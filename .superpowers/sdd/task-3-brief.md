### Task 3: Product Capture, JSON State, Excel Control Workbook

**Files:**
- Modify: `domain/status.js`
- Modify: `domain/lote.js`
- Modify: `server/json-persistence.js`
- Modify: `repositories/lote-repository.js`
- Modify: `repositories/file-repository.js`
- Modify: `services/captura-service.js`
- Modify: `services/excel-service.js`
- Modify: `routes/captura.js`
- Modify: `tests/unit/domain-lote.test.js`
- Modify: `tests/integration/captura-products.test.js`

**Interfaces:**
- Produces: `Produto.isValid(gtin) => true` for any non-empty numeric string up to max length
- Produces: `transitionProduct(produto, event, details)` with enforced state changes
- Produces: `writeJsonAtomic(filePath, data, { backupDir })`
- Produces: `ExcelService.updateControlFromLote(loteNumero) => Promise<{ ok, data: { filePath } }>`
- Consumes: `operationId` requirement from Task 1

- [ ] **Step 1: Write failing domain/capture tests**

```js
// tests/unit/domain-lote.test.js additions
test('Produto accepts any numeric local identifier and preserves zeros', () => {
  assert.equal(Produto.isValid('000123'), true);
  assert.equal(Produto.isValid('1'), true);
  assert.equal(Produto.normalize(' 000123 '), '000123');
  assert.equal(Produto.isValid('ABC123'), false);
});
```

```js
// tests/integration/captura-products.test.js addition
test('save capture moves snapshot, updates JSON, Excel control, and does not overwrite', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto.jpg'), JPG_BYTES);
  const result = await CapturaService.saveCapture('37', '000123', '', '', { operationId: 'save-1' });
  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.equal(await exists(path.join(env.paths.finalizadas, 'LOTE 37', '000123', 'foto.jpg')), true);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_37.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].status, 'pendente_qa');
  assert.equal(await exists(path.join(env.paths.xlsx, 'controle-lotes.xlsx')), true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/unit/domain-lote.test.js tests/integration/captura-products.test.js`

Expected: FAIL because GTIN validation is too strict and `fotosMovidas`/Excel control are not implemented.

- [ ] **Step 3: Implement status transitions**

```js
// domain/status.js
export const ProductStatus = Object.freeze({
  EM_CAPTURA: 'em_captura',
  PENDENTE_QA: 'pendente_qa',
  PRONTO_PARA_ENTREGA: 'pronto_para_entrega',
  ENTREGANDO: 'entregando',
  ENTREGUE: 'entregue',
  ERRO_ENTREGA: 'erro_entrega',
  RETRABALHO: 'retrabalho'
});

export const ProductEvents = Object.freeze({
  CAPTURA_SALVA: 'captura_salva',
  QA_CONCLUIDO: 'qa_concluido',
  ENTREGA_INICIADA: 'entrega_iniciada',
  ENTREGA_CONFIRMADA: 'entrega_confirmada',
  ENTREGA_FALHOU: 'entrega_falhou',
  RETRABALHO_INICIADO: 'retrabalho_iniciado'
});

export function nextProductStatus(current, event) {
  const map = {
    [ProductEvents.CAPTURA_SALVA]: ProductStatus.PENDENTE_QA,
    [ProductEvents.QA_CONCLUIDO]: ProductStatus.PRONTO_PARA_ENTREGA,
    [ProductEvents.ENTREGA_INICIADA]: ProductStatus.ENTREGANDO,
    [ProductEvents.ENTREGA_CONFIRMADA]: ProductStatus.ENTREGUE,
    [ProductEvents.ENTREGA_FALHOU]: ProductStatus.ERRO_ENTREGA,
    [ProductEvents.RETRABALHO_INICIADO]: ProductStatus.RETRABALHO
  };
  const next = map[event];
  if (!next) throw new Error(`Unknown product event: ${event}`);
  return next;
}
```

- [ ] **Step 4: Relax numeric product validation**

```js
// domain/lote.js Produto.isValid replacement
static isValid(gtin) {
  const normalized = String(gtin ?? '').trim();
  return /^\d{1,64}$/.test(normalized);
}
```

- [ ] **Step 5: Finish collision-safe moves**

In `repositories/file-repository.js`, make `moveToFinalizadas()` use deterministic suffix before move:

```js
static async uniqueDestPath(destDir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(destDir, filename);
  let counter = 1;
  while (await fileExists(candidate)) {
    candidate = path.join(destDir, `${base}_${String(counter).padStart(3, '0')}${ext}`);
    counter++;
  }
  return candidate;
}
```

- [ ] **Step 6: Fix capture service moved/copied bug**

```js
// services/captura-service.js response shape
const moveResult = await FileRepository.moveSnapshotToFinalizadas(snapshot, loteNumero, gtin);
produto.markCaptureSaved(moveResult.moved.length);
await LoteRepository.save(lote);
await ExcelService.updateControlFromLote(loteNumero);
return {
  ok: moveResult.failed.length === 0,
  data: {
    lote: lote.numero,
    gtin,
    fotosMovidas: moveResult.moved.length,
    fotosFalhadas: moveResult.failed.length,
    status: produto.status,
    detalhes: moveResult
  },
  error: moveResult.failed.length ? 'Some files failed to move' : undefined
};
```

- [ ] **Step 7: Implement Excel control update**

```js
// services/excel-service.js method
static async updateControlFromLote(loteNumero) {
  const lote = await LoteRepository.load(loteNumero);
  await fs.promises.mkdir(config.paths.xlsx, { recursive: true });
  const filePath = path.join(config.paths.xlsx, 'controle-lotes.xlsx');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.readFile(filePath); } catch {}
  let sheet = workbook.getWorksheet(`Lote ${loteNumero}`);
  if (sheet) workbook.removeWorksheet(sheet.id);
  sheet = workbook.addWorksheet(`Lote ${loteNumero}`);
  sheet.addRow(['EAN', 'Codigo', 'Descricao', 'Data da foto', 'Quantidade de fotos', 'Status', 'Ultima entrega', 'Ultimo erro']);
  for (const item of Object.values(lote.itens)) {
    sheet.addRow([item.gtin, item.codigo || '', item.descricao || '', item.dataFotografia || '', item.quantidadeFotos, item.status, item.ultimaEntregaEm || '', item.ultimoErro || '']);
  }
  await workbook.xlsx.writeFile(filePath);
  return { ok: true, data: { filePath } };
}
```

- [ ] **Step 8: Run task tests**

Run: `npm.cmd test -- tests/unit/domain-lote.test.js tests/integration/captura-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 9: Commit**

```bash
git add domain/status.js domain/lote.js server/json-persistence.js repositories/lote-repository.js repositories/file-repository.js services/captura-service.js services/excel-service.js routes/captura.js tests/unit/domain-lote.test.js tests/integration/captura-products.test.js
git commit -m "feat: implement product capture state and control workbook"
```

---

