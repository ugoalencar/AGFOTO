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

async function saveReadyProduct(env, lote = '37', gtin = '000123') {
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'root.jpg'), JPG_BYTES);
  const saved = await CapturaService.saveCapture(lote, gtin, 'COD-1', 'Produto local');
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

  const executed = await DeliveryService.executeDelivery('39', '000123', 'COD-1', DeliveryType.NORMAL);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_39.json'), 'utf8'));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(env.paths.xlsx, 'controle-lotes.xlsx'));
  const attempts = await fs.promises.readdir(env.paths.envios);

  assert.equal(executed.ok, true, executed.error);
  assert.equal(lote.itens['000123'].status, 'entregue');
  assert.ok(lote.itens['000123'].ultimaEntregaEm);
  assert.equal(lote.itens['000123'].ultimoErro, null);
  assert.equal(workbook.getWorksheet('Lote 39').getCell('F2').value, 'entregue');
  assert.ok(attempts.length >= 2);
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

  const executed = await DeliveryService.executeDelivery('40', '000123', 'COD-1', DeliveryType.NORMAL);
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
  const execute = await request(app, '/api/entregas/executar', { lote: '41', gtin: '000123', codigo: 'COD-1' }, 'delivery-execute');

  assert.equal(missing.status, 400);
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.ok(first.body.requestId);
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.data, first.body.data);
  assert.equal(execute.status, 200);
  assert.equal(execute.body.ok, true);
});
