import path from 'path';
import fs from 'fs';
import { VehicleBatch, Vehicle } from '../domain/vehicle.js';
import { config } from '../server/config.js';
import { createSecureDirectory, assertInsideRoot, validateImageSignature } from '../server/secure-filesystem.js';
import { PlateOcrService, MockPlateOcrProvider } from './plate-ocr-service.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';
import { auditLogger } from '../server/audit-logger.js';

// Extensoes aceitas na pasta de origem (JPG da camera e RAW).
const EXTENSOES_FOTO = ['.jpg', '.jpeg', '.png', '.webp', '.cr2', '.cr3', '.nef', '.arw', '.dng'];

// Ultima pasta lida. As miniaturas so podem sair daqui.
let pastaOrigemAtual = null;

/**
 * Serviço de Veículos
 * Gerencia importação, QA e entrega de fotos de veículos
 */
export class VehicleService {
  constructor() {
    this.ocrService = new PlateOcrService(new MockPlateOcrProvider());
  }

  /**
   * Le uma pasta de origem (cartao de memoria ou qualquer outra) e devolve as
   * fotos na ordem em que foram tiradas.
   *
   * A pasta e escolhida pelo usuario, entao nao da para prende-la a uma raiz
   * como no resto do sistema. A protecao vem de outro lado: so arquivo de
   * imagem de verdade entra na lista, e a pasta lida fica guardada para ser a
   * unica de onde as miniaturas podem ser servidas depois.
   */
  static async scanFolder(caminho) {
    try {
      if (!caminho || typeof caminho !== 'string') {
        return { ok: false, error: 'Informe a pasta das fotos' };
      }

      const pasta = path.resolve(caminho.trim());

      let stats;
      try {
        stats = await fs.promises.stat(pasta);
      } catch {
        return { ok: false, error: `Pasta nao encontrada: ${pasta}` };
      }
      if (!stats.isDirectory()) {
        return { ok: false, error: 'O caminho informado nao e uma pasta' };
      }

      const entries = await fs.promises.readdir(pasta, { withFileTypes: true });
      const fotos = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!EXTENSOES_FOTO.includes(path.extname(entry.name).toLowerCase())) continue;

        const filePath = path.join(pasta, entry.name);
        try {
          // Descarta arquivo que so tem nome de imagem.
          await validateImageSignature(filePath);
        } catch {
          continue;
        }

        const info = await fs.promises.stat(filePath);
        fotos.push({
          name: entry.name,
          path: filePath,
          size: info.size,
          modified: info.mtime.toISOString(),
          mtimeMs: info.mtimeMs
        });
      }

      // A sequencia e o que separa um veiculo do outro, entao a ordem importa:
      // hora da foto primeiro, nome como desempate para cartao que zera o mtime.
      fotos.sort((a, b) => (a.mtimeMs - b.mtimeMs) || a.name.localeCompare(b.name));
      fotos.forEach((foto, i) => {
        foto.sequencia = i + 1;
        delete foto.mtimeMs;
      });

      pastaOrigemAtual = pasta;

      return { ok: true, data: { pasta, fotos, total: fotos.length } };
    } catch (err) {
      return { ok: false, error: `Nao foi possivel ler a pasta: ${err.message}` };
    }
  }

  /**
   * Caminho de uma foto da pasta lida. So serve arquivo de dentro dela - sem
   * isso o endpoint de miniatura viraria um leitor de qualquer arquivo do disco.
   */
  static async resolveFolderPhoto(filename) {
    if (!pastaOrigemAtual) throw new Error('Nenhuma pasta foi lida ainda');
    if (filename !== path.basename(filename)) throw new Error(`Path traversal attempt: ${filename}`);

    const filePath = path.resolve(pastaOrigemAtual, filename);
    assertInsideRoot(filePath, pastaOrigemAtual);
    await validateImageSignature(filePath);
    return filePath;
  }

  /**
   * Importa a pasta lida agrupando pelas placas informadas.
   *
   * Cada foto marcada com placa abre um veiculo; as seguintes, sem placa,
   * entram nele - que e como a sequencia sai da camera (placa, carro, carro,
   * placa, ...). Foto antes da primeira placa nao pertence a veiculo nenhum e e
   * devolvida em ignoradas, para a tela poder avisar em vez de sumir com ela.
   *
   * A placa vem do usuario, nao do OCR: com o provider atual nenhuma foto real
   * e reconhecida, e mesmo com OCR de verdade a leitura falha o suficiente para
   * exigir conferencia. Quando houver OCR, ele entra sugerindo este campo.
   */
  static async importFromFolder(lote, fotos) {
    try {
      if (!lote) return { ok: false, error: 'Informe o lote' };
      if (!Array.isArray(fotos) || fotos.length === 0) {
        return { ok: false, error: 'Nenhuma foto para importar' };
      }

      const batch = new VehicleBatch(lote);
      const ignoradas = [];
      let veiculoAtual = null;

      for (const foto of fotos) {
        const placa = String(foto.placa || '').trim().toUpperCase();

        if (placa) {
          veiculoAtual = batch.getOrCreateVehicle(placa);
          veiculoAtual.manifest.origin = 'memory_card';
          veiculoAtual.manifest.importedAt = new Date().toISOString();
        }

        if (!veiculoAtual) {
          ignoradas.push(foto.name);
          continue;
        }

        const caminho = await this.resolveFolderPhoto(foto.name);
        veiculoAtual.addPhoto(foto.name, caminho, veiculoAtual.photos.length + 1);
        if (placa) veiculoAtual.photos[veiculoAtual.photos.length - 1].markAsPlatePhoto();
      }

      const veiculos = batch.getAllVehicles();
      if (veiculos.length === 0) {
        return {
          ok: false,
          error: 'Nenhuma placa foi informada: marque a foto da placa de cada veiculo'
        };
      }

      const saveResult = await VehicleRepository.saveBatch(batch);
      if (!saveResult.ok) throw new Error(`Failed to save batch: ${saveResult.error}`);

      await auditLogger.log('VEHICLE_IMPORT', {
        lote,
        vehiclesImported: veiculos.length,
        totalPhotos: fotos.length - ignoradas.length,
        ignoradas: ignoradas.length,
        origem: pastaOrigemAtual
      });

      return {
        ok: true,
        data: {
          lote,
          vehiclesImported: veiculos.length,
          totalPhotos: fotos.length - ignoradas.length,
          ignoradas,
          veiculos: veiculos.map(v => ({ placa: v.placa, fotos: v.photos.length }))
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Importa fotos de origem (cartão de memória)
   * Processa com OCR e agrupa por placa
   */
  static async importVehiclePhotos(lote, photos) {
    try {
      const ocrService = new PlateOcrService();

      // Processa sequência com OCR
      const processResult = await ocrService.processPhotoSequence(photos);

      if (!processResult.ok) {
        throw new Error(processResult.error);
      }

      // Cria batch e veículos
      const batch = new VehicleBatch(lote);

      for (const group of processResult.data.groups) {
        const vehicle = batch.getOrCreateVehicle(group.plate);

        // Define OCR da placa
        if (group.ocrResult) {
          vehicle.setPlateOcr(group.ocrResult);
        }

        // Adiciona fotos
        for (const photo of group.photos) {
          vehicle.addPhoto(photo.name, photo.path, photo.sequence);
          const v_photo = vehicle.photos[vehicle.photos.length - 1];
          if (photo.isPlatePhoto) {
            v_photo.markAsPlatePhoto();
          }
        }

        vehicle.manifest.origin = 'memory_card';
        vehicle.manifest.importedAt = new Date().toISOString();
      }

      // Salva batch
      const saveResult = await VehicleRepository.saveBatch(batch);
      if (!saveResult.ok) {
        throw new Error(`Failed to save batch: ${saveResult.error}`);
      }

      await auditLogger.log('VEHICLE_IMPORT', {
        lote,
        vehiclesImported: batch.getAllVehicles().length,
        totalPhotos: processResult.data.totalPhotos
      });

      return {
        ok: true,
        data: {
          lote,
          vehiclesImported: batch.getAllVehicles().length,
          totalPhotos: processResult.data.totalPhotos,
          batch: batch.toJSON()
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Carrega veículos de um lote
   */
  static async loadVehicles(lote) {
    try {
      const batchResult = await VehicleRepository.loadBatch(lote);
      if (!batchResult.ok) {
        return { ok: false, error: batchResult.error };
      }

      const batch = batchResult.data;

      return {
        ok: true,
        data: {
          lote,
          vehicles: batch.getAllVehicles().map(v => ({
            placa: v.placa,
            fotos: v.photos.length,
            status: v.status,
            ocrConfidence: v.plateOcr?.confidence
          })),
          count: batch.getAllVehicles().length,
          totalPhotos: batch.getTotalPhotos()
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Reordena fotos de um veículo
   */
  static async reorderPhotos(lote, placa, reorderList) {
    try {
      const vehicleResult = await VehicleRepository.loadVehicle(lote, placa);
      if (!vehicleResult.ok) {
        return { ok: false, error: vehicleResult.error };
      }

      const vehicle = vehicleResult.data;

      // Aplica reordenação
      for (const change of reorderList) {
        vehicle.reorderPhoto(change.from, change.to);
      }

      // Persiste
      const saveResult = await VehicleRepository.saveVehicle(lote, vehicle);
      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }

      await auditLogger.log('VEHICLE_REORDER', {
        lote,
        placa,
        changes: reorderList.length
      });

      return {
        ok: true,
        data: {
          reordered: reorderList.length,
          message: 'Photos reordered successfully'
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Marca veículo como pronto para entrega
   */
  static async completeVehicleQa(lote, placa) {
    try {
      const vehicleResult = await VehicleRepository.loadVehicle(lote, placa);
      if (!vehicleResult.ok) {
        return { ok: false, error: vehicleResult.error };
      }

      const vehicle = vehicleResult.data;

      // Muda status
      vehicle.status = 'pronto_para_entrega';
      vehicle.updatedAt = new Date().toISOString();

      // Persiste
      const saveResult = await VehicleRepository.saveVehicle(lote, vehicle);
      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }

      await auditLogger.log('VEHICLE_QA_COMPLETE', {
        lote,
        placa
      });

      return {
        ok: true,
        data: {
          status: 'pronto_para_entrega',
          message: 'Vehicle ready for delivery'
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Entrega veículos para ADSET (mock)
   */
  static async deliverToAdset(lote, placa) {
    try {
      const vehicleResult = await VehicleRepository.loadVehicle(lote, placa);
      if (!vehicleResult.ok) {
        return { ok: false, error: vehicleResult.error };
      }

      const vehicle = vehicleResult.data;

      // Valida pré-requisitos
      if (vehicle.photos.length === 0) {
        return { ok: false, error: 'No photos to deliver' };
      }

      if (!vehicle.plateOcr || !vehicle.plateOcr.isReliable()) {
        return { ok: false, error: 'Plate OCR not reliable enough' };
      }

      // Simula entrega ADSET
      vehicle.status = 'entregue';
      vehicle.updatedAt = new Date().toISOString();

      // Persiste
      const saveResult = await VehicleRepository.saveVehicle(lote, vehicle);
      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }

      await auditLogger.log('VEHICLE_DELIVER', {
        lote,
        placa,
        destination: 'adset_mock',
        photosDelivered: vehicle.photos.length
      });

      return {
        ok: true,
        data: {
          status: 'entregue',
          message: 'Vehicle delivered to ADSET (mock)',
          photosDelivered: vehicle.photos.length
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Gera relatório de veículos
   */
  static async generateReport(filters = {}) {
    try {
      const { lote = null, status = null } = filters;

      const listResult = await VehicleRepository.listBatches();
      if (!listResult.ok) {
        return { ok: false, error: listResult.error };
      }

      let items = [];
      for (const batchLote of listResult.data) {
        if (lote && batchLote !== lote) continue;

        const batchResult = await VehicleRepository.loadBatch(batchLote);
        if (!batchResult.ok) continue;

        const batch = batchResult.data;
        for (const vehicle of batch.getAllVehicles()) {
          if (status && vehicle.status !== status) continue;

          items.push({
            lote: vehicle.lote,
            placa: vehicle.placa,
            fotos: vehicle.photos.length,
            status: vehicle.status,
            plataforma: vehicle.plateOcr ? 'Detectada' : 'Pendente',
            confianca: vehicle.plateOcr?.confidence || 0,
            criadoEm: vehicle.createdAt
          });
        }
      }

      const stats = {
        total: items.length,
        entregues: items.filter(i => i.status === 'entregue').length,
        pendentes: items.filter(i => i.status === 'pendente_qa').length,
        pronto: items.filter(i => i.status === 'pronto_para_entrega').length
      };

      return {
        ok: true,
        data: {
          items,
          stats
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default VehicleService;
