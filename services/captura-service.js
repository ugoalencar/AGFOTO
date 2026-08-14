import LoteRepository from '../repositories/lote-repository.js';
import { FileRepository } from '../repositories/file-repository.js';
import { Produto } from '../domain/lote.js';
import { auditLogger } from '../server/audit-logger.js';
import ExcelService from './excel-service.js';

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
   * 4. Move snapshot para Finalizadas/LOTE/GTIN/
   * 5. Atualiza JSON com novo status
   * 6. Registra auditoria
   */
  static async saveCapture(loteNumero, gtin, codigo = null, descricao = null) {
    let snapshot;
    let normalizedGtin = gtin;

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
      normalizedGtin = Produto.normalize(gtin);

      // 3. Carrega ou cria lote
      const lote = await LoteRepository.loadOrCreate(loteNumero);

      // 4. ObtÃ©m produto alvo
      const moveResult = await FileRepository.moveSnapshotToFinalizadas(
        snapshot,
        loteNumero,
        normalizedGtin
      );

      if (moveResult.failed.length > 0) {
        console.warn(`Some files failed to move: `, moveResult.failed);
      }

      if (moveResult.moved.length === 0) {
        return {
          ok: false,
          error: 'No files moved; capture was not saved',
          data: {
            lote: lote.numero,
            gtin: normalizedGtin,
            fotosMovidas: 0,
            fotosFalhadas: moveResult.failed.length,
            detalhes: moveResult
          }
        };
      }

      // Atualiza o JSON apenas com as fotos efetivamente movidas.
      const produto = lote.getOrCreateItem(normalizedGtin, codigo, descricao);
      produto.markCaptureSaved(moveResult.moved.length);
      await LoteRepository.save(lote);

      const warnings = [];
      try {
        await ExcelService.updateControlFromLote(loteNumero);
      } catch (err) {
        warnings.push({
          code: 'CONTROL_WORKBOOK_UPDATE_FAILED',
          error: err.message
        });
      }

      // 7. Registra auditoria
      await auditLogger.log('CAPTURA_SALVA', {
        lote: loteNumero,
        gtin: normalizedGtin,
        codigo,
        fotosMovidas: moveResult.moved.length,
        fotosFalhadas: moveResult.failed.length
      });

      return {
        ok: moveResult.failed.length === 0,
        data: {
          lote: lote.numero,
          gtin: normalizedGtin,
          fotosMovidas: moveResult.moved.length,
          fotosFalhadas: moveResult.failed.length,
          status: produto.status,
          detalhes: moveResult
        },
        error: moveResult.failed.length ? 'Some files failed to move' : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (err) {
      await auditLogger.log('CAPTURA_ERRO', {
        lote: loteNumero,
        gtin: normalizedGtin,
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
