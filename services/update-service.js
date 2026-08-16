import { execFile } from 'child_process';
import { promisify } from 'util';
import { ROOT } from '../server/config.js';
import { auditLogger } from '../server/audit-logger.js';

const execFileAsync = promisify(execFile);

// Rede pode pendurar; a tela nao pode ficar esperando o git desistir sozinho.
const TIMEOUT_MS = 30000;

// Mexer nestes exige reiniciar o servidor: o Node carrega tudo isso uma vez, no
// start. O resto (html, css, o App.vue) e servido do disco a cada pedido e vale
// com um Ctrl+Shift+R.
const PRECISA_REINICIAR = [
  /^server\//, /^services\//, /^routes\//, /^repositories\//, /^domain\//,
  /^server\.js$/, /^launcher\.js$/, /^package\.json$/
];

async function git(...args) {
  const { stdout } = await execFileAsync('git', args, { cwd: ROOT, timeout: TIMEOUT_MS });
  return stdout.trim();
}

/**
 * Atualizacao do sistema pelo GitHub.
 *
 * Nunca cria merge nem resolve conflito sozinho: se a pasta tiver alteracao
 * local ou o historico tiver divergido, para e explica. Numa maquina de
 * producao, um merge automatico que da errado deixa o fotografo sem sistema no
 * meio do expediente.
 */
export class UpdateService {
  static async estado() {
    try {
      const dentroDoGit = await git('rev-parse', '--is-inside-work-tree').catch(() => '');
      if (dentroDoGit !== 'true') {
        return {
          ok: true,
          data: {
            conectado: false,
            mensagem: 'Esta pasta nao esta ligada ao GitHub. Rode instalar.bat uma vez.'
          }
        };
      }

      const branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
      const sujo = await git('status', '--porcelain');
      const local = await git('rev-parse', 'HEAD');

      const arquivosLocais = sujo ? sujo.split('\n').filter(Boolean).map(l => l.slice(3)) : [];

      // O nome da branch daqui nao e necessariamente o nome dela no GitHub, e
      // usar "origin/<branch>" as cegas falha justamente na maquina do cliente,
      // onde a copia pode ter sido feita a partir de outra branch. O upstream
      // configurado e quem sabe de onde vem a atualizacao.
      const upstream = await git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
        .catch(() => null);

      if (!upstream) {
        return {
          ok: true,
          data: {
            conectado: true,
            branch,
            versaoLocal: local.slice(0, 7),
            versaoRemota: null,
            atualizacoesPendentes: 0,
            temNovidade: false,
            alteracoesLocais: arquivosLocais,
            podeAtualizar: false,
            erroRede: `A branch "${branch}" nao esta ligada a nenhuma do GitHub. `
              + 'Rode instalar.bat uma vez para ligar.'
          }
        };
      }

      const remotoNome = upstream.split('/')[0];
      const branchRemota = upstream.split('/').slice(1).join('/');

      let remoto = null;
      let atras = 0;
      let erroRede = null;

      try {
        await git('fetch', remotoNome, branchRemota);
        remoto = await git('rev-parse', upstream);
        atras = parseInt(await git('rev-list', '--count', `HEAD..${upstream}`), 10) || 0;
      } catch (err) {
        // Sem rede da para trabalhar; so nao da para atualizar.
        erroRede = err.message.split('\n')[0].slice(0, 200);
      }

      return {
        ok: true,
        data: {
          conectado: true,
          branch,
          versaoLocal: local.slice(0, 7),
          versaoRemota: remoto ? remoto.slice(0, 7) : null,
          atualizacoesPendentes: atras,
          temNovidade: atras > 0,
          alteracoesLocais: arquivosLocais,
          podeAtualizar: atras > 0 && arquivosLocais.length === 0 && !erroRede,
          erroRede
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  static async aplicar() {
    try {
      const estado = await this.estado();
      if (!estado.ok) return estado;

      const d = estado.data;

      if (!d.conectado) {
        return { ok: false, error: d.mensagem };
      }
      if (d.erroRede) {
        return { ok: false, error: `Sem acesso ao GitHub: ${d.erroRede}` };
      }
      if (d.alteracoesLocais.length > 0) {
        return {
          ok: false,
          error: 'Ha alteracoes locais nesta pasta: '
            + d.alteracoesLocais.slice(0, 5).join(', ')
            + (d.alteracoesLocais.length > 5 ? ` e mais ${d.alteracoesLocais.length - 5}` : '')
            + '. Resolva antes de atualizar - a atualizacao nao sobrescreve seu trabalho.'
        };
      }
      if (!d.temNovidade) {
        return { ok: true, data: { jaEstavaAtualizado: true, versao: d.versaoLocal, arquivos: [] } };
      }

      const antes = await git('rev-parse', 'HEAD');
      // --ff-only: avanca ou aborta. Nunca inventa um merge.
      await git('pull', '--ff-only');
      const depois = await git('rev-parse', 'HEAD');

      const arquivos = antes === depois
        ? []
        : (await git('diff', '--name-only', antes, depois)).split('\n').filter(Boolean);

      const precisaReiniciar = arquivos.some(f => PRECISA_REINICIAR.some(re => re.test(f)));
      const mexeuEmDependencia = arquivos.some(f => f === 'package.json' || f === 'package-lock.json');

      await auditLogger.log('SISTEMA_ATUALIZADO', {
        de: antes.slice(0, 7), para: depois.slice(0, 7), arquivos: arquivos.length
      });

      return {
        ok: true,
        data: {
          jaEstavaAtualizado: false,
          versao: depois.slice(0, 7),
          versaoAnterior: antes.slice(0, 7),
          arquivos,
          precisaReiniciar,
          mexeuEmDependencia
        }
      };
    } catch (err) {
      const msg = (err.message || String(err)).split('\n').slice(0, 3).join(' ').slice(0, 400);
      await auditLogger.log('SISTEMA_ATUALIZACAO_FALHOU', { error: msg });
      return { ok: false, error: `git pull falhou: ${msg}` };
    }
  }
}

export default UpdateService;
