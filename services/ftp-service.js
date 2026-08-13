import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from '../server/audit-logger.js';
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
    console.log('🔌 Mock FTP: Connecting...');
    this.connected = true;
    return true;
  }

  async disconnect() {
    console.log('🔌 Mock FTP: Disconnecting...');
    this.connected = false;
    return true;
  }

  async uploadFile(localPath, remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // Simula upload de arquivo
    console.log(`📤 Mock FTP: Upload ${localPath} → ${remotePath}`);

    const fakeSize = Math.random() * 5000000 + 500000; // 0.5-5.5 MB
    const fakeHash = uuidv4();

    this.files.set(remotePath, {
      size: fakeSize,
      hash: fakeHash,
      uploadedAt: new Date().toISOString()
    });

    // Simula delay
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      size: fakeSize,
      hash: fakeHash
    };
  }

  async listFiles(remotePath) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    console.log(`📋 Mock FTP: List ${remotePath}`);

    const files = [];
    const normPath = remotePath.endsWith('/') ? remotePath : `${remotePath}/`;

    for (const [path, info] of this.files.entries()) {
      if (path.startsWith(normPath)) {
        const relativeName = path.substring(normPath.length);
        // Only include direct children, not subdirectories
        if (!relativeName.includes('/')) {
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

    console.log(`📝 Mock FTP: Rename ${oldPath} → ${newPath}`);

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

    console.log(`🗑️ Mock FTP: Delete ${remotePath}`);
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
    const remote = baseRemote || this.remoteTemplate;

    // Substitui template
    let path = remote
      .replace('<remoteRoot>', config.ftp?.remoteRoot || '/fotos')
      .replace('<lote>', lote)
      .replace('<codigo>', codigo);

    // Bloqueia path traversal, absolute paths
    if (path.includes('..') || path.startsWith('/') && path[1] === '/' || path.includes('\\')) {
      throw new Error('Invalid remote path');
    }

    return path;
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
      console.log('✓ FTP connected');
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
      console.log('✓ FTP disconnected');
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
