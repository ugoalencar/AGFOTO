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
  static captureLocks = new Map();

  static async withCaptureLock(loteNumero, operation) {
    const key = String(loteNumero ?? '').trim();
    const previous = this.captureLocks.get(key) || Promise.resolve();
    let release;
    const current = new Promise(resolve => {
      release = resolve;
    });
    this.captureLocks.set(key, current);

    await previous.catch(() => {});
    try {
      return await operation();
    } finally {
      release();
      if (this.captureLocks.get(key) === current) {
        this.captureLocks.delete(key);
      }
    }
  }

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
  static async saveCapture(loteNumero, gtin, codigo = null, descricao = null, obs = null) {
    return this.withCaptureLock(loteNumero, () => (
      this.saveCaptureLocked(loteNumero, gtin, codigo, descricao, obs)
    ));
  }

  static async saveCaptureLocked(loteNumero, gtin, codigo = null, descricao = null, obs = null) {
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
            lote: loteNumero,
            gtin: normalizedGtin,
            fotosMovidas: 0,
            fotosFalhadas: moveResult.failed.length,
            detalhes: moveResult
          }
        };
      }

      // Atualiza o JSON apenas com as fotos efetivamente movidas.
      const lote = await LoteRepository.loadOrCreate(loteNumero);
      const produto = lote.getOrCreateItem(normalizedGtin, codigo, descricao);
      produto.markCaptureSaved(moveResult.moved.length);
      await LoteRepository.save(lote);

      const warnings = [...moveResult.warnings];

      // Observacoes viram um .txt na pasta do GTIN, igual o sphoto faz.
      try {
        await FileRepository.writeObservacoes(loteNumero, normalizedGtin, obs);
      } catch (err) {
        warnings.push({ code: 'OBS_WRITE_FAILED', error: err.message });
      }

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
   * Toggle de sufixo (_coding, _RT, ...) nos arquivos marcados.
   */
  static async markPhotos({ location, filenames, suffix, lote = null, gtin = null }) {
    try {
      const result = await FileRepository.toggleSuffix({
        location,
        filenames,
        suffix,
        loteNumero: lote,
        gtin
      });

      await auditLogger.log('FOTOS_MARCADAS', {
        location,
        lote,
        gtin,
        sufixo: suffix,
        renomeados: result.renamed.length,
        falhados: result.failed.length
      });

      return { ok: result.failed.length === 0, data: result, error: result.failed.length ? 'Some files failed to rename' : undefined };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Toggle de subpasta RT/IS/AP no palco Anterior.
   */
  static async tagSubfolder({ lote, gtin, filenames, pasta }) {
    try {
      const result = await FileRepository.toggleSubfolderTag({
        loteNumero: lote,
        gtin,
        filenames,
        pasta
      });

      await auditLogger.log('FOTOS_SUBPASTA', {
        lote,
        gtin,
        pasta,
        movidos: result.moved.length,
        falhados: result.failed.length
      });

      return { ok: result.failed.length === 0, data: result, error: result.failed.length ? 'Some files failed to move' : undefined };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista imagens que estao nas subpastas RT/IS/AP
   */
  static async getSubfolderImages(lote, gtin) {
    try {
      const subpastas = await FileRepository.listSubfolderImages(lote, gtin);
      return { ok: true, data: { lote, gtin, subpastas } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Remove uma foto ja salva em Finalizadas
   */
  static async deleteFinalizadaPhoto({ lote, gtin, filename, location = null }) {
    try {
      const photo = await FileRepository.deleteFinalizadaPhoto({
        loteNumero: lote,
        gtin,
        filename,
        location
      });

      await auditLogger.log('FOTO_FINALIZADA_REMOVIDA', {
        lote,
        gtin,
        filename,
        location: photo.location
      });

      return { ok: true, data: { filename: photo.filename, location: photo.location } };
    } catch (err) {
      return { ok: false, error: err.message };
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
