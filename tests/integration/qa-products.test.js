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
import LoteRepository from '../../repositories/lote-repository.js';
import { DeliveryType } from '../../domain/delivery.js';
import { auditLogger } from '../../server/audit-logger.js';

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

  // Salvar renomeia no padrao do sphoto (GTIN_data_hora_indice). Estes testes tratam
  // de classificacao/entrega, nao de nomenclatura, entao a fixture volta pro nome
  // fixo pra manter as asserções legiveis e deterministicas.
  const dir = path.join(env.paths.finalizadas, `LOTE ${lote}`, gtin);
  const salvo = result.data.detalhes.moved[0].dest;
  if (salvo !== filename) {
    await fs.promises.rename(path.join(dir, salvo), path.join(dir, filename));
  }
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

test('rejects an invalid delete location without changing the file or JSON history', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '51');
  const root = path.join(env.paths.finalizadas, 'LOTE 51', '000123');
  const jsonPath = path.join(env.paths.jsons, 'Lote_51.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');

  const result = await DeliveryService.deletePhoto('51', '000123', 'a.jpg', '../AP');

  assert.equal(result.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
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

test('compensates a classify move when saving its JSON history fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '48');
  const root = path.join(env.paths.finalizadas, 'LOTE 48', '000123');
  const originalSave = LoteRepository.save;
  LoteRepository.save = async () => { throw new Error('forced save failure'); };
  t.after(() => { LoteRepository.save = originalSave; });

  const result = await DeliveryService.classifyPhotoAP('48', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced save failure/);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
  const auditFiles = await fs.promises.readdir(env.paths.auditoria);
  const auditLog = await fs.promises.readFile(path.join(env.paths.auditoria, auditFiles[0]), 'utf8');
  assert.match(auditLog, /CLASSIFY_AP/);
  assert.match(auditLog, /QA_MOVE_COMPENSATED/);
});

test('compensates an unclassify move when saving its JSON history fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '49');
  const root = path.join(env.paths.finalizadas, 'LOTE 49', '000123');
  const classified = await DeliveryService.classifyPhotoAP('49', '000123', 'a.jpg');
  assert.equal(classified.ok, true);
  const originalSave = LoteRepository.save;
  LoteRepository.save = async () => { throw new Error('forced save failure'); };
  t.after(() => { LoteRepository.save = originalSave; });

  const result = await DeliveryService.unclassifyPhoto('49', '000123', 'a.jpg', 'AP');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced save failure/);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), false);
  const auditFiles = await fs.promises.readdir(env.paths.auditoria);
  const auditLog = await fs.promises.readFile(path.join(env.paths.auditoria, auditFiles[0]), 'utf8');
  assert.match(auditLog, /UNCLASSIFY/);
  assert.match(auditLog, /QA_MOVE_COMPENSATED/);
});

test('does not delete a photo when saving its deletion history fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '50');
  const root = path.join(env.paths.finalizadas, 'LOTE 50', '000123');
  const originalSave = LoteRepository.save;
  LoteRepository.save = async () => { throw new Error('forced save failure'); };
  t.after(() => { LoteRepository.save = originalSave; });

  const result = await DeliveryService.deletePhoto('50', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced save failure/);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  const lote = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_50.json'), 'utf8'));
  assert.notEqual(lote.itens['000123'].historico.at(-1)?.evento, 'foto_excluida');
  const auditFiles = await fs.promises.readdir(env.paths.auditoria);
  const auditLog = await fs.promises.readFile(path.join(env.paths.auditoria, auditFiles[0]), 'utf8');
  assert.match(auditLog, /DELETE_PHOTO/);
  assert.match(auditLog, /DELETE_PHOTO_ABORTED/);
});

test('reports when compensated classify cannot log the compensation event', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '56');
  const root = path.join(env.paths.finalizadas, 'LOTE 56', '000123');
  const originalSave = LoteRepository.save;
  const originalLog = auditLogger.log;
  let logCalls = 0;
  LoteRepository.save = async () => { throw new Error('forced save failure'); };
  auditLogger.log = async (...args) => {
    logCalls += 1;
    if (logCalls === 2) throw new Error('forced compensation audit failure');
    return originalLog.apply(auditLogger, args);
  };
  t.after(() => {
    LoteRepository.save = originalSave;
    auditLogger.log = originalLog;
  });

  const result = await DeliveryService.classifyPhotoAP('56', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced save failure/);
  assert.match(result.error, /forced compensation audit failure/);
  assert.match(result.warning, /compensated.*audit/i);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
});

test('reports when delete abort cannot log the abort event', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '57');
  const root = path.join(env.paths.finalizadas, 'LOTE 57', '000123');
  const originalSave = LoteRepository.save;
  const originalLog = auditLogger.log;
  let logCalls = 0;
  LoteRepository.save = async () => { throw new Error('forced save failure'); };
  auditLogger.log = async (...args) => {
    logCalls += 1;
    if (logCalls === 2) throw new Error('forced abort audit failure');
    return originalLog.apply(auditLogger, args);
  };
  t.after(() => {
    LoteRepository.save = originalSave;
    auditLogger.log = originalLog;
  });

  const result = await DeliveryService.deletePhoto('57', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced save failure/);
  assert.match(result.error, /forced abort audit failure/);
  assert.match(result.warning, /abort.*audit/i);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
});

test('rejects dot directory filenames before creating QA classification folders', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '54');
  const root = path.join(env.paths.finalizadas, 'LOTE 54', '000123');
  const jsonPath = path.join(env.paths.jsons, 'Lote_54.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');

  for (const filename of ['.', '..']) {
    const result = await DeliveryService.classifyPhotoAP('54', '000123', filename);
    assert.equal(result.ok, false);
    assert.match(result.error, /Invalid filename/);
  }

  assert.equal(fs.existsSync(path.join(root, 'AP')), false);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
});

test('real audit write failure stops classify without persisting JSON history', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '55');
  const root = path.join(env.paths.finalizadas, 'LOTE 55', '000123');
  const jsonPath = path.join(env.paths.jsons, 'Lote_55.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');
  await fs.promises.rm(env.paths.auditoria, { recursive: true, force: true });
  await fs.promises.writeFile(env.paths.auditoria, 'not a directory');
  auditLogger.initialized = false;

  const result = await DeliveryService.classifyPhotoAP('55', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /Audit log failed|ENOTDIR|not a directory|EEXIST/);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
});

test('compensates a classify move when audit logging fails without persisting JSON history', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '52');
  const root = path.join(env.paths.finalizadas, 'LOTE 52', '000123');
  const jsonPath = path.join(env.paths.jsons, 'Lote_52.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');
  const originalLog = auditLogger.log;
  auditLogger.log = async () => { throw new Error('forced audit failure'); };
  t.after(() => { auditLogger.log = originalLog; });

  const result = await DeliveryService.classifyPhotoAP('52', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced audit failure/);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), false);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
});

test('does not persist deletion history or remove the file when audit logging fails', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '53');
  const root = path.join(env.paths.finalizadas, 'LOTE 53', '000123');
  const jsonPath = path.join(env.paths.jsons, 'Lote_53.json');
  const before = await fs.promises.readFile(jsonPath, 'utf8');
  const originalLog = auditLogger.log;
  auditLogger.log = async () => { throw new Error('forced audit failure'); };
  t.after(() => { auditLogger.log = originalLog; });

  const result = await DeliveryService.deletePhoto('53', '000123', 'a.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /forced audit failure/);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
  assert.equal(await fs.promises.readFile(jsonPath, 'utf8'), before);
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

test('QA photo listing reports AP and AT classification from the folder the file sits in', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '60', '000123', 'a.jpg');
  await savePhoto(env, '60', '000123', 'b.jpg');
  await savePhoto(env, '60', '000123', 'c.jpg');

  await DeliveryService.classifyPhotoAP('60', '000123', 'a.jpg');
  await DeliveryService.classifyPhotoAT('60', '000123', 'b.jpg');

  const result = await DeliveryService.loadQaPhotos('60', '000123');
  assert.equal(result.ok, true);

  const porNome = Object.fromEntries(result.data.photos.map(p => [p.filename, p]));
  assert.equal(porNome['a.jpg'].classification, 'AP');
  assert.equal(porNome['a.jpg'].location, 'AP');
  assert.equal(porNome['b.jpg'].classification, 'AT');
  assert.equal(porNome['b.jpg'].location, 'AT');
  assert.equal(porNome['c.jpg'].classification, null);
  assert.equal(porNome['c.jpg'].location, 'root');

  assert.equal(result.data.count, 3);
  assert.equal(result.data.classificadas, 2);
  // A tela precisa do tamanho para o rodape do preview.
  assert.ok(porNome['c.jpg'].size > 0);
  assert.match(porNome['a.jpg'].url, /\/AP\/a\.jpg$/);
});

test('QA listing follows a photo that is unclassified back to the root', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '61', '000123', 'a.jpg');

  await DeliveryService.classifyPhotoAP('61', '000123', 'a.jpg');
  const marcada = await DeliveryService.loadQaPhotos('61', '000123');
  assert.equal(marcada.data.photos[0].classification, 'AP');

  await DeliveryService.unclassifyPhoto('61', '000123', 'a.jpg', 'AP');
  const desmarcada = await DeliveryService.loadQaPhotos('61', '000123');
  assert.equal(desmarcada.data.photos[0].classification, null);
  assert.equal(desmarcada.data.classificadas, 0);
});

test('completing QA as atualizacao counts only AT photos and refuses when there are none', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '62', '000123', 'a.jpg');
  await savePhoto(env, '62', '000123', 'b.jpg');

  // Sem nenhuma AT a entrega de atualizacao nao tem o que levar.
  const semAt = await DeliveryService.completeQa('62', '000123', DeliveryType.ATUALIZACAO);
  assert.equal(semAt.ok, false);
  assert.match(semAt.error, /No AT photos/i);

  await DeliveryService.classifyPhotoAT('62', '000123', 'b.jpg');
  const comAt = await DeliveryService.completeQa('62', '000123', DeliveryType.ATUALIZACAO);
  assert.equal(comAt.ok, true);
  assert.equal(comAt.data.deliveryType, DeliveryType.ATUALIZACAO);
  assert.equal(comAt.data.quantidadeFotosElegiveis, 1);
});

test('completing QA as normal refuses when every photo was classified away from the root', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await savePhoto(env, '63', '000123', 'a.jpg');
  await DeliveryService.classifyPhotoAP('63', '000123', 'a.jpg');

  const result = await DeliveryService.completeQa('63', '000123', DeliveryType.NORMAL);

  assert.equal(result.ok, false);
  assert.match(result.error, /No root photos/i);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_63.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].status, 'pendente_qa');
});
