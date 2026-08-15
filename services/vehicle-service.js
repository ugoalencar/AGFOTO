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

  // ---- Modelo por data -------------------------------------------------
  // Carro nao tem lote: o que agrupa e o dia em que as fotos foram carregadas.
  // Em disco fica Carros/DD-MM-YYYY/PLACA/PLACA_indice.ext, e a pasta manda -
  // criar placa e mover foto sao operacoes de pasta, iguais as do produto.

  static dataDeHoje() {
    const agora = new Date();
    const dois = n => String(n).padStart(2, '0');
    return `${dois(agora.getDate())}-${dois(agora.getMonth() + 1)}-${agora.getFullYear()}`;
  }

  static normalizarData(valor) {
    const data = String(valor || '').trim();
    if (!/^\d{2}-\d{2}-\d{4}$/.test(data)) {
      throw new Error(`Data invalida (use DD-MM-AAAA): ${valor}`);
    }
    return data;
  }

  static normalizarPlaca(valor) {
    const placa = String(valor || '').trim().toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{5,8}$/.test(placa)) {
      throw new Error(`Placa invalida: ${valor}`);
    }
    return placa;
  }

  static pastaDoDia(data) {
    return path.join(config.paths.carros, this.normalizarData(data));
  }

  static pastaDaPlaca(data, placa) {
    return path.join(this.pastaDoDia(data), this.normalizarPlaca(placa));
  }

  /**
   * Proximo indice livre de uma placa, para nao sobrescrever ao mover fotos.
   */
  static async proximoIndice(dir, placa) {
    let arquivos = [];
    try {
      arquivos = await fs.promises.readdir(dir);
    } catch {
      return 0;
    }
    const padrao = new RegExp(`^${placa}_(\\d+)`);
    let proximo = 0;
    for (const nome of arquivos) {
      const m = nome.match(padrao);
      if (m) proximo = Math.max(proximo, parseInt(m[1], 10) + 1);
    }
    return proximo;
  }

  /**
   * Copia as fotos da pasta de origem para Carros/DD-MM-YYYY/PLACA.
   *
   * A foto marcada com placa abre um veiculo e as seguintes pertencem a ele. O
   * original nao e apagado: o cartao continua sendo a copia de seguranca ate o
   * usuario decidir limpar.
   */
  static async importarParaData(data, fotos) {
    try {
      const dia = this.normalizarData(data);
      if (!Array.isArray(fotos) || fotos.length === 0) {
        return { ok: false, error: 'Nenhuma foto para importar' };
      }

      const grupos = [];
      const ignoradas = [];
      let atual = null;

      for (const foto of fotos) {
        const bruta = String(foto.placa || '').trim();
        if (bruta) {
          const placa = this.normalizarPlaca(bruta);
          atual = grupos.find(g => g.placa === placa);
          if (!atual) {
            atual = { placa, fotos: [] };
            grupos.push(atual);
          }
        }
        if (!atual) {
          ignoradas.push(foto.name);
          continue;
        }
        atual.fotos.push(foto.name);
      }

      if (grupos.length === 0) {
        return { ok: false, error: 'Nenhuma placa informada: marque a foto da placa de cada veiculo' };
      }

      const copiadas = [];
      for (const grupo of grupos) {
        const destino = this.pastaDaPlaca(dia, grupo.placa);
        await fs.promises.mkdir(destino, { recursive: true });
        let indice = await this.proximoIndice(destino, grupo.placa);

        for (const nome of grupo.fotos) {
          const origem = await this.resolveFolderPhoto(nome);
          const ext = path.extname(nome);
          const alvo = path.join(destino, `${grupo.placa}_${indice}${ext}`);
          await fs.promises.copyFile(origem, alvo);
          copiadas.push({ placa: grupo.placa, arquivo: path.basename(alvo) });
          indice++;
        }
      }

      await auditLogger.log('VEHICLE_IMPORT', {
        data: dia,
        placas: grupos.length,
        fotos: copiadas.length,
        ignoradas: ignoradas.length,
        origem: pastaOrigemAtual
      });

      return {
        ok: true,
        data: { data: dia, placas: grupos.length, fotos: copiadas.length, ignoradas }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Placas de um dia, lidas do disco (a pasta e a fonte, como nos produtos).
   */
  static async listarPorData(data) {
    try {
      const dia = this.normalizarData(data);
      const raiz = this.pastaDoDia(dia);

      let entries;
      try {
        entries = await fs.promises.readdir(raiz, { withFileTypes: true });
      } catch {
        return { ok: true, data: { data: dia, placas: [], total: 0 } };
      }

      const placas = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirPlaca = path.join(raiz, entry.name);
        const arquivos = (await fs.promises.readdir(dirPlaca))
          .filter(nome => EXTENSOES_FOTO.includes(path.extname(nome).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        placas.push({
          placa: entry.name,
          fotos: arquivos.map(nome => ({
            name: nome,
            url: `/api/carros/foto/${encodeURIComponent(dia)}/${encodeURIComponent(entry.name)}/${encodeURIComponent(nome)}`
          })),
          total: arquivos.length
        });
      }

      placas.sort((a, b) => a.placa.localeCompare(b.placa));
      return {
        ok: true,
        data: { data: dia, placas, total: placas.reduce((s, p) => s + p.total, 0) }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Cria uma placa vazia no dia. Serve para o caso de faltar a foto da placa e
   * dois carros terem ficado juntos: cria-se a placa certa e arrastam-se as
   * fotos que sao dela.
   */
  static async criarPlaca(data, placa) {
    try {
      const dia = this.normalizarData(data);
      const nome = this.normalizarPlaca(placa);
      const destino = this.pastaDaPlaca(dia, nome);

      try {
        await fs.promises.mkdir(destino, { recursive: false });
      } catch (err) {
        if (err.code === 'EEXIST') return { ok: false, error: `A placa ${nome} ja existe neste dia` };
        throw err;
      }

      await auditLogger.log('VEHICLE_PLATE_CREATED', { data: dia, placa: nome });
      return { ok: true, data: { data: dia, placa: nome } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Move uma foto de uma placa para outra, renomeando para a placa de destino.
   * Sem renomear, o arquivo diria uma placa e estaria dentro de outra.
   */
  static async moverFoto(data, dePlaca, paraPlaca, filename) {
    try {
      const dia = this.normalizarData(data);
      const origemPlaca = this.normalizarPlaca(dePlaca);
      const destinoPlaca = this.normalizarPlaca(paraPlaca);
      if (origemPlaca === destinoPlaca) return { ok: false, error: 'Placa de origem e destino sao a mesma' };
      if (filename !== path.basename(filename)) throw new Error(`Path traversal attempt: ${filename}`);

      const dirOrigem = this.pastaDaPlaca(dia, origemPlaca);
      const dirDestino = this.pastaDaPlaca(dia, destinoPlaca);
      const origem = assertInsideRoot(path.resolve(dirOrigem, filename), dirOrigem);

      await fs.promises.stat(origem);
      await fs.promises.mkdir(dirDestino, { recursive: true });

      const ext = path.extname(filename);
      const indice = await this.proximoIndice(dirDestino, destinoPlaca);
      const destino = path.join(dirDestino, `${destinoPlaca}_${indice}${ext}`);

      await fs.promises.rename(origem, destino);

      await auditLogger.log('VEHICLE_PHOTO_MOVED', {
        data: dia, de: origemPlaca, para: destinoPlaca, arquivo: filename, virou: path.basename(destino)
      });

      return { ok: true, data: { de: origemPlaca, para: destinoPlaca, arquivo: path.basename(destino) } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Caminho de uma foto ja importada, para servir a miniatura.
   */
  static async resolveVehiclePhoto(data, placa, filename) {
    const dir = this.pastaDaPlaca(data, placa);
    if (filename !== path.basename(filename)) throw new Error(`Path traversal attempt: ${filename}`);
    const filePath = assertInsideRoot(path.resolve(dir, filename), dir);
    await validateImageSignature(filePath);
    return filePath;
  }

  /**
   * Dias que ja tem fotos importadas.
   */
  static async listarDatas() {
    try {
      const entries = await fs.promises.readdir(config.paths.carros, { withFileTypes: true })
        .catch(() => []);
      const datas = entries
        .filter(e => e.isDirectory() && /^\d{2}-\d{2}-\d{4}$/.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse();
      return { ok: true, data: { datas } };
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
