import path from 'path';
import { VehicleBatch, Vehicle } from '../domain/vehicle.js';
import { config } from '../server/config.js';
import { createSecureDirectory } from '../server/secure-filesystem.js';
import { PlateOcrService, MockPlateOcrProvider } from './plate-ocr-service.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';
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
