import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { FileRepository } from '../../repositories/file-repository.js';
import CapturaService from '../../services/captura-service.js';
import ExcelService from '../../services/excel-service.js';
import { createApp } from '../../server/app.js';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

// Salvar renomeia no padrao do sphoto: GTIN_dd_MM_yyyy_HH_mm_ss_indice[_sufixos].ext
// O timestamp e do momento da gravacao, entao os testes casam por padrao.
function padraoCapturado(gtin, indice = 0, extras = '') {
  return new RegExp(`^${gtin}_\\d{2}_\\d{2}_\\d{4}_\\d{2}_\\d{2}_\\d{2}_${indice}${extras}\\.jpg$`);
}

function pastaProduto(env, lote, gtin, subpasta = null) {
  const base = path.join(env.paths.finalizadas, `LOTE ${lote}`, gtin);
  return subpasta ? path.join(base, subpasta) : base;
}

async function listarPasta(env, lote, gtin, subpasta = null) {
  return fs.promises.readdir(pastaProduto(env, lote, gtin, subpasta)).catch(() => []);
}

async function acharCapturado(env, lote, gtin, { indice = 0, extras = '', subpasta = null } = {}) {
  const padrao = padraoCapturado(gtin, indice, extras);
  const arquivos = await listarPasta(env, lote, gtin, subpasta);
  return arquivos.find(nome => padrao.test(nome)) || null;
}
const RIFF_WAV_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20
]);

async function request(app, requestPath, options = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, options);
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function findPlaywrightPython() {
  const candidates = process.platform === 'win32'
    ? [
        { command: 'py', args: ['-3'] },
        { command: 'python3', args: [] },
        { command: 'python', args: [] }
      ]
    : [
        { command: 'python3', args: [] },
        { command: 'python', args: [] }
      ];

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [
        ...candidate.args,
        '-c',
        `from playwright.sync_api import sync_playwright
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    browser.close()`
      ],
      { encoding: 'utf8', windowsHide: true }
    );
    if (result.status === 0) return candidate;
  }

  return null;
}

test('phone capture layout keeps the previous stage inside its card', async t => {
  const python = findPlaywrightPython();
  if (!python) {
    t.skip('Python Playwright browser runner unavailable; skipped rendered 390x844 capture geometry regression');
    return;
  }

  const css = await fs.promises.readFile(path.resolve('frontend/public/css/main.css'), 'utf8');
  const fixtureDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agfoto-phone-layout-'));
  const fixturePath = path.join(fixtureDirectory, 'capture.html');
  const playwrightScript = `
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(Path(sys.argv[1]).as_uri())
    previous_grid = page.locator('#previous-grid').bounding_box()
    stage = page.locator('#capture-stage').bounding_box()
    browser.close()

if not previous_grid or not stage:
    raise SystemExit('Capture stage geometry was unavailable')

print(json.dumps({"previousBottom": previous_grid["y"] + previous_grid["height"], "stageBottom": stage["y"] + stage["height"]}))
`;

  const fixture = `<!doctype html>
<html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div id="app"><div class="app-shell" style="grid-template-columns:minmax(0, 1fr)"><div class="ag-main"><div class="ag-content"><main class="ag-view capture-view">
  <section class="ag-card capture-entry" style="height:320px"><div class="ag-card-body">Entrada</div></section>
  <section id="capture-stage" class="ag-card capture-stage">
    <div class="stage-head"><h3 class="stage-title">Palco atual</h3></div>
    <div class="stage-grid stage-empty">Aguardando imagens</div>
    <div class="stage-head"><h3 class="stage-title">Palco anterior</h3></div>
    <div id="previous-grid" class="stage-grid stage-empty">Nenhuma imagem anterior</div>
  </section>
  <section class="ag-card" style="height:160px"><div class="ag-card-body">GTINs do lote</div></section>
</main></div></div></div></div></body></html>`;

  await fs.promises.writeFile(fixturePath, fixture, 'utf8');
  t.after(() => fs.promises.rm(fixtureDirectory, { recursive: true, force: true }));

  const result = spawnSync(
    python.command,
    [...python.args, '-c', playwrightScript, fixturePath],
    { encoding: 'utf8', windowsHide: true }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const geometry = JSON.parse(result.stdout);

  assert.ok(
    geometry.previousBottom <= geometry.stageBottom + 0.5,
    `Palco anterior is clipped: bottom ${geometry.previousBottom}px exceeds card bottom ${geometry.stageBottom}px`
  );
});

test('TEMP listing includes only valid image signatures with stable state', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto1.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'fake.jpg'), 'not an image');

  const images = await FileRepository.listTempImages();

  assert.deepEqual(images.map(image => image.name), ['foto1.jpg']);
  assert.equal(images[0].signatureOk, true);
  assert.equal(images[0].state, 'stable');
  assert.equal(images[0].url, '/api/captura/imagem/temp/foto1.jpg');
});

test('TEMP preview serves only a valid image inside its configured directory', async t => {
  const env = await createTestEnv(t);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto1.jpg'), JPG_BYTES);
  const app = createApp({ configOverrides: env.config });

  const image = await request(app, '/api/captura/imagem/temp/foto1.jpg');
  const traversal = await request(app, '/api/captura/imagem/temp/%2e%2e%2foutside.jpg');

  assert.equal(image.status, 200);
  assert.match(image.contentType, /^image\/jpeg/);
  assert.deepEqual(image.body, JPG_BYTES);
  assert.equal(traversal.status, 400);
});

test('TEMP preview rejects a valid image reached through a symlink outside TEMP', async t => {
  const env = await createTestEnv(t);
  const outsideImage = path.join(env.root, 'outside.jpg');
  const linkedImage = path.join(env.paths.imagesTemp, 'linked.jpg');
  await fs.promises.writeFile(outsideImage, JPG_BYTES);
  try {
    await fs.promises.symlink(outsideImage, linkedImage, 'file');
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Creating symlinks requires Windows Developer Mode or elevated privileges');
      return;
    }
    throw error;
  }
  const app = createApp({ configOverrides: env.config });

  const preview = await request(app, '/api/captura/imagem/temp/linked.jpg');

  assert.equal(preview.status, 400);
});

test('TEMP listing and preview reject a WAV file renamed as WebP', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'audio.webp'), RIFF_WAV_BYTES);
  const app = createApp({ configOverrides: env.config });

  const images = await FileRepository.listTempImages();
  const preview = await request(app, '/api/captura/imagem/temp/audio.webp');

  assert.deepEqual(images, []);
  assert.equal(preview.status, 400);
});

test('camera API reports status and opens through the operation middleware', async t => {
  const env = await createTestEnv(t);
  const cameraService = {
    getStatus: async () => ({ running: false, executableExists: true, message: 'Camera executable available' }),
    open: async () => ({ started: true, message: 'simplusCamera.exe started' })
  };
  const app = createApp({ configOverrides: env.config, services: { cameraService } });

  const status = await request(app, '/api/status/camera');
  const opened = await request(app, '/api/status/camera/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationId: 'open-camera' })
  });
  const missingOperationId = await request(app, '/api/status/camera/open', { method: 'POST' });

  assert.deepEqual(JSON.parse(status.body.toString()).data, await cameraService.getStatus());
  assert.deepEqual(JSON.parse(opened.body.toString()).data, await cameraService.open());
  assert.equal(missingOperationId.status, 400);
  assert.match(JSON.parse(missingOperationId.body.toString()).error, /operationId/i);
});

test('save capture moves snapshot, updates JSON and control workbook without overwriting', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const tempPhoto = path.join(env.paths.imagesTemp, 'foto.jpg');
  const finalPhoto = path.join(env.paths.finalizadas, 'LOTE 37', '000123', 'foto.jpg');
  await fs.promises.writeFile(tempPhoto, JPG_BYTES);
  await fs.promises.mkdir(path.dirname(finalPhoto), { recursive: true });
  await fs.promises.writeFile(finalPhoto, Buffer.from('existing photo'));

  const result = await CapturaService.saveCapture('37', '000123', '', 'Produto local');

  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.equal(await fs.promises.stat(tempPhoto).then(() => true, () => false), false);
  // Arquivo que ja estava na pasta nao pode ser tocado pela captura nova.
  assert.deepEqual(await fs.promises.readFile(finalPhoto), Buffer.from('existing photo'));

  const capturado = await acharCapturado(env, '37', '000123');
  assert.ok(capturado, 'foto salva deve usar o nome GTIN_data_hora_indice');
  assert.deepEqual(await fs.promises.readFile(pastaProduto(env, '37', '000123', null) + path.sep + capturado), JPG_BYTES);

  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_37.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].status, 'pendente_qa');
  assert.equal(loteJson.itens['000123'].quantidadeFotos, 1);

  const controlPath = path.join(env.paths.xlsx, 'controle-lotes.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(controlPath);
  const sheet = workbook.getWorksheet('Lote 37');
  assert.ok(sheet);
  assert.equal(sheet.getCell('A2').value, '000123');
  assert.equal(sheet.getCell('F2').value, 'pendente_qa');
});

test('save capture uses the normalized GTIN as the JSON key and final folder', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto.jpg'), JPG_BYTES);

  const result = await CapturaService.saveCapture('38', ' 000123 ');

  assert.equal(result.ok, true);
  assert.equal(result.data.gtin, '000123');
  assert.ok(await acharCapturado(env, '38', '000123'), 'foto deve cair na pasta do GTIN normalizado');
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_38.json'), 'utf8'));
  assert.ok(loteJson.itens['000123']);
});

test('moving colliding filenames concurrently preserves both files with deterministic suffixes', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const firstSource = path.join(env.paths.imagesTemp, 'primeira', 'foto.jpg');
  const secondSource = path.join(env.paths.imagesTemp, 'segunda', 'foto.jpg');
  await fs.promises.mkdir(path.dirname(firstSource), { recursive: true });
  await fs.promises.mkdir(path.dirname(secondSource), { recursive: true });
  await fs.promises.writeFile(firstSource, Buffer.from('first'));
  await fs.promises.writeFile(secondSource, Buffer.from('second'));

  await Promise.all([
    FileRepository.moveToFinalizadas(firstSource, '38', '000123'),
    FileRepository.moveToFinalizadas(secondSource, '38', '000123')
  ]);

  const destination = path.join(env.paths.finalizadas, 'LOTE 38', '000123');
  const contents = await Promise.all([
    fs.promises.readFile(path.join(destination, 'foto.jpg'), 'utf8'),
    fs.promises.readFile(path.join(destination, 'foto_001.jpg'), 'utf8')
  ]);
  assert.deepEqual(contents.sort(), ['first', 'second']);
});

test('save capture recaptures the same GTIN with a deterministic suffix and cumulative photo count', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const tempPhoto = path.join(env.paths.imagesTemp, 'foto.jpg');

  await fs.promises.writeFile(tempPhoto, JPG_BYTES);
  const firstCapture = await CapturaService.saveCapture('39', '000123');
  await fs.promises.writeFile(tempPhoto, JPG_BYTES);
  const secondCapture = await CapturaService.saveCapture('39', '000123');

  assert.equal(firstCapture.ok, true);
  assert.equal(secondCapture.ok, true);
  assert.equal(secondCapture.data.fotosMovidas, 1);
  // Recaptura no mesmo segundo geraria o mesmo nome: uniqueDestPath preserva as duas.
  const salvas = await listarPasta(env, '39', '000123');
  assert.equal(salvas.filter(nome => nome.endsWith('.jpg')).length, 2, `esperava 2 fotos, veio ${salvas}`);

  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_39.json'), 'utf8'));
  const produto = loteJson.itens['000123'];
  assert.equal(produto.status, 'pendente_qa');
  assert.equal(produto.quantidadeFotos, 2);
  assert.equal(produto.historico.filter(evento => evento.evento === 'captura_salva').length, 2);
});

test('save capture turns TEMP tags into subfolders and keeps other suffixes in the name', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  // Nomes crus da camera ja marcados no palco Atual.
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_1.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_2_coding.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_3_RT.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_4_IS.jpg'), JPG_BYTES);

  const result = await CapturaService.saveCapture('50', '000123', '', '', 'observacao do produto');

  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 4);

  const raiz = await listarPasta(env, '50', '000123');
  // _coding fica no nome; _RT e _IS saem do nome e viram pasta.
  assert.ok(raiz.some(nome => padraoCapturado('000123', 0).test(nome)), `raiz sem a foto 0: ${raiz}`);
  assert.ok(raiz.some(nome => padraoCapturado('000123', 1, '_coding').test(nome)), `_coding perdido: ${raiz}`);
  assert.ok(await acharCapturado(env, '50', '000123', { indice: 2, subpasta: 'RT' }), 'foto _RT deve ir para RT/');
  assert.ok(await acharCapturado(env, '50', '000123', { indice: 3, subpasta: 'IS' }), 'foto _IS deve ir para IS/');
  assert.equal(raiz.filter(nome => nome.endsWith('.jpg')).length, 2, `so 2 fotos ficam na raiz: ${raiz}`);

  // Observacoes viram um .txt na pasta do produto.
  const txt = raiz.find(nome => nome.endsWith('.txt'));
  assert.ok(txt, `observacao nao gravada: ${raiz}`);
  assert.equal(
    await fs.promises.readFile(path.join(pastaProduto(env, '50', '000123'), txt), 'utf8'),
    'observacao do produto'
  );
});

test('marking toggles a suffix on saved photos without losing the file', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_1.jpg'), JPG_BYTES);
  await CapturaService.saveCapture('51', '000123');

  const original = await acharCapturado(env, '51', '000123');
  assert.ok(original);

  const marcado = await CapturaService.markPhotos({
    location: 'finalizadas', lote: '51', gtin: '000123', filenames: [original], suffix: '_coding'
  });
  assert.equal(marcado.ok, true);
  assert.ok(await acharCapturado(env, '51', '000123', { extras: '_coding' }), 'sufixo nao aplicado');

  // Segunda chamada e um toggle: volta ao nome sem sufixo.
  const desmarcado = await CapturaService.markPhotos({
    location: 'finalizadas', lote: '51', gtin: '000123', filenames: [`${original.slice(0, -4)}_coding.jpg`], suffix: '_coding'
  });
  assert.equal(desmarcado.ok, true);
  const arquivos = await listarPasta(env, '51', '000123');
  assert.deepEqual(arquivos, [original], `toggle deveria restaurar o nome: ${arquivos}`);
});

test('subfolder tagging moves between folders and never leaves a copy behind', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_1.jpg'), JPG_BYTES);
  await CapturaService.saveCapture('52', '000123');
  const nome = await acharCapturado(env, '52', '000123');

  await CapturaService.tagSubfolder({ lote: '52', gtin: '000123', filenames: [nome], pasta: 'RT' });
  assert.deepEqual(await listarPasta(env, '52', '000123', 'RT'), [nome]);
  assert.equal((await listarPasta(env, '52', '000123')).filter(n => n.endsWith('.jpg')).length, 0);

  // RT -> IS: troca direta, sem duplicar.
  await CapturaService.tagSubfolder({ lote: '52', gtin: '000123', filenames: [nome], pasta: 'IS' });
  assert.deepEqual(await listarPasta(env, '52', '000123', 'RT'), []);
  assert.deepEqual(await listarPasta(env, '52', '000123', 'IS'), [nome]);

  // Mesma pasta de novo: volta pra raiz.
  await CapturaService.tagSubfolder({ lote: '52', gtin: '000123', filenames: [nome], pasta: 'IS' });
  assert.deepEqual(await listarPasta(env, '52', '000123', 'IS'), []);
  assert.deepEqual((await listarPasta(env, '52', '000123')).filter(n => n.endsWith('.jpg')), [nome]);

  const subpastas = await CapturaService.getSubfolderImages('52', '000123');
  assert.deepEqual(subpastas.data.subpastas, {});
});

test('subfolder tagging rejects a folder outside RT/IS/AP', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'IMG_1.jpg'), JPG_BYTES);
  await CapturaService.saveCapture('53', '000123');
  const nome = await acharCapturado(env, '53', '000123');

  const result = await CapturaService.tagSubfolder({
    lote: '53', gtin: '000123', filenames: [nome], pasta: '../fora'
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /RT, IS ou AP/i);
  assert.deepEqual((await listarPasta(env, '53', '000123')).filter(n => n.endsWith('.jpg')), [nome]);
});

test('save capture does not persist a lote, product, or workbook when no files move', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto.jpg'), JPG_BYTES);
  const originalMove = FileRepository.moveToFinalizadas;
  FileRepository.moveToFinalizadas = async () => {
    throw new Error('destination unavailable');
  };
  t.after(() => {
    FileRepository.moveToFinalizadas = originalMove;
  });

  const result = await CapturaService.saveCapture('40', '000123');

  assert.equal(result.ok, false);
  assert.match(result.error, /no files moved/i);
  assert.equal(await fs.promises.stat(path.join(env.paths.jsons, 'Lote_40.json')).then(() => true, () => false), false);
  assert.equal(await fs.promises.stat(path.join(env.paths.xlsx, 'controle-lotes.xlsx')).then(() => true, () => false), false);
});

test('save capture persists only moved files when a later move fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'a.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'b.jpg'), JPG_BYTES);
  const originalMove = FileRepository.moveToFinalizadas;
  FileRepository.moveToFinalizadas = async (srcPath, ...args) => {
    if (path.basename(srcPath) === 'b.jpg') throw new Error('simulated move failure');
    return originalMove.call(FileRepository, srcPath, ...args);
  };
  t.after(() => {
    FileRepository.moveToFinalizadas = originalMove;
  });

  const result = await CapturaService.saveCapture('41', '000123');

  assert.equal(result.ok, false);
  assert.match(result.error, /some files failed to move/i);
  assert.equal(result.data.fotosMovidas, 1);
  assert.equal(result.data.fotosFalhadas, 1);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_41.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].quantidadeFotos, 1);
  assert.ok(await acharCapturado(env, '41', '000123'), 'a.jpg deve ter sido salva e renomeada');
  assert.equal(await fs.promises.stat(path.join(env.paths.imagesTemp, 'b.jpg')).then(() => true, () => false), true);
});

test('save capture reports an Excel rebuild failure as a warning after JSON is saved', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto.jpg'), JPG_BYTES);
  const originalUpdateControl = ExcelService.updateControlFromLote;
  ExcelService.updateControlFromLote = async () => {
    throw new Error('workbook is locked');
  };
  t.after(() => {
    ExcelService.updateControlFromLote = originalUpdateControl;
  });

  const result = await CapturaService.saveCapture('42', '000123');

  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.match(result.warnings[0].error, /workbook is locked/i);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_42.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].quantidadeFotos, 1);
});

test('save capture records an exclusive copy when TEMP cleanup fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const tempPhoto = path.join(env.paths.imagesTemp, 'foto.jpg');
  await fs.promises.writeFile(tempPhoto, JPG_BYTES);
  const originalUnlink = fs.promises.unlink;
  fs.promises.unlink = async filePath => {
    if (filePath === tempPhoto) throw new Error('simulated TEMP unlink failure');
    return originalUnlink.call(fs.promises, filePath);
  };
  t.after(() => {
    fs.promises.unlink = originalUnlink;
  });

  const result = await CapturaService.saveCapture('43', '000123');

  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.ok(await acharCapturado(env, '43', '000123'), 'copia exclusiva deve existir no destino');
  assert.equal(await fs.promises.stat(tempPhoto).then(() => true, () => false), true);
  assert.match(result.warnings[0].error, /TEMP cleanup failed/i);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_43.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].quantidadeFotos, 1);
});

test('concurrent captures for the same lote and GTIN preserve cumulative JSON state', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const firstPhoto = path.join(env.paths.imagesTemp, 'first.jpg');
  const secondPhoto = path.join(env.paths.imagesTemp, 'second.jpg');
  await fs.promises.writeFile(firstPhoto, JPG_BYTES);
  await fs.promises.writeFile(secondPhoto, JPG_BYTES);

  const originalSnapshot = FileRepository.snapshotTempFiles;
  let snapshotCall = 0;
  FileRepository.snapshotTempFiles = async () => {
    snapshotCall += 1;
    return snapshotCall === 1
      ? [{ name: 'first.jpg', path: firstPhoto }]
      : [{ name: 'second.jpg', path: secondPhoto }];
  };
  t.after(() => {
    FileRepository.snapshotTempFiles = originalSnapshot;
  });

  const [first, second] = await Promise.all([
    CapturaService.saveCapture('44', '000123'),
    CapturaService.saveCapture('44', '000123')
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_44.json'), 'utf8'));
  const produto = loteJson.itens['000123'];
  assert.equal(produto.quantidadeFotos, 2);
  assert.equal(produto.historico.filter(evento => evento.evento === 'captura_salva').length, 2);
});
