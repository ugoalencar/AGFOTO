import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../server/config.js';

/**
 * Contrato FTP Provider
 * Implementar MockFtpProvider para testes ou RealFtpProvider para produção
 */
export class FtpProvider {
  async connect() {
    throw new Error('Not implemented');
  }

  async disconnect() {
    throw new Error('Not implemented');
  }

  async uploadFile(localPath, remotePath) {
    throw new Error('Not implemented');
  }

  async listFiles(remotePath) {
    throw new Error('Not implemented');
  }

  async verifyFile(remotePath) {
    throw new Error('Not implemented');
  }

  async renameRemote(oldPath, newPath) {
    throw new Error('Not implemented');
  }

  async deleteRemote(remotePath) {
    throw new Error('Not implemented');
  }
}

/**
 * Mock FTP Provider para desenvolvimento/testes
 * Simula FTP sem conexão real
 */
export class MockFtpProvider extends FtpProvider {
  constructor() {
    super();
    this.connected = false;
    this.files = new Map(); // path -> { size, hash, uploadedAt }
  }

  async connect() {
    this.connected = true;
    return true;
  }

  async disconnect() {
    this.connected = false;
    return true;
  }

  async uploadFile(localPath, remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const contents = await fs.promises.readFile(localPath);
    const size = contents.length;
    const hash = crypto.createHash('sha256').update(contents).digest('hex');

    this.files.set(remotePath, {
      size,
      hash,
      uploadedAt: new Date().toISOString()
    });

    return {
      success: true,
      size,
      hash
    };
  }

  async listFiles(remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const files = [];

    for (const [filePath, info] of this.files.entries()) {
      const relativeName = path.relative(remotePath, filePath);
      if (relativeName && !relativeName.startsWith('..') && !path.isAbsolute(relativeName)) {
        if (!relativeName.includes(path.sep)) {
          files.push({
            name: relativeName,
            size: info.size,
            hash: info.hash,
            uploadedAt: info.uploadedAt
          });
        }
      }
    }

    return files;
  }

  async verifyFile(remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const file = this.files.get(remotePath);
    if (!file) {
      return { exists: false };
    }

    return {
      exists: true,
      size: file.size,
      hash: file.hash
    };
  }

  async renameRemote(oldPath, newPath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const file = this.files.get(oldPath);
    if (!file) {
      throw new Error(`File not found: ${oldPath}`);
    }

    this.files.delete(oldPath);
    this.files.set(newPath, file);

    return { success: true };
  }

  async deleteRemote(remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    this.files.delete(remotePath);
    return { success: true };
  }
}

/**
 * Serviço FTP para gerenciar uploads e entregas
 */
export class FtpService {
  constructor(provider = null) {
    // Por padrão usa mock
    this.provider = provider || new MockFtpProvider();
    this.remoteTemplate = config.ftp?.remoteTemplate || '<remoteRoot>/LOTE <lote>/<codigo>';
  }

  /**
   * Valida e constrói caminho remoto
   */
  buildRemotePath(lote, codigo, baseRemote = null) {
    if (typeof lote !== 'string' || typeof codigo !== 'string' || lote.includes('..') || codigo.includes('..') || /[\\/:*?"<>|]/.test(codigo)) {
      throw new Error('Invalid remote path');
    }
    return path.join(baseRemote || config.ftp?.remoteRoot || 'remote-ftp', `LOTE ${lote}`, codigo);
  }

  /**
   * Prepara staging local antes de enviar
   */
  async prepareStaging(lote, gtin, codigo, deliveryType) {
    try {
      // TODO: Implementar staging
      // Verificar se fotos existem em Finalizadas
      // Copiar para Entrega/LOTE/CODIGO/
      // Selecionar apenas imagens elegíveis (raiz vs AT)

      return {
        ok: true,
        data: {
          message: 'Staging prepared',
          location: `Entrega/LOTE ${lote}/${codigo}`
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
   * Conecta ao FTP
   */
  async connect() {
    try {
      await this.provider.connect();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Desconecta do FTP
   */
  async disconnect() {
    try {
      await this.provider.disconnect();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Faz upload de arquivo
   */
  async uploadFile(localPath, remotePath) {
    try {
      const result = await this.provider.uploadFile(localPath, remotePath);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Lista arquivos remotos
   */
  async listRemoteFiles(remotePath) {
    try {
      const files = await this.provider.listFiles(remotePath);
      return { ok: true, data: { files, count: files.length } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Verifica arquivo remoto
   */
  async verifyRemoteFile(remotePath) {
    try {
      const result = await this.provider.verifyFile(remotePath);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Renomeia arquivo remoto
   */
  async renameRemoteFile(oldPath, newPath) {
    try {
      const result = await this.provider.renameRemote(oldPath, newPath);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Deleta arquivo remoto
   */
  async deleteRemoteFile(remotePath) {
    try {
      const result = await this.provider.deleteRemote(remotePath);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

// Instância global
let ftpServiceInstance = null;

export function getFtpService(provider = null) {
  if (!ftpServiceInstance) {
    ftpServiceInstance = new FtpService(provider);
  }
  return ftpServiceInstance;
}

export function resetFtpService(provider = null) {
  ftpServiceInstance = new FtpService(provider);
  return ftpServiceInstance;
}

export default {
  FtpProvider,
  MockFtpProvider,
  FtpService,
  getFtpService,
  resetFtpService
};
