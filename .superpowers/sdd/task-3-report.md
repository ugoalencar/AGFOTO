# Task 3 Report

## Status

Completed. Product capture now moves stable TEMP images to `Finalizadas/LOTE <n>/<gtin>/`, persists the lote JSON atomically, and rebuilds the lote sheet in the local `controle-lotes.xlsx` workbook.

## Files

- `domain/status.js`: explicit product events and enforced transitions.
- `domain/lote.js`: numeric GTIN validation from 1 to 64 digits with leading-zero preservation.
- `server/json-persistence.js`, `repositories/lote-repository.js`: atomic JSON writes accept the configured backup directory.
- `repositories/file-repository.js`: collision-safe moves with deterministic `_001` suffixes and cross-device fallback.
- `services/captura-service.js`: normalized GTIN capture flow, move counters, JSON save, and control workbook update.
- `services/excel-service.js`: rebuilds the per-lote control sheet from JSON in `controle-lotes.xlsx`.
- `tests/unit/domain-lote.test.js`, `tests/integration/captura-products.test.js`: domain and end-to-end capture coverage.

No route change was necessary: the app factory operation middleware already owns `operationId` begin/complete behavior for the mutating capture route.

## Commits

- `5168075 feat: implement product capture state and control workbook`

## Tests

- `node --test tests/integration/captura-products.test.js tests/unit/domain-lote.test.js`: 21 passed, 1 skipped (Windows symlink permission).
- `npm.cmd test`: 128 passed, 1 skipped, 0 failed.

## Concerns

- The existing JSON loader logs an ENOENT before creating a new lote, which makes successful test output noisy. This was pre-existing and was not changed by Task 3.
- A capture with individual move failures still persists the count of successfully moved files and returns `ok: false`; retry/rework orchestration remains outside this task's scope.

## Fix Review Findings

### Corrections

- Recapture of a GTIN already in `pendente_qa` now retains its status, accumulates `quantidadeFotos`, and records a second `captura_salva` history event with the incremental and total counts.
- Capture only creates or updates a product after at least one move succeeds. A total move failure returns `ok: false` with `No files moved; capture was not saved`, leaves the lote without a capture record, and does not rebuild Excel.
- Partial move failures persist only the files moved, update JSON and Excel for that partial operational state, and return `ok: false` with a clear error.
- Excel is treated as a rebuildable derivative: after the JSON save, an Excel error is returned in `warnings` without changing an otherwise successful capture to `ok: false`.
- Final destination allocation uses `copyFile(..., COPYFILE_EXCL)` followed by source unlink and retries deterministic suffixes after `EEXIST`; this avoids the Windows `rename` overwrite race while retaining cross-device-safe behavior.
- Updated move-related comments that still described the flow as a copy.

### Tests

- Added temporary-directory integration coverage for same-GTIN recapture with `foto_001.jpg`, cumulative JSON photo count, and capture history.
- Added temporary-directory integration coverage for concurrent filename collisions, total move failure, partial move failure, and Excel rebuild failure warnings.
- `node --test tests/integration/captura-products.test.js tests/unit/domain-lote.test.js`: 26 passed, 1 skipped (Windows symlink permission), 0 failed.
- `npm.cmd test`: 133 passed, 1 skipped (Windows symlink permission), 0 failed.

### Commits

- `05bad6f fix: preserve product capture state`

### Concerns

- `loadOrCreate` still creates an otherwise empty lote JSON before a total move failure. No product capture, `pendente_qa` status, saved-capture history, or Excel workbook is recorded; changing lote creation timing was kept outside this review fix.
