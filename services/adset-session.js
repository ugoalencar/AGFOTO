import fs from 'fs';
import path from 'path';
import { config, ROOT } from '../server/config.js';
import { AdsetWebProvider } from './adset-web-provider.js';
import { auditLogger } from '../server/audit-logger.js';

const ARQUIVO = path.join(ROOT, 'adset-config.json');

export const MODOS = Object.freeze(['desligado', 'ensaio', 'real']);

// Sem isso um navegador ficaria de pe indefinidamente depois de um teste,
// segurando memoria e uma sessao aberta na conta do cliente a noite inteira.
const OCIOSO_MS = 30 * 60 * 1000;

/**
 * Sessao unica com o ADSET.
 *
 * Com "manter conectado", o navegador e o login sao reaproveitados entre uma
 * operacao e outra: cada login custa uns 10 segundos, e sem isso enviar cinco
 * placas seguidas seria cinco logins.
 *
 * Sem "manter conectado", cada operacao abre e fecha - mais lento, porem nao
 * deixa nada aberto na conta.
 */
class AdsetSession {
  constructor() {
    this.provider = null;
    this.usuario = null;
    this.desde = null;
    this.timerOcioso = null;
  }

  get ativa() {
    return Boolean(this.provider);
  }

  manterConectado() {
    return config.adset?.manterConectado === true;
  }

  /**
   * Devolve um provider pronto e logado.
   *
   * @param {Object} opcoes
   * @param {boolean} opcoes.ensaio
   * @param {string}  opcoes.pastaEvidencia
   */
  async obter({ ensaio = true, pastaEvidencia = null } = {}) {
    if (!config.adset?.username || !config.adset?.password) {
      return { ok: false, error: 'Usuario e senha do ADSET nao configurados' };
    }

    if (this.provider) {
      // O modo muda por operacao (ensaio hoje, real daqui a pouco) e a pasta de
      // evidencia muda por placa; a sessao aberta continua servindo.
      this.provider.ensaio = ensaio;
      this.provider.pastaEvidencia = pastaEvidencia;
      this.adiarFechamento();
      return { ok: true, provider: this.provider, reaproveitada: true };
    }

    const provider = new AdsetWebProvider({
      usuario: config.adset.username,
      senha: config.adset.password,
      ensaio,
      visivel: config.adset?.visivel === true,
      pastaEvidencia
    });

    const entrou = await provider.login();
    if (!entrou.ok) {
      await provider.fechar();
      return entrou;
    }

    if (this.manterConectado()) {
      this.provider = provider;
      this.usuario = config.adset.username;
      this.desde = new Date().toISOString();
      this.adiarFechamento();
    }

    return { ok: true, provider, reaproveitada: false };
  }

  /**
   * Fecha o provider quando a sessao NAO e para manter. Chamado no fim de cada
   * operacao: sem isso, com "manter conectado" desligado, cada envio deixaria um
   * navegador orfao.
   */
  async liberar(provider) {
    if (!provider) return;
    if (this.provider === provider) return;
    await provider.fechar();
  }

  adiarFechamento() {
    if (this.timerOcioso) clearTimeout(this.timerOcioso);
    this.timerOcioso = setTimeout(() => {
      this.encerrar('ocioso').catch(() => {});
    }, OCIOSO_MS);
    // Um timer pendente nao pode impedir o servidor de encerrar.
    if (this.timerOcioso.unref) this.timerOcioso.unref();
  }

  async encerrar(motivo = 'pedido') {
    if (this.timerOcioso) {
      clearTimeout(this.timerOcioso);
      this.timerOcioso = null;
    }
    if (!this.provider) return { ok: true, data: { encerrada: false } };

    await this.provider.fechar();
    this.provider = null;
    this.usuario = null;
    this.desde = null;

    await auditLogger.log('ADSET_SESSAO_ENCERRADA', { motivo });
    return { ok: true, data: { encerrada: true, motivo } };
  }

  estado() {
    // "usuarioSessao", nao "usuario": espalhado junto com a configuracao, um
    // campo com o mesmo nome sobrescrevia a conta gravada e a tela de ajustes
    // aparecia sempre com o usuario em branco.
    return {
      conectada: this.ativa,
      usuarioSessao: this.ativa ? this.usuario : null,
      desde: this.desde
    };
  }
}

export const adsetSession = new AdsetSession();

/**
 * Le a configuracao guardada, sem a senha.
 *
 * A senha nunca sai do servidor: devolver ela para a tela colocaria a senha do
 * cliente no HTML, no cache do navegador e em qualquer captura de tela.
 */
export function lerConfigAdset() {
  return {
    modo: config.adset?.modo || 'desligado',
    usuario: config.adset?.username || '',
    senhaGuardada: Boolean(config.adset?.password),
    manterConectado: config.adset?.manterConectado === true,
    visivel: config.adset?.visivel === true,
    ...adsetSession.estado()
  };
}

/**
 * Grava a configuracao em adset-config.json (fora do git) e aplica na hora.
 *
 * Senha em branco NAO apaga a que ja existe: a tela nunca recebe a senha atual,
 * entao salvar qualquer outro campo chegaria aqui com o campo de senha vazio e
 * limparia a credencial sem o usuario pedir.
 */
export async function salvarConfigAdset(entrada = {}) {
  const modo = entrada.modo || 'desligado';
  if (!MODOS.includes(modo)) {
    return { ok: false, error: `Modo invalido: ${modo}` };
  }

  const usuario = String(entrada.usuario || '').trim();
  const senha = typeof entrada.senha === 'string' && entrada.senha.length > 0
    ? entrada.senha
    : config.adset?.password || '';

  if (modo !== 'desligado' && (!usuario || !senha)) {
    return { ok: false, error: 'Preencha usuario e senha para sair do modo desligado' };
  }

  const novo = {
    modo,
    username: usuario,
    password: senha,
    manterConectado: entrada.manterConectado === true,
    visivel: entrada.visivel === true
  };

  try {
    await fs.promises.writeFile(ARQUIVO, JSON.stringify(novo, null, 2) + '\n', 'utf8');
  } catch (err) {
    return { ok: false, error: `Nao deu para gravar adset-config.json: ${err.message}` };
  }

  const trocouDeConta = config.adset?.username !== usuario
    || config.adset?.password !== senha;

  Object.assign(config.adset, novo);

  // Sessao aberta com a conta antiga nao pode continuar valendo depois da troca.
  if (trocouDeConta || !novo.manterConectado) {
    await adsetSession.encerrar(trocouDeConta ? 'troca de conta' : 'manter conectado desligado');
  }

  await auditLogger.log('ADSET_CONFIG_SALVA', {
    modo, usuario, manterConectado: novo.manterConectado, visivel: novo.visivel
  });

  return { ok: true, data: lerConfigAdset() };
}

/**
 * Entra no ADSET so para conferir a credencial.
 *
 * Nao mexe em nenhum anuncio: e login e, se der certo, uma olhada na lista de
 * publicados para provar que a conta enxerga o estoque.
 */
export async function testarConexaoAdset() {
  if (config.adset?.modo === 'desligado') {
    return { ok: false, error: 'Modo desligado. Escolha ensaio ou real para testar' };
  }

  const pasta = path.join(config.paths.evidenciasAdset, 'teste-de-conexao');
  const sessao = await adsetSession.obter({ ensaio: true, pastaEvidencia: pasta });
  if (!sessao.ok) {
    await auditLogger.log('ADSET_TESTE_FALHOU', { error: sessao.error });
    return sessao;
  }

  try {
    const lista = await sessao.provider.abrirLista('Publicado');
    if (!lista.ok) return lista;

    const veiculos = await sessao.provider.page.evaluate(
      () => document.querySelectorAll('.informacoes').length
    );

    await auditLogger.log('ADSET_TESTE_OK', {
      usuario: config.adset.username,
      reaproveitada: sessao.reaproveitada
    });

    return {
      ok: true,
      data: {
        usuario: config.adset.username,
        veiculosNaPrimeiraPagina: veiculos,
        sessaoReaproveitada: sessao.reaproveitada,
        mantidaAberta: adsetSession.ativa
      }
    };
  } catch (err) {
    return { ok: false, error: `Erro no teste: ${err.message}` };
  } finally {
    await adsetSession.liberar(sessao.provider);
  }
}
