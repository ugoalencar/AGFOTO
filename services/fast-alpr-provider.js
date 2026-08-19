import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlateOcrProvider } from './plate-ocr-service.js';
import { PlateOcrResult } from '../domain/vehicle.js';

/**
 * Leitura de placa com Fast-ALPR: deteccao (YOLO) + OCR treinado
 * especificamente em caracteres de placa, tudo local via ONNX. Substitui o
 * Tesseract (feito para texto de documento, nao placa) por um motor
 * purpose-built - resolveu em teste os erros sistematicos que nenhum
 * pre-processamento no Tesseract conseguia (ex.: Q lido como O).
 *
 * Roda como processo Python de vida longa (carregar o modelo custa ~2s,
 * inviavel repetir por foto num lote com centenas de imagens) e conversa com
 * ele por stdin/stdout: uma linha = um caminho de imagem = uma resposta JSON.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROJETO = path.resolve(__dirname, '..');
const PYTHON = path.join(RAIZ_PROJETO, 'python-alpr', 'venv', 'Scripts', 'python.exe');
const SCRIPT = path.join(RAIZ_PROJETO, 'python-alpr', 'servidor.py');

// Confianca minima do OCR de caractere para aceitar a leitura. Abaixo disso
// isReliable() deve mandar para revisao manual em vez de confiar cego.
const CONFIANCA_MINIMA_ACEITAVEL = 40;

let processo = null;
let linhas = null;
let filaDeRespostas = [];
let pronto = null;

function iniciarProcesso() {
  processo = spawn(PYTHON, [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
  linhas = readline.createInterface({ input: processo.stdout });

  pronto = new Promise((resolve, reject) => {
    const aoReceberPrimeiraLinha = (linha) => {
      linhas.off('line', aoReceberPrimeiraLinha);
      try {
        const msg = JSON.parse(linha);
        if (msg.pronto) resolve();
        else reject(new Error('Fast-ALPR nao sinalizou pronto ao iniciar'));
      } catch (err) {
        reject(err);
      }
    };
    linhas.on('line', aoReceberPrimeiraLinha);
    processo.once('error', reject);
  });

  linhas.on('line', (linha) => {
    const resolver = filaDeRespostas.shift();
    if (!resolver) return;
    try {
      resolver.resolve(JSON.parse(linha));
    } catch (err) {
      resolver.reject(err);
    }
  });

  processo.once('exit', () => {
    // Processo caiu (ou foi encerrado): quem estiver esperando resposta nao
    // pode ficar pendurado pra sempre.
    for (const resolver of filaDeRespostas) resolver.reject(new Error('Processo Fast-ALPR encerrou'));
    filaDeRespostas = [];
    processo = null;
    linhas = null;
    pronto = null;
  });
}

async function obterProcesso() {
  if (!processo) iniciarProcesso();
  await pronto;
  return processo;
}

export async function encerrarAlpr() {
  if (!processo) return;
  processo.stdin.write('SAIR\n');
  processo.kill();
  processo = null;
  linhas = null;
  pronto = null;
}

async function reconhecer(caminho) {
  const proc = await obterProcesso();
  return new Promise((resolve, reject) => {
    filaDeRespostas.push({ resolve, reject });
    proc.stdin.write(`${caminho}\n`);
  });
}

export class FastAlprProvider extends PlateOcrProvider {
  async detectPlate(imagePath) {
    try {
      const resposta = await reconhecer(imagePath);
      if (!resposta || !resposta.placa) return null;

      const texto = String(resposta.placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(texto)) return null;

      const formato = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(texto) ? 'mercosul' : 'old';
      const confianca = Math.round(resposta.confiancaOcr ?? 0);

      // Confianca baixa nao descarta a leitura de cara - so evita que ela
      // passe como confiavel sem revisao (isReliable() usa esse numero).
      return new PlateOcrResult(
        texto,
        texto,
        formato,
        confianca < CONFIANCA_MINIMA_ACEITAVEL ? 0 : confianca
      );
    } catch (err) {
      console.warn(`[Fast-ALPR] Falha ao ler ${imagePath}: ${err.message}`);
      return null;
    }
  }
}

export default FastAlprProvider;
