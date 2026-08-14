import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import ExcelJS from 'exceljs';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import { createApp } from '../../server/app.js';
import ExcelService from '../../services/excel-service.js';

async function makeWorkbook(filePath, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Entrada');
  rows.forEach(row => worksheet.addRow(row));
  await workbook.xlsx.writeFile(filePath);
}

async function request(app, requestPath, body, operationId) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operation-Id': operationId
      },
      body: JSON.stringify({ operationId, ...body })
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('imports lookup workbook and blocks silent conflicts', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const entrada = path.join(env.paths.xlsx, 'entrada.xlsx');
  await makeWorkbook(entrada, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-1', 'Produto 1']]);

  const imported = await ExcelService.importWorkbook({ lote: '37', filePath: entrada });
  assert.equal(imported.ok, true);
  assert.equal(imported.data.preview.length, 1);

  const confirmed = await ExcelService.confirmImport(imported.data.importId);
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.data.inserted, 1);
  assert.equal((await ExcelService.lookupCodigo('37', '000123')).data.codigo, 'COD-1');

  const conflictFile = path.join(env.paths.xlsx, 'entrada-conflict.xlsx');
  await makeWorkbook(conflictFile, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-2', 'Produto 1']]);
  const conflict = await ExcelService.importWorkbook({ lote: '37', filePath: conflictFile });
  assert.equal(conflict.ok, true);
  assert.equal(conflict.data.conflicts.length, 1);
  const blocked = await ExcelService.confirmImport(conflict.data.importId);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /resolve conflicts/i);
});

test('only accepts local workbooks inside the configured xlsx directory', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const outside = path.join(env.root, 'outside.xlsx');
  await makeWorkbook(outside, [['EAN'], ['000123']]);

  const traversal = await ExcelService.importWorkbook({ lote: '37', filePath: outside });
  const internet = await ExcelService.importWorkbook({ lote: '37', filePath: 'https://example.test/entrada.xlsx' });

  assert.equal(traversal.ok, false);
  assert.match(traversal.error, /path traversal|outside/i);
  assert.equal(internet.ok, false);
  assert.match(internet.error, /path/i);
});

test('spreadsheet import routes stage then confirm an import', async t => {
  const env = await createTestEnv(t);
  const entrada = path.join(env.paths.xlsx, 'rota.xlsx');
  await makeWorkbook(entrada, [['EAN', 'Codigo', 'Descricao'], ['000124', 'COD-2', 'Produto 2']]);
  const app = createApp({ configOverrides: env.config });

  const imported = await request(app, '/api/planilhas/importar', { lote: '37', filePath: entrada }, 'import-route');
  assert.equal(imported.status, 200);
  assert.equal(imported.body.ok, true);

  const confirmed = await request(app, '/api/planilhas/confirmar', { importId: imported.body.data.importId }, 'confirm-route');
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.inserted, 1);
});
