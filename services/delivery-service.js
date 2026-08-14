import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
    try {
      const { loteObj, produto, lote: normalizedLote, gtin: normalizedGtin } = await this.loadQaProduct(lote, gtin);
      if (!['AP', 'AT'].includes(fromClassification)) return { ok: false, error: 'fromClassification must be AP or AT' };
      const moved = await FileRepository.moveFinalizadaPhoto({
        loteNumero: normalizedLote, gtin: normalizedGtin, filename, fromSubfolder: fromClassification
      });
      await this.recordQaHistory(loteObj, produto, 'foto_desclassificada', {
        classificacaoAnterior: fromClassification, filename: moved.destName
      });
      await auditLogger.log('UNCLASSIFY', {
        lote: normalizedLote, gtin: normalizedGtin, filename, fromClassification,
        destName: moved.destName, operationId: operationContext?.operationId || null
      });
      return { ok: true, data: { unclassified: true, filename: moved.destName } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  static async classifyPhoto(lote, gtin, filename, classification, operationContext = null) {
    try {
      if (!['AP', 'AT'].includes(classification)) return { ok: false, error: 'Invalid classification' };
      const { loteObj, produto, lote: normalizedLote, gtin: normalizedGtin } = await this.loadQaProduct(lote, gtin);
      const moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: normalizedLote, gtin: normalizedGtin, filename, toSubfolder: classification });
      await this.recordQaHistory(loteObj, produto, 'foto_classificada', { classificacao: classification, filename: moved.destName });
      await auditLogger.log(`CLASSIFY_${classification}`, {
        lote: normalizedLote, gtin: normalizedGtin, filename, destName: moved.destName,
        operationId: operationContext?.operationId || null
      });
      return { ok: true, data: { classified: classification, filename: moved.destName } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  static async deletePhoto(lote, gtin, filename, location = 'root', operationContext = null) {
    try {
      const { loteObj, produto, lote: normalizedLote, gtin: normalizedGtin } = await this.loadQaProduct(lote, gtin);
      const deleted = await FileRepository.deleteFinalizadaPhoto({ loteNumero: normalizedLote, gtin: normalizedGtin, filename, location });
      await this.recordQaHistory(loteObj, produto, 'foto_excluida', {
        filename: deleted.filename, location: deleted.location
      }, -1);
      await auditLogger.log('DELETE_PHOTO', {
        lote: normalizedLote, gtin: normalizedGtin, filename: deleted.filename, location: deleted.location,
        operationId: operationContext?.operationId || null
      });
      return { ok: true, data: { deleted: true, filename: deleted.filename, location: deleted.location } };
    } catch (err) {
      return { ok: false, error: err.message };
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

  static async recordQaHistory(loteObj, produto, event, details, photoCountDelta = 0) {
    if (photoCountDelta !== 0) produto.quantidadeFotos = Math.max(0, produto.quantidadeFotos + photoCountDelta);
    produto.addHistoricoEvent(event, details);
    await LoteRepository.save(loteObj);
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
      const loteObj = await LoteRepository.load(lote);
      const produto = loteObj.itens[gtin];

      if (!produto) {
        throw new Error(`Product not found: ${gtin}`);
      }

      if (!codigo) {
        throw new Error('Internal code required for delivery');
      }

      // Seleciona fotos conforme tipo de entrega
      let photos;
      if (deliveryType === DeliveryType.ATUALIZACAO) {
        photos = await FileRepository.listFinalizadasImages(lote, gtin, 'AT');
      } else {
        photos = await FileRepository.listFinalizadasImages(lote, gtin);
        // Filtra AP/
        photos = photos.filter(p => !p.name.includes('AP/'));
      }

      if (photos.length === 0) {
        throw new Error('No eligible photos for delivery');
      }

      // Cria manifest
      const manifest = new Manifest(lote, gtin, codigo, deliveryType);
      photos.forEach(photo => {
        // TODO: Calcular hash real
        manifest.addFile(photo.name, 0, uuidv4());
      });

      return {
        ok: true,
        data: {
          manifest: manifest.toJSON(),
          readyForDelivery: true
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Executa entrega via FTP
   */
  static async executeDelivery(lote, gtin, codigo, deliveryType = DeliveryType.NORMAL) {
    try {
      const ftpService = getFtpService();

      // Conecta ao FTP
      const connectResult = await ftpService.connect();
      if (!connectResult.ok) {
        throw new Error(`FTP connection failed: ${connectResult.error}`);
      }

      // Constrói caminho remoto
      const remotePath = ftpService.buildRemotePath(lote, codigo);
      const tempPath = `${remotePath}_${uuidv4().substring(0, 8)}_tmp`;

      // TODO: Upload de arquivos
      // 1. Criar pasta temporária
      // 2. Upload cada arquivo
      // 3. Verificar checksums
      // 4. Renomear para destino final

      // Marca como entregue
      const loteObj = await LoteRepository.load(lote);
      const produto = loteObj.itens[gtin];
      produto.markDelivered();
      await LoteRepository.save(loteObj);

      // Auditoria
      await auditLogger.log('ENTREGA_COMPLETA', {
        lote,
        gtin,
        codigo,
        deliveryType,
        remotePath
      });

      // Desconecta
      await ftpService.disconnect();

      return {
        ok: true,
        data: {
          status: 'delivered',
          remotePath,
          productoStatus: ProductStatus.ENTREGUE
        }
      };
    } catch (err) {
      await auditLogger.log('ENTREGA_ERRO', {
        lote,
        gtin,
        codigo,
        erro: err.message
      });

      return { ok: false, error: err.message };
    }
  }

  /**
   * Reinicia para retrabalho
   */
  static async restartRework(lote, gtin, codigo = null) {
    try {
      const loteObj = await LoteRepository.load(lote);

      // Se não passou GTIN, tentar encontrar por código
      let targetGtin = gtin;
      if (!targetGtin && codigo) {
        for (const [ean, produto] of Object.entries(loteObj.itens)) {
          if (produto.codigo === codigo) {
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

      // Muda status para retrabalho
      produto.status = ProductStatus.RETRABALHO;
      await LoteRepository.save(loteObj);

      await auditLogger.log('RETRABALHO_INICIADO', {
        lote,
        gtin: targetGtin,
        codigo: produto.codigo
      });

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
