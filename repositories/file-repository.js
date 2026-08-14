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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
          try {
            await fs.promises.unlink(destPath);
          } catch (cleanupError) {
            throw new Error(
              `Source cleanup failed after exclusive copy (${unlinkError.message}); ` +
              `destination cleanup also failed (${cleanupError.message})`
            );
          }
          throw new Error(`Source cleanup failed after exclusive copy; destination copy was removed (${unlinkError.message})`);
        }
        return destPath;
      }
    } catch (err) {
      throw new Error(`Cannot move to finalizadas: ${err.message}`);
    }
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

      return await listAllowedFiles(dirPath);
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

      for (const file of snapshot) {
        try {
          const destPath = await this.moveToFinalizadas(file.path, loteNumero, gtin);
          moved.push({
            src: file.name,
            dest: path.basename(destPath)
          });
        } catch (err) {
          failed.push({
            file: file.name,
            error: err.message
          });
        }
      }

      return { moved, failed };
    } catch (err) {
      throw new Error(`Cannot move snapshot: ${err.message}`);
    }
  }
}

export default FileRepository;
