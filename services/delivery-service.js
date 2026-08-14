import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import LoteRepository from '../repositories/lote-repository.js';
import { FileRepository } from '../repositories/file-repository.js';
import { Manifest, DeliveryRecord, DeliveryType, DeliveryStatus } from '../domain/delivery.js';
import { ProductStatus } from '../domain/status.js';
import { getFtpService } from './ftp-service.js';
import { auditLogger } from '../server/audit-logger.js';
import { config } from '../server/config.js';
import ExcelService from './excel-service.js';
import { Lote, Produto } from '../domain/lote.js';

/**
 * Serviço de Entrega
 * Gerencia QA, classificação, preparação e entrega de fotos
 */
export class DeliveryService {
  /**
   * Carrega fotos de um produto para QA
   */
  static async loadQaPhotos(lote, gtin) {
    try {
      const images = await FileRepository.listFinalizadasImages(lote, gtin);

      const photos = images.map(img => ({
        filename: img.name,
        path: img.path,
        classification: null, // 'AP', 'AT', ou null
        size: 0
      }));

      return {
        ok: true,
        data: {
          lote,
          gtin,
          photos,
          count: photos.length
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Classifica foto como AP (Apoio)
   */
  static async classifyPhotoAP(lote, gtin, filename, operationContext = null) {
    try {
      return await this.classifyPhoto(lote, gtin, filename, 'AP', operationContext);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Classifica foto como AT (Atualização)
   */
  static async classifyPhotoAT(lote, gtin, filename, operationContext = null) {
    try {
      return await this.classifyPhoto(lote, gtin, filename, 'AT', operationContext);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Remove classificação de foto
   */
  static async unclassifyPhoto(lote, gtin, filename, fromClassification = null, operationContext = null) {
    let moved = null;
    let normalizedLote = null;
    let normalizedGtin = null;
    try {
      const loaded = await this.loadQaProduct(lote, gtin);
      const { loteObj, produto } = loaded;
      normalizedLote = loaded.lote;
      normalizedGtin = loaded.gtin;
      if (!['AP', 'AT'].includes(fromClassification)) return { ok: false, error: 'fromClassification must be AP or AT' };
      moved = await FileRepository.moveFinalizadaPhoto({
        loteNumero: normalizedLote, gtin: normalizedGtin, filename, fromSubfolder: fromClassification
      });
      this.recordQaHistory(produto, 'foto_desclassificada', {
        classificacaoAnterior: fromClassification, filename: moved.destName
      });
      await auditLogger.log('UNCLASSIFY', {
        lote: normalizedLote, gtin: normalizedGtin, filename, fromClassification,
        destName: moved.destName, operationId: operationContext?.operationId || null
      });
      await LoteRepository.save(loteObj);
      return { ok: true, data: { unclassified: true, filename: moved.destName } };
    } catch (err) {
      return this.compensateQaMoveFailure(err, moved, {
        loteNumero: normalizedLote,
        gtin: normalizedGtin,
        fromSubfolder: null,
        toSubfolder: fromClassification,
        originalFilename: filename
      });
    }
  }

  static async classifyPhoto(lote, gtin, filename, classification, operationContext = null) {
    let moved = null;
    let normalizedLote = null;
    let normalizedGtin = null;
    try {
      if (!['AP', 'AT'].includes(classification)) return { ok: false, error: 'Invalid classification' };
      const loaded = await this.loadQaProduct(lote, gtin);
      const { loteObj, produto } = loaded;
      normalizedLote = loaded.lote;
      normalizedGtin = loaded.gtin;
      moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: normalizedLote, gtin: normalizedGtin, filename, toSubfolder: classification });
      this.recordQaHistory(produto, 'foto_classificada', { classificacao: classification, filename: moved.destName });
      await auditLogger.log(`CLASSIFY_${classification}`, {
        lote: normalizedLote, gtin: normalizedGtin, filename, destName: moved.destName,
        operationId: operationContext?.operationId || null
      });
      await LoteRepository.save(loteObj);
      return { ok: true, data: { classified: classification, filename: moved.destName } };
    } catch (err) {
      return this.compensateQaMoveFailure(err, moved, {
        loteNumero: normalizedLote,
        gtin: normalizedGtin,
        fromSubfolder: classification,
        toSubfolder: null,
        originalFilename: filename
      });
    }
  }

  static async deletePhoto(lote, gtin, filename, location = 'root', operationContext = null) {
    let historyPersisted = false;
    let auditPersisted = false;
    let normalizedLote = null;
    let normalizedGtin = null;
    try {
      const loaded = await this.loadQaProduct(lote, gtin);
      const { loteObj, produto } = loaded;
      normalizedLote = loaded.lote;
      normalizedGtin = loaded.gtin;
      const photo = await FileRepository.resolveFinalizadaPhoto({ loteNumero: normalizedLote, gtin: normalizedGtin, filename, location });
      this.recordQaHistory(produto, 'foto_excluida', {
        filename: photo.filename, location: photo.location
      }, -1);
      await auditLogger.log('DELETE_PHOTO', {
        lote: normalizedLote, gtin: normalizedGtin, filename: photo.filename, location: photo.location,
        operationId: operationContext?.operationId || null, phase: 'pre_delete'
      });
      auditPersisted = true;
      await LoteRepository.save(loteObj);
      historyPersisted = true;
      const deleted = await FileRepository.deleteFinalizadaPhoto({ loteNumero: normalizedLote, gtin: normalizedGtin, filename, location });
      return { ok: true, data: { deleted: true, filename: deleted.filename, location: deleted.location } };
    } catch (err) {
      if (historyPersisted && auditPersisted) {
        return {
          ok: false,
          error: `Physical delete failed after persisted history/audit: ${err.message}`,
          warning: 'The file was retained and requires retry or manual cleanup.'
        };
      }
      if (auditPersisted) {
        try {
          await auditLogger.log('DELETE_PHOTO_ABORTED', {
            lote: normalizedLote, gtin: normalizedGtin, filename, location,
            operationId: operationContext?.operationId || null,
            reason: err.message
          });
        } catch (abortAuditError) {
          return {
            ok: false,
            error: `${err.message}; abort audit failed: ${abortAuditError.message}`,
            warning: 'The file was retained and JSON was not persisted, but the abort audit event could not be recorded.'
          };
        }
      }
      if (historyPersisted) return { ok: false, error: `Delete stopped after persisted history because audit logging failed: ${err.message}` };
      return { ok: false, error: err.message };
    }
  }

  static async compensateQaMoveFailure(error, moved, { loteNumero, gtin, fromSubfolder, toSubfolder, originalFilename }) {
    if (!moved) return { ok: false, error: error.message };

    try {
      const compensation = await FileRepository.moveFinalizadaPhoto({
        loteNumero,
        gtin,
        filename: moved.destName,
        fromSubfolder,
        toSubfolder
      });
      try {
        await auditLogger.log('QA_MOVE_COMPENSATED', {
          lote: loteNumero,
          gtin,
          filename: moved.destName,
          restoredAs: compensation.destName,
          fromSubfolder,
          toSubfolder,
          reason: error.message
        });
      } catch (compensationAuditError) {
        return {
          ok: false,
          error: `${error.message}; compensation audit failed: ${compensationAuditError.message}`,
          warning: 'The physical file was compensated and JSON was not persisted, but the compensation audit event could not be recorded.'
        };
      }
      const warning = compensation.destName === originalFilename
        ? null
        : `Compensation restored the file as ${compensation.destName} instead of ${originalFilename}.`;
      return {
        ok: false,
        error: error.message,
        ...(warning ? { warning } : {})
      };
    } catch (compensationError) {
      return {
        ok: false,
        error: `${error.message}; compensation failed: ${compensationError.message}`,
        warning: 'The physical file may be out of sync with JSON history and requires manual recovery.'
      };
    }
  }

  static async loadQaProduct(lote, gtin) {
    const normalizedLote = Lote.normalize(lote);
    if (!Lote.isValid(normalizedLote)) throw new Error(`Invalid lote number: ${lote}`);
    if (!Produto.isValid(gtin)) throw new Error(`Invalid GTIN: ${gtin}`);
    const normalizedGtin = Produto.normalize(gtin);
    const loteObj = await LoteRepository.load(normalizedLote);
    const produto = loteObj.itens[normalizedGtin];
    if (!produto) throw new Error(`Product not found: ${normalizedGtin}`);
    return { loteObj, produto, lote: normalizedLote, gtin: normalizedGtin };
  }

  static recordQaHistory(produto, event, details, photoCountDelta = 0) {
    if (photoCountDelta !== 0) produto.quantidadeFotos = Math.max(0, produto.quantidadeFotos + photoCountDelta);
    produto.addHistoricoEvent(event, details);
  }

  /**
   * Conclui QA e muda status para pronto_para_entrega
   */
  static async completeQa(lote, gtin, deliveryType = DeliveryType.NORMAL) {
    try {
      if (![DeliveryType.NORMAL, DeliveryType.ATUALIZACAO].includes(deliveryType)) {
        return { ok: false, error: 'Invalid delivery type' };
      }
      const { loteObj, produto, lote: normalizedLote, gtin: normalizedGtin } = await this.loadQaProduct(lote, gtin);
      const subfolder = deliveryType === DeliveryType.ATUALIZACAO ? 'AT' : null;
      const photos = await FileRepository.listFinalizadasImages(normalizedLote, normalizedGtin, subfolder);
      if (photos.length === 0) {
        return {
          ok: false,
          error: deliveryType === DeliveryType.ATUALIZACAO
            ? 'No AT photos available for update delivery'
            : 'No root photos available for normal delivery'
        };
      }

      // Muda status
      produto.status = ProductStatus.PRONTO_PARA_ENTREGA;
      produto.addHistoricoEvent('qa_concluido', { deliveryType, quantidadeFotosElegiveis: photos.length });
      await LoteRepository.save(loteObj);
      await ExcelService.updateControlFromLote(normalizedLote);

      await auditLogger.log('QA_COMPLETO', {
        lote: normalizedLote,
        gtin: normalizedGtin,
        deliveryType,
        quantidadeFotosElegiveis: photos.length
      });

      return {
        ok: true,
        data: {
          status: produto.status,
          deliveryType,
          quantidadeFotosElegiveis: photos.length
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Prepara entrega (monta staging + manifest)
   */
  static async prepareDelivery(lote, gtin, codigo, deliveryType = DeliveryType.NORMAL) {
    try {
      const delivery = await this.buildDeliveryManifest(lote, gtin, codigo, deliveryType);
      const record = new DeliveryRecord(delivery.normalizedLote, delivery.normalizedGtin, codigo, deliveryType);
      record.status = DeliveryStatus.STAGING;
      record.manifest = delivery.manifest;
      record.remoteFolder = getFtpService().buildRemotePath(delivery.normalizedLote, codigo);
      await this.persistDeliveryRecord(record);
      return { ok: true, data: { manifest: delivery.manifest.toJSON(), attemptId: record.id, readyForDelivery: true } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Executa entrega via FTP
   */
  static async executeDelivery(lote, gtin, codigo, deliveryType = DeliveryType.NORMAL, attemptId = null) {
    let record = null;
    let loaded = null;
    let ftpService = null;
    let deliveryStarted = false;
    try {
      if (!attemptId) throw new Error('Prepared delivery attemptId is required');
      if (![DeliveryType.NORMAL, DeliveryType.ATUALIZACAO].includes(deliveryType)) throw new Error('Invalid delivery type');
      loaded = await this.loadQaProduct(lote, gtin);
      this.validateDeliveryCode(loaded.produto, codigo);
      if (loaded.produto.status !== ProductStatus.PRONTO_PARA_ENTREGA) throw new Error('Product is not ready for delivery');
      record = await this.loadDeliveryRecord(attemptId);
      if (record.status !== DeliveryStatus.STAGING) throw new Error('Prepared delivery attempt is not ready for execution');
      if (
        record.lote !== loaded.lote ||
        record.gtin !== loaded.gtin ||
        record.codigo !== codigo ||
        record.deliveryType !== deliveryType
      ) {
        throw new Error('Prepared delivery attempt does not match requested product');
      }
      if (!record.manifest || record.manifest.fileCount === 0) throw new Error('Prepared delivery attempt has no manifest files');
      ftpService = getFtpService();
      deliveryStarted = true;

      // Conecta ao FTP
      const connectResult = await ftpService.connect();
      if (!connectResult.ok) {
        throw new Error(`FTP connection failed: ${connectResult.error}`);
      }

      // Constrói caminho remoto
      const remotePath = ftpService.buildRemotePath(loaded.lote, codigo);
      record.remoteFolder = remotePath;
      record.startAttempt(record.manifest);
      deliveryStarted = true;
      await this.persistDeliveryRecord(record);

      for (const file of record.manifest.files) {
        const upload = await ftpService.uploadFile(file.stagingPath, path.join(remotePath, file.name));
        if (!upload.ok) throw new Error(`Upload failed for ${file.name}: ${upload.error}`);
      }
      const listed = await ftpService.listRemoteFiles(remotePath);
      if (!listed.ok || listed.data.count !== record.manifest.fileCount) throw new Error('Remote verification failed: unexpected file count');
      for (const file of record.manifest.files) {
        const verified = await ftpService.verifyRemoteFile(path.join(remotePath, file.name));
        if (!verified.ok || !verified.data.exists || verified.data.size !== file.size || verified.data.hash !== file.checksum) {
          throw new Error(`Remote verification failed for ${file.name}`);
        }
      }
      record.verify(record.manifest.fileCount);
      record.manifest.complete();
      record.complete(remotePath);

      // Marca como entregue
      loaded.produto.markDelivered();
      await LoteRepository.save(loaded.loteObj);
      await ExcelService.updateControlFromLote(loaded.lote);
      await this.persistDeliveryRecord(record);

      // Auditoria
      await auditLogger.log('ENTREGA_COMPLETA', {
        lote: loaded.lote,
        gtin: loaded.gtin,
        codigo,
        deliveryType,
        remotePath
      });

      return {
        ok: true,
        data: {
          status: ProductStatus.ENTREGUE,
          remotePath,
          produtoStatus: ProductStatus.ENTREGUE
        }
      };
    } catch (err) {
      if (!loaded) {
        try { loaded = await this.loadQaProduct(lote, gtin); } catch { /* invalid identities cannot be persisted */ }
      }
      if (record && deliveryStarted) {
        record.fail(err.message);
        await this.persistDeliveryRecord(record);
      }
      if (loaded && deliveryStarted) {
        loaded.produto.recordDeliveryError(err.message);
        await LoteRepository.save(loaded.loteObj);
        await ExcelService.updateControlFromLote(loaded.lote);
      }
      if (deliveryStarted) {
        await auditLogger.log('ENTREGA_ERRO', {
          lote,
          gtin,
          codigo,
          erro: err.message
        });
      }

      return { ok: false, error: err.message };
    } finally {
      if (ftpService) await ftpService.disconnect();
    }
  }

  static async buildDeliveryManifest(lote, gtin, codigo, deliveryType) {
    if (![DeliveryType.NORMAL, DeliveryType.ATUALIZACAO].includes(deliveryType)) throw new Error('Invalid delivery type');
    const loaded = await this.loadQaProduct(lote, gtin);
    this.validateDeliveryCode(loaded.produto, codigo);
    if (loaded.produto.status !== ProductStatus.PRONTO_PARA_ENTREGA) throw new Error('Product is not ready for delivery');
    const photos = await FileRepository.listFinalizadasImages(loaded.lote, loaded.gtin, deliveryType === DeliveryType.ATUALIZACAO ? 'AT' : null);
    if (photos.length === 0) throw new Error('No eligible photos for delivery');
    const stagingDir = path.join(config.paths.entrega, `LOTE ${loaded.lote}`, codigo);
    await fs.promises.mkdir(stagingDir, { recursive: true });
    const manifest = new Manifest(loaded.lote, loaded.gtin, codigo, deliveryType);
    for (const photo of photos) {
      const stagingPath = await this.copyToStaging(photo.path, stagingDir, photo.name);
      const contents = await fs.promises.readFile(stagingPath);
      manifest.addFile(path.basename(stagingPath), contents.length, crypto.createHash('sha256').update(contents).digest('hex'), stagingPath, photo.path);
    }
    return { loaded, manifest, normalizedLote: loaded.lote, normalizedGtin: loaded.gtin };
  }

  static validateDeliveryCode(produto, codigo) {
    if (
      typeof codigo !== 'string' ||
      codigo.trim().length === 0 ||
      codigo === '.' ||
      codigo === '..' ||
      /[\\/:*?"<>|]/.test(codigo) ||
      codigo.includes('..')
    ) {
      throw new Error('Internal code required for delivery');
    }
    if (typeof produto.codigo !== 'string' || produto.codigo.trim().length === 0) {
      throw new Error('Product internal code required for delivery');
    }
    if (produto.codigo !== codigo) {
      throw new Error(`Delivery codigo does not match product codigo: ${codigo}`);
    }
  }

  static async copyToStaging(sourcePath, stagingDir, filename) {
    const extension = path.extname(filename);
    const basename = path.basename(filename, extension);
    for (let index = 0; ; index += 1) {
      const destination = path.join(stagingDir, index === 0 ? filename : `${basename}_${String(index).padStart(3, '0')}${extension}`);
      try {
        await fs.promises.copyFile(sourcePath, destination, fs.constants.COPYFILE_EXCL);
        return destination;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }

  static async persistDeliveryRecord(record) {
    await fs.promises.mkdir(config.paths.envios, { recursive: true });
    await fs.promises.writeFile(path.join(config.paths.envios, `${record.id}.json`), JSON.stringify(record.toJSON(), null, 2), 'utf8');
  }

  static async loadDeliveryRecord(attemptId) {
    if (typeof attemptId !== 'string' || !/^[a-f0-9-]{36}$/i.test(attemptId)) throw new Error('Invalid delivery attemptId');
    const recordPath = path.join(config.paths.envios, `${attemptId}.json`);
    const record = DeliveryRecord.fromJSON(JSON.parse(await fs.promises.readFile(recordPath, 'utf8')));
    if (record.id !== attemptId) throw new Error('Delivery attemptId mismatch');
    return record;
  }

  /**
   * Reinicia para retrabalho
   */
  static async restartRework(lote, gtin, codigo = null) {
    try {
      const normalizedLote = Lote.normalize(lote);
      if (!Lote.isValid(normalizedLote)) throw new Error('Invalid lote');
      const normalizedGtin = gtin ? Produto.normalize(gtin) : null;
      if (normalizedGtin && !Produto.isValid(normalizedGtin)) throw new Error('Invalid GTIN');
      const normalizedCodigo = typeof codigo === 'string' ? codigo.trim() : codigo;
      if (!normalizedGtin && (!normalizedCodigo || typeof normalizedCodigo !== 'string')) {
        throw new Error('GTIN or codigo required');
      }

      const loteObj = await LoteRepository.load(normalizedLote);

      // Se não passou GTIN, tentar encontrar por código
      let targetGtin = normalizedGtin;
      if (!targetGtin && normalizedCodigo) {
        for (const [ean, produto] of Object.entries(loteObj.itens)) {
          if (produto.codigo === normalizedCodigo) {
            if (targetGtin) {
              throw new Error('Ambiguous code: multiple products match');
            }
            targetGtin = ean;
          }
        }
      }

      if (!targetGtin) {
        throw new Error('Product not found');
      }

      const produto = loteObj.itens[targetGtin];
      if (!produto) throw new Error('Product not found');
      if (normalizedCodigo && produto.codigo !== normalizedCodigo) {
        throw new Error(`Rework codigo does not match product codigo: ${normalizedCodigo}`);
      }

      // Muda status para retrabalho
      produto.status = ProductStatus.RETRABALHO;
      produto.ultimoErro = null;
      produto.addHistoricoEvent('retrabalho_iniciado', {
        gtin: targetGtin,
        codigo: produto.codigo
      });

      await auditLogger.log('RETRABALHO_INICIADO', {
        lote: normalizedLote,
        gtin: targetGtin,
        codigo: produto.codigo
      });

      await LoteRepository.save(loteObj);
      await ExcelService.updateControlFromLote(normalizedLote);

      return {
        ok: true,
        data: {
          status: 'retrabalho',
          gtin: targetGtin
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista produtos prontos para entrega
   */
  static async listReadyForDelivery(lote) {
    try {
      const loteObj = await LoteRepository.load(lote);
      const ready = [];

      for (const [gtin, produto] of Object.entries(loteObj.itens)) {
        if (produto.status === ProductStatus.PRONTO_PARA_ENTREGA) {
          const photos = await FileRepository.listFinalizadasImages(lote, gtin);
          ready.push({
            gtin,
            codigo: produto.codigo,
            descricao: produto.descricao,
            quantidadeFotos: photos.length,
            dataFotografia: produto.dataFotografia
          });
        }
      }

      return {
        ok: true,
        data: {
          lote,
          ready,
          count: ready.length
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default DeliveryService;
