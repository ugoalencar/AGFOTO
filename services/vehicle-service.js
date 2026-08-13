import path from 'path';
import { VehicleBatch, Vehicle } from '../domain/vehicle.js';
import { config } from '../server/config.js';
import { createSecureDirectory } from '../server/secure-filesystem.js';
import { PlateOcrService, MockPlateOcrProvider } from './plate-ocr-service.js';
import { auditLogger } from '../server/audit-logger.js';

/**
 * Serviço de Veículos
 * Gerencia importação, QA e entrega de fotos de veículos
 */
export class VehicleService {
  constructor() {
    this.ocrService = new PlateOcrService(new MockPlateOcrProvider());
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
      // TODO: Implementar persistência em JSON

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
      // TODO: Carregar de JSON persistido
      // Por agora retorna batch vazio
      const batch = new VehicleBatch(lote);

      return {
        ok: true,
        data: {
          lote,
          vehicles: batch.getAllVehicles().map(v => ({
            placa: v.placa,
            fotos: v.photos.length,
            status: v.status
          })),
          count: batch.getAllVehicles().length
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
      // TODO: Carregar vehicle, reordenar, salvar

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
      // TODO: Carregar vehicle, mudar status, salvar

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
   * Entrega veículos para ADSET
   */
  static async deliverToAdset(lote, placa) {
    try {
      // TODO: Integração ADSET (mock por agora)

      await auditLogger.log('VEHICLE_DELIVER', {
        lote,
        placa,
        destination: 'adset_mock'
      });

      return {
        ok: true,
        data: {
          status: 'entregue',
          message: 'Vehicle delivered to ADSET (mock)'
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

      // TODO: Carregar dados reais de JSON

      return {
        ok: true,
        data: {
          items: [],
          stats: {
            total: 0,
            entregues: 0,
            pendentes: 0,
            erros: 0
          }
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default VehicleService;
