import fs from 'fs';
import path from 'path';

/**
 * Envio de fotos ao ADSET pelo proprio site, repetindo o caminho que o usuario
 * faz na mao. Os passos vieram dos prints em "Nome da empresa AG Fotografia.docx"
 * e cada seletor abaixo foi conferido contra o site de verdade.
 *
 *   1. Login em /Integrador/Home/Principal  (#Email, #Senha, #loginBtn).
 *   2. Menu Veiculos > Estoque Publicados. Se a placa nao estiver la, Estoque
 *      Nao Publicados.
 *   3. Campo #Filtro_PlacaChassi com a placa e botao #buscar.
 *   4. Na linha (.informacoes), o icone "Editar Fotos" (a.foto-qtd) carrega a
 *      tela de fotos por AJAX dentro da mesma pagina.
 *   5. #btnExcluirTodas limpa as posicoes.
 *   6. input[name="files[]"] recebe as nossas, na ordem do QA.
 *   7. "Confirmar" grava.
 *
 * TUDO acontece a partir de /Integrador/Home/Principal, sem nunca navegar para
 * outra URL. Isso nao e preciosismo: /IntegracaoDealerNet/Abrir e
 * /Veiculo/Cadastro respondem o fragmento HTML sozinho, SEM o jQuery da pagina.
 * Aberto assim, o campo de arquivo fica sem o handler de "change" - as fotos
 * nunca subiriam, e o "Confirmar" gravaria o anuncio com zero foto. Ou seja: o
 * caminho por URL direta apaga as fotos do cliente e nao poe nada no lugar.
 * Por isso a navegacao aqui e sempre por clique, como o usuario faz.
 *
 * Os cliques sao despachados por evento (dispatchEvent) porque os alvos vivem em
 * menu suspenso ou linha da lista, e o clique de mouse tropeca em sobreposicao.
 * O site escuta com jQuery, que atende o evento despachado igual.
 *
 * AVISO: o passo 5 apaga as fotos que o anuncio ja tem, na conta de producao da
 * concessionaria, e nao da para desfazer. Por isso nada roda sem modo explicito,
 * e o modo "ensaio" vai ate o passo 4 e para.
 */

const URL_BASE = 'https://www.adset.com.br';

// As duas listas, na ordem em que o usuario procura.
export const LISTAS = Object.freeze([
  { nome: 'Estoque Publicados', view: 'Publicado' },
  { nome: 'Estoque Nao Publicados', view: 'Pendente' }
]);

// O site e lento com estoque grande - 119 veiculos na conta dos prints.
const TIMEOUT_MS = 45000;

export class AdsetWebProvider {
  /**
   * @param {Object} options
   * @param {string} options.usuario
   * @param {string} options.senha
   * @param {boolean} options.ensaio  Para antes de apagar as fotos do anuncio.
   * @param {boolean} options.visivel Abre o navegador na tela, para acompanhar.
   * @param {string}  options.pastaEvidencia Onde salvar as capturas de cada passo.
   */
  constructor(options = {}) {
    this.usuario = options.usuario;
    this.senha = options.senha;
    this.ensaio = options.ensaio !== false;
    this.visivel = options.visivel === true;
    this.pastaEvidencia = options.pastaEvidencia || null;
    this.browser = null;
    this.page = null;
    this.passos = [];
  }

  registrar(passo, detalhe = '') {
    this.passos.push({ passo, detalhe, em: new Date().toISOString() });
  }

  /**
   * Captura da tela a cada passo. E o que permite conferir depois o que o
   * sistema fez na conta do cliente sem ter estado olhando.
   */
  async evidencia(nome) {
    if (!this.pastaEvidencia || !this.page) return null;
    try {
      await fs.promises.mkdir(this.pastaEvidencia, { recursive: true });
      const arquivo = path.join(this.pastaEvidencia, `${Date.now()}_${nome}.png`);
      await this.page.screenshot({ path: arquivo });
      return arquivo;
    } catch {
      return null;
    }
  }

  async abrir() {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: !this.visivel });
    const contexto = await this.browser.newContext();
    contexto.setDefaultTimeout(TIMEOUT_MS);
    this.page = await contexto.newPage();
  }

  async login() {
    if (!this.usuario || !this.senha) {
      return { ok: false, error: 'Usuario e senha do ADSET nao configurados' };
    }

    try {
      if (!this.page) await this.abrir();

      // Sem sessao o site redireciona para Home/Index com o ReturnUrl.
      await this.page.goto(`${URL_BASE}/Integrador/Home/Principal`, { waitUntil: 'domcontentloaded' });

      if (await this.page.locator('#Email').count() === 0) {
        await this.evidencia('login_sem_campos');
        return { ok: false, error: 'Tela de login do ADSET nao reconhecida' };
      }

      await this.page.fill('#Email', this.usuario);
      await this.page.fill('#Senha', this.senha);
      await this.page.click('#loginBtn');
      await this.page.waitForLoadState('networkidle').catch(() => {});

      // "Sair" so aparece depois de entrar.
      const entrou = await this.page.getByText('Sair', { exact: false }).count() > 0;
      if (!entrou) {
        await this.evidencia('login_falhou');
        return { ok: false, error: 'Login recusado pelo ADSET' };
      }

      this.registrar('login', this.usuario);
      return { ok: true };
    } catch (err) {
      await this.evidencia('login_erro');
      return { ok: false, error: `Erro no login: ${err.message}` };
    }
  }

  /**
   * Abre uma das listas pelo menu lateral, sem sair da pagina.
   */
  async abrirLista(view) {
    const link = this.page.locator(
      `a[href="/Integrador/IntegracaoDealerNet/Abrir?view=${view}"]`
    ).first();

    if (await link.count() === 0) {
      return { ok: false, error: `Menu do estoque ${view} nao encontrado` };
    }

    // O item vive em menu suspenso: clique de mouse nao alcanca, evento sim.
    await link.dispatchEvent('click');
    await this.page.waitForSelector('#Filtro_PlacaChassi', { timeout: TIMEOUT_MS });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return { ok: true };
  }

  /**
   * Filtra uma lista pela placa e devolve o id do veiculo.
   */
  async procurarNaLista(placa, view) {
    const lista = await this.abrirLista(view);
    if (!lista.ok) return lista;

    await this.page.fill('#Filtro_PlacaChassi', placa);
    await this.page.click('#buscar');

    // A lista se refaz por AJAX: esperar a linha da placa aparecer e mais firme
    // do que contar segundos, e o "sumiu" e resposta valida (placa nao esta la).
    await this.page.waitForFunction(
      alvo => {
        const linhas = [...document.querySelectorAll('.informacoes')];
        return linhas.length === 0
          || linhas.every(n => n.textContent.includes(alvo))
          || linhas.some(n => n.textContent.includes(alvo));
      },
      placa,
      { timeout: TIMEOUT_MS }
    ).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // O icone "Editar Fotos" da linha carrega o id do veiculo no data-id.
    const achado = await this.page.evaluate(alvo => {
      const linha = [...document.querySelectorAll('.informacoes')]
        .find(n => n.textContent.includes(alvo));
      if (!linha) return null;

      const icone = linha.querySelector('a.foto-qtd');
      if (!icone) return { erro: 'linha sem o icone de fotos' };

      return {
        id: icone.getAttribute('data-id'),
        // O proprio site recusa editar fotos de cadastro incompleto.
        invalido: icone.getAttribute('data-invalido') === '1',
        fotosHoje: parseInt(icone.textContent.trim(), 10) || 0
      };
    }, placa);

    if (!achado) return { ok: false, error: 'nao_encontrado' };
    if (achado.erro) return { ok: false, error: achado.erro };
    if (achado.invalido) {
      return {
        ok: false,
        error: `O ADSET recusa editar fotos de ${placa}: cadastro incompleto `
          + '(marca, modelo, versao, preco ou portas)'
      };
    }

    return { ok: true, ...achado };
  }

  /**
   * Procura a placa nas duas listas, publicados primeiro.
   */
  async localizarVeiculo(placa) {
    for (const lista of LISTAS) {
      const achado = await this.procurarNaLista(placa, lista.view);

      if (achado.ok) {
        this.registrar('encontrado', `${lista.nome} id=${achado.id}`);
        return { ...achado, lista: lista.nome };
      }
      if (achado.error !== 'nao_encontrado') return achado;

      this.registrar('nao_encontrado', lista.nome);
    }

    return { ok: false, error: `Placa ${placa} nao encontrada em nenhuma das duas listas` };
  }

  /**
   * Abre a tela de fotos pelo icone da linha, como o usuario faz.
   *
   * Nao trocar por navegacao direta em /Veiculo/Cadastro: o fragmento vem sem o
   * jQuery da pagina, o campo de arquivo fica sem handler e o envio grava o
   * anuncio sem foto nenhuma.
   */
  async abrirTelaDeFotos(placa) {
    const icone = this.page.locator('.informacoes')
      .filter({ hasText: placa })
      .locator('a.foto-qtd')
      .first();

    await icone.dispatchEvent('click');

    try {
      await this.page.waitForSelector('#btnExcluirTodas', { timeout: TIMEOUT_MS });
    } catch {
      await this.evidencia('sem_tela_de_fotos');
      return { ok: false, error: 'Tela de fotos nao abriu - confira a evidencia' };
    }

    // O campo so sobe arquivo se o handler da pagina estiver ligado. Conferir
    // aqui e o que impede um envio que apaga tudo e nao poe nada no lugar.
    const preparado = await this.page.evaluate(() => {
      const campo = document.querySelector('input[name="files[]"]');
      if (!campo) return { pronto: false, motivo: 'sem campo de arquivo' };

      const jq = window.jQuery;
      const eventos = jq && jq._data ? jq._data(campo, 'events') : null;
      if (!eventos || !eventos.change) {
        return { pronto: false, motivo: 'campo de arquivo sem handler de envio' };
      }

      return {
        pronto: true,
        posicoes: document.querySelectorAll('#listaFotos li').length,
        // Cada <li> e uma posicao; as ocupadas tem data-url preenchido.
        ocupadas: [...document.querySelectorAll('#listaFotos li input[type="hidden"]')]
          .filter(i => (i.getAttribute('data-url') || '').length > 0).length
      };
    });

    if (!preparado.pronto) {
      await this.evidencia('tela_de_fotos_incompleta');
      return { ok: false, error: `Tela de fotos incompleta: ${preparado.motivo}` };
    }

    return { ok: true, ...preparado };
  }

  /**
   * Substitui as fotos do anuncio pelas nossas, na ordem recebida.
   *
   * @param {string} placa
   * @param {string[]} arquivos Caminhos completos, ja na ordem do QA.
   */
  async enviarFotos(placa, arquivos) {
    try {
      if (!Array.isArray(arquivos) || arquivos.length === 0) {
        return { ok: false, error: 'Nenhuma foto para enviar' };
      }

      const veiculo = await this.localizarVeiculo(placa);
      if (!veiculo.ok) return veiculo;

      const tela = await this.abrirTelaDeFotos(placa);
      if (!tela.ok) return tela;

      if (arquivos.length > tela.posicoes) {
        return {
          ok: false,
          error: `O anuncio tem ${tela.posicoes} posicoes de foto e voce mandou `
            + `${arquivos.length}. Tire fotos no QA antes de enviar.`
        };
      }

      await this.evidencia(`fotos_antes_${placa}`);

      if (this.ensaio) {
        // O ensaio prova o caminho inteiro sem destruir nada: daqui em diante os
        // passos apagam as fotos do anuncio em producao.
        this.registrar('ensaio_parou_antes_de_excluir', placa);
        return {
          ok: true,
          ensaio: true,
          data: {
            placa,
            lista: veiculo.lista,
            veiculoId: veiculo.id,
            fotosNoAnuncio: tela.ocupadas,
            fotosAEnviar: arquivos.length,
            mensagem: 'Ensaio: abriu a tela de fotos e parou antes de excluir'
          }
        };
      }

      await this.page.click('#btnExcluirTodas');
      await this.page.waitForTimeout(1000);
      this.registrar('excluiu_fotos', `${tela.ocupadas} que estavam la`);

      // A ordem do array e a ordem em que o ADSET recebe: a primeira vira capa.
      await this.page.locator('input[name="files[]"]').first().setInputFiles(arquivos);
      await this.page.waitForLoadState('networkidle').catch(() => {});

      // O envio para o S3 e assincrono: espera as posicoes serem preenchidas em
      // vez de contar tempo, senao "Confirmar" grava um anuncio pela metade.
      await this.page.waitForFunction(
        esperadas => [...document.querySelectorAll('#listaFotos li input[type="hidden"]')]
          .filter(i => (i.getAttribute('data-url') || '').length > 0).length >= esperadas,
        arquivos.length,
        { timeout: TIMEOUT_MS }
      );

      await this.evidencia(`fotos_carregadas_${placa}`);

      await this.page.getByRole('button', { name: /^Confirmar$/i }).first().click();
      await this.page.waitForLoadState('networkidle').catch(() => {});

      this.registrar('confirmou', `${arquivos.length} fotos`);
      const evidenciaFinal = await this.evidencia(`fotos_depois_${placa}`);

      return {
        ok: true,
        data: {
          placa,
          lista: veiculo.lista,
          veiculoId: veiculo.id,
          fotosSubstituidas: tela.ocupadas,
          fotosEnviadas: arquivos.length,
          evidencia: evidenciaFinal
        }
      };
    } catch (err) {
      await this.evidencia('erro_envio');
      return { ok: false, error: `Erro ao enviar fotos: ${err.message}` };
    }
  }

  async fechar() {
    try {
      if (this.browser) await this.browser.close();
    } catch {
      // navegador ja caiu
    }
    this.browser = null;
    this.page = null;
  }
}

export default AdsetWebProvider;
