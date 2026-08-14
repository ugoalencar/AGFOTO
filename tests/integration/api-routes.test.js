import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app.js';
import { createTestEnv } from '../helpers/test-env.js';

async function request(app, path, options = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
    return {
      status: res.status,
      requestId: res.headers.get('x-request-id'),
      body: await res.json()
    };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /api/lotes is not double-prefixed', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const res = await request(app, '/api/lotes');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.data.lotes));
});

test('mutating routes reject missing operationId', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const res = await request(app, '/api/captura/salvar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lote: '37', gtin: '000123' })
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /operationId/i);
});

test('phase 1 app does not expose carros or adset routes', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });

  for (const path of ['/api/carros/lote-teste', '/api/adset/status']) {
    const res = await request(app, path);
    assert.equal(res.status, 404);
  }
});

test('phase 1 app does not expose delivery execution', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const res = await request(app, '/api/entregas/executar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operation-ID': 'delivery-execution-is-disabled'
    },
    body: JSON.stringify({ lote: '37', gtin: '000123', codigo: 'A-1' })
  });

  assert.equal(res.status, 404);
});

test('mutating routes require operationId before reporting malformed JSON', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const res = await request(app, '/api/captura/salvar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /operationId/i);
});

test('mutating routes replay a completed operationId response', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationId: 'invalid-import', lote: '' })
  };

  const first = await request(app, '/api/planilhas/importar', options);
  const second = await request(app, '/api/planilhas/importar', options);

  assert.equal(first.status, 400);
  assert.equal(second.status, first.status);
  assert.equal(second.body.error, first.body.error);
  assert.notEqual(first.requestId, second.requestId);
  assert.equal(first.body.requestId, first.requestId);
  assert.equal(second.body.requestId, second.requestId);
});
