import { Jimp } from 'jimp';
import { createWorker, PSM } from 'tesseract.js';
import { PlateOcrProvider } from './plate-ocr-service.js';
import { PlateOcrResult } from '../domain/vehicle.js';

/**
 * Leitura de placa com Tesseract, rodando na propria maquina.
 *
 * Nao ha servico externo nem credencial: o modelo de idioma fica em disco e o
 * reconhecimento acontece aqui.
 */

// A foto da placa sai da camera com o texto enorme, e o Tesseract erra quando o
// caractere e grande demais - ele foi feito para texto de documento. Reduzir
// para esta largura foi o que fez a leitura sair exata nos testes com foto real:
// em tamanho original a mesma placa devolvia lixo.
const LARGURA_ALVO = 480;

// Placa antiga (AAA1234) e Mercosul (AAA1A23).
const PADRAO_PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

// Confusoes que o OCR comete quando a posicao ja diz se e letra ou numero.
const PARA_NUMERO = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '7', S: '5', B: '8', G: '6', A: '4', T: '7' };
const PARA_LETRA = { 0: 'O', 1: 'I', 7: 'Z', 5: 'S', 8: 'B', 6: 'G', 4: 'A', 2: 'Z' };

let workerCompartilhado = null;

async function obterWorker() {
  if (workerCompartilhado) return workerCompartilhado;

  workerCompartilhado = await createWorker('eng', 1, { logger: () => {} });
  await workerCompartilhado.setParameters({
    // Placa so tem letra maiuscula e numero: restringir o alfabeto tira de
    // saida boa parte da confusao entre O/0, I/1 e S/5.
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK
  });
  return workerCompartilhado;
}

export async function encerrarOcr() {
  if (!workerCompartilhado) return;
  const w = workerCompartilhado;
  workerCompartilhado = null;
  await w.terminate().catch(() => {});
}

/**
 * Reduz e tira a cor: e o preparo que faz a leitura funcionar.
 */
async function prepararImagem(caminho) {
  const imagem = await Jimp.read(caminho);
  if (imagem.bitmap.width > LARGURA_ALVO) {
    imagem.resize({ w: LARGURA_ALVO });
  }
  imagem.greyscale().contrast(0.3);
  return imagem.getBuffer('image/png');
}

/**
 * Corrige o texto sabendo o formato: onde e digito, letra vira numero, e
 * onde e letra, numero vira letra. Sem isso "ELEZDS1" nunca viraria "ELE7D31".
 */
function corrigirPorPosicao(bruto) {
  const c = bruto.split('');
  if (c.length !== 7) return bruto;

  // Posicoes 0-2: sempre letras.
  for (let i = 0; i < 3; i++) if (PARA_LETRA[c[i]]) c[i] = PARA_LETRA[c[i]];
  // Posicao 3: sempre digito.
  if (PARA_NUMERO[c[3]]) c[3] = PARA_NUMERO[c[3]];
  // Posicoes 5-6: sempre digitos.
  for (let i = 5; i < 7; i++) if (PARA_NUMERO[c[i]]) c[i] = PARA_NUMERO[c[i]];
  // Posicao 4: letra no Mercosul, digito no antigo - fica como veio.

  return c.join('');
}

function extrairPlacas(texto) {
  const limpo = texto.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
  const candidatos = new Set();

  for (const bloco of limpo.split(/\s+/).filter(Boolean)) {
    // Janela de 7 em 7: a placa costuma vir colada a alguma sujeira.
    for (let i = 0; i + 7 <= bloco.length; i++) {
      const trecho = corrigirPorPosicao(bloco.slice(i, i + 7));
      if (PADRAO_PLACA.test(trecho)) candidatos.add(trecho);
    }
  }
  return [...candidatos];
}

export class TesseractPlateOcrProvider extends PlateOcrProvider {
  async detectPlate(imagePath) {
    try {
      const buffer = await prepararImagem(imagePath);
      const worker = await obterWorker();
      const { data } = await worker.recognize(buffer);

      const placas = extrairPlacas(data.text || '');
      if (placas.length === 0) return null;

      const texto = placas[0];
      const formato = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(texto) ? 'mercosul' : 'old';

      // A confianca do Tesseract cai muito com o ruido em volta da placa, mesmo
      // quando o texto sai certo. O que sustenta o resultado aqui e o formato
      // ter fechado; a confianca vai junto so como indicacao.
      return new PlateOcrResult(texto, texto, formato, Math.max(0, Math.round(data.confidence)));
    } catch (err) {
      console.warn(`[OCR] Falha ao ler ${imagePath}: ${err.message}`);
      return null;
    }
  }
}

export default TesseractPlateOcrProvider;
