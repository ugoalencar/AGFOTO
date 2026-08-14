### Task 6: Entrega Local Segura com Staging, Manifesto e Provider Mock

**Files:**
- Modify: `services/delivery-service.js`
- Modify: `services/ftp-service.js`
- Modify: `routes/qa-hub.js`
- Modify: `domain/delivery.js` if needed for manifest/record metadata
- Create/Modify: `tests/integration/delivery-products.test.js`
- Create/Modify: `tests/unit/delivery-domain.test.js` if manifest behavior changes

**Scope:**
- Implement product delivery for Phase 1 only.
- Use local/mock provider only. Do not enable or call a real external FTP server.
- Do not use Redmine, Java, `C:\sphoto-terminais`, `D:\Syndi_qa`, or any external query/API.
- Preserve source photos in `Finalizadas` on every failure.

**Required behavior:**
- `prepareDelivery(lote, gtin, codigo, deliveryType)` validates lote, GTIN, codigo, product status, delivery type and eligible files.
- Normal delivery uses only root photos from `Finalizadas/LOTE <lote>/<GTIN>/`.
- Update delivery uses only `AT/` photos and stages them in the product destination root, not inside an `AT` remote folder.
- AP photos are excluded from normal delivery.
- Staging path:
  - `Entrega/LOTE <lote>/<CODIGO_INTERNO>/` for normal delivery.
  - same destination shape for update delivery, with only AT photos copied there.
- Staging must not overwrite existing files; use deterministic suffixes or clean attempt-specific staging safely.
- Manifest includes lote, GTIN/EAN, codigo, deliveryType, file names, sizes, hashes and staging paths.
- Persist delivery attempts/manifest records under `dados/envios/`.
- `executeDelivery(...)` must not mark `entregue` until provider upload and verification confirm quantity and size for every file.
- On delivery failure:
  - preserve source files;
  - set product status to `erro_entrega`;
  - record `ultimoErro`;
  - persist attempt record;
  - audit `ENTREGA_ERRO`.
- On success:
  - set status `entregue`;
  - set `ultimaEntregaEm`;
  - clear `ultimoErro`;
  - update control workbook;
  - audit `ENTREGA_COMPLETA`.
- Routes `/api/entregas/preparar` and `/api/entregas/executar` must use operationId/idempotency envelope like other mutable routes.
- No route should call real FTP or mark delivered without verification.

**Suggested tests first:**
- Normal prepare stages only root photos and excludes AP/AT.
- Update prepare stages only AT photos and does not create remote/staging `AT` folder as destination level.
- Prepare blocks missing codigo, invalid deliveryType, missing product, no eligible photos, and not-ready status.
- Execute with mock/local provider uploads and verifies all staged files before status becomes `entregue`.
- Execute provider verification failure leaves source files, sets `erro_entrega`, records `ultimoErro`, and writes envio/audit.
- Route tests require `operationId`, replay completed operationId, and preserve the global `{ ok, data/error, requestId }` envelope.

**Verification:**
- Run `node --test tests/integration/delivery-products.test.js`.
- Run related route tests.
- Run full `npm.cmd test`.

**Commit:**
- `feat: implement safe local product delivery`
