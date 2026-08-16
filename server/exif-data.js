import fs from 'fs';

/**
 * Leitura da data em que a foto foi tirada, direto do EXIF.
 *
 * Existe porque a ordem das fotos e o que separa um carro do outro: a foto da
 * placa abre o veiculo e as seguintes pertencem a ele. Usar a data do arquivo
 * (mtime) para isso e fragil - copiar de um cartao, sincronizar ou passar por
 * um editor reescreve o mtime e embaralha a sequencia, juntando carros errados.
 *
 * Le so o comeco do arquivo e nao traz dependencia nova: o suficiente para
 * achar DateTimeOriginal, que e o que a camera grava no momento do disparo.
 */

// O bloco EXIF fica logo no inicio do JPEG. 128 KB cobre com folga, inclusive
// quando ha miniatura embutida antes das tags que interessam.
const BYTES_LIDOS = 128 * 1024;

const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;
const TAG_DATE_TIME = 0x0132;

const TAMANHO_DO_TIPO = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/**
 * "2026:08:15 14:03:09" -> Date. O EXIF nao guarda fuso, entao a data e lida
 * como hora local, que e como a camera a registrou.
 */
export function parseExifDate(texto) {
  const m = String(texto || '').trim()
    .match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;

  const [, ano, mes, dia, hora, min, seg] = m.map(Number);
  const data = new Date(ano, mes - 1, dia, hora, min, seg);
  return Number.isNaN(data.getTime()) ? null : data;
}

function lerIfd(buf, inicio, tiffInicio, littleEndian, alvos, encontrados) {
  if (inicio + 2 > buf.length) return;
  const total = littleEndian ? buf.readUInt16LE(inicio) : buf.readUInt16BE(inicio);

  for (let i = 0; i < total; i++) {
    const entrada = inicio + 2 + i * 12;
    if (entrada + 12 > buf.length) return;

    const tag = littleEndian ? buf.readUInt16LE(entrada) : buf.readUInt16BE(entrada);
    if (!alvos.has(tag)) continue;

    const tipo = littleEndian ? buf.readUInt16LE(entrada + 2) : buf.readUInt16BE(entrada + 2);
    const quantidade = littleEndian ? buf.readUInt32LE(entrada + 4) : buf.readUInt32BE(entrada + 4);
    const bytes = (TAMANHO_DO_TIPO[tipo] || 1) * quantidade;

    // Ate 4 bytes cabem na propria entrada; acima disso ela guarda um offset.
    const posicao = bytes <= 4
      ? entrada + 8
      : tiffInicio + (littleEndian ? buf.readUInt32LE(entrada + 8) : buf.readUInt32BE(entrada + 8));

    if (posicao < 0 || posicao + bytes > buf.length) continue;

    if (tag === TAG_EXIF_IFD) {
      const ponteiro = tiffInicio + (littleEndian ? buf.readUInt32LE(entrada + 8) : buf.readUInt32BE(entrada + 8));
      lerIfd(buf, ponteiro, tiffInicio, littleEndian, alvos, encontrados);
      continue;
    }

    encontrados.set(tag, buf.toString('ascii', posicao, posicao + bytes).replace(/\0.*$/, ''));
  }
}

/**
 * Data de captura de um JPEG, ou null quando nao houver EXIF utilizavel.
 */
export async function lerDataDeCaptura(filePath) {
  let handle;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(BYTES_LIDOS);
    const { bytesRead } = await handle.read(buf, 0, BYTES_LIDOS, 0);
    const dados = buf.subarray(0, bytesRead);

    if (dados.length < 4 || dados[0] !== 0xff || dados[1] !== 0xd8) return null; // nao e JPEG

    // Percorre os marcadores ate achar o APP1 com assinatura Exif.
    let i = 2;
    while (i + 4 <= dados.length) {
      if (dados[i] !== 0xff) { i++; continue; }

      const marcador = dados[i + 1];
      if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marcador === 0xda) break; // comecou a imagem: nao ha mais metadado

      const tamanho = dados.readUInt16BE(i + 2);
      if (marcador === 0xe1 && dados.toString('ascii', i + 4, i + 10) === 'Exif\0\0') {
        const tiff = i + 10;
        if (tiff + 8 > dados.length) return null;

        const ordem = dados.toString('ascii', tiff, tiff + 2);
        if (ordem !== 'II' && ordem !== 'MM') return null;
        const littleEndian = ordem === 'II';

        const offsetIfd0 = littleEndian ? dados.readUInt32LE(tiff + 4) : dados.readUInt32BE(tiff + 4);
        const encontrados = new Map();
        lerIfd(
          dados, tiff + offsetIfd0, tiff, littleEndian,
          new Set([TAG_EXIF_IFD, TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED, TAG_DATE_TIME]),
          encontrados
        );

        // Preferencia: o disparo, depois a digitalizacao, depois a data do arquivo EXIF.
        for (const tag of [TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED, TAG_DATE_TIME]) {
          const data = parseExifDate(encontrados.get(tag));
          if (data) return data;
        }
        return null;
      }

      i += 2 + tamanho;
    }

    return null;
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}
