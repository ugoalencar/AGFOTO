import { v4 as uuidv4 } from 'uuid';

/**
 * Tipos de entrega
 */
export const DeliveryType = {
  NORMAL: 'normal',           // Fotos da raiz
  ATUALIZACAO: 'atualizacao'  // Fotos do AT/
};

/**
 * Estados de entrega
 */
export const DeliveryStatus = {
  PENDING: 'pendente',
  STAGING: 'staging',
  IN_PROGRESS: 'entregando',
  COMPLETED: 'entregue',
  FAILED: 'erro_entrega',
  VERIFYING: 'verificando'
};

/**
 * Manifest de entrega
 * Registra metadados sobre o que foi enviado
 */
export class Manifest {
  constructor(lote, gtin, codigo, deliveryType = DeliveryType.NORMAL) {
    this.id = uuidv4();
    this.lote = lote;
    this.gtin = gtin;
    this.codigo = codigo;
    this.deliveryType = deliveryType;
    this.files = [];
    this.totalSize = 0;
    this.fileCount = 0;
    this.createdAt = new Date().toISOString();
    this.completedAt = null;
    this.checksums = {};
  }

  /**
   * Adiciona arquivo ao manifest
   */
  addFile(filename, size, checksum, stagingPath = null) {
    this.files.push({
      name: filename,
      size,
      checksum,
      stagingPath,
      addedAt: new Date().toISOString()
    });
    this.totalSize += size;
    this.fileCount = this.files.length;
    this.checksums[filename] = checksum;
  }

  /**
   * Marca como concluído
   */
  complete() {
    this.completedAt = new Date().toISOString();
  }

  /**
   * Serializa para JSON
   */
  toJSON() {
    return {
      id: this.id,
      lote: this.lote,
      gtin: this.gtin,
      codigo: this.codigo,
      deliveryType: this.deliveryType,
      files: this.files,
      totalSize: this.totalSize,
      fileCount: this.fileCount,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      checksums: this.checksums
    };
  }

  /**
   * Reconstrói de JSON
   */
  static fromJSON(data) {
    const manifest = new Manifest(data.lote, data.gtin, data.codigo, data.deliveryType);
    manifest.id = data.id;
    manifest.files = data.files;
    manifest.totalSize = data.totalSize;
    manifest.fileCount = data.fileCount;
    manifest.createdAt = data.createdAt;
    manifest.completedAt = data.completedAt;
    manifest.checksums = data.checksums;
    return manifest;
  }
}

/**
 * Registro de entrega
 * Rastreia tentativa de entrega, sucesso/falha
 */
export class DeliveryRecord {
  constructor(lote, gtin, codigo, deliveryType) {
    this.id = uuidv4();
    this.lote = lote;
    this.gtin = gtin;
    this.codigo = codigo;
    this.deliveryType = deliveryType;
    this.status = DeliveryStatus.PENDING;
    this.manifest = null;
    this.remoteFolder = null;
    this.remotePath = null;
    this.attemptedAt = null;
    this.completedAt = null;
    this.duration = null; // ms
    this.error = null;
    this.verifiedAt = null;
    this.remoteFileCount = null;
  }

  /**
   * Inicia tentativa
   */
  startAttempt(manifest) {
    this.manifest = manifest;
    this.status = DeliveryStatus.IN_PROGRESS;
    this.attemptedAt = new Date().toISOString();
  }

  /**
   * Marca como completado
   */
  complete(remotePath) {
    this.status = DeliveryStatus.COMPLETED;
    this.remotePath = remotePath;
    this.completedAt = new Date().toISOString();
    this.duration = new Date(this.completedAt) - new Date(this.attemptedAt);
  }

  /**
   * Registra erro
   */
  fail(error) {
    this.status = DeliveryStatus.FAILED;
    this.error = error;
    this.completedAt = new Date().toISOString();
    this.duration = new Date(this.completedAt) - new Date(this.attemptedAt);
  }

  /**
   * Marca como verificado
   */
  verify(remoteFileCount, remoteSize) {
    this.status = DeliveryStatus.VERIFYING;
    this.verifiedAt = new Date().toISOString();
    this.remoteFileCount = remoteFileCount;
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      id: this.id,
      lote: this.lote,
      gtin: this.gtin,
      codigo: this.codigo,
      deliveryType: this.deliveryType,
      status: this.status,
      manifest: this.manifest?.toJSON(),
      remoteFolder: this.remoteFolder,
      remotePath: this.remotePath,
      attemptedAt: this.attemptedAt,
      completedAt: this.completedAt,
      duration: this.duration,
      error: this.error,
      verifiedAt: this.verifiedAt,
      remoteFileCount: this.remoteFileCount
    };
  }

  /**
   * Reconstrói
   */
  static fromJSON(data) {
    const record = new DeliveryRecord(
      data.lote,
      data.gtin,
      data.codigo,
      data.deliveryType
    );
    record.id = data.id;
    record.status = data.status;
    record.manifest = data.manifest ? Manifest.fromJSON(data.manifest) : null;
    record.remoteFolder = data.remoteFolder;
    record.remotePath = data.remotePath;
    record.attemptedAt = data.attemptedAt;
    record.completedAt = data.completedAt;
    record.duration = data.duration;
    record.error = data.error;
    record.verifiedAt = data.verifiedAt;
    record.remoteFileCount = data.remoteFileCount;
    return record;
  }
}

/**
 * Foto com classificação QA
 */
export class QaPhoto {
  constructor(filename, path) {
    this.filename = filename;
    this.path = path;
    this.classification = null; // null, 'AP', 'AT'
    this.classifiedAt = null;
  }

  /**
   * Classifica como AP (Apoio)
   */
  markAsAP() {
    this.classification = 'AP';
    this.classifiedAt = new Date().toISOString();
  }

  /**
   * Classifica como AT (Atualização)
   */
  markAsAT() {
    this.classification = 'AT';
    this.classifiedAt = new Date().toISOString();
  }

  /**
   * Remove classificação
   */
  unclassify() {
    this.classification = null;
    this.classifiedAt = null;
  }

  /**
   * Serializa
   */
  toJSON() {
    return {
      filename: this.filename,
      path: this.path,
      classification: this.classification,
      classifiedAt: this.classifiedAt
    };
  }
}

export default {
  DeliveryType,
  DeliveryStatus,
  Manifest,
  DeliveryRecord,
  QaPhoto
};
