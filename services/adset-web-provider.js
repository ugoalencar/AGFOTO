import fs from 'fs';
import path from 'path';

/**
 * Envio de fotos ao ADSET pelo proprio site, repetindo o caminho que o usuario
 * faz na mao. Os passos vieram dos prints em "Nome da empresa AG Fotografia.docx":
 *
 *   1. Login com usuario e senha.
 *   2. Veiculos > Estoque Publicados  (Abrir?view=Publicado)
 *      Se a placa nao estiver la, Estoque Nao Publicados (Abrir?view=Pendente).
 *   3. Campo "Pesquisar": digita a placa e clica em "Buscar".
 *   4. Na linha do veiculo, o icone de camera abre a tela "Alterar", secao "5. Fotos".
 *   5. "Excluir Todas as Fotos".
 *   6. Sobe as nossas fotos na ordem definida no QA.
 *
 * Os localizadores sao por texto visivel ("Buscar", "Excluir Todas as Fotos") e
 * nao por classe de CSS: o texto e o que os prints realmente provam, e e o que
 * menos quebra quando o site muda de layout.
 *
 * AVISO: o passo 5 apaga as fotos que o anuncio ja tem. E irreversivel e
 * acontece na conta de producao da concessionaria. Por isso nada aqui roda sem
 * modo explicito, e o modo "ensaio" para antes de apagar.
 */

const URL_BASE = 'https://www.adset.com.br';

// As duas listas, na ordem em que o usuario procura: publicados primeiro, e so
// vai para os pendentes se nao achar.
export const LISTAS = Object.freeze([
  { nome: 'Estoque Publicados', url: `${URL_BASE}/Integrador/IntegracaoDealerNet/Abrir?view=Publicado` },
  { nome: 'Estoque Nao Publicados', url: `${URL_BASE}/Integrador/IntegracaoDealerNet/Abrir?view=Pendente` }
]);

// O site e lento com estoque grande; 119 veiculos na conta dos prints.
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
      await this.page.screenshot({ path: arquivo, fullPage: false });
      return arquivo;
    } catch {
      return null;
    }
  }

  async abrir() {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: !this.visivel });
    const contexto = await this.browser.newContext({ acceptDownloads: false });
    contexto.setDefaultTimeout(TIMEOUT_MS);
    this.page = await contexto.newPage();
  }

  async login() {
    if (!this.usuario || !this.senha) {
      return { ok: false, error: 'Usuario e senha do ADSET nao configurados' };
    }

    try {
      if (!this.page) await this.abrir();

      await this.page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });

      // Nao ha print da tela de login no documento, entao os campos sao
      // procurados por varios nomes possiveis em vez de um chute unico. Se
      // nenhum aparecer, para aqui em vez de seguir as cegas.
      const usuario = this.page.locator(
        'input[name="usuario" i], input[name="email" i], input[name="login" i], input[type="email"]'
      ).first();
      const senha = this.page.locator('input[type="password"]').first();

      if (await usuario.count() === 0 || await senha.count() === 0) {
        await this.evidencia('login_sem_campos');
        return {
          ok: false,
          error: 'Tela de login do ADSET nao reconhecida - confira a captura em evidencias'
        };
      }

      await usuario.fill(this.usuario);
      await senha.fill(this.senha);
      await this.page.keyboard.press('Enter');
      await this.page.waitForLoadState('networkidle').catch(() => {});

      // "Sair" so existe depois de entrar - e o sinal mais confiavel dos prints.
      const entrou = await this.page.getByText('Sair', { exact: false }).count() > 0;
      await this.evidencia(entrou ? 'login_ok' : 'login_falhou');

      if (!entrou) return { ok: false, error: 'Login recusado pelo ADSET' };

      this.registrar('login', this.usuario);
      return { ok: true };
    } catch (err) {
      await this.evidencia('login_erro');
      return { ok: false, error: `Erro no login: ${err.message}` };
    }
  }

  /**
   * Procura a placa nas duas listas e abre a tela de fotos do veiculo.
   * Devolve em qual lista achou - o usuario precisa saber se mexeu em um anuncio
   * publicado ou em um pendente.
   */
  async localizarVeiculo(placa) {
    for (const lista of LISTAS) {
      await this.page.goto(lista.url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForLoadState('networkidle').catch(() => {});

      const pesquisar = this.page.locator('input').filter({ hasNot: this.page.locator('[type="hidden"]') }).first();
      const campo = this.page.getByLabel('Pesquisar').or(pesquisar).first();

      await campo.fill(placa);
      await this.page.getByRole('button', { name: /Buscar/i }).first().click();
      await this.page.waitForLoadState('networkidle').catch(() => {});

      // A linha do veiculo mostra "Placa - XXXXXXX".
      const linha = this.page.locator(`text=/Placa\\s*-\\s*${placa}/i`).first();
      if (await linha.count() === 0) {
        this.registrar('nao_encontrado', lista.nome);
        continue;
      }

      await this.evidencia(`encontrado_${placa}`);
      this.registrar('encontrado', lista.nome);
      return { ok: true, lista: lista.nome, linha };
    }

    return { ok: false, error: `Placa ${placa} nao encontrada em nenhuma das duas listas` };
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

      const achou = await this.localizarVeiculo(placa);
      if (!achou.ok) return achou;

      // O icone de camera na linha abre a tela "Alterar".
      await achou.linha.locator('xpath=ancestor::tr[1] | xpath=ancestor::div[1]')
        .locator('a,button').filter({ has: this.page.locator('[class*="camera" i], [class*="foto" i]') })
        .first().click()
        .catch(async () => {
          // Alguns temas trocam o icone por link direto para a tela de alterar.
          await this.page.locator('a[href*="Alterar" i]').first().click();
        });

      await this.page.waitForLoadState('networkidle').catch(() => {});

      const naTelaDeFotos = await this.page.getByText('Excluir Todas as Fotos').count() > 0;
      if (!naTelaDeFotos) {
        await this.evidencia('sem_tela_de_fotos');
        return { ok: false, error: 'Tela de fotos do veiculo nao abriu - confira a evidencia' };
      }

      await this.evidencia(`fotos_antes_${placa}`);

      if (this.ensaio) {
        // O ensaio existe para provar o caminho sem destruir nada: daqui em
        // diante os passos apagam as fotos do anuncio em producao.
        this.registrar('ensaio_parou_antes_de_excluir', placa);
        return {
          ok: true,
          ensaio: true,
          data: {
            placa,
            lista: achou.lista,
            fotosAEnviar: arquivos.length,
            mensagem: 'Ensaio: chegou na tela de fotos e parou antes de excluir'
          }
        };
      }

      await this.page.getByRole('button', { name: /Excluir Todas as Fotos/i }).click();
      // O site pode pedir confirmacao; aceita se pedir, segue se nao pedir.
      this.page.once('dialog', d => d.accept().catch(() => {}));
      await this.page.waitForTimeout(1500);
      this.registrar('excluiu_fotos', placa);
      await this.evidencia(`fotos_excluidas_${placa}`);

      // A ordem do array e a ordem em que o ADSET recebe: a primeira vira capa.
      const entrada = this.page.locator('input[type="file"]').first();
      await entrada.setInputFiles(arquivos);
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(3000);

      this.registrar('enviou_fotos', `${arquivos.length} fotos`);
      const evidenciaFinal = await this.evidencia(`fotos_depois_${placa}`);

      return {
        ok: true,
        data: {
          placa,
          lista: achou.lista,
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
