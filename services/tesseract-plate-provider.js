import { Jimp } from 'jimp';
import { createWorker, PSM } from 'tesseract.js';
import { PlateOcrProvider } from './plate-ocr-service.js';
import { PlateOcrResult } from '../domain/vehicle.js';
import { classificarLayoutPlaca } from './plate-layout-classifier.js';

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

// Fotos reais vem com uma marca d'agua diagonal ("MERCOSUL BRASIL" repetido)
// sobre o fundo da placa, que atrapalha a binarizacao do Tesseract de jeitos
// diferentes dependendo do brilho/nitidez da foto. Nenhum preparo unico
// funciona pra todas: testado contra um lote real, cada variante abaixo
// resolve um subconjunto diferente de casos. Rodamos todas e so aceitamos o
// resultado quando pelo menos duas concordam exatamente no mesmo texto -
// senao um erro sistematico de uma unica variante (ex.: confundir Q com O)
// passaria batido por ter formato valido.
const VARIANTES_PREPARO = [
  { largura: LARGURA_ALVO, contraste: 0.3 },
  { largura: 320, blur: 1, contraste: 0.5 },
  { largura: LARGURA_ALVO, blur: 2, limiar: 140 },
  { largura: LARGURA_ALVO, blur: 2, limiar: 180 },
  { largura: 700, blur: 2, limiar: 140 }
];

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
 * Recorta pelo enquadramento ideal (tira do caminho outra placa, reflexo ou
 * texto de fundo) e aplica uma das variantes de preparo.
 */
async function prepararImagem(caminho, boundingBox, variante) {
  const imagem = await Jimp.read(caminho);
  if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
    imagem.crop({ x: boundingBox.x, y: boundingBox.y, w: boundingBox.width, h: boundingBox.height });
  }
  if (imagem.bitmap.width > variante.largura) {
    imagem.resize({ w: variante.largura });
  }
  imagem.greyscale();
  if (variante.blur) imagem.blur(variante.blur);
  if (variante.limiar) imagem.threshold({ max: variante.limiar });
  else if (variante.contraste) imagem.contrast(variante.contraste);
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
      // Antes de gastar tempo com OCR, checa se a foto tem cara de foto de
      // placa dedicada (faixa azul Mercosul + corpo claro ocupando area
      // relevante do quadro). Fotos aleatorias do meio do lote nem chegam a
      // rodar o Tesseract - o que tambem evita ler placa de fundo/tampada.
      const layout = await classificarLayoutPlaca(imagePath);
      if (!layout.isPlateLayout) return null;

      const worker = await obterWorker();

      // Cada variante e um primeiro candidato (o texto mais frequente lido
      // naquele preparo); a contagem de votos e por variante concordante,
      // nao por trecho de texto repetido dentro da mesma leitura.
      const votos = new Map();
      for (const variante of VARIANTES_PREPARO) {
        const buffer = await prepararImagem(imagePath, layout.boundingBox, variante);
        const { data } = await worker.recognize(buffer);
        const placas = extrairPlacas(data.text || '');
        if (placas.length === 0) continue;

        const texto = placas[0];
        votos.set(texto, (votos.get(texto) || 0) + 1);

        // Duas variantes ja concordaram: para por aqui, sem gastar as demais.
        if (votos.get(texto) >= 2) {
          const formato = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(texto) ? 'mercosul' : 'old';
          return new PlateOcrResult(texto, texto, formato, 90);
        }
      }

      if (votos.size === 0) return null;

      // Nenhuma concordancia: nenhuma variante bateu duas vezes no mesmo
      // texto. Ainda devolve o melhor palpite (mais votado), mas com
      // confianca baixa - isReliable() vai mandar para revisao manual.
      const [texto] = [...votos.entries()].sort((a, b) => b[1] - a[1])[0];
      const formato = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(texto) ? 'mercosul' : 'old';
      return new PlateOcrResult(texto, texto, formato, 40);
    } catch (err) {
      console.warn(`[OCR] Falha ao ler ${imagePath}: ${err.message}`);
      return null;
    }
  }
}

export default TesseractPlateOcrProvider;
