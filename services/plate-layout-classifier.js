import { Jimp } from 'jimp';

/**
 * Classificador geometrico de layout de placa (heuristica, sem OCR).
 *
 * Objetivo: decidir rapido se uma foto TEM CARA de foto-de-placa dedicada
 * (enquadramento proximo, faixa azul Mercosul no topo + retangulo claro
 * ocupando boa parte do quadro) antes de gastar tempo com Tesseract. Fotos
 * do meio do lote (carro em angulo aleatorio, sem placa em destaque, ou com
 * placa tampada/de fundo) devem ser reprovadas aqui e nunca chegar ao OCR.
 */

const LARGURA_ANALISE = 240;

// Azul do topo da placa Mercosul (aprox. RGB 0,71,171 impresso, com variacao
// de foto/luz). Testa contra combinacao de canal, nao valor fixo.
function ehAzulMercosul(r, g, b) {
  return b > 110 && (b - r) > 35 && (b - g) > 15 && r < 130;
}

// Fundo da placa: quase branco/cinza claro, baixa saturacao.
function ehClaroDePlaca(r, g, b) {
  const brilho = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturacao = max === 0 ? 0 : (max - min) / max;
  return brilho > 150 && saturacao < 0.25;
}

/**
 * @param {string} caminho
 * @returns {Promise<{ isPlateLayout: boolean, score: number, reason: string }>}
 */
export async function classificarLayoutPlaca(caminho) {
  const imagem = await Jimp.read(caminho);
  const imagemOriginalLargura = imagem.bitmap.width;
  const imagemOriginalAltura = imagem.bitmap.height;
  if (imagem.bitmap.width > LARGURA_ANALISE) {
    imagem.resize({ w: LARGURA_ANALISE });
  }

  const { width, height, data } = imagem.bitmap;
  const pixel = (x, y) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  // 1) Fracao de azul-Mercosul por linha -> localizar a faixa azul.
  const fracaoAzulPorLinha = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    let azuis = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      if (ehAzulMercosul(r, g, b)) azuis++;
    }
    fracaoAzulPorLinha[y] = azuis / width;
  }

  // 2) Agrupa linhas com fracao de azul relevante em uma faixa continua.
  const LIMIAR_LINHA_AZUL = 0.25;
  let inicioFaixa = -1;
  let fimFaixa = -1;
  for (let y = 0; y < height; y++) {
    if (fracaoAzulPorLinha[y] >= LIMIAR_LINHA_AZUL) {
      if (inicioFaixa === -1) inicioFaixa = y;
      fimFaixa = y;
    } else if (inicioFaixa !== -1 && (y - fimFaixa) > 2) {
      break; // faixa contigua encerrada
    }
  }

  if (inicioFaixa === -1) {
    return { isPlateLayout: false, score: 0, reason: 'sem faixa azul Mercosul detectada' };
  }

  const alturaFaixa = fimFaixa - inicioFaixa + 1;
  const alturaFaixaRelativa = alturaFaixa / height;

  // Faixa azul da placa e fina (na foto de perto, tipicamente 4%-18% da altura).
  if (alturaFaixaRelativa > 0.30) {
    return { isPlateLayout: false, score: 0, reason: 'faixa azul grossa demais (nao parece placa)' };
  }

  // 3) Extensao horizontal da faixa azul.
  let colEsq = width, colDir = -1;
  for (let y = inicioFaixa; y <= fimFaixa; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      if (ehAzulMercosul(r, g, b)) {
        if (x < colEsq) colEsq = x;
        if (x > colDir) colDir = x;
      }
    }
  }
  const larguraFaixa = colDir - colEsq + 1;
  const larguraFaixaRelativa = larguraFaixa / width;

  if (larguraFaixaRelativa < 0.35) {
    return { isPlateLayout: false, score: 0, reason: 'faixa azul ocupa pouca largura do quadro (placa distante/pequena)' };
  }

  // 4) Regiao logo abaixo da faixa azul deve ser predominantemente clara
  // (fundo branco/cinza da placa), na mesma extensao horizontal.
  const alturaRegiaoClara = Math.min(alturaFaixa * 4, height - fimFaixa - 1);
  if (alturaRegiaoClara < alturaFaixa) {
    return { isPlateLayout: false, score: 0, reason: 'sem espaco abaixo da faixa azul para o corpo da placa' };
  }

  let clarosNaRegiao = 0;
  let totalNaRegiao = 0;
  for (let y = fimFaixa + 1; y <= fimFaixa + alturaRegiaoClara; y++) {
    for (let x = colEsq; x <= colDir; x++) {
      const [r, g, b] = pixel(x, y);
      totalNaRegiao++;
      if (ehClaroDePlaca(r, g, b)) clarosNaRegiao++;
    }
  }
  const fracaoClara = totalNaRegiao > 0 ? clarosNaRegiao / totalNaRegiao : 0;

  if (fracaoClara < 0.45) {
    return { isPlateLayout: false, score: fracaoClara, reason: 'regiao abaixo da faixa azul nao e clara o suficiente' };
  }

  // 5) A placa (faixa azul + corpo claro) precisa ocupar area relevante do
  // quadro - e o que distingue "foto dedicada da placa" de "placa aparecendo
  // pequena/de lado/tampada no fundo de uma foto do carro".
  const areaPlaca = larguraFaixa * (alturaFaixa + alturaRegiaoClara);
  const areaImagem = width * height;
  const areaRelativa = areaPlaca / areaImagem;

  if (areaRelativa < 0.06) {
    return { isPlateLayout: false, score: areaRelativa, reason: 'placa ocupa area pequena demais do quadro' };
  }

  const score = Math.min(1, (fracaoClara * 0.5) + (larguraFaixaRelativa * 0.3) + (Math.min(areaRelativa, 0.3) / 0.3 * 0.2));

  // Bounding box da placa (faixa azul + corpo claro) em coordenadas da
  // imagem original, com margem, para recorte antes do OCR.
  const escala = imagemOriginalLargura / width;
  const margem = 0.08;
  const bboxLarguraPx = larguraFaixa * escala;
  const bboxAlturaPx = (alturaFaixa + alturaRegiaoClara) * escala;
  const boundingBox = {
    x: Math.max(0, Math.round((colEsq * escala) - bboxLarguraPx * margem)),
    y: Math.max(0, Math.round((inicioFaixa * escala) - bboxAlturaPx * margem)),
    width: Math.min(imagemOriginalLargura, Math.round(bboxLarguraPx * (1 + margem * 2))),
    height: Math.min(imagemOriginalAltura, Math.round(bboxAlturaPx * (1 + margem * 2)))
  };

  return { isPlateLayout: true, score, reason: 'faixa azul + corpo claro em area relevante do quadro', boundingBox };
}

export default classificarLayoutPlaca;
