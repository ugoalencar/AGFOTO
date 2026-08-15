### Task 4: Planilhas Import, Lookup, Conflicts

**Files:**
- Modify: `domain/excel.js`
- Modify: `services/excel-service.js`
- Modify: `routes/planilhas.js`
- Create/Modify: `tests/integration/planilhas-products.test.js`

**Interfaces:**
- Produces: `ExcelService.importWorkbook({ lote, filePath }) => Promise<{ ok, data: { importId, preview, conflicts } }>`
- Produces: `ExcelService.confirmImport(importId) => Promise<{ ok, data: { inserted, unchanged, conflicts } }>`
- Produces: `ExcelService.lookupCodigo(lote, ean) => Promise<{ ok, data: { codigo, descricao } }>`
- Produces: `POST /api/planilhas/importar` accepting JSON `{ operationId, lote, filePath }` for local file import in Fase 1
- Produces: `POST /api/planilhas/confirmar` accepting `{ operationId, importId }`

- [ ] **Step 1: Write failing import tests**

```js
// tests/integration/planilhas-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import ExcelJS from 'exceljs';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import ExcelService from '../../services/excel-service.js';

async function makeWorkbook(filePath, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Entrada');
  rows.forEach(row => ws.addRow(row));
  await wb.xlsx.writeFile(filePath);
}

test('imports lookup workbook and blocks silent conflicts', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const entrada = path.join(env.paths.xlsx, 'entrada.xlsx');
  await makeWorkbook(entrada, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-1', 'Produto 1']]);
  const imported = await ExcelService.importWorkbook({ lote: '37', filePath: entrada });
  assert.equal(imported.ok, true);
  const confirmed = await ExcelService.confirmImport(imported.data.importId);
  assert.equal(confirmed.data.inserted, 1);
  const conflictFile = path.join(env.paths.xlsx, 'entrada-conflict.xlsx');
  await makeWorkbook(conflictFile, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-2', 'Produto 1']]);
  const conflict = await ExcelService.importWorkbook({ lote: '37', filePath: conflictFile });
  assert.equal(conflict.data.conflicts.length, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/planilhas-products.test.js`

Expected: FAIL because `importWorkbook`/`confirmImport` are not implemented.

- [ ] **Step 3: Implement import session storage**

In `services/excel-service.js`, add module-level import session map:

```js
const pendingImports = new Map();

function makeImportId(lote, filePath) {
  return `${lote}:${path.basename(filePath)}:${Date.now()}`;
}
```

- [ ] **Step 4: Implement workbook import**

```js
static async importWorkbook({ lote, filePath }) {
  if (!Lote.isValid(lote)) return { ok: false, error: 'Invalid lote' };
  const ext = path.extname(filePath).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) return { ok: false, error: 'Only .xlsx and .xls are accepted' };
  const stats = await fs.promises.stat(filePath);
  if (stats.size > config.validation.maxSheetSize) return { ok: false, error: 'Spreadsheet exceeds size limit' };
  const items = await this.parseWorkbook(filePath, lote);
  const conflicts = await this.detectLookupConflicts(lote, items);
  const importId = makeImportId(lote, filePath);
  pendingImports.set(importId, { lote, filePath, items, conflicts });
  return { ok: true, data: { importId, preview: items.slice(0, 20), total: items.length, conflicts } };
}
```

- [ ] **Step 5: Implement confirm and lookup**

```js
static async confirmImport(importId) {
  const session = pendingImports.get(importId);
  if (!session) return { ok: false, error: 'Import session not found' };
  if (session.conflicts.length) return { ok: false, error: 'Resolve conflicts before confirming', data: { conflicts: session.conflicts } };
  const result = await this.mergeToLookup(session.lote, session.items);
  pendingImports.delete(importId);
  return result;
}

static async lookupCodigo(lote, ean) {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(config.paths.xlsx, 'lookup-integrado.xlsx');
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.getWorksheet('Lookup') || workbook.worksheets[0];
  for (const row of ws.getRows(2, ws.rowCount - 1) || []) {
    if (String(row.getCell(1).value) === String(lote) && String(row.getCell(2).value) === String(ean)) {
      return { ok: true, data: { codigo: String(row.getCell(3).value || ''), descricao: String(row.getCell(4).value || '') } };
    }
  }
  return { ok: false, error: `Codigo not found for lote ${lote} EAN ${ean}` };
}
```

- [ ] **Step 6: Wire routes**

```js
router.post('/importar', async (req, res) => {
  const operationId = req.app.locals.operationStore.requireOperationId(req);
  req.app.locals.operationStore.begin(operationId, 'planilhas.importar');
  const result = await ExcelService.importWorkbook(req.body);
  req.app.locals.operationStore.complete(operationId, result);
  return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
});
```

- [ ] **Step 7: Run task tests**

Run: `npm.cmd test -- tests/integration/planilhas-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add domain/excel.js services/excel-service.js routes/planilhas.js tests/integration/planilhas-products.test.js
git commit -m "feat: implement local spreadsheet lookup imports"
```

---

