import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Extensões permitidas para imagens
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const IMAGE_FORMAT_BY_EXTENSION = {
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.png': 'png',
  '.gif': 'gif',
  '.webp': 'webp'
};
const ALLOWED_IMAGE_SIGNATURES = {
  jpg: buffer => buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF])),
  png: buffer => buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47])),
  gif: buffer => buffer.subarray(0, 3).equals(Buffer.from([0x47, 0x49, 0x46])),
  webp: buffer => (
    buffer.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
    buffer.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))
  )
};

// Nomes reservados do Windows
const WINDOWS_RESERVED = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

/**
 * Valida e resolve um caminho para estar dentro de uma raiz permitida
 * @throws {Error} se o caminho escapar da raiz
 */
export function securePath(userPath, allowedRoot = ROOT) {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  const normalized = path.resolve(path.isAbsolute(userPath) ? userPath : path.join(allowedRoot, userPath));

  // Verifica se está realmente dentro da raiz
  assertInsideRoot(normalized, allowedRoot);

  // Rejeita caminhos UNC (\\server\share)
  if (normalized.startsWith('\\\\')) {
    throw new Error('UNC paths not allowed');
  }

  return normalized;
}

export function assertInsideRoot(resolvedPath, allowedRoot) {
  const root = path.resolve(allowedRoot);
  const target = path.resolve(resolvedPath);
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return target;
  throw new Error(`Path traversal attempt: ${resolvedPath}`);
}

/**
 * Valida componentes de nome de arquivo
 */
export function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }

  const baseName = path.basename(filename);
  if (baseName === '.' || baseName === '..') {
    throw new Error(`Invalid filename: ${baseName}`);
  }
  const upperName = baseName.toUpperCase().split('.')[0];

  // Rejeita nomes reservados do Windows
  if (WINDOWS_RESERVED.includes(upperName)) {
    throw new Error(`Reserved Windows name: ${baseName}`);
  }

  // Rejeita caracteres inválidos
  if (/[<>:"|?*]/.test(baseName)) {
    throw new Error(`Invalid characters in filename: ${baseName}`);
  }

  return baseName;
}

/**
 * Valida extensão de imagem por assinatura, não somente extensão
 */
export async function validateImageSignature(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`Image extension not allowed: ${ext}`);
  }

  // Lê os primeiros bytes para validar assinatura
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(16);
    await fd.read(buffer, 0, 16, 0);
    await fd.close();

    const expectedFormat = IMAGE_FORMAT_BY_EXTENSION[ext];
    if (ALLOWED_IMAGE_SIGNATURES[expectedFormat](buffer)) {
      return expectedFormat;
    }

    throw new Error('Invalid image signature');
  } catch (err) {
    throw new Error(`Cannot validate image: ${err.message}`);
  }
}

/**
 * Monitora estabilidade de arquivo (para câmera gravando)
 */
// Tempo sem escrita a partir do qual o arquivo e considerado pronto sem precisar
// ficar observando. Cobre a camera que ainda esta gravando sem cobrar o pedagio
// de quem so quer salvar uma foto que ja esta parada no disco.
const QUIET_PERIOD_MS = 750;
const STABILITY_POLL_MS = 120;

/**
 * Resolve quando o arquivo para de crescer.
 *
 * Antes isso custava 2 segundos fixos por arquivo (3 conferencias a 500ms) mesmo
 * para foto parada ha horas, e o salvar chamava em serie - 10 fotos viravam 20
 * segundos de espera. Agora o arquivo que ja esta quieto passa direto.
 */
export async function waitForFileStability(filePath, timeoutMs = 5000) {
  const startTime = Date.now();

  let stats = await fs.promises.stat(filePath);
  if (Date.now() - stats.mtimeMs >= QUIET_PERIOD_MS) return stats.size;

  let lastSize = stats.size;
  let stableChecks = 0;

  for (;;) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`File stability timeout: ${filePath}`);
    }

    await new Promise(resolve => setTimeout(resolve, STABILITY_POLL_MS));
    stats = await fs.promises.stat(filePath);

    if (stats.size === lastSize) {
      stableChecks++;
      // Duas leituras iguais seguidas, ou o arquivo parou de ser escrito ha tempo
      // suficiente: nao ha mais o que esperar.
      if (stableChecks >= 2 || Date.now() - stats.mtimeMs >= QUIET_PERIOD_MS) {
        return stats.size;
      }
    } else {
      stableChecks = 0;
      lastSize = stats.size;
    }
  }
}

/**
 * Cria diretório com segurança
 */
export async function createSecureDirectory(dirPath, root = ROOT) {
  const safe = securePath(dirPath, root);
  try {
    await fs.promises.mkdir(safe, { recursive: true });
    return safe;
  } catch (err) {
    throw new Error(`Cannot create directory: ${err.message}`);
  }
}

/**
 * Lista arquivos permitidos em um diretório
 */
export async function listAllowedFiles(dirPath, root = ROOT) {
  const safe = securePath(dirPath, root);

  try {
    await fs.promises.access(safe);
  } catch {
    return [];
  }

  try {
    const entries = await fs.promises.readdir(safe, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !ALLOWED_IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;
      const filePath = assertInsideRoot(path.join(safe, entry.name), root);
      try {
        await validateImageSignature(filePath);
        files.push({ name: entry.name, path: filePath });
      } catch {
        // Do not expose incomplete or mislabeled camera files.
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    throw new Error(`Cannot list files: ${err.message}`);
  }
}

/**
 * Remove arquivo com segurança
 */
export async function removeSecureFile(filePath, root = ROOT) {
  const safe = securePath(filePath, root);

  try {
    await fs.promises.unlink(safe);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Cannot remove file: ${err.message}`);
    }
  }
}

/**
 * Copia arquivo para novo local (sem sobrescrever)
 */
export async function copySecureFile(srcPath, destDir, root = ROOT) {
  const safeSrc = securePath(srcPath, root);
  const safeDest = securePath(destDir, root);

  const filename = validateFilename(path.basename(srcPath));
  let destPath = path.join(safeDest, filename);
  let counter = 1;

  // Se colisão, usa nome determinístico
  while (await fileExists(destPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    destPath = path.join(safeDest, `${base}_${counter}${ext}`);
    counter++;
  }

  try {
    await fs.promises.copyFile(safeSrc, destPath);
    return destPath;
  } catch (err) {
    throw new Error(`Cannot copy file: ${err.message}`);
  }
}

/**
 * Verifica se arquivo existe
 */
export async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default {
  securePath,
  assertInsideRoot,
  validateFilename,
  validateImageSignature,
  waitForFileStability,
  createSecureDirectory,
  listAllowedFiles,
  removeSecureFile,
  copySecureFile,
  fileExists
};
