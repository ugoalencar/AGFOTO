import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
function getBackupsDir(backupDir = null) {
  return backupDir || config.paths.backups || path.join(config.paths.dados, 'backups');
}

/**
 * Realiza escrita atômica de JSON com backup automático
 * 1. Escreve em arquivo temporário na mesma pasta
 * 2. Sincroniza
 * 3. Renomeia para destino
 * 4. Mantém backup da última versão válida
 */
export async function writeJsonAtomic(filePath, data, { backupDir = null } = {}) {
  try {
    // Validação básica
    if (!filePath) throw new Error('filePath is required');
    const dir = path.dirname(filePath);

    // Cria diretório se necessário
    await fs.promises.mkdir(dir, { recursive: true });

    // Escreve em arquivo temporário
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    const jsonContent = JSON.stringify(data, null, 2);

    await fs.promises.writeFile(tempPath, jsonContent, 'utf8');

    // Se arquivo original existe, faz backup
    try {
      await fs.promises.access(filePath);
      const backupPath = await createBackup(filePath, backupDir);
      console.log(`Backup created: ${backupPath}`);
    } catch {
      // Arquivo original não existe, ignorar
    }

    // Renomeia arquivo temporário para destino
    await fs.promises.rename(tempPath, filePath);

    return { success: true, path: filePath };
  } catch (err) {
    throw new Error(`Atomic write failed: ${err.message}`);
  }
}

/**
 * Lê JSON com validação e fallback para backup
 */
export async function readJsonSafe(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return data;
  } catch (err) {
    console.error(`Error reading JSON: ${err.message}`);

    // Tenta restaurar do backup
    const backupPath = await findLatestBackup(filePath);
    if (backupPath) {
      console.log(`Attempting to restore from backup: ${backupPath}`);
      try {
        const content = await fs.promises.readFile(backupPath, 'utf8');
        const data = JSON.parse(content);

        // Copia backup de volta
        await fs.promises.copyFile(backupPath, filePath);
        console.log(`Restored from backup: ${backupPath}`);

        return data;
      } catch (backupErr) {
        throw new Error(`Cannot read JSON and backup is also corrupted: ${backupErr.message}`);
      }
    }

    throw new Error(`Cannot read JSON and no backup available: ${err.message}`);
  }
}

/**
 * Cria backup de arquivo JSON
 */
async function createBackup(filePath, backupDir = null) {
  try {
    const backupsDir = getBackupsDir(backupDir);
    await fs.promises.mkdir(backupsDir, { recursive: true });

    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = uuidv4().substring(0, 8);
    const backupPath = path.join(backupsDir, `${filename}.${timestamp}.${id}.bak`);

    await fs.promises.copyFile(filePath, backupPath);
    return backupPath;
  } catch (err) {
    console.error(`Backup creation failed: ${err.message}`);
    throw err;
  }
}

/**
 * Encontra o backup mais recente de um arquivo
 */
async function findLatestBackup(filePath) {
  try {
    const filename = path.basename(filePath);
    const backupsDir = getBackupsDir();
    const entries = await fs.promises.readdir(backupsDir);

    const backups = entries
      .filter(name => name.startsWith(filename))
      .sort()
      .reverse();

    if (backups.length > 0) {
      return path.join(backupsDir, backups[0]);
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Gerencia fila de escrita para evitar conflitos
 */
class WriteQueue {
  constructor() {
    this.queues = new Map();
  }

  async enqueue(filePath, writeOperation) {
    if (!this.queues.has(filePath)) {
      this.queues.set(filePath, Promise.resolve());
    }

    const prevPromise = this.queues.get(filePath);
    const newPromise = prevPromise.then(() => writeOperation());

    this.queues.set(filePath, newPromise);
    return newPromise;
  }
}

export const writeQueue = new WriteQueue();

/**
 * Atualiza um JSON de forma segura (lê, modifica, escreve)
 */
export async function updateJsonSafe(filePath, updater) {
  return writeQueue.enqueue(filePath, async () => {
    const current = await readJsonSafe(filePath).catch(() => ({}));
    const updated = updater(current);
    return writeJsonAtomic(filePath, updated);
  });
}

export default {
  writeJsonAtomic,
  readJsonSafe,
  updateJsonSafe,
  writeQueue
};
