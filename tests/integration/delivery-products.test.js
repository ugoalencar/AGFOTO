import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import { createApp } from '../../server/app.js';
import CapturaService from '../../services/captura-service.js';
import DeliveryService from '../../services/delivery-service.js';
import { DeliveryType } from '../../domain/delivery.js';
import { FtpProvider, resetFtpService } from '../../services/ftp-service.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

async function saveReadyProduct(env, lote = '37', gtin = '000123', codigo = 'COD-1') {
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'root.jpg'), JPG_BYTES);
  const saved = await CapturaService.saveCapture(lote, gtin, codigo, 'Produto local');
  assert.equal(saved.ok, true);
  const qa = await DeliveryService.completeQa(lote, gtin, DeliveryType.NORMAL);
  assert.equal(qa.ok, true);
}

async function request(app, requestPath, body, operationId) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${requestPath}`, {
      method: 'POST',
      headers: operationId ? { 'Content-Type': 'application/json', 'X-Operation-ID': operationId } : { 'Content-Type': 'application/json' },
      body: JSON.stringify(operationId ? { ...body, operationId } : body)
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('prepare normal stages only root photos and persists an exact manifest', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env);
  const root = path.join(env.paths.finalizadas, 'LOTE 37', '000123');
  await fs.promises.mkdir(path.join(root, 'AP'), { recursive: true });
  await fs.promises.mkdir(path.join(root, 'AT'), { recursive: true });
  await fs.promises.writeFile(path.join(root, 'AP', 'ap.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(root, 'AT', 'at.jpg'), JPG_BYTES);

  const prepared = await DeliveryService.prepareDelivery('37', '000123', 'COD-1', DeliveryType.NORMAL);

  assert.equal(prepared.ok, true);
  assert.deepEqual(prepared.data.manifest.files.map(file => file.name), ['root.jpg']);
  assert.equal(prepared.data.manifest.files[0].size, JPG_BYTES.length);
  assert.match(prepared.data.manifest.files[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(prepared.data.manifest.files[0].sourcePath, path.join(root, 'root.jpg'));
  assert.equal(prepared.data.manifest.files[0].stagingPath, path.join(env.paths.entrega, 'LOTE 37', 'COD-1', 'root.jpg'));
  assert.equal(fs.existsSync(path.join(env.paths.entrega, 'LOTE 37', 'COD-1', 'root.jpg')), true);
  assert.equal(fs.existsSync(path.join(env.paths.entrega, 'LOTE 37', 'COD-1', 'AP', 'ap.jpg')), false);
  assert.equal((await fs.promises.readdir(env.paths.envios)).length, 1);
});

test('prepare update stages AT photos in the product root and rejects unready inputs', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '38');
  const root = path.join(env.paths.finalizadas, 'LOTE 38', '000123');
  const classified = await DeliveryService.classifyPhotoAT('38', '000123', 'root.jpg');
  assert.equal(classified.ok, true);

  const prepared = await DeliveryService.prepareDelivery('38', '000123', 'COD-1', DeliveryType.ATUALIZACAO);
  const invalidType = await DeliveryService.prepareDelivery('38', '000123', 'COD-1', 'external');
  const missingCode = await DeliveryService.prepareDelivery('38', '000123', '', DeliveryType.ATUALIZACAO);

  assert.equal(prepared.ok, true);
  assert.equal(fs.existsSync(path.join(env.paths.entrega, 'LOTE 38', 'COD-1', 'root.jpg')), true);
  assert.equal(fs.existsSync(path.join(env.paths.entrega, 'LOTE 38', 'COD-1', 'AT', 'root.jpg')), false);
  assert.equal(invalidType.ok, false);
  assert.equal(missingCode.ok, false);
});

test('execute uploads and verifies every staged file before recording delivered', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '39');
  const prepared = await DeliveryService.prepareDelivery('39', '000123', 'COD-1', DeliveryType.NORMAL);
  assert.equal(prepared.ok, true);

  const executed = await DeliveryService.executeDelivery('39', '000123', 'COD-1', DeliveryType.NORMAL, prepared.data.attemptId);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_39.json'), 'utf8'));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(env.paths.xlsx, 'controle-lotes.xlsx'));
  const attempts = await fs.promises.readdir(env.paths.envios);
  const attempt = JSON.parse(await fs.promises.readFile(path.join(env.paths.envios, prepared.data.attemptId + '.json'), 'utf8'));

  assert.equal(executed.ok, true, executed.error);
  assert.equal(lote.itens['000123'].status, 'entregue');
  assert.ok(lote.itens['000123'].ultimaEntregaEm);
  assert.equal(lote.itens['000123'].ultimoErro, null);
  assert.equal(workbook.getWorksheet('Lote 39').getCell('F2').value, 'entregue');
  assert.equal(attempts.length, 1);
  assert.equal(attempt.status, 'entregue');
});

test('execute requires a prepared attempt and preserves status for validation failures', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '42');
  const prepared = await DeliveryService.prepareDelivery('42', '000123', 'COD-1', DeliveryType.NORMAL);
  const invalidType = await DeliveryService.executeDelivery('42', '000123', 'COD-1', 'external');
  const wrongCode = await DeliveryService.executeDelivery('42', '000123', 'OTHER-CODE', DeliveryType.NORMAL, prepared.data.attemptId);
  const missingAttempt = await DeliveryService.executeDelivery('42', '000123', 'COD-1', DeliveryType.NORMAL);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_42.json'), 'utf8'));

  assert.equal(invalidType.ok, false);
  assert.equal(wrongCode.ok, false);
  assert.equal(missingAttempt.ok, false);
  assert.match(wrongCode.error, /does not match/i);
  assert.match(missingAttempt.error, /prepared delivery attempt/i);
  assert.equal(lote.itens['000123'].status, 'pronto_para_entrega');
  assert.equal(lote.itens['000123'].ultimoErro, null);
  assert.equal((await fs.promises.readdir(env.paths.envios)).length, 1);
});

test('incompatible prepared attempt remains staged and does not create an operational failure', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '44');
  const prepared = await DeliveryService.prepareDelivery('44', '000123', 'COD-1', DeliveryType.NORMAL);

  const executed = await DeliveryService.executeDelivery('44', '000123', 'COD-1', DeliveryType.ATUALIZACAO, prepared.data.attemptId);
  const record = JSON.parse(await fs.promises.readFile(path.join(env.paths.envios, prepared.data.attemptId + '.json'), 'utf8'));
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_44.json'), 'utf8'));

  assert.equal(executed.ok, false);
  assert.match(executed.error, /does not match/i);
  assert.equal(record.status, 'staging');
  assert.equal(lote.itens['000123'].status, 'pronto_para_entrega');
  assert.equal(lote.itens['000123'].ultimoErro, null);
});

test('connection failure after a valid prepared attempt records delivery error', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '45');
  const prepared = await DeliveryService.prepareDelivery('45', '000123', 'COD-1', DeliveryType.NORMAL);
  class BrokenConnectProvider extends FtpProvider {
    async connect() { throw new Error('forced connect failure'); }
    async disconnect() { return true; }
  }
  resetFtpService(new BrokenConnectProvider());
  t.after(() => resetFtpService());

  const executed = await DeliveryService.executeDelivery('45', '000123', 'COD-1', DeliveryType.NORMAL, prepared.data.attemptId);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_45.json'), 'utf8'));
  const record = JSON.parse(await fs.promises.readFile(path.join(env.paths.envios, prepared.data.attemptId + '.json'), 'utf8'));

  assert.equal(executed.ok, false);
  assert.match(executed.error, /connect/i);
  assert.equal(record.status, 'erro_entrega');
  assert.equal(lote.itens['000123'].status, 'erro_entrega');
  assert.match(lote.itens['000123'].ultimoErro, /connect/i);
});

test('prepare rejects products without an internal code instead of accepting an arbitrary codigo', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '46', '000123', null);

  const prepared = await DeliveryService.prepareDelivery('46', '000123', 'ARBITRARY-CODE', DeliveryType.NORMAL);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_46.json'), 'utf8'));

  assert.equal(prepared.ok, false);
  assert.match(prepared.error, /product internal code/i);
  assert.equal(lote.itens['000123'].status, 'pronto_para_entrega');
  assert.equal((await fs.promises.readdir(env.paths.envios)).length, 0);
});

test('execute uses the prepared attempt instead of rebuilding staging from later files', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '43');
  const prepared = await DeliveryService.prepareDelivery('43', '000123', 'COD-1', DeliveryType.NORMAL);
  assert.equal(prepared.ok, true);
  await fs.promises.writeFile(path.join(env.paths.finalizadas, 'LOTE 43', '000123', 'late.jpg'), JPG_BYTES);

  const executed = await DeliveryService.executeDelivery('43', '000123', 'COD-1', DeliveryType.NORMAL, prepared.data.attemptId);
  const records = await Promise.all(
    (await fs.promises.readdir(env.paths.envios))
      .map(file => fs.promises.readFile(path.join(env.paths.envios, file), 'utf8').then(JSON.parse))
  );
  const completed = records.find(record => record.id === prepared.data.attemptId);

  assert.equal(executed.ok, true, executed.error);
  assert.ok(completed);
  assert.deepEqual(completed.manifest.files.map(file => file.name), ['root.jpg']);
  assert.equal(completed.manifest.files.some(file => file.name === 'late.jpg'), false);
});

test('execute verification failure preserves source and records delivery error', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '40');
  await DeliveryService.prepareDelivery('40', '000123', 'COD-1', DeliveryType.NORMAL);
  class BrokenVerificationProvider extends FtpProvider {
    async connect() { return true; }
    async disconnect() { return true; }
    async uploadFile() { return { success: true }; }
    async listFiles() { return []; }
    async verifyFile() { return { exists: false }; }
  }
  resetFtpService(new BrokenVerificationProvider());
  t.after(() => resetFtpService());

  const prepared = await DeliveryService.prepareDelivery('40', '000123', 'COD-1', DeliveryType.NORMAL);
  const executed = await DeliveryService.executeDelivery('40', '000123', 'COD-1', DeliveryType.NORMAL, prepared.data.attemptId);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_40.json'), 'utf8'));
  const auditFile = (await fs.promises.readdir(env.paths.auditoria))[0];
  const audit = await fs.promises.readFile(path.join(env.paths.auditoria, auditFile), 'utf8');

  assert.equal(executed.ok, false);
  assert.equal(fs.existsSync(path.join(env.paths.finalizadas, 'LOTE 40', '000123', 'root.jpg')), true);
  assert.equal(lote.itens['000123'].status, 'erro_entrega');
  assert.match(lote.itens['000123'].ultimoErro, /verification/i);
  assert.ok((await fs.promises.readdir(env.paths.envios)).length >= 2);
  assert.match(audit, /ENTREGA_ERRO/);
});

test('delivery routes require and replay operationId with the global envelope', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await saveReadyProduct(env, '41');
  const app = createApp({ configOverrides: env.config });

  const missing = await request(app, '/api/entregas/preparar', { lote: '41', gtin: '000123', codigo: 'COD-1' }, undefined);
  const first = await request(app, '/api/entregas/preparar', { lote: '41', gtin: '000123', codigo: 'COD-1' }, 'delivery-prepare');
  const replay = await request(app, '/api/entregas/preparar', { lote: '41', gtin: '000123', codigo: 'COD-1' }, 'delivery-prepare');
  const execute = await request(app, '/api/entregas/executar', { lote: '41', gtin: '000123', codigo: 'COD-1', attemptId: first.body.data.attemptId }, 'delivery-execute');

  assert.equal(missing.status, 400);
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.ok(first.body.requestId);
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.data, first.body.data);
  assert.equal(execute.status, 200);
  assert.equal(execute.body.ok, true);
});
