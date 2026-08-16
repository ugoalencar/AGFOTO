// AG Fotografia - executor unico: sobe o servidor, liga a camera e abre a
// interface. E o alvo do atalho da area de trabalho.
//
// Uso: node launcher.js   (no Windows, por iniciar-tudo.vbs, para nao abrir
// janela de terminal nenhuma)

import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// O projeto e ESM ("type": "module"), entao __dirname nao existe.
const BASE = path.dirname(fileURLToPath(import.meta.url));
const WIN = process.platform === 'win32';
const PORTA = parseInt(process.env.PORT || '3000', 10);

// Caminho absoluto do cmd.exe: dependendo de quem chamou o node, "cmd.exe" pode
// nao estar no PATH e o spawn morre com ENOENT.
const CMD = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';

const LOGS = path.join(BASE, 'logs');
if (!fs.existsSync(LOGS)) fs.mkdirSync(LOGS, { recursive: true });

function log(msg) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  console.log(linha);
  try {
    fs.appendFileSync(path.join(LOGS, 'launcher.log'), linha + '\n');
  } catch {
    // sem log nao e motivo para nao subir o sistema
  }
}

function portaOcupada(porta) {
  return new Promise(resolve => {
    const s = net.connect({ port: porta, host: '127.0.0.1', timeout: 600 });
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function esperarPorta(porta, tentativas, intervaloMs) {
  for (let i = 0; i < tentativas; i++) {
    if (await portaOcupada(porta)) return true;
    await esperar(intervaloMs);
  }
  return false;
}

// Processo solto e sem janela: o launcher termina logo em seguida, e os
// servicos seguem rodando por conta propria.
function rodarOculto(comando, args) {
  const p = spawn(comando, args, {
    cwd: BASE,
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  p.unref();
}

// O windowsHide do spawn nao esconde a janela de forma confiavel quando junto
// com detached - a janela do simplusCamera aparecia. O WshShell.Run com flag 0
// do VBS esconde de verdade.
function rodarBatOculto(nomeArquivo) {
  const wscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');
  rodarOculto(wscript, [path.join(BASE, 'iniciar-oculto.vbs'), nomeArquivo]);
}

async function iniciarServidor() {
  if (await portaOcupada(PORTA)) {
    log(`servidor: ja rodando (porta ${PORTA})`);
    return true;
  }

  log('servidor: iniciando...');
  if (WIN) {
    // iniciar-server.bat tem o laco de reinicio automatico.
    rodarBatOculto('iniciar-server.bat');
  } else {
    rodarOculto('sh', ['-c', 'while true; do node server.js >> logs/server.log 2>&1; sleep 3; done']);
  }

  const ok = await esperarPorta(PORTA, 40, 500);
  log(ok ? 'servidor: OK' : 'servidor: NAO subiu - veja logs/server.log');
  return ok;
}

function iniciarCamera() {
  if (!WIN) {
    log('camera: simplusCamera.exe so roda no Windows - pulando');
    return;
  }

  const exe = path.join(BASE, 'simplusCameraLib', 'simplusCamera.exe');
  if (!fs.existsSync(exe)) {
    // A pasta fica fora do git por causa do tamanho; copiar na mao.
    log('camera: simplusCameraLib\\simplusCamera.exe nao encontrado - pulando');
    return;
  }

  log('camera: iniciando...');
  rodarBatOculto('camera.bat');
}

function acharNavegador() {
  const candidatos = WIN ? [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ] : [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];

  for (const c of candidatos) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      // caminho invalido nao interrompe a busca
    }
  }
  return null;
}

async function abrirInterface() {
  const url = `http://localhost:${PORTA}/`;
  const navegador = acharNavegador();

  if (navegador) {
    // Perfil de navegador proprio: o perfil normal do usuario acumula cookies e
    // extensoes para o localhost que nao tem nada a ver com o sistema, e uma
    // janela de app limpa evita barra de endereco, abas e historico no meio do
    // trabalho.
    const perfil = path.join(BASE, '.perfil-navegador');
    rodarOculto(navegador, [
      `--user-data-dir=${perfil}`,
      `--app=${url}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]);
  } else if (WIN) {
    rodarOculto(CMD, ['/c', 'start', '', url]);
  } else {
    rodarOculto('xdg-open', [url]);
  }

  log(`interface aberta: ${url}`);
}

(async function main() {
  log(`=== AG Fotografia (${process.platform}) ===`);

  const servidorOk = await iniciarServidor();
  iniciarCamera();

  if (servidorOk) {
    await abrirInterface();
  } else {
    log('interface NAO aberta - o servidor nao subiu');
  }

  log('=== pronto ===');
  process.exit(0);
})();
