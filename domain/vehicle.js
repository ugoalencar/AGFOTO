import { v4 as uuidv4 } from 'uuid';

/**
 * Resultado de OCR de placa
 */
export class PlateOcrResult {
  constructor(rawText, normalizedText = null, format = null, confidence = 0) {
    this.id = uuidv4();
    this.rawText = rawText;
    this.normalizedText = normalizedText;
    this.format = format; // 'old', 'mercosul', or 'unknown'
    this.confidence = confidence; // 0-100
    this.detectedAt = new Date().toISOString();
  }

  /**
   * Valida se placa é confiável (>80%)
   */
  isReliable() {
    return this.confidence >= 80;
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      id: this.id,
      rawText: this.rawText,
      normalizedText: this.normalizedText,
      format: this.format,
      confidence: this.confidence,
      detectedAt: this.detectedAt
    };
  }

  static fromJSON(data) {
    const result = new PlateOcrResult(
      data.rawText,
      data.normalizedText,
      data.format,
      data.confidence
    );
    result.id = data.id;
    result.detectedAt = data.detectedAt;
    return result;
  }
}

/**
 * Foto de veículo com metadados
 */
export class VehiclePhoto {
  constructor(filename, path, sequence) {
    this.filename = filename;
    this.path = path;
    this.sequence = sequence; // 1-based order
    this.size = 0;
    this.hash = null;
    this.uploadedAt = null;
    this.isPlatePhoto = false; // Primeira foto é placa
  }

  /**
   * Marca como foto de placa
   */
  markAsPlatePhoto() {
    this.isPlatePhoto = true;
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      filename: this.filename,
      path: this.path,
      sequence: this.sequence,
      size: this.size,
      hash: this.hash,
      uploadedAt: this.uploadedAt,
      isPlatePhoto: this.isPlatePhoto
    };
  }
}

/**
 * Veículo com fotos e OCR
 */
export class Vehicle {
  constructor(lote, placa) {
    this.id = uuidv4();
    this.lote = lote;
    this.placa = String(placa).toUpperCase().trim();
    this.photos = [];
    this.plateOcr = null;
    this.status = 'pendente_qa'; // ou 'entregue', 'erro_entrega'
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.manifest = {
      origin: null,
      importedAt: null,
      totalPhotos: 0,
      ocrData: null,
      history: []
    };
  }

  /**
   * Adiciona foto ao veículo
   */
  addPhoto(filename, path, sequence) {
    const photo = new VehiclePhoto(filename, path, sequence);
    this.photos.push(photo);
    this.manifest.totalPhotos = this.photos.length;
    return photo;
  }

  /**
   * Define OCR de placa
   */
  setPlateOcr(ocrResult) {
    this.plateOcr = ocrResult;
    this.manifest.ocrData = ocrResult.toJSON();
  }

  /**
   * Reordena fotos
   */
  reorderPhoto(fromSequence, toSequence) {
    const photo = this.photos.find(p => p.sequence === fromSequence);
    if (!photo) throw new Error('Photo not found');

    this.photos.forEach(p => {
      if (p.sequence === fromSequence) {
        p.sequence = toSequence;
      } else if (toSequence > fromSequence && p.sequence <= toSequence && p.sequence > fromSequence) {
        p.sequence--;
      } else if (toSequence < fromSequence && p.sequence >= toSequence && p.sequence < fromSequence) {
        p.sequence++;
      }
    });

    this.photos.sort((a, b) => a.sequence - b.sequence);
    this.manifest.history.push({
      action: 'reorder',
      from: fromSequence,
      to: toSequence,
      at: new Date().toISOString()
    });
  }

  /**
   * Normaliza placa brasileira
   */
  static normalizePlate(placa) {
    if (!placa) return null;

    const norm = String(placa)
      .toUpperCase()
      .trim()
      .replace(/[-\s]/g, '');

    // Valida: 3 letras + 4 dígitos (antigo) ou 3 letras + 1 dígito + 1 letra + 2 dígitos (Mercosul)
    if (/^[A-Z]{3}\d{4}$/.test(norm)) {
      return norm; // Antigo: ABC1234
    }
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(norm)) {
      return norm; // Mercosul: ABC1D23
    }

    return norm; // Retorna como está se não match padrão
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      id: this.id,
      lote: this.lote,
      placa: this.placa,
      photos: this.photos.map(p => p.toJSON()),
      plateOcr: this.plateOcr?.toJSON(),
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      manifest: this.manifest
    };
  }

  static fromJSON(data) {
    const vehicle = new Vehicle(data.lote, data.placa);
    vehicle.id = data.id;
    vehicle.photos = data.photos.map(p => {
      const photo = new VehiclePhoto(p.filename, p.path, p.sequence);
      photo.size = p.size;
      photo.hash = p.hash;
      photo.uploadedAt = p.uploadedAt;
      photo.isPlatePhoto = p.isPlatePhoto;
      return photo;
    });
    if (data.plateOcr) {
      vehicle.plateOcr = PlateOcrResult.fromJSON(data.plateOcr);
    }
    vehicle.status = data.status;
    vehicle.createdAt = data.createdAt;
    vehicle.updatedAt = data.updatedAt;
    vehicle.manifest = data.manifest;
    return vehicle;
  }
}

/**
 * Batch de veículos para um lote
 */
export class VehicleBatch {
  constructor(lote) {
    this.lote = lote;
    this.vehicles = new Map(); // placa -> Vehicle
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Adiciona ou obtém veículo
   */
  getOrCreateVehicle(placa) {
    const normalizedPlate = Vehicle.normalizePlate(placa);
    if (!this.vehicles.has(normalizedPlate)) {
      this.vehicles.set(normalizedPlate, new Vehicle(this.lote, normalizedPlate));
    }
    return this.vehicles.get(normalizedPlate);
  }

  /**
   * Lista todos os veículos
   */
  getAllVehicles() {
    return Array.from(this.vehicles.values());
  }

  /**
   * Conta por status
   */
  countByStatus(status) {
    return Array.from(this.vehicles.values())
      .filter(v => v.status === status).length;
  }

  /**
   * Total de fotos
   */
  getTotalPhotos() {
    return Array.from(this.vehicles.values())
      .reduce((sum, v) => sum + v.photos.length, 0);
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      lote: this.lote,
      vehicles: Array.from(this.vehicles.entries()).map(([placa, vehicle]) => ({
        placa,
        data: vehicle.toJSON()
      })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(data) {
    const batch = new VehicleBatch(data.lote);
    for (const { placa, data: vehicleData } of data.vehicles) {
      batch.vehicles.set(placa, Vehicle.fromJSON(vehicleData));
    }
    batch.createdAt = data.createdAt;
    batch.updatedAt = data.updatedAt;
    return batch;
  }
}

export default {
  PlateOcrResult,
  VehiclePhoto,
  Vehicle,
  VehicleBatch
};
