import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { FileRepository } from '../../repositories/file-repository.js';
import CapturaService from '../../services/captura-service.js';
import ExcelService from '../../services/excel-service.js';
import { createApp } from '../../server/app.js';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
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
  const suffixedPhoto = path.join(env.paths.finalizadas, 'LOTE 37', '000123', 'foto_001.jpg');
  await fs.promises.writeFile(tempPhoto, JPG_BYTES);
  await fs.promises.mkdir(path.dirname(finalPhoto), { recursive: true });
  await fs.promises.writeFile(finalPhoto, Buffer.from('existing photo'));

  const result = await CapturaService.saveCapture('37', '000123', '', 'Produto local');

  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.equal(await fs.promises.stat(tempPhoto).then(() => true, () => false), false);
  assert.deepEqual(await fs.promises.readFile(finalPhoto), Buffer.from('existing photo'));
  assert.deepEqual(await fs.promises.readFile(suffixedPhoto), JPG_BYTES);

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
  assert.equal(
    await fs.promises.stat(path.join(env.paths.finalizadas, 'LOTE 38', '000123', 'foto.jpg')).then(() => true, () => false),
    true
  );
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
  assert.equal(await fs.promises.stat(path.join(env.paths.finalizadas, 'LOTE 39', '000123', 'foto.jpg')).then(() => true, () => false), true);
  assert.equal(await fs.promises.stat(path.join(env.paths.finalizadas, 'LOTE 39', '000123', 'foto_001.jpg')).then(() => true, () => false), true);

  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_39.json'), 'utf8'));
  const produto = loteJson.itens['000123'];
  assert.equal(produto.status, 'pendente_qa');
  assert.equal(produto.quantidadeFotos, 2);
  assert.equal(produto.historico.filter(evento => evento.evento === 'captura_salva').length, 2);
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
  assert.equal(await fs.promises.stat(path.join(env.paths.finalizadas, 'LOTE 41', '000123', 'a.jpg')).then(() => true, () => false), true);
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

test('save capture removes its final destination when TEMP unlink fails after an exclusive copy', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const tempPhoto = path.join(env.paths.imagesTemp, 'foto.jpg');
  const finalPhoto = path.join(env.paths.finalizadas, 'LOTE 43', '000123', 'foto.jpg');
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

  assert.equal(result.ok, false);
  assert.match(result.error, /no files moved/i);
  assert.equal(await fs.promises.stat(finalPhoto).then(() => true, () => false), false);
  assert.equal(await fs.promises.stat(path.join(env.paths.jsons, 'Lote_43.json')).then(() => true, () => false), false);
  assert.equal(await fs.promises.stat(path.join(env.paths.xlsx, 'controle-lotes.xlsx')).then(() => true, () => false), false);
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
