import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationStore } from '../../server/operation-store.js';

test('operation store requires unique operationId lifecycle', () => {
  const store = createOperationStore();

  assert.throws(() => store.requireOperationId({ body: {} }), /operationId is required/);
  assert.equal(store.begin('op-1', 'captura.salvar').status, 'started');
  assert.throws(() => store.begin('op-1', 'captura.salvar'), /already in progress/);

  store.complete('op-1', { ok: true, data: { saved: 1 } });
  assert.deepEqual(store.get('op-1').result, { ok: true, data: { saved: 1 } });
});

test('operation store rejects a completed operationId reused by another action', () => {
  const store = createOperationStore();

  store.begin('op-1', 'POST /api/captura/salvar');
  store.complete('op-1', { ok: true });

  assert.throws(
    () => store.begin('op-1', 'POST /api/planilhas/importar'),
    /already completed for a different action/
  );
});
