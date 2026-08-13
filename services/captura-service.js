import LoteRepository from '../repositories/lote-repository.js';
import { FileRepository } from '../repositories/file-repository.js';
import { Produto } from '../domain/lote.js';
import { auditLogger } from '../server/audit-logger.js';

/**
 * Serviço de Captura
 * Orquestra lógica de captura de fotos, salvamento e transições de estado
 */
export class CapturaService {
  /**
   * Carrega ou cria lote
   */
  static async loadOrCreateLote(numero) {
    try {
      const lote = await LoteRepository.loadOrCreate(numero);
      return {
        ok: true,
        data: {
          lote: lote.numero,
          itens: lote.getAllGtins().length,
          criadoEm: lote.criadoEm,
          atualizadoEm: lote.atualizadoEm
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Obtém detalhes de um lote com sua lista de GTINs
   */
  static async getLoteDetails(numero) {
    try {
      const lote = await LoteRepository.load(numero);
      const gtins = lote.getAllGtins().map(gtin => ({
        gtin,
        codigo: lote.itens[gtin].codigo,
        descricao: lote.itens[gtin].descricao,
        status: lote.itens[gtin].status,
        dataFotografia: lote.itens[gtin].dataFotografia,
        quantidadeFotos: lote.itens[gtin].quantidadeFotos
      }));

      return {
        ok: true,
        data: {
          lote: lote.numero,
          criadoEm: lote.criadoEm,
          atualizadoEm: lote.atualizadoEm,
          totalFotos: lote.getTotalPhotos(),
          itens: gtins
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Lista imagens atuais em TEMP
   */
  static async getTempImages() {
    try {
      const images = await FileRepository.listTempImages();
      return {
        ok: true,
        data: {
          images: images.map(img => ({
            name: img.name,
            path: img.path
          })),
          count: images.length
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Salva captura de fotos para um lote e GTIN
   * Fluxo:
   * 1. Snapshots nomes disponíveis em TEMP
   * 2. Valida GTIN
   * 3. Carrega/cria lote
   * 4. Copia snapshot para Finalizadas/LOTE/GTIN/
   * 5. Atualiza JSON com novo status
   * 6. Registra auditoria
   */
  static async saveCapture(loteNumero, gtin, codigo = null, descricao = null) {
    let snapshot;

    try {
      // 1. Snapshots arquivos estáveis em TEMP
      snapshot = await FileRepository.snapshotTempFiles();

      if (snapshot.length === 0) {
        return {
          ok: false,
          error: 'No stable images in TEMP'
        };
      }

      // 2. Valida GTIN
      if (!Produto.isValid(gtin)) {
        return {
          ok: false,
          error: `Invalid GTIN: ${gtin}`
        };
      }

      // 3. Carrega ou cria lote
      const lote = await LoteRepository.loadOrCreate(loteNumero);

      // 4. Atualiza produto
      const produto = lote.getOrCreateItem(gtin, codigo, descricao);
      produto.markCaptureSaved(snapshot.length);

      // 5. Copia snapshot para Finalizadas
      const copyResult = await FileRepository.copySnapshotToFinalizadas(
        snapshot,
        loteNumero,
        gtin
      );

      if (copyResult.failed.length > 0) {
        console.warn(`Some files failed to copy: `, copyResult.failed);
      }

      // 6. Salva lote
      await LoteRepository.save(lote);

      // 7. Registra auditoria
      await auditLogger.log('CAPTURA_SALVA', {
        lote: loteNumero,
        gtin,
        codigo,
        fotosCopied: copyResult.copied.length,
        fotosFailed: copyResult.failed.length
      });

      return {
        ok: true,
        data: {
          lote: lote.numero,
          gtin,
          fotosCopidas: copyResult.copied.length,
          fotosFalhadas: copyResult.failed.length,
          status: produto.status,
          detalhes: copyResult
        }
      };
    } catch (err) {
      await auditLogger.log('CAPTURA_ERRO', {
        lote: loteNumero,
        gtin,
        erro: err.message
      });

      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Limpa TEMP com confirmação
   */
  static async clearTemp(filenames) {
    try {
      if (!Array.isArray(filenames) || filenames.length === 0) {
        return {
          ok: false,
          error: 'No files specified'
        };
      }

      const result = await FileRepository.clearTemp(filenames);

      await auditLogger.log('TEMP_LIMPO', {
        removidos: result.removed.length,
        falhados: result.failed.length
      });

      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Lista todas as imagens de um GTIN já capturado
   */
  static async getPreviousImages(loteNumero, gtin, subfolder = null) {
    try {
      const images = await FileRepository.listFinalizadasImages(
        loteNumero,
        gtin,
        subfolder
      );

      return {
        ok: true,
        data: {
          lote: loteNumero,
          gtin,
          subfolder: subfolder || 'raiz',
          images: images.map(img => ({
            name: img.name,
            path: img.path
          })),
          count: images.length
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Lista todos os lotes
   */
  static async listAllLotes() {
    try {
      const lotes = await LoteRepository.listAll();
      return {
        ok: true,
        data: {
          lotes: lotes.map(lote => ({
            numero: lote.numero,
            criadoEm: lote.criadoEm,
            atualizadoEm: lote.atualizadoEm,
            itens: lote.getAllGtins().length,
            totalFotos: lote.getTotalPhotos()
          }))
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }
}

export default CapturaService;
