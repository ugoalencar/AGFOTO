import fs from 'fs';
import path from 'path';
import { config as defaultConfig } from '../server/config.js';
import { assertInsideRoot, securePath, validateFilename, validateImageSignature } from '../server/secure-filesystem.js';
import { SUBPASTAS_VALIDAS } from '../repositories/file-repository.js';

export class PreviewService {
  constructor({ config = defaultConfig } = {}) { this.config = config; }

  async resolveTempImage(filename) {
    if (filename !== path.basename(filename)) throw new Error(`Path traversal attempt: ${filename}`);
    const filePath = securePath(validateFilename(filename), this.config.paths.imagesTemp);
    const [realTempRoot, realFilePath] = await Promise.all([
      fs.promises.realpath(this.config.paths.imagesTemp),
      fs.promises.realpath(filePath)
    ]);
    assertInsideRoot(realFilePath, realTempRoot);
    await validateImageSignature(realFilePath);
    return realFilePath;
  }

  async resolveFinalizedImage(lote, gtin, filename, subfolder = null) {
    if (filename !== path.basename(filename)) throw new Error(`Path traversal attempt: ${filename}`);
    let dirPath = path.join(this.config.paths.finalizadas, `LOTE ${lote}`, gtin);
    if (subfolder) {
      if (!SUBPASTAS_VALIDAS.includes(subfolder)) throw new Error(`Invalid subfolder: ${subfolder}`);
      dirPath = path.join(dirPath, subfolder);
    }
    const filePath = securePath(validateFilename(filename), dirPath);
    const [realFinalRoot, realFilePath] = await Promise.all([
      fs.promises.realpath(this.config.paths.finalizadas),
      fs.promises.realpath(filePath)
    ]);
    assertInsideRoot(realFilePath, realFinalRoot);
    await validateImageSignature(realFilePath);
    return realFilePath;
  }
}
