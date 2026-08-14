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

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

async function request(app, requestPath, body, operationId) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Operation-ID': operationId },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function savePhoto(env, lote = '37', gtin = '000123', filename = 'a.jpg') {
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, filename), JPG_BYTES);
  const result = await CapturaService.saveCapture(lote, gtin, 'COD-1', 'Produto local');
  assert.equal(result.ok, true);
}

test('classifies AP and AT by moving files, then unclassifies without overwrite', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env);
  const root = path.join(env.paths.finalizadas, 'LOTE 37', '000123');
  const ap = await DeliveryService.classifyPhotoAP('37', '000123', 'a.jpg');
  assert.equal(ap.ok, true);
  assert.equal(ap.data.filename, 'a.jpg');
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), true);
  await fs.promises.writeFile(path.join(root, 'a.jpg'), Buffer.from('root collision'));

  const undo = await DeliveryService.unclassifyPhoto('37', '000123', 'a.jpg', 'AP');
  assert.equal(undo.ok, true);
  assert.equal(undo.data.filename, 'a_001.jpg');
  assert.equal(fs.existsSync(path.join(root, 'a_001.jpg')), true);
  assert.deepEqual(await fs.promises.readFile(path.join(root, 'a.jpg')), Buffer.from('root collision'));

  const at = await DeliveryService.classifyPhotoAT('37', '000123', 'a_001.jpg');
  assert.equal(at.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'AT', 'a_001.jpg')), true);
});

test('classifies into AP and AT without overwriting an existing destination', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '41');
  const root = path.join(env.paths.finalizadas, 'LOTE 41', '000123');

  await fs.promises.mkdir(path.join(root, 'AP'), { recursive: true });
  await fs.promises.writeFile(path.join(root, 'AP', 'a.jpg'), Buffer.from('existing AP'));
  const ap = await DeliveryService.classifyPhotoAP('41', '000123', 'a.jpg');
  assert.equal(ap.ok, true);
  assert.equal(ap.data.filename, 'a_001.jpg');
  assert.deepEqual(await fs.promises.readFile(path.join(root, 'AP', 'a.jpg')), Buffer.from('existing AP'));
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a_001.jpg')), true);

  await fs.promises.writeFile(path.join(root, 'a_001.jpg'), JPG_BYTES);
  await fs.promises.mkdir(path.join(root, 'AT'), { recursive: true });
  await fs.promises.writeFile(path.join(root, 'AT', 'a_001.jpg'), Buffer.from('existing AT'));
  const at = await DeliveryService.classifyPhotoAT('41', '000123', 'a_001.jpg');
  assert.equal(at.ok, true);
  assert.equal(at.data.filename, 'a_001_001.jpg');
  assert.deepEqual(await fs.promises.readFile(path.join(root, 'AT', 'a_001.jpg')), Buffer.from('existing AT'));
  assert.equal(fs.existsSync(path.join(root, 'AT', 'a_001_001.jpg')), true);
});

test('rejects unsafe QA path inputs without changing files', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '42');
  const root = path.join(env.paths.finalizadas, 'LOTE 42', '000123');
  const source = path.join(root, 'a.jpg');
  const escapedProduct = path.join(env.paths.finalizadas, 'outro');
  const escapedLote = path.join(env.paths.finalizadas, 'outro', '000123');
  await fs.promises.mkdir(escapedProduct, { recursive: true });
  await fs.promises.mkdir(escapedLote, { recursive: true });
  await fs.promises.writeFile(path.join(escapedProduct, 'a.jpg'), Buffer.from('other product'));
  await fs.promises.writeFile(path.join(escapedLote, 'a.jpg'), Buffer.from('other lote'));
  const invalidInputs = [
    () => DeliveryService.classifyPhotoAP('42', '../outro', 'a.jpg'),
    () => DeliveryService.classifyPhotoAP('42/../outro', '000123', 'a.jpg'),
    () => DeliveryService.classifyPhotoAP('42', '000123', '../a.jpg'),
    () => DeliveryService.deletePhoto('42', '000123', 'a.jpg', '../AP')
  ];

  for (const operation of invalidInputs) {
    const result = await operation();
    assert.equal(result.ok, false);
    assert.equal(fs.existsSync(source), true);
  }
  assert.equal(fs.existsSync(path.join(escapedProduct, 'AP', 'a.jpg')), false);
  assert.equal(fs.existsSync(path.join(escapedLote, 'AP', 'a.jpg')), false);
  assert.deepEqual(await fs.promises.readFile(path.join(escapedProduct, 'a.jpg')), Buffer.from('other product'));
  assert.deepEqual(await fs.promises.readFile(path.join(escapedLote, 'a.jpg')), Buffer.from('other lote'));
});

test('does not mutate photos when the lote or product is absent from JSON', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const root = path.join(env.paths.finalizadas, 'LOTE 43', '000123');
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, 'a.jpg'), JPG_BYTES);

  const missingLote = await DeliveryService.classifyPhotoAP('43', '000123', 'a.jpg');
  assert.equal(missingLote.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);

  await savePhoto(env, '44');
  const missingProductRoot = path.join(env.paths.finalizadas, 'LOTE 44', '999999');
  await fs.promises.mkdir(missingProductRoot, { recursive: true });
  await fs.promises.writeFile(path.join(missingProductRoot, 'orphan.jpg'), JPG_BYTES);
  const missingProduct = await DeliveryService.deletePhoto('44', '999999', 'orphan.jpg');
  assert.equal(missingProduct.ok, false);
  assert.equal(fs.existsSync(path.join(missingProductRoot, 'orphan.jpg')), true);
});

test('rejects an invalid unclassify source without moving the photo', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '45');
  const root = path.join(env.paths.finalizadas, 'LOTE 45', '000123');

  const result = await DeliveryService.unclassifyPhoto('45', '000123', 'a.jpg', 'invalid');
  assert.equal(result.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
});

test('deletes a classified photo with an audit trail and updates product history', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '38');
  const root = path.join(env.paths.finalizadas, 'LOTE 38', '000123');
  await DeliveryService.classifyPhotoAP('38', '000123', 'a.jpg');

  const deleted = await DeliveryService.deletePhoto('38', '000123', 'a.jpg', 'AP');

  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_38.json'), 'utf8'));
  assert.equal(lote.itens['000123'].quantidadeFotos, 0);
  assert.equal(lote.itens['000123'].historico.at(-1).evento, 'foto_excluida');
  const auditFiles = await fs.promises.readdir(env.paths.auditoria);
  const auditLog = await fs.promises.readFile(path.join(env.paths.auditoria, auditFiles[0]), 'utf8');
  assert.match(auditLog, /DELETE_PHOTO/);
});

test('completes QA from JSON, updates the control workbook, and does not deliver', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '39');

  const complete = await DeliveryService.completeQa('39', '000123', DeliveryType.NORMAL);

  assert.equal(complete.ok, true);
  assert.equal(complete.data.status, 'pronto_para_entrega');
  assert.equal(complete.data.quantidadeFotosElegiveis, 1);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_39.json'), 'utf8'));
  assert.equal(lote.itens['000123'].status, 'pronto_para_entrega');
  assert.equal(lote.itens['000123'].historico.at(-1).evento, 'qa_concluido');
  assert.equal(fs.existsSync(path.join(env.paths.entrega, '39')), false);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(env.paths.xlsx, 'controle-lotes.xlsx'));
  assert.equal(workbook.getWorksheet('Lote 39').getCell('F2').value, 'pronto_para_entrega');
});

test('rejects an unknown QA delivery type without changing JSON', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '46');
  const jsonPath = path.join(env.paths.jsons, 'Lote_46.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');

  const result = await DeliveryService.completeQa('46', '000123', 'express');

  assert.equal(result.ok, false);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
});

test('QA routes use the global operationId envelope and expose all commands', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '40');
  const app = createApp({ configOverrides: env.config });

  const classified = await request(app, '/api/qa/classificar', {
    lote: '40', gtin: '000123', filename: 'a.jpg', classification: 'AP'
  }, 'qa-classify');
  assert.equal(classified.status, 200);
  assert.equal(classified.body.ok, true);
  assert.equal(classified.body.data.classified, 'AP');

  const unclassified = await request(app, '/api/qa/desclassificar', {
    lote: '40', gtin: '000123', filename: 'a.jpg', fromClassification: 'AP'
  }, 'qa-unclassify');
  assert.equal(unclassified.status, 200);
  assert.equal(unclassified.body.data.unclassified, true);

  const deleted = await request(app, '/api/qa/excluir', {
    lote: '40', gtin: '000123', filename: 'a.jpg', location: 'root'
  }, 'qa-delete');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.deleted, true);
});

test('QA routes reject invalid lote and GTIN before commands run', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '47');
  const app = createApp({ configOverrides: env.config });
  const root = path.join(env.paths.finalizadas, 'LOTE 47', '000123');

  const invalidGtin = await request(app, '/api/qa/classificar', {
    lote: '47', gtin: '../outro', filename: 'a.jpg', classification: 'AP'
  }, 'qa-invalid-gtin');
  assert.equal(invalidGtin.status, 400);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);

  const invalidLote = await request(app, '/api/qa/excluir', {
    lote: '47/../outro', gtin: '000123', filename: 'a.jpg', location: 'root'
  }, 'qa-invalid-lote');
  assert.equal(invalidLote.status, 400);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
});
