import path from 'path';
import { VehicleBatch } from '../domain/vehicle.js';
import jsonPersistence from '../server/json-persistence.js';
import { createSecureDirectory } from '../server/secure-filesystem.js';
import { config } from '../server/config.js';

const getVehiclesDir = () => path.join(config.dataPath, 'jsons');

/**
 * Repositório de Veículos
 * Persistência em JSON por lote
 */
export class VehicleRepository {
  /**
   * Obtém nome arquivo batch
   */
  static getBatchFilename(lote) {
    return `Veiculo_${String(lote).padStart(3, '0')}.json`;
  }

  /**
   * Carrega batch de veículos
   */
  static async loadBatch(lote) {
    try {
      await createSecureDirectory(getVehiclesDir());
      const filename = this.getBatchFilename(lote);
      const filepath = path.join(getVehiclesDir(), filename);

      const result = await jsonPersistence.readJsonSafe(filepath);
      return { ok: true, data: VehicleBatch.fromJSON(result || { lote, vehicles: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) };
    } catch (err) {
      // Se não existe arquivo, retorna batch vazio
      if (err.code === 'ENOENT') {
        return { ok: true, data: new VehicleBatch(lote) };
      }
      return { ok: false, error: err.message };
    }
  }

  /**
   * Salva batch de veículos
   */
  static async saveBatch(batch) {
    try {
      await createSecureDirectory(getVehiclesDir());
      const filename = this.getBatchFilename(batch.lote);
      const filepath = path.join(getVehiclesDir(), filename);

      batch.updatedAt = new Date().toISOString();
      await jsonPersistence.writeJsonAtomic(filepath, batch.toJSON());
      return { ok: true, data: { saved: true, filepath } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Carrega vehicle específico de um batch
   */
  static async loadVehicle(lote, placa) {
    try {
      const batchResult = await this.loadBatch(lote);
      if (!batchResult.ok) return batchResult;

      const vehicle = batchResult.data.getOrCreateVehicle(placa);
      return { ok: true, data: vehicle };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Salva vehicle em seu batch
   */
  static async saveVehicle(lote, vehicle) {
    try {
      const batchResult = await this.loadBatch(lote);
      if (!batchResult.ok) return batchResult;

      const batch = batchResult.data;
      batch.vehicles.set(vehicle.placa, vehicle);

      return this.saveBatch(batch);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista batches de veículos
   */
  static async listBatches() {
    try {
      await createSecureDirectory(getVehiclesDir());

      const fs = (await import('fs')).promises;
      const files = await fs.readdir(getVehiclesDir());

      const batches = files
        .filter(f => f.startsWith('Veiculo_') && f.endsWith('.json'))
        .map(f => {
          const match = f.match(/Veiculo_(\d+)\.json/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      return { ok: true, data: batches };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { ok: true, data: [] };
      }
      return { ok: false, error: err.message };
    }
  }
}

export default VehicleRepository;
