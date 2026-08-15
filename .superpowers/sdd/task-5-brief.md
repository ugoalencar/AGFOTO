### Task 5: QA AP/AT, Unclassify, Delete, Conclude QA

**Files:**
- Modify: `repositories/file-repository.js`
- Modify: `services/delivery-service.js`
- Modify: `routes/qa-hub.js`
- Create/Modify: `tests/integration/qa-products.test.js`

**Interfaces:**
- Produces: `DeliveryService.classifyPhoto(lote, gtin, filename, classification, operationContext)`
- Produces: `DeliveryService.unclassifyPhoto(lote, gtin, filename, fromClassification, operationContext)`
- Produces: `DeliveryService.deletePhoto(lote, gtin, filename, location, operationContext)`
- Produces: `DeliveryService.completeQa(lote, gtin, deliveryType)`

- [ ] **Step 1: Write failing QA tests**

```js
// tests/integration/qa-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import DeliveryService from '../../services/delivery-service.js';

test('classifies AP and AT by moving files, then unclassifies without overwrite', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const root = path.join(env.paths.finalizadas, 'LOTE 37', '000123');
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  const ap = await DeliveryService.classifyPhotoAP('37', '000123', 'a.jpg');
  assert.equal(ap.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), true);
  const undo = await DeliveryService.unclassifyPhoto('37', '000123', 'a.jpg', 'AP');
  assert.equal(undo.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/qa-products.test.js`

Expected: FAIL because AP/AT methods currently return success without moving files.

- [ ] **Step 3: Implement finalizadas move helper**

```js
// repositories/file-repository.js
static async moveFinalizadaPhoto({ loteNumero, gtin, filename, fromSubfolder = null, toSubfolder = null }) {
  validateFilename(filename);
  const baseDir = path.join(config.paths.finalizadas, `LOTE ${loteNumero}`, gtin);
  const srcDir = fromSubfolder ? path.join(baseDir, fromSubfolder) : baseDir;
  const destDir = toSubfolder ? path.join(baseDir, toSubfolder) : baseDir;
  await createSecureDirectory(destDir);
  const srcPath = securePath(path.join(srcDir, filename), config.paths.finalizadas);
  const destPath = await this.uniqueDestPath(destDir, filename);
  await fs.promises.rename(srcPath, destPath).catch(async err => {
    if (err.code !== 'EXDEV') throw err;
    await fs.promises.copyFile(srcPath, destPath);
    await fs.promises.unlink(srcPath);
  });
  return { srcPath, destPath, destName: path.basename(destPath) };
}
```

- [ ] **Step 4: Implement AP/AT service methods**

```js
static async classifyPhotoAP(lote, gtin, filename) {
  return this.classifyPhoto(lote, gtin, filename, 'AP');
}

static async classifyPhotoAT(lote, gtin, filename) {
  return this.classifyPhoto(lote, gtin, filename, 'AT');
}

static async classifyPhoto(lote, gtin, filename, classification) {
  if (!['AP', 'AT'].includes(classification)) return { ok: false, error: 'Invalid classification' };
  const moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: lote, gtin, filename, toSubfolder: classification });
  await auditLogger.log(`CLASSIFY_${classification}`, { lote, gtin, filename, destName: moved.destName });
  return { ok: true, data: { classified: classification, filename: moved.destName } };
}

static async unclassifyPhoto(lote, gtin, filename, fromClassification = null) {
  const fromSubfolder = fromClassification || (filename.includes('/') ? filename.split('/')[0] : null);
  const cleanFilename = filename.includes('/') ? filename.split('/').pop() : filename;
  if (!['AP', 'AT'].includes(fromSubfolder)) return { ok: false, error: 'fromClassification must be AP or AT' };
  const moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: lote, gtin, filename: cleanFilename, fromSubfolder, toSubfolder: null });
  await auditLogger.log('UNCLASSIFY', { lote, gtin, filename: cleanFilename, fromSubfolder, destName: moved.destName });
  return { ok: true, data: { unclassified: true, filename: moved.destName } };
}
```

- [ ] **Step 5: Update complete QA**

Replace the body of `DeliveryService.completeQa()` with this behavior:

```js
static async completeQa(lote, gtin, deliveryType = DeliveryType.NORMAL) {
  try {
    const loteObj = await LoteRepository.load(lote);
    const produto = loteObj.itens[gtin];
    if (!produto) return { ok: false, error: `Product not found: ${gtin}` };

    const subfolder = deliveryType === DeliveryType.ATUALIZACAO ? 'AT' : null;
    const photos = await FileRepository.listFinalizadasImages(lote, gtin, subfolder);
    if (photos.length === 0) {
      return {
        ok: false,
        error: deliveryType === DeliveryType.ATUALIZACAO
          ? 'No AT photos available for update delivery'
          : 'No root photos available for normal delivery'
      };
    }

    produto.status = ProductStatus.PRONTO_PARA_ENTREGA;
    produto.addHistoricoEvent('qa_concluido', { deliveryType, quantidadeFotosElegiveis: photos.length });
    await LoteRepository.save(loteObj);
    await ExcelService.updateControlFromLote(lote);
    await auditLogger.log('QA_COMPLETO', { lote, gtin, deliveryType, quantidadeFotosElegiveis: photos.length });
    return { ok: true, data: { status: produto.status, deliveryType, quantidadeFotosElegiveis: photos.length } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

- [ ] **Step 6: Wire QA routes with operationId**

```js
router.post('/classificar', async (req, res) => {
  const operationId = req.app.locals.operationStore.requireOperationId(req);
  req.app.locals.operationStore.begin(operationId, 'qa.classificar');
  const { lote, gtin, filename, classification } = req.body;
  const result = classification === 'AP'
    ? await DeliveryService.classifyPhotoAP(lote, gtin, filename)
    : await DeliveryService.classifyPhotoAT(lote, gtin, filename);
  req.app.locals.operationStore.complete(operationId, result);
  return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
});
```

- [ ] **Step 7: Run task tests**

Run: `npm.cmd test -- tests/integration/qa-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add repositories/file-repository.js services/delivery-service.js routes/qa-hub.js tests/integration/qa-products.test.js
git commit -m "feat: implement product QA AP AT classification"
```

---

