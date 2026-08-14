# Task 1 Report

STATUS: DONE_WITH_CONCERNS

## Resumo

Implementada a base local-only da Fase 1: app factory Express sem listener,
envelopes de resposta, controle em memoria de `operationId` com replay
idempotente, normalizacao dos caminhos montados e isolamento das suites que
persistem lotes.

## Arquivos alterados

- `server/app.js`
- `server/response.js`
- `server/operation-store.js`
- `server.js`
- `server/config.js`
- `server/audit-logger.js`
- `server/json-persistence.js`
- `repositories/lote-repository.js`
- `routes/captura.js`
- `routes/qa-hub.js`
- `routes/planilhas.js`
- `tests/helpers/test-env.js`
- `tests/unit/operation-store.test.js`
- `tests/integration/api-routes.test.js`
- `tests/integration/captura-workflow.test.js`

## Commits criados

- `68697f7 refactor: add app factory and phase 1 route contracts`
- `docs: add task 1 implementation report` (este relatorio)

## Testes executados

- `npm.cmd test -- tests/unit/operation-store.test.js tests/integration/api-routes.test.js`: passou apos implementacao; o script tambem expandiu a suite completa.
- `npm.cmd test`: 114 testes passaram, 0 falhas.
- `npm.cmd run lint`: nao executou porque o repositorio nao possui configuracao ESLint.

## Preocupacoes e observacoes

- A persistencia e a auditoria agora respeitam os caminhos sobrescritos pelo ambiente de teste; nenhuma execucao verde escreveu em diretorios operacionais.
- A primeira execucao vermelha, antes da correcao de isolamento, deixou artefatos `TEST-*` e `BATCH-*` nos diretorios operacionais. Eles foram identificados, mas a remocao explicita foi bloqueada pela politica do ambiente.
- Os avisos de `ENOENT` durante a criacao inicial de lotes sao provenientes do fallback de leitura existente; os testes passam e usam apenas o diretorio temporario.

## Fix Review Findings

- Critical: removidos os imports e mounts de `/api/carros` e `/api/adset` do app factory da Fase 1; os modulos legados foram preservados.
- Critical: removidos 8 JSONs `Lote_TEST-*`/`Lote_BATCH-*` e 14 backups equivalentes de `dados/` neste worktree. A verificacao posterior nao encontrou arquivos nesses padroes.
- Important: erros `entity.parse.failed` em `POST`, `PUT`, `PATCH` e `DELETE` sem `x-operation-id` agora retornam `operationId is required`. Requisicoes JSON validas continuam aceitando `operationId` no corpo.
- Important: replays idempotentes agora retornam o mesmo resultado com `requestId` atualizado para corresponder ao header `X-Request-ID` da nova requisicao.

Testes executados:

- `node --test tests/integration/api-routes.test.js`: 5 aprovados, 0 falhas.
- `npm.cmd test`: 116 aprovados, 0 falhas.

Commits:

- `7eda87d fix: address phase 1 app review findings`
