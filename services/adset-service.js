import path from 'path';
import { MockAdsetProvider, RealAdsetProvider } from './adset-provider.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';
import { config } from '../server/config.js';
import { auditLogger } from '../server/audit-logger.js';

/**
 * Serviço ADSET
 * Gerencia integração com plataforma ADSET
 * Suporta: Mock (dev), Real (Playwright), Dry-run (simulação)
 */
export class AdsetService {
  constructor(options = {}) {
    this.mode = options.mode || 'mock'; // 'mock', 'real', 'dry-run'
    this.provider = this.createProvider();
    this.sessionId = null;
    this.dryRunResults = [];
  }

  /**
   * Factory para criar provider apropriado
   */
  createProvider() {
    switch (this.mode) {
      case 'real':
        return new RealAdsetProvider({
          baseUrl: config.adset?.baseUrl || 'https://www.adset.com.br',
          email: config.adset?.email,
          password: config.adset?.password
        });
      case 'dry-run':
        return new MockAdsetProvider(); // Simula tudo
      case 'mock':
      default:
        return new MockAdsetProvider();
    }
  }

  /**
   * Efetua login
   */
  async login(email, password) {
    try {
      const result = await this.provider.login(email, password);
      if (result.ok) {
        this.sessionId = result.sessionId;
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Valida se veículo pode ser entregue
   */
  async validateVehicle(lote, placa) {
    try {
      if (!this.sessionId) {
        return { ok: false, error: 'Not logged in' };
      }

      // Carrega veículo
      const vehicleResult = await VehicleRepository.loadVehicle(lote, placa);
      if (!vehicleResult.ok) {
        return { ok: false, error: 'Vehicle not found' };
      }

      const vehicle = vehicleResult.data;

      // Valida pré-requisitos
      const validations = {
        hasPhotos: vehicle.photos.length > 0,
        hasOcr: vehicle.plateOcr !== null,
        ocrReliable: vehicle.plateOcr?.isReliable() || false,
        photoCount: vehicle.photos.length
      };

      if (!validations.hasPhotos) {
        return { ok: false, error: 'Vehicle has no photos' };
      }

      if (!validations.hasOcr || !validations.ocrReliable) {
        return { ok: false, error: 'Plate OCR not reliable enough' };
      }

      // Valida unicidade de placa
      const uniqueResult = await this.provider.validatePlateUnique(this.sessionId, placa);
      if (!uniqueResult.ok) {
        return { ok: false, error: uniqueResult.error };
      }

      if (!uniqueResult.unique) {
        return {
          ok: false,
          error: `Plate ${placa} already exists in ADSET (status: ${uniqueResult.existing})`
        };
      }

      return {
        ok: true,
        data: {
          lote,
          placa,
          validations,
          message: 'Vehicle is valid for delivery'
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Entrega veículo para ADSET (real ou dry-run)
   */
  async deliverVehicle(lote, placa) {
    try {
      if (!this.sessionId) {
        return { ok: false, error: 'Not logged in' };
      }

      // Valida veículo
      const validation = await this.validateVehicle(lote, placa);
      if (!validation.ok) {
        return validation;
      }

      // Carrega dados para entrega
      const vehicleResult = await VehicleRepository.loadVehicle(lote, placa);
      const vehicle = vehicleResult.data;

      // Em dry-run, apenas registra sem realmente enviar
      if (this.mode === 'dry-run') {
        const dryRun = {
          timestamp: new Date().toISOString(),
          lote,
          placa,
          photosCount: vehicle.photos.length,
          ocrConfidence: vehicle.plateOcr.confidence,
          status: 'DRY_RUN_APPROVED',
          message: `Would submit ${placa} with ${vehicle.photos.length} photos`
        };

        this.dryRunResults.push(dryRun);

        await auditLogger.log('ADSET_DRY_RUN', {
          lote,
          placa,
          photosCount: vehicle.photos.length,
          mode: 'dry-run'
        });

        return {
          ok: true,
          data: dryRun
        };
      }

      // Prepara dados para envio
      const deliveryData = {
        placa: vehicle.placa,
        fotos: vehicle.photos.map(p => ({
          path: p.path,
          filename: p.filename
        }))
      };

      // Envia para ADSET
      const submitResult = await this.provider.submitVehicle(this.sessionId, deliveryData);

      if (submitResult.ok) {
        // Atualiza status do veículo
        vehicle.status = 'entregue';
        vehicle.updatedAt = new Date().toISOString();
        await VehicleRepository.saveVehicle(lote, vehicle);

        await auditLogger.log('ADSET_DELIVER_SUCCESS', {
          lote,
          placa,
          vehicleId: submitResult.vehicleId,
          photosCount: vehicle.photos.length,
          ocrConfidence: vehicle.plateOcr.confidence,
          mode: this.mode
        });

        return {
          ok: true,
          data: {
            lote,
            placa,
            vehicleId: submitResult.vehicleId,
            status: 'entregue',
            message: submitResult.message,
            photosDelivered: vehicle.photos.length
          }
        };
      } else {
        await auditLogger.log('ADSET_DELIVER_FAILED', {
          lote,
          placa,
          error: submitResult.error,
          mode: this.mode
        });

        return { ok: false, error: submitResult.error };
      }
    } catch (err) {
      await auditLogger.log('ADSET_DELIVER_ERROR', {
        error: err.message
      });
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista veículos publicados no ADSET
   */
  async listPublished() {
    try {
      if (!this.sessionId) {
        return { ok: false, error: 'Not logged in' };
      }

      const result = await this.provider.fetchPublished(this.sessionId);

      if (result.ok) {
        await auditLogger.log('ADSET_LIST_PUBLISHED', {
          count: result.published?.length || 0,
          mode: this.mode
        });
      }

      return result;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista veículos em rascunho
   */
  async listUnpublished() {
    try {
      if (!this.sessionId) {
        return { ok: false, error: 'Not logged in' };
      }

      const result = await this.provider.fetchUnpublished(this.sessionId);

      if (result.ok) {
        await auditLogger.log('ADSET_LIST_UNPUBLISHED', {
          count: result.unpublished?.length || 0,
          mode: this.mode
        });
      }

      return result;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Relatório de entregas (dry-run)
   */
  getDryRunReport() {
    return {
      ok: true,
      data: {
        mode: this.mode,
        dryRunsExecuted: this.dryRunResults.length,
        results: this.dryRunResults
      }
    };
  }

  /**
   * Limpa dry-run results
   */
  clearDryRun() {
    this.dryRunResults = [];
    return { ok: true, message: 'Dry-run cleared' };
  }

  /**
   * Logout
   */
  async logout() {
    try {
      if (this.sessionId) {
        const result = await this.provider.logout(this.sessionId);
        this.sessionId = null;
        return result;
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default AdsetService;
