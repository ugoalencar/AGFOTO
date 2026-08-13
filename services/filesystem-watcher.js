import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Monitora mudanças no diretório images/temp/
 * Usa fs.watch com fallback para polling se o watcher falhar
 */
export class FilesystemWatcher {
  constructor(watchDir = null) {
    this.watchDir = watchDir || config.paths.imagesTemp;
    this.watchers = new Map();
    this.listeners = new Set();
    this.lastKnownFiles = new Set();
    this.pollingInterval = null;
    this.pollingMs = 2000;
  }

  /**
   * Inicia o watcher com fallback para polling
   */
  async start() {
    try {
      // Cria diretório se não existir
      await fs.promises.mkdir(this.watchDir, { recursive: true });

      // Tenta usar fs.watch nativo
      this._startNativeWatcher();

      // Também inicia polling como fallback
      this._startPolling();

      console.log(`✓ Filesystem watcher started: ${this.watchDir}`);
    } catch (err) {
      console.warn(`Watcher error: ${err.message}, falling back to polling`);
      this._startPolling();
    }
  }

  /**
   * Inicia native fs.watch
   */
  _startNativeWatcher() {
    try {
      const watcher = fs.watch(this.watchDir, { recursive: false }, (eventType, filename) => {
        if (filename && (eventType === 'change' || eventType === 'rename')) {
          this._notifyListeners();
        }
      });

      watcher.on('error', (err) => {
        console.warn(`Native watcher error: ${err.message}`);
      });

      this.watchers.set('native', watcher);
    } catch (err) {
      console.warn(`Cannot start native watcher: ${err.message}`);
    }
  }

  /**
   * Inicia polling como fallback
   */
  _startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this._checkForChanges();
    }, this.pollingMs);
  }

  /**
   * Verifica mudanças pelo polling
   */
  async _checkForChanges() {
    try {
      const files = await fs.promises.readdir(this.watchDir);
      const currentFiles = new Set(files);

      // Detecta adições ou removals
      const hasChanges =
        currentFiles.size !== this.lastKnownFiles.size ||
        [...currentFiles].some(f => !this.lastKnownFiles.has(f));

      if (hasChanges) {
        this.lastKnownFiles = currentFiles;
        this._notifyListeners();
      }
    } catch (err) {
      console.warn(`Polling error: ${err.message}`);
    }
  }

  /**
   * Registra listener para mudanças
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);

      // Retorna função para unsubscribe
      return () => {
        this.listeners.delete(callback);
      };
    }
  }

  /**
   * Notifica todos os listeners
   */
  _notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error(`Listener error: ${err.message}`);
      }
    }
  }

  /**
   * Para o watcher
   */
  stop() {
    // Para native watcher
    for (const [name, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (err) {
        console.warn(`Error closing watcher ${name}: ${err.message}`);
      }
    }

    // Para polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log('✓ Filesystem watcher stopped');
  }
}

// Instância global singleton
let watcherInstance = null;

export function getWatcher() {
  if (!watcherInstance) {
    watcherInstance = new FilesystemWatcher();
  }
  return watcherInstance;
}

export function resetWatcher() {
  if (watcherInstance) {
    watcherInstance.stop();
  }
  watcherInstance = null;
}

export default { FilesystemWatcher, getWatcher, resetWatcher };
