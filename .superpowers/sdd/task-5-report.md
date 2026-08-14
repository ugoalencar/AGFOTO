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

- The QA mutation paths validate lote/product before moving or deleting files. Save failures are now either compensated (moves) or stop physical deletion before it begins.

## Ajuste Final da Tarefa 5

- Delete agora resolve e confirma o arquivo finalizado antes de preparar historico, auditar ou persistir JSON. A rota tambem rejeita `location` fora de `root`, `AP` e `AT` antes de chamar o servico.
- Classify e unclassify movem o arquivo, registram auditoria e somente depois persistem o historico JSON. Falhas de auditoria e de save compensam o move fisico e deixam o JSON inalterado.
- Delete prepara historico somente em memoria, registra auditoria, persiste JSON e por fim tenta o unlink. Falha no unlink retorna aviso para retry, mantendo a trilha de intencao persistida.
- Foram incluidos testes para location invalida preservar arquivo, quantidade e historico, e para falhas de auditoria em classify e delete nao produzirem JSON falso nem exclusao fisica.

### Testes

- `node --test tests/integration/qa-products.test.js`: 16 aprovados, 0 falhos.
- `npm.cmd test`: 162 aprovados, 0 falhos, 1 ignorado (criacao de symlink indisponivel no Windows).

## Fixes Finais da Tarefa 5

- Classify e unclassify agora compensam o move fisico quando a persistencia do historico JSON falha. A resposta permanece `ok:false`; se a compensacao tambem falhar, ela informa explicitamente que o arquivo pode exigir recuperacao manual.
- Delete persiste o historico e a auditoria antes da exclusao fisica. Assim, falha em `LoteRepository.save` interrompe a operacao com a foto intacta. Se o `unlink` falhar depois da trilha persistida, a resposta retorna `ok:false` com aviso de que a foto foi retida para nova tentativa ou limpeza manual.
- Foram adicionadas regressões para falha de save em classify, unclassify e delete.

### Testes

- `node --test tests/integration/qa-products.test.js`: 13 aprovados, 0 falhos.
- `npm.cmd test`: 159 aprovados, 0 falhos, 1 ignorado (criacao de symlink indisponivel no Windows).

## Revisao Finalissima da Tarefa 5

- `validateFilename` agora rejeita explicitamente `.` e `..`, impedindo criacao de subpastas AP/AT em requisicoes invalidas.
- `AuditLogger.log` agora falha de verdade quando nao consegue criar/gravar o arquivo JSONL; operacoes QA nao seguem como sucesso sem auditoria persistida.
- Falhas de save depois de uma auditoria pre-mutation agora registram `QA_MOVE_COMPENSATED` ou `DELETE_PHOTO_ABORTED`, preservando a trilha append-only sem deixar evento de sucesso sem contrapartida de rollback.
- Foram adicionadas regressoes para nomes `.`/`..`, falha real do diretório de auditoria, compensacao auditada em classify/unclassify e abort auditado em delete.

### Testes

- `node --test tests/unit/secure-filesystem.test.js`: 12 aprovados, 0 falhos.
- `node --test tests/integration/qa-products.test.js`: 18 aprovados, 0 falhos.
- `npm.cmd test`: 165 aprovados, 0 falhos, 1 ignorado (criacao de symlink indisponivel no Windows).

## Ajuste de Auditoria de Contrapartida

- `QA_MOVE_COMPENSATED` e `DELETE_PHOTO_ABORTED` nao ignoram mais falha de auditoria da propria contrapartida.
- Quando a compensacao fisica acontece, mas a auditoria da compensacao falha, a resposta retorna `ok:false` com erro e aviso explicito.
- Quando delete aborta antes de persistir JSON, mas a auditoria do abort falha, a resposta retorna `ok:false` com erro e aviso explicito.
- Foram adicionadas regressoes para falha no segundo log de auditoria em classify e delete.

### Testes

- `node --test tests/integration/qa-products.test.js`: 20 aprovados, 0 falhos.
- `node --test tests/unit/secure-filesystem.test.js`: 12 aprovados, 0 falhos.
- `npm.cmd test`: 167 aprovados, 0 falhos, 1 ignorado (criacao de symlink indisponivel no Windows).

## Ajuste de Validacao de Lote

- `Lote.isValid` agora rejeita explicitamente `.` e `..`.
- Foi adicionada regressao no dominio para impedir lote `.` antes que rotas e servicos possam criar caminhos/JSONs ambiguos.

### Testes

- `node --test tests/unit/domain-lote.test.js`: 15 aprovados, 0 falhos.
- `node --test tests/integration/qa-products.test.js`: 20 aprovados, 0 falhos.
- `node --test tests/unit/secure-filesystem.test.js`: 12 aprovados, 0 falhos.
- `npm.cmd test`: 167 aprovados, 0 falhos, 1 ignorado (criacao de symlink indisponivel no Windows).
