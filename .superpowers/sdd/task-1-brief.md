### Task 1: App Factory, Route Contracts, Test Isolation, Operation IDs

**Files:**
- Create: `server/app.js`
- Create: `server/response.js`
- Create: `server/operation-store.js`
- Create: `tests/helpers/test-env.js`
- Create: `tests/unit/operation-store.test.js`
- Create: `tests/integration/api-routes.test.js`
- Modify: `server.js`
- Modify: `server/config.js`
- Modify: `routes/captura.js`
- Modify: `routes/qa-hub.js`
- Modify: `routes/planilhas.js`

**Interfaces:**
- Produces: `createApp({ configOverrides, services } = {}) => express.Application`
- Produces: `sendOk(res, data, status = 200)` and `sendError(res, status, error)`
- Produces: `createOperationStore()` with `requireOperationId(req)`, `begin(operationId, action)`, `complete(operationId, result)`, `get(operationId)`
- Produces: `createTestEnv(t, options)` returning `{ root, config, paths, cleanup }`
- Consumes: existing route modules after route path normalization

- [ ] **Step 1: Write failing operation store tests**

```js
// tests/unit/operation-store.test.js
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
```

- [ ] **Step 2: Write failing route contract smoke tests**

```js
// tests/integration/api-routes.test.js
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
    return { status: res.status, body: await res.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /api/lotes is not double-prefixed', async (t) => {
  const env = await createTestEnv(t);
  const app = createApp({ configOverrides: env.config });
  const res = await request(app, '/api/lotes');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.data.lotes));
});

test('mutating routes reject missing operationId', async (t) => {
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
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm.cmd test -- tests/unit/operation-store.test.js tests/integration/api-routes.test.js`

Expected: FAIL because `server/app.js`, `server/operation-store.js`, and `tests/helpers/test-env.js` do not exist.

- [ ] **Step 4: Implement response helper**

```js
// server/response.js
export function sendOk(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    requestId: res.req?.id
  });
}

export function sendError(res, status, error) {
  return res.status(status).json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    requestId: res.req?.id
  });
}
```

- [ ] **Step 5: Implement operation store**

```js
// server/operation-store.js
export function createOperationStore() {
  const operations = new Map();

  return {
    requireOperationId(req) {
      const id = req.body?.operationId || req.headers['x-operation-id'];
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('operationId is required');
      }
      return id.trim();
    },

    begin(operationId, action) {
      const existing = operations.get(operationId);
      if (existing?.status === 'started') {
        throw new Error(`operationId already in progress: ${operationId}`);
      }
      if (existing?.status === 'completed') {
        return existing;
      }
      const record = {
        operationId,
        action,
        status: 'started',
        startedAt: new Date().toISOString(),
        completedAt: null,
        result: null
      };
      operations.set(operationId, record);
      return record;
    },

    complete(operationId, result) {
      const record = operations.get(operationId);
      if (!record) throw new Error(`operationId not started: ${operationId}`);
      record.status = 'completed';
      record.completedAt = new Date().toISOString();
      record.result = result;
      operations.set(operationId, record);
      return record;
    },

    get(operationId) {
      return operations.get(operationId) || null;
    }
  };
}
```

- [ ] **Step 6: Implement isolated test env**

```js
// tests/helpers/test-env.js
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function createTestEnv(t, options = {}) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agfoto-test-'));
  const paths = {
    root,
    imagesTemp: path.join(root, 'images', 'temp'),
    captura: path.join(root, 'Captura'),
    finalizadas: path.join(root, 'Finalizadas'),
    entrega: path.join(root, 'Entrega'),
    carros: path.join(root, 'Carros'),
    dados: path.join(root, 'dados'),
    jsons: path.join(root, 'dados', 'jsons'),
    xlsx: path.join(root, 'dados', 'xlsx'),
    envios: path.join(root, 'dados', 'envios'),
    auditoria: path.join(root, 'dados', 'auditoria'),
    backups: path.join(root, 'dados', 'backups'),
    logs: path.join(root, 'logs'),
    cameraExe: path.join(root, 'simplusCameraLib', 'simplusCamera.exe')
  };
  await Promise.all(Object.values(paths).filter(p => path.extname(p) === '').map(p => fs.promises.mkdir(p, { recursive: true })));
  const config = {
    server: { host: '127.0.0.1', port: 0, lanEnabled: false },
    paths,
    camera: { executable: paths.cameraExe },
    ftp: { remoteRoot: path.join(root, 'remote-ftp') },
    timezone: 'America/Sao_Paulo',
    validation: { maxFilesPerOperation: 10000, maxSheetSize: 50 * 1024 * 1024, maxSheetRows: 100000 }
  };
  t.after(async () => fs.promises.rm(root, { recursive: true, force: true }));
  return { root, paths, config };
}
```

- [ ] **Step 7: Implement `createApp()` and route mounts**

```js
// server/app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import capturaRoutes from '../routes/captura.js';
import planilhasRoutes from '../routes/planilhas.js';
import qaHubRoutes from '../routes/qa-hub.js';
import { createOperationStore } from './operation-store.js';
import { sendError, sendOk } from './response.js';
import { applyConfigOverrides, config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createApp({ configOverrides = null, services = {} } = {}) {
  if (configOverrides) applyConfigOverrides(configOverrides);
  const app = express();
  app.locals.services = services;
  app.locals.operationStore = services.operationStore || createOperationStore();

  app.use(express.json({ limit: '10mb' }));
  app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/api/health', (_req, res) => sendOk(res, { timestamp: new Date().toISOString(), environment: 'local' }));
  app.get('/api/version', (_req, res) => sendOk(res, { version: '1.0.0-fase1', name: 'AG Fotografia', displayName: 'AG Foto' }));

  app.use('/api/captura', capturaRoutes);
  app.use('/api/lotes', capturaRoutes);
  app.use('/api/imagens', capturaRoutes);
  app.use('/api/planilhas', planilhasRoutes);
  app.use('/api/qa', qaHubRoutes);
  app.use('/api/entregas', qaHubRoutes);
  app.use('/api/retrabalhos', qaHubRoutes);
  app.use('/api/relatorios', qaHubRoutes);

  app.use(express.static(path.join(rootDir, 'frontend', 'public')));
  app.use((req, res) => sendError(res, 404, `Not found: ${req.path}`));
  app.use((err, req, res, _next) => sendError(res, err.status || 500, err.expose ? err.message : 'Internal server error'));
  return app;
}
```

- [ ] **Step 8: Add config override function**

```js
// server/config.js addition
export function applyConfigOverrides(overrides = {}) {
  if (overrides.server) Object.assign(config.server, overrides.server);
  if (overrides.paths) Object.assign(config.paths, overrides.paths);
  if (overrides.camera) Object.assign(config.camera, overrides.camera);
  if (overrides.ftp) Object.assign(config.ftp, overrides.ftp);
  if (overrides.validation) Object.assign(config.validation, overrides.validation);
  if (overrides.timezone) config.timezone = overrides.timezone;
  return config;
}
```

- [ ] **Step 9: Normalize route path definitions**

In `routes/captura.js`, expose list/detail routes at both root and mounted variants:

```js
router.get('/', listLotesHandler);
router.get('/:numero', getLoteHandler);
router.get('/:numero/itens', getLoteHandler);
router.get('/lotes', listLotesHandler);
router.get('/lotes/:numero', getLoteHandler);
```

In `routes/qa-hub.js`, remove duplicated `/retrabalhos` and `/relatorios` prefixes from handlers mounted under those prefixes:

```js
router.post('/', retrabalhoHandler);                  // mounted at /api/retrabalhos
router.get('/produtos', productReportHandler);        // mounted at /api/relatorios
router.get('/csv', csvReportHandler);                 // mounted at /api/relatorios
router.post('/preparar', prepareDeliveryHandler);     // mounted at /api/entregas
router.post('/executar', executeDeliveryHandler);     // mounted at /api/entregas
```

- [ ] **Step 10: Update `server.js` to start from factory**

```js
// server.js shape
import { createApp } from './server/app.js';
import { config, initConfig, createExampleConfigs } from './server/config.js';
import { getWatcher } from './services/filesystem-watcher.js';

async function start() {
  await initConfig();
  await createExampleConfigs();
  const app = createApp();
  const watcher = getWatcher();
  await watcher.start();
  const host = config.server.lanEnabled ? '0.0.0.0' : config.server.host;
  app.listen(config.server.port, host, () => {
    console.log(`Server running on http://${config.server.host}:${config.server.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

- [ ] **Step 11: Run task tests**

Run: `npm.cmd test -- tests/unit/operation-store.test.js tests/integration/api-routes.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 12: Commit**

```bash
git add server/app.js server/response.js server/operation-store.js server.js server/config.js routes/captura.js routes/qa-hub.js routes/planilhas.js tests/helpers/test-env.js tests/unit/operation-store.test.js tests/integration/api-routes.test.js
git commit -m "refactor: add app factory and phase 1 route contracts"
```

---

