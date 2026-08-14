# Task 6 Report - Safe Local Product Delivery

## Changes

- Added local staging at `Entrega/LOTE <lote>/<codigo>/` with exclusive copies, SHA-256 manifests, source paths, and persisted delivery records in `dados/envios/`.
- Normal delivery reads only product-root photos; update delivery reads only `AT/` photos and stages them in the product root.
- Reworked the mock FTP provider to read real local files and retain actual size and SHA-256 metadata for verification. No external FTP provider is enabled.
- `executeDelivery` uploads every manifest file, checks remote count, then verifies each remote file's existence, size, and hash before setting `entregue`.
- Failures preserve `Finalizadas`, persist the failed attempt, set `erro_entrega` and `ultimoErro`, refresh the control workbook, and write `ENTREGA_ERRO`. Success refreshes JSON and workbook, persists the completed attempt, and writes `ENTREGA_COMPLETA`.
- Exposed `/api/entregas/preparar` and `/api/entregas/executar` through the existing global operation middleware. The execute endpoint was removed from the phase-one block list because it is now locally mocked and integration-tested.

## Tests

- `node --test tests/integration/delivery-products.test.js` - 5 passed.
- `node --test tests/integration/qa-products.test.js tests/integration/api-routes.test.js` - 25 passed.
- `node --test tests/unit/ftp-service.test.js` - 11 passed.
- `npm.cmd test` - 172 passed, 0 failed, 1 skipped because Windows symlink creation requires Developer Mode or elevation.

## Concerns

- The provider is intentionally process-local and in-memory. It verifies uploaded bytes without network access, but remote FTP support remains out of scope for Phase 1.
- Existing test output includes expected repository bootstrap and audit-failure diagnostic messages; the final suite has no test failures.

## Review Fixes

- `executeDelivery` now requires a prepared `attemptId` and executes the persisted staging/manifest instead of rebuilding a new one.
- The route `/api/entregas/executar` now requires `attemptId`.
- Delivery validates that the requested `codigo` matches the product's internal code before preparing or executing.
- Invalid delivery type/code/missing attempt validation no longer marks a product as `erro_entrega`.
- Manifest files now persist both `sourcePath` and `stagingPath`.

### Tests

- `node --test tests/integration/delivery-products.test.js`: 7 passed.
- `node --test tests/integration/qa-products.test.js tests/integration/api-routes.test.js tests/unit/ftp-service.test.js`: 36 passed.
- `npm.cmd test`: 174 passed, 0 failed, 1 skipped because Windows symlink creation requires Developer Mode or elevation.

## Second Review Fixes

- Incompatible prepared attempts now remain staged and return a validation error without persisting a false operational delivery failure.
- Provider connection failures after a valid prepared attempt now persist `erro_entrega`, update `ultimoErro`, and refresh the local control workbook.
- Delivery preparation and execution now require the product to already have a non-empty internal `codigo`; arbitrary requested codes are rejected.

### Tests

- `node --test tests/integration/delivery-products.test.js`: 10 passed.
- `node --test tests/integration/qa-products.test.js tests/integration/api-routes.test.js tests/unit/ftp-service.test.js`: 36 passed.
- `npm.cmd test`: 177 passed, 0 failed, 1 skipped because Windows symlink creation requires Developer Mode or elevation.

## Rework Fixes

- `restartRework` now validates lote, GTIN, and codigo before mutating local JSON.
- Rework by `codigo` requires a unique matching product; ambiguous codes fail without changing the lote file.
- Successful rework now records `retrabalho_iniciado` in product history, writes `RETRABALHO_INICIADO`, clears stale delivery errors, saves JSON, and rebuilds the local control workbook.
- `/api/retrabalhos` is covered through the global `operationId` replay envelope.

### Tests

- `node --test tests/integration/delivery-products.test.js`: 13 passed.

## Frontend Delivery Fix

- The QA Hub delivery action now runs the full local flow from the UI: prepare staging, execute the persisted `attemptId`, then refresh the ready-for-delivery list.
- The delivery button is disabled per product while the local delivery is in progress.
- The UI sends distinct `operationId` values for prepare and execute, matching the global idempotency middleware.

### Tests

- `npm.cmd test`: 180 passed, 0 failed, 1 skipped because Windows symlink creation requires Developer Mode or elevation.
- `node --input-type=module` script syntax check for `frontend/src/App.vue`: passed.
- `npm.cmd run lint`: not runnable; ESLint reports no configuration file in this project.
