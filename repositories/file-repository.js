import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  securePath,
  validateFilename,
  createSecureDirectory,
  listAllowedFiles,
  removeSecureFile,
  waitForFileStability
} from '../server/secure-filesystem.js';
import { config } from '../server/config.js';
import { auditDelete } from '../server/audit-logger.js';
import { Lote, Produto } from '../domain/lote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function normalizeFinalizadaPathComponents(loteNumero, gtin) {
  const normalizedLote = Lote.normalize(loteNumero);
  if (!Lote.isValid(normalizedLote)) throw new Error(`Invalid lote number: ${loteNumero}`);
  if (!Produto.isValid(gtin)) throw new Error(`Invalid GTIN: ${gtin}`);
  return { loteNumero: normalizedLote, gtin: Produto.normalize(gtin) };
}

/**
 * Repository para operações de arquivo (imagens, cópias, exclusões)
 */
export class FileRepository {
  /**
   * Lista imagens estáveis em images/temp
   */
  static async listTempImages() {
    try {
      const files = await listAllowedFiles(config.paths.imagesTemp, config.paths.imagesTemp);
      const images = [];
      for (const file of files) {
        const stats = await fs.promises.stat(file.path);
        images.push({
          name: file.name,
          path: file.path,
          url: `/api/captura/imagem/temp/${encodeURIComponent(file.name)}`,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          stable: true,
          signatureOk: true,
          state: 'stable'
        });
      }
      return images;
    } catch (err) {
      throw new Error(`Cannot list temp images: ${err.message}`);
    }
  }

  /**
   * Aguarda estabilidade de arquivo (e.g., câmera ainda gravando)
   */
  static async waitForFileStable(filePath, timeoutMs = 5000) {
    try {
      return await waitForFileStability(filePath, timeoutMs);
    } catch (err) {
      throw new Error(`File stability check failed: ${err.message}`);
    }
  }

  /**
   * Obtém informações de arquivo
   */
  static async getFileInfo(filePath) {
    try {
      const safe = securePath(filePath);
      const stats = await fs.promises.stat(safe);
      return {
        name: path.basename(filePath),
        path: safe,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        isFile: stats.isFile()
      };
    } catch (err) {
      throw new Error(`Cannot get file info: ${err.message}`);
    }
  }

  /**
   * Move arquivo de TEMP para Finalizadas sem sobrescrever.
   * Não sobrescreve, usa nome determinístico em colisão
   */
  static async uniqueDestPath(destDir, filename, counter = 0) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    return counter === 0
      ? path.join(destDir, filename)
      : path.join(destDir, `${base}_${String(counter).padStart(3, '0')}${ext}`);
  }

  /**
   * Moves a validated TEMP image to Finalizadas without overwriting existing files.
   */
  static async moveToFinalizadas(srcPath, loteNumero, gtin) {
    try {
      const safeSrc = securePath(srcPath, config.paths.imagesTemp);

      // Valida GTIN
      if (!gtin || typeof gtin !== 'string') {
        throw new Error('GTIN is required');
      }

      // Cria diretório de destino
      const destDir = path.join(
        config.paths.finalizadas,
        `LOTE ${loteNumero}`,
        gtin
      );
      await createSecureDirectory(destDir, config.paths.finalizadas);
      const filename = validateFilename(path.basename(safeSrc));

      for (let counter = 0; ; counter++) {
        const destPath = await this.uniqueDestPath(destDir, filename, counter);
        try {
          await fs.promises.copyFile(safeSrc, destPath, fs.constants.COPYFILE_EXCL);
        } catch (err) {
          if (err.code === 'EEXIST') continue;
          throw err;
        }

        try {
          await fs.promises.unlink(safeSrc);
        } catch (unlinkError) {
          return {
            destPath,
            warning: {
              code: 'TEMP_CLEANUP_FAILED',
              error: `TEMP cleanup failed after exclusive copy; final file was retained (${unlinkError.message})`
            }
          };
        }
        return { destPath };
      }
    } catch (err) {
      throw new Error(`Cannot move to finalizadas: ${err.message}`);
    }
  }

  static async moveFinalizadaPhoto({ loteNumero, gtin, filename, fromSubfolder = null, toSubfolder = null }) {
    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const cleanFilename = validateFilename(filename);
    if (cleanFilename !== filename) throw new Error('Filename must not include a path');
    if (fromSubfolder && !['AP', 'AT'].includes(fromSubfolder)) throw new Error(`Invalid source subfolder: ${fromSubfolder}`);
    if (toSubfolder && !['AP', 'AT'].includes(toSubfolder)) throw new Error(`Invalid destination subfolder: ${toSubfolder}`);

    const baseDir = securePath(path.join(config.paths.finalizadas, `LOTE ${components.loteNumero}`, components.gtin), config.paths.finalizadas);
    const srcDir = fromSubfolder ? path.join(baseDir, fromSubfolder) : baseDir;
    const destDir = toSubfolder ? path.join(baseDir, toSubfolder) : baseDir;
    const srcPath = securePath(path.join(srcDir, cleanFilename), config.paths.finalizadas);
    await createSecureDirectory(destDir, config.paths.finalizadas);

    for (let counter = 0; ; counter++) {
      const destPath = securePath(await this.uniqueDestPath(destDir, cleanFilename, counter), config.paths.finalizadas);
      try {
        await fs.promises.copyFile(srcPath, destPath, fs.constants.COPYFILE_EXCL);
      } catch (err) {
        if (err.code === 'EEXIST') continue;
        throw err;
      }
      try {
        await fs.promises.unlink(srcPath);
      } catch (err) {
        await fs.promises.unlink(destPath).catch(() => {});
        throw err;
      }
      return { srcPath, destPath, destName: path.basename(destPath) };
    }
  }

  static async deleteFinalizadaPhoto({ loteNumero, gtin, filename, location = null }) {
    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const cleanFilename = validateFilename(filename);
    if (cleanFilename !== filename) throw new Error('Filename must not include a path');
    const subfolder = location === 'root' ? null : location;
    if (subfolder && !['AP', 'AT'].includes(subfolder)) throw new Error('location must be root, AP, or AT');
    const baseDir = securePath(path.join(config.paths.finalizadas, `LOTE ${components.loteNumero}`, components.gtin), config.paths.finalizadas);
    const filePath = securePath(path.join(subfolder ? path.join(baseDir, subfolder) : baseDir, cleanFilename), config.paths.finalizadas);
    await fs.promises.unlink(filePath);
    return { filePath, filename: cleanFilename, location: subfolder || 'root' };
  }

  /**
   * Lista imagens em um diretório Finalizadas
   */
  static async listFinalizadasImages(loteNumero, gtin, subfolder = null) {
    try {
      let dirPath = path.join(
        config.paths.finalizadas,
        `LOTE ${loteNumero}`,
        gtin
      );

      if (subfolder) {
        if (!['AP', 'AT'].includes(subfolder)) {
          throw new Error(`Invalid subfolder: ${subfolder}`);
        }
        dirPath = path.join(dirPath, subfolder);
      }

      return await listAllowedFiles(dirPath, config.paths.finalizadas);
    } catch (err) {
      throw new Error(`Cannot list finalizadas images: ${err.message}`);
    }
  }

  /**
   * Remove arquivo de TEMP com auditoria
   */
  static async removeFromTemp(filePath) {
    try {
      const safe = securePath(filePath, config.paths.imagesTemp);
      const filename = path.basename(safe);

      await removeSecureFile(filePath, config.paths.imagesTemp);
      await auditDelete(safe, { location: 'temp' });

      return { removed: filename };
    } catch (err) {
      throw new Error(`Cannot remove temp file: ${err.message}`);
    }
  }

  /**
   * Remove múltiplos arquivos de TEMP com confirmação
   */
  static async clearTemp(filenames) {
    try {
      if (!Array.isArray(filenames) || filenames.length === 0) {
        throw new Error('No files to remove');
      }

      const removed = [];
      const failed = [];

      for (const filename of filenames) {
        try {
          validateFilename(filename);
          const filePath = path.join(config.paths.imagesTemp, filename);
          await removeSecureFile(filePath);
          removed.push(filename);
        } catch (err) {
          failed.push({ filename, error: err.message });
        }
      }

      if (removed.length > 0) {
        await auditDelete(config.paths.imagesTemp, {
          action: 'clearTemp',
          count: removed.length,
          files: removed
        });
      }

      return { removed, failed };
    } catch (err) {
      throw new Error(`Cannot clear temp: ${err.message}`);
    }
  }

  /**
   * Cria snapshot de arquivos em TEMP no momento da operação
   * Retorna lista de nomes de arquivo estáveis
   */
  static async snapshotTempFiles() {
    try {
      const files = await this.listTempImages();

      // Aguarda estabilidade de cada arquivo
      const stable = [];
      for (const file of files) {
        try {
          await this.waitForFileStable(file.path, 2000);
          stable.push({
            name: file.name,
            path: file.path
          });
        } catch {
          // Arquivo ainda instável, ignora
        }
      }

      return stable;
    } catch (err) {
      throw new Error(`Cannot snapshot temp files: ${err.message}`);
    }
  }

  /**
   * Move snapshot de arquivos para Finalizadas
   */
  static async moveSnapshotToFinalizadas(snapshot, loteNumero, gtin) {
    try {
      const moved = [];
      const failed = [];
      const warnings = [];

      for (const file of snapshot) {
        try {
          const result = await this.moveToFinalizadas(file.path, loteNumero, gtin);
          moved.push({
            src: file.name,
            dest: path.basename(result.destPath)
          });
          if (result.warning) warnings.push({ file: file.name, ...result.warning });
        } catch (err) {
          failed.push({
            file: file.name,
            error: err.message
          });
        }
      }

      return { moved, failed, warnings };
    } catch (err) {
      throw new Error(`Cannot move snapshot: ${err.message}`);
    }
  }
}

export default FileRepository;
