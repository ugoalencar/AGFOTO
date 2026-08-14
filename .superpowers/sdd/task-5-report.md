# Task 5 Report: QA Hub Products

## Delivered

- Added safe AP and AT classification moves, unclassification, and audited deletion for finalized product photos.
- Added JSON history for QA classification actions and adjusted the captured-photo count on deletion.
- Updated QA completion to set `pronto_para_entrega`, record `qa_concluido`, and rebuild the local control workbook without preparing or executing a delivery.
- Added QA route coverage for classify, unclassify, and delete with the app-wide operationId middleware.

## Verification

- `node --test tests/integration/qa-products.test.js`: 4 passed, 0 failed.
- `npm.cmd test`: 150 passed, 0 failed, 1 skipped because Windows symlink creation is unavailable in this environment.

## Scope

No delivery, rework, frontend, report, Redmine, Java, or external-system behavior was added.

## Fix Review Findings

- Validated and normalized lote/GTIN before creating finalized-photo paths; unsafe path components, filenames, source folders, and delete locations now fail without touching files. QA mutation routes also validate lote and GTIN before dispatching.
- QA classify, unclassify, and delete now load the lote/product JSON before any physical mutation. History updates use that loaded object and no longer suppress missing-file errors.
- `completeQa` accepts only `normal` and `atualizacao`, and uses one eligible-photo lookup rather than repeating the validation.
- Added integration coverage in temporary directories for GTIN/lote traversal, filename/location rejection, missing JSON/product preservation, AP/AT destination collisions, invalid unclassify origin, invalid delivery type, and route validation.

### Tests

- `node --test tests/integration/qa-products.test.js`: 10 passed, 0 failed.
- `npm.cmd test`: 156 passed, 0 failed, 1 skipped (Windows symlink capability unavailable).

### Commits

- `ef74d45 fix: harden product QA mutations`

### Concerns

- The JSON update still occurs after the physical move/delete, so an unrelated JSON write failure after a successful mutation can leave file and JSON state temporarily divergent. Missing lote/product errors are now detected before mutation as required.
