import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Lote } from '../domain/lote.js';
import { readJsonSafe, writeJsonAtomic, updateJsonSafe } from '../server/json-persistence.js';
import { createSecureDirectory, securePath } from '../server/secure-filesystem.js';
import { config } from '../server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Extensoes que contam como "tem imagem" ao decidir o que a Captura e o QA mostram.
const EXTENSOES_IMAGEM = ['.jpg', '.jpeg', '.png', '.webp', '.cr2', '.cr3', '.nef', '.arw', '.dng'];

function ehImagem(nome) {
  return EXTENSOES_IMAGEM.includes(path.extname(nome).toLowerCase());
}

async function listarDiretorios(dirPath) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch {
    return [];
  }
}

// Conta as imagens da pasta e de qualquer subpasta dela (AP/AT/RT/IS).
async function contarImagens(dirPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let total = 0;
  for (const entry of entries) {
    if (entry.isFile() && ehImagem(entry.name)) total++;
    else if (entry.isDirectory()) total += await contarImagens(path.join(dirPath, entry.name));
  }
  return total;
}

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
   * Sincroniza lotes do diretório Finalizadas com JSONs
   * Cria/atualiza JSONs para cada lote encontrado
   */
  static async syncFinalizadasLotes() {
    try {
      const fs = await import('fs');
      await createSecureDirectory(config.paths.jsons, config.paths.root);

      const finalDir = config.paths.finalizadas;

      // Cria o diretório Finalizadas se não existir (sem validação de segurança, pois está configurado explicitamente)
      try {
        await fs.promises.mkdir(finalDir, { recursive: true });
      } catch (err) {
        console.warn(`[SYNC] Cannot create/access Finalizadas directory: ${err.message}`);
        return [];
      }

      let entries;
      try {
        entries = await fs.promises.readdir(finalDir, { withFileTypes: true });
      } catch (err) {
        console.warn(`[SYNC] Cannot read Finalizadas directory: ${err.message}`);
        return [];
      }

      const syncedLotes = [];

      for (const entry of entries) {

        if (entry.isDirectory() && entry.name.startsWith('LOTE ')) {
          const numero = entry.name.replace(/^LOTE /, '');
          const jsonPath = this.getLoteJsonPath(numero);

          try {
            // Verifica se JSON existe
            let lote;
            let needsUpdate = false;
            try {
              const data = await readJsonSafe(jsonPath);
              lote = Lote.fromJSON(data);
            } catch (err) {
              // Cria novo lote se JSON não existir
              lote = new Lote(numero);
              needsUpdate = true;
            }

            // Escaneia os GTINs no diretório do lote
            const loteFinalDir = path.join(finalDir, `LOTE ${numero}`);
            try {
              const gtinEntries = await fs.promises.readdir(loteFinalDir, { withFileTypes: true });
              for (const gtinEntry of gtinEntries) {
                if (gtinEntry.isDirectory()) {
                  const gtin = gtinEntry.name;
                  // Valida se é GTIN válido (aceita qualquer sequência de dígitos)
                  if (!/^\d{1,64}$/.test(gtin)) continue;

                  if (!lote.itens[gtin]) {
                    // Usa getOrCreateItem para criar produtos corretamente
                    lote.getOrCreateItem(gtin, gtin, gtin);
                    needsUpdate = true;
                  }
                }
              }
            } catch (err) {
              console.warn(`[SYNC] Cannot read GTINs for lote ${numero}: ${err.message}`);
            }

            if (needsUpdate) {
              await writeJsonAtomic(jsonPath, lote.toJSON(), { backupDir: config.paths.backups });
            }

            syncedLotes.push(lote);
          } catch (err) {
            console.warn(`[SYNC] Cannot sync lote ${numero}: ${err.message}`);
          }
        }
      }

      return syncedLotes.sort((a, b) => a.numero.localeCompare(b.numero));
    } catch (err) {
      console.warn(`[SYNC] Failed to sync Finalizadas lotes: ${err.message}`);
      return [];
    }
  }

  /**
   * Lista todos os lotes existentes
   * Sincroniza com Finalizadas primeiro, depois carrega JSONs
   */
  /**
   * Numeros de lote que existem fisicamente em disco.
   *
   * Imagem so mora em Finalizadas e Entrega. Um lote que perdeu as pastas (por
   * exemplo, limpo depois de entregue) some da Captura e do QA - o historico dele
   * continua no JSON e continua saindo nos relatorios.
   *
   * Aqui basta a pasta do lote existir, mesmo vazia: loadOrCreate cria a pasta ao
   * abrir o lote, e e ela que deixa um lote novo aparecer na Captura antes da
   * primeira foto. O corte por imagem e no nivel do GTIN (listGtinsWithImages).
   */
  static async listLoteNumbersOnDisk() {
    const numeros = new Set();

    for (const raiz of [config.paths.finalizadas, config.paths.entrega]) {
      for (const nome of await listarDiretorios(raiz)) {
        if (nome.startsWith('LOTE ')) {
          const numero = nome.replace(/^LOTE /, '').trim();
          if (numero) numeros.add(numero);
        }
      }
    }

    return numeros;
  }

  /**
   * GTINs de um lote que tem imagem em disco, e quantas (contando AP/AT/RT/IS).
   *
   * A contagem sai do disco de proposito: o quantidadeFotos do JSON e historico
   * acumulado e nao cai quando o usuario apaga arquivo, entao serve para
   * relatorio, nao para a tela que gerencia imagem.
   */
  static async listGtinsWithImages(numero) {
    const contagem = new Map();
    const loteDir = path.join(config.paths.finalizadas, `LOTE ${numero}`);

    for (const gtin of await listarDiretorios(loteDir)) {
      const total = await contarImagens(path.join(loteDir, gtin));
      if (total > 0) contagem.set(gtin, total);
    }

    return contagem;
  }

  /**
   * Lotes que a Captura e o QA podem ver: os que tem pasta em disco.
   *
   * A sincronizacao roda antes, entao uma pasta colocada na mao vira JSON e passa
   * a aparecer. Sem JSON correspondente o lote e ignorado.
   */
  static async listWithImages() {
    const [todos, naDisco] = await Promise.all([
      this.listAll(),
      this.listLoteNumbersOnDisk()
    ]);

    return todos.filter(lote => naDisco.has(lote.numero));
  }

  static async listAll() {
    try {
      await createSecureDirectory(config.paths.jsons, config.paths.root);

      // Sincroniza lotes do diretório Finalizadas
      await this.syncFinalizadasLotes();

      // Lista todos os JSONs
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
