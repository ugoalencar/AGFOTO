import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ROOT } from './config.js';

const execFileAsync = promisify(execFile);

// Lido uma vez: nem o package.json nem o commit mudam com o servidor de pe. Se
// mudarem, foi uma atualizacao - e ela ja pede recarga ou reinicio.
let cache = null;

/**
 * Versao do sistema, para o usuario dizer em que ponto esta ao pedir ajuda.
 *
 * Junta o numero do package.json com o commit do git. O numero sozinho nao
 * distingue duas maquinas na mesma versao com atualizacoes diferentes; o commit
 * sozinho nao diz nada para quem esta do outro lado do telefone.
 */
export async function lerVersao() {
  if (cache) return cache;

  let numero = '?';
  try {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(ROOT, 'package.json'), 'utf8'));
    numero = pkg.version || '?';
  } catch {
    // sem package.json legivel o sistema ainda roda
  }

  // Pasta de terminal descompactada do zip nao tem git ate rodar o instalar.bat.
  let commit = null;
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'],
      { cwd: ROOT, timeout: 5000 });
    commit = stdout.trim();
  } catch {
    commit = null;
  }

  cache = {
    versao: numero,
    commit,
    rotulo: commit ? `v${numero} (${commit})` : `v${numero}`
  };
  return cache;
}
