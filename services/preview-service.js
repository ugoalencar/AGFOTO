import fs from 'fs';
import path from 'path';
import { config as defaultConfig } from '../server/config.js';
import { assertInsideRoot, securePath, validateFilename, validateImageSignature } from '../server/secure-filesystem.js';

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
}
