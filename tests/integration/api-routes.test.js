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

test('phase 1 blocked POST routes return 404 before operationId validation', async t => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const paths = [
    '/api/entregas/executar',
    '/api/qa/executar',
    '/api/retrabalhos/executar',
    '/api/relatorios/executar',
    '/api/carros',
    '/api/adset'
  ];

  for (const path of paths) {
    for (const headers of [{}, { 'X-Operation-ID': 'blocked-route' }]) {
      const res = await request(app, path, {
        method: 'POST',
        headers,
        body: '{}'
      });

      assert.equal(res.status, 404, `${path} must be unavailable before operationId validation`);
    }
  }
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
