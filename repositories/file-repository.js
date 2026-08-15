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

// Tags de correcao pontual do palco Anterior, iguais as do sphoto.
// RT = Rotulo, IS = Insumos, AP = Apoio.
export const SUBPASTAS_TAG = ['RT', 'IS', 'AP'];

// AT continua existindo porque o QA do AGFOTO ja usa essa pasta; as tags de captura
// sao as do sphoto. Qualquer caminho de subpasta tem que estar nesta lista - o
// PreviewService importa daqui pra nao divergir da validacao de escrita.
export const SUBPASTAS_VALIDAS = [...SUBPASTAS_TAG, 'AT'];

// Nome ja no padrao GTIN_dd_MM_yyyy_HH_mm_ss_indice[_sufixo].ext
const PADRAO_NOME_NORMALIZADO = /^\d+_\d{2}_\d{2}_\d{4}_\d{2}_\d{2}_\d{2}_\d+(_[a-zA-Z0-9]+)*$/;

function normalizeFinalizadaPathComponents(loteNumero, gtin) {
  const normalizedLote = Lote.normalize(loteNumero);
  if (!Lote.isValid(normalizedLote)) throw new Error(`Invalid lote number: ${loteNumero}`);
  if (!Produto.isValid(gtin)) throw new Error(`Invalid GTIN: ${gtin}`);
  return { loteNumero: normalizedLote, gtin: Produto.normalize(gtin) };
}

/**
 * Timestamp no formato do sphoto: dd_MM_yyyy_HH_mm_ss
 */
export function formatTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return [
    pad(date.getDate()),
    pad(date.getMonth() + 1),
    date.getFullYear(),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('_');
}

// Tags que a captura sabe reconhecer no fim de um nome de arquivo.
const TAGS_CONHECIDAS = ['coding', ...SUBPASTAS_TAG];

/**
 * Devolve as tags extras (_coding, _RT, ...) presentes no fim do nome, pra nao
 * serem perdidas ao renomear na hora de salvar.
 *
 * O sphoto so extrai tags de nomes JA normalizados. Isso faz a marcacao feita na
 * TEMP sumir quando o arquivo ainda tem o nome cru da camera (IMG_1234_RT.CR2),
 * que e justamente o caso normal do palco Atual. Aqui o nome cru tambem e lido,
 * mas so para tags conhecidas - senao o "_1234" de IMG_1234 viraria tag.
 */
export function extractExtraSuffixes(nameWithoutExt) {
  const match = nameWithoutExt.match(/^\d+_\d{2}_\d{2}_\d{4}_\d{2}_\d{2}_\d{2}_\d+((?:_[a-zA-Z0-9]+)*)$/);
  if (match) return match[1];

  let restante = nameWithoutExt;
  const encontradas = [];
  for (;;) {
    const tag = TAGS_CONHECIDAS.find(t => restante.endsWith(`_${t}`));
    if (!tag) break;
    encontradas.unshift(`_${tag}`);
    restante = restante.slice(0, -(tag.length + 1));
  }
  return encontradas.join('');
}

/**
 * RT/IS/AP marcadas ainda em TEMP viram sufixo no nome (igual _coding). Na hora de
 * salvar, tira esse sufixo do nome final e devolve a subpasta correspondente.
 */
export function separateSubfolderTag(extraSuffixes) {
  let pasta = null;
  let extrasRestantes = extraSuffixes;
  for (const tag of SUBPASTAS_TAG) {
    const marcador = `_${tag}`;
    if (extrasRestantes.includes(marcador)) {
      if (!pasta) pasta = tag;
      extrasRestantes = extrasRestantes.split(marcador).join('');
    }
  }
  return { pasta, extrasRestantes };
}

/**
 * Aplica ou remove (toggle) um sufixo no nome, preservando a extensao e as demais tags.
 */
export function toggleSuffixInName(filename, suffix) {
  const ext = path.extname(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;
  const next = base.endsWith(suffix)
    ? base.slice(0, -suffix.length)
    : `${base}${suffix}`;
  return `${next}${ext}`;
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
   *
   * @param {string} [targetName] nome final ja renomeado (padrao sphoto). Sem ele
   *   o nome de origem e preservado.
   * @param {string} [subfolder] subpasta RT/IS/AP derivada da tag no nome.
   */
  static async moveToFinalizadas(srcPath, loteNumero, gtin, targetName = null, subfolder = null) {
    try {
      const safeSrc = securePath(srcPath, config.paths.imagesTemp);

      // Valida GTIN
      if (!gtin || typeof gtin !== 'string') {
        throw new Error('GTIN is required');
      }

      if (subfolder && !SUBPASTAS_VALIDAS.includes(subfolder)) {
        throw new Error(`Invalid subfolder: ${subfolder}`);
      }

      // Cria diretório de destino
      let destDir = path.join(
        config.paths.finalizadas,
        `LOTE ${loteNumero}`,
        gtin
      );
      if (subfolder) destDir = path.join(destDir, subfolder);
      await createSecureDirectory(destDir, config.paths.finalizadas);
      const filename = validateFilename(targetName || path.basename(safeSrc));

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
    if (fromSubfolder && !SUBPASTAS_VALIDAS.includes(fromSubfolder)) throw new Error(`Invalid source subfolder: ${fromSubfolder}`);
    if (toSubfolder && !SUBPASTAS_VALIDAS.includes(toSubfolder)) throw new Error(`Invalid destination subfolder: ${toSubfolder}`);

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

  static async resolveFinalizadaPhoto({ loteNumero, gtin, filename, location = null }) {
    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const cleanFilename = validateFilename(filename);
    if (cleanFilename !== filename) throw new Error('Filename must not include a path');
    const subfolder = location === 'root' ? null : location;
    if (subfolder && !SUBPASTAS_VALIDAS.includes(subfolder)) throw new Error(`location must be root or one of ${SUBPASTAS_VALIDAS.join(', ')}`);
    const baseDir = securePath(path.join(config.paths.finalizadas, `LOTE ${components.loteNumero}`, components.gtin), config.paths.finalizadas);
    const filePath = securePath(path.join(subfolder ? path.join(baseDir, subfolder) : baseDir, cleanFilename), config.paths.finalizadas);
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) throw new Error('Finalized photo path is not a file');
    return { filePath, filename: cleanFilename, location: subfolder || 'root' };
  }

  static async deleteFinalizadaPhoto({ loteNumero, gtin, filename, location = null }) {
    const photo = await this.resolveFinalizadaPhoto({ loteNumero, gtin, filename, location });
    await fs.promises.unlink(photo.filePath);
    return photo;
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
        if (!SUBPASTAS_VALIDAS.includes(subfolder)) {
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
   * Move snapshot de arquivos para Finalizadas renomeando no padrao do sphoto:
   * GTIN_dd_MM_yyyy_HH_mm_ss_indice[_sufixos].ext
   *
   * As tags _RT/_IS/_AP marcadas ainda em TEMP saem do nome e viram a subpasta de
   * destino - o resto dos sufixos (ex.: _coding) continua no nome final.
   */
  static async moveSnapshotToFinalizadas(snapshot, loteNumero, gtin) {
    try {
      const moved = [];
      const failed = [];
      const warnings = [];
      const timestamp = formatTimestamp();
      let indice = 0;

      for (const file of snapshot) {
        try {
          const ext = path.extname(file.name);
          const semExt = ext ? file.name.slice(0, -ext.length) : file.name;
          const { pasta, extrasRestantes } = separateSubfolderTag(extractExtraSuffixes(semExt));
          const targetName = `${gtin}_${timestamp}_${indice}${extrasRestantes}${ext}`;

          const result = await this.moveToFinalizadas(file.path, loteNumero, gtin, targetName, pasta);
          moved.push({
            src: file.name,
            dest: path.basename(result.destPath),
            subfolder: pasta || 'raiz'
          });
          indice++;
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

  /**
   * Grava as observacoes do GTIN como .txt na pasta do produto (igual sphoto).
   */
  static async writeObservacoes(loteNumero, gtin, texto) {
    const conteudo = String(texto ?? '').trim();
    if (!conteudo) return null;

    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const destDir = path.join(
      config.paths.finalizadas,
      `LOTE ${components.loteNumero}`,
      components.gtin
    );
    await createSecureDirectory(destDir, config.paths.finalizadas);
    const filename = `${formatTimestamp()}.txt`;
    const destPath = securePath(path.join(destDir, filename), config.paths.finalizadas);
    await fs.promises.writeFile(destPath, conteudo, 'utf8');
    return { filename, destPath };
  }

  /**
   * Toggle de sufixo (_coding, _RT, ...) no nome dos arquivos marcados.
   * location = 'temp' (images/temp) ou 'finalizadas' (LOTE/GTIN).
   */
  static async toggleSuffix({ location, filenames, suffix, loteNumero = null, gtin = null }) {
    if (!Array.isArray(filenames) || filenames.length === 0) {
      throw new Error('No files specified');
    }
    if (!/^_[a-zA-Z0-9]+$/.test(String(suffix || ''))) {
      throw new Error(`Invalid suffix: ${suffix}`);
    }

    let baseDir;
    let root;
    if (location === 'temp') {
      baseDir = config.paths.imagesTemp;
      root = config.paths.imagesTemp;
    } else if (location === 'finalizadas') {
      const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
      baseDir = path.join(config.paths.finalizadas, `LOTE ${components.loteNumero}`, components.gtin);
      root = config.paths.finalizadas;
    } else {
      throw new Error(`Invalid location: ${location}`);
    }

    const renamed = [];
    const failed = [];

    for (const filename of filenames) {
      try {
        const clean = validateFilename(filename);
        if (clean !== filename) throw new Error('Filename must not include a path');

        const srcPath = securePath(path.join(baseDir, clean), root);
        const nextName = toggleSuffixInName(clean, suffix);
        const destPath = securePath(path.join(baseDir, nextName), root);

        if (srcPath !== destPath) {
          await fs.promises.rename(srcPath, destPath);
        }
        renamed.push({ from: clean, to: nextName });
      } catch (err) {
        failed.push({ filename, error: err.message });
      }
    }

    return { renamed, failed };
  }

  /**
   * Toggle de subpasta RT/IS/AP no palco Anterior: se o arquivo ja esta na pasta
   * pedida ele volta pra raiz, senao vai pra la. Mesma semantica do sphoto.
   */
  static async toggleSubfolderTag({ loteNumero, gtin, filenames, pasta }) {
    if (!SUBPASTAS_TAG.includes(pasta)) {
      throw new Error('Pasta deve ser RT, IS ou AP');
    }
    if (!Array.isArray(filenames) || filenames.length === 0) {
      throw new Error('No files specified');
    }

    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const baseDir = securePath(
      path.join(config.paths.finalizadas, `LOTE ${components.loteNumero}`, components.gtin),
      config.paths.finalizadas
    );

    const movedFiles = [];
    const failed = [];

    for (const filename of filenames) {
      try {
        const clean = validateFilename(filename);
        if (clean !== filename) throw new Error('Filename must not include a path');

        // Descobre onde o arquivo esta agora: raiz ou uma das subpastas de tag.
        let origemAtual;
        if (fs.existsSync(path.join(baseDir, clean))) {
          origemAtual = null;
        } else {
          for (const tag of SUBPASTAS_TAG) {
            if (fs.existsSync(path.join(baseDir, tag, clean))) {
              origemAtual = tag;
              break;
            }
          }
        }
        if (origemAtual === undefined) throw new Error('File not found');

        const vaiParaRaiz = origemAtual === pasta;
        const srcDir = origemAtual ? path.join(baseDir, origemAtual) : baseDir;
        const destDir = vaiParaRaiz ? baseDir : path.join(baseDir, pasta);

        if (!vaiParaRaiz) await createSecureDirectory(destDir, config.paths.finalizadas);

        const srcPath = securePath(path.join(srcDir, clean), config.paths.finalizadas);
        const destPath = securePath(path.join(destDir, clean), config.paths.finalizadas);
        await fs.promises.rename(srcPath, destPath);

        movedFiles.push({ filename: clean, to: vaiParaRaiz ? 'raiz' : pasta });
      } catch (err) {
        failed.push({ filename, error: err.message });
      }
    }

    return { moved: movedFiles, failed };
  }

  /**
   * Lista as imagens que estao nas subpastas RT/IS/AP de um GTIN.
   */
  static async listSubfolderImages(loteNumero, gtin) {
    const components = normalizeFinalizadaPathComponents(loteNumero, gtin);
    const baseDir = path.join(
      config.paths.finalizadas,
      `LOTE ${components.loteNumero}`,
      components.gtin
    );

    const resultado = {};
    for (const tag of SUBPASTAS_TAG) {
      try {
        const files = await listAllowedFiles(path.join(baseDir, tag), config.paths.finalizadas);
        if (files.length > 0) {
          resultado[tag] = files.map(file => ({ name: file.name }));
        }
      } catch {
        // subpasta inexistente - nada a listar
      }
    }
    return resultado;
  }
}

export default FileRepository;
