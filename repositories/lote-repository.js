import path from 'path';
import { fileURLToPath } from 'url';
import { Lote } from '../domain/lote.js';
import { readJsonSafe, writeJsonAtomic, updateJsonSafe } from '../server/json-persistence.js';
import { createSecureDirectory, securePath } from '../server/secure-filesystem.js';
import { config } from '../server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Repository para gerenciar Lotes (persistência em JSON)
 */
export class LoteRepository {
  /**
   * Obtém caminho seguro para arquivo JSON de um lote
   */
  static getLoteJsonPath(numero) {
    const filename = `Lote_${numero}.json`;
    return path.join(config.paths.jsons, filename);
  }

  /**
   * Obtém caminho seguro para diretório Finalizadas de um lote
   */
  static getLoteFinalizadasPath(numero) {
    const dirname = `LOTE ${numero}`;
    return path.join(config.paths.finalizadas, dirname);
  }

  /**
   * Carrega um lote existente ou cria novo
   */
  static async loadOrCreate(numero) {
    try {
      Lote.normalize(numero);
      if (!Lote.isValid(numero)) {
        throw new Error(`Invalid lote number: ${numero}`);
      }

      const jsonPath = this.getLoteJsonPath(numero);
      let data;

      try {
        data = await readJsonSafe(jsonPath);
        return Lote.fromJSON(data);
      } catch (err) {
        // Lote não existe, cria novo
        const lote = new Lote(numero);

        // Cria diretórios
        await createSecureDirectory(this.getLoteFinalizadasPath(numero), config.paths.root);
        await createSecureDirectory(config.paths.jsons, config.paths.root);

        // Salva JSON inicial
        await writeJsonAtomic(jsonPath, lote.toJSON(), { backupDir: config.paths.backups });

        return lote;
      }
    } catch (err) {
      throw new Error(`Failed to load or create lote: ${err.message}`);
    }
  }

  /**
   * Carrega lote existente
   */
  static async load(numero) {
    try {
      Lote.normalize(numero);
      const jsonPath = this.getLoteJsonPath(numero);
      const data = await readJsonSafe(jsonPath);
      return Lote.fromJSON(data);
    } catch (err) {
      throw new Error(`Failed to load lote: ${err.message}`);
    }
  }

  /**
   * Salva um lote
   */
  static async save(lote) {
    try {
      if (!(lote instanceof Lote)) {
        throw new Error('Invalid lote object');
      }

      const jsonPath = this.getLoteJsonPath(lote.numero);
      await createSecureDirectory(path.dirname(jsonPath), config.paths.root);
      await writeJsonAtomic(jsonPath, lote.toJSON(), { backupDir: config.paths.backups });

      return jsonPath;
    } catch (err) {
      throw new Error(`Failed to save lote: ${err.message}`);
    }
  }

  /**
   * Atualiza um lote de forma segura (lê, modifica, escreve)
   */
  static async update(numero, updater) {
    try {
      const jsonPath = this.getLoteJsonPath(numero);
      const result = await updateJsonSafe(jsonPath, (data) => {
        const lote = Lote.fromJSON(data);
        updater(lote);
        return lote.toJSON();
      });
      return result;
    } catch (err) {
      throw new Error(`Failed to update lote: ${err.message}`);
    }
  }

  /**
   * Lista todos os lotes existentes
   */
  static async listAll() {
    try {
      await createSecureDirectory(config.paths.jsons, config.paths.root);

      const fs = await import('fs');
      const entries = await fs.promises.readdir(config.paths.jsons);

      const lotes = [];
      for (const entry of entries) {
        if (entry.startsWith('Lote_') && entry.endsWith('.json')) {
          try {
            const numero = entry.replace(/^Lote_/, '').replace(/\.json$/, '');
            const data = await readJsonSafe(path.join(config.paths.jsons, entry));
            lotes.push(Lote.fromJSON(data));
          } catch (err) {
            console.warn(`Cannot load lote from ${entry}: ${err.message}`);
          }
        }
      }

      return lotes.sort((a, b) => a.numero.localeCompare(b.numero));
    } catch (err) {
      throw new Error(`Failed to list lotes: ${err.message}`);
    }
  }

  /**
   * Verifica se lote existe
   */
  static async exists(numero) {
    try {
      const jsonPath = this.getLoteJsonPath(numero);
      const fs = await import('fs');
      await fs.promises.access(jsonPath);
      return true;
    } catch {
      return false;
    }
  }
}

export default LoteRepository;
