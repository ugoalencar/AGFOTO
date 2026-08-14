# AGFOTO Fase 1 Produtos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local-only product workflow for AG Fotografia: camera status, capture, JSON, Excel, QA AP/AT, delivery staging/mock, retrabalho, reports, and corrected documentation.

**Architecture:** Keep the existing Express + service/repository/domain shape, but replace broken route wiring and incomplete service methods with testable modules. Use dependency injection through explicit service factories where filesystem, clock, camera, Excel, and delivery providers need fake implementations in tests. Operational state remains in local folders, JSON, Excel, and audit logs.

**Tech Stack:** Node.js ESM, Express, Vue 3 served locally, Bootstrap local assets, ExcelJS, Node test runner, Windows filesystem conventions, `simplusCameraLib/simplusCamera.exe`.

## Global Constraints

- The AGFOTO system must be local-only in Fase 1: no Redmine, no Java, no `start.jar`, no calls to `C:\sphoto-terminais`, no calls to `D:\Syndi_qa`.
- The server binds to `127.0.0.1:3000` by default.
- Frontend assets must work without internet; do not use CDN.
- Camera integration is local and non-blocking through `simplusCameraLib/simplusCamera.exe`.
- JSON is the operational source of truth; Excel control files are rebuildable views.
- All mutating API routes require `operationId`.
- Tests must use temporary fixture directories, never operational `dados/`, `Finalizadas/`, `Entrega/`, or `images/temp/`.
- Do not mark an item `entregue` until delivery provider verification succeeds.
- FTP real, Carros, OCR plate flow, ADSET, GitHub updater, LAN auth, and production claims are outside Fase 1.

---

## File Structure

Create:

- `server/app.js` - Express app factory without starting the listener.
- `server/response.js` - `{ ok, data, error, requestId }` helpers.
- `server/operation-store.js` - idempotency record for `operationId`.
- `services/camera-service.js` - local camera status/open logic.
- `services/preview-service.js` - image URL/metadata helper for frontend thumbnails.
- `services/delivery-provider.js` - mock/local delivery provider contract.
- `tests/helpers/test-env.js` - isolated temp workspace setup.
- `tests/unit/camera-service.test.js`
- `tests/unit/operation-store.test.js`
- `tests/integration/api-routes.test.js`
- `tests/integration/captura-products.test.js`
- `tests/integration/planilhas-products.test.js`
- `tests/integration/qa-products.test.js`
- `tests/integration/delivery-products.test.js`
- `tests/integration/reports-products.test.js`
- `docs/superpowers/plans/2026-08-14-agfoto-fase-1-produtos-implementation.md`

Modify:

- `server.js` - start server via `createApp()`.
- `server/config.js` - allow test config injection and add camera path config.
- `server/secure-filesystem.js` - strengthen path containment and image signature usage.
- `server/json-persistence.js` - finish atomic write with queue, backup, restore semantics.
- `domain/lote.js` - accept any numeric GTIN/EAN string and formalize status transitions.
- `domain/status.js` - expose transition map and validation.
- `repositories/lote-repository.js` - root injection and safe JSON load/create/list.
- `repositories/file-repository.js` - snapshot, collision-safe moves, AP/AT moves.
- `services/captura-service.js` - fix moved/copied bug and update JSON/Excel atomically.
- `services/excel-service.js` - real upload/import/confirm/lookup/control workbook.
- `services/delivery-service.js` - AP/AT, staging, manifest, delivery verification, retrabalho.
- `services/report-service.js` - filters and stats from JSON + lookup.
- `routes/captura.js`, `routes/planilhas.js`, `routes/qa-hub.js` - correct route paths and `operationId`.
- `frontend/public/index.html`, `frontend/public/main.js`, `frontend/public/App.js`, `frontend/public/services/api.js`, `frontend/public/css/main.css` - local assets and working UI.
- `README.md`, `OPERACIONAL.md`, `STATUS-DESENVOLVIMENTO.md`, `TESTE-RESULTADO-v1.0.0.md`, `LANCAMENTO-v1.0.0.md`, `RELEASE-NOTES-v1.0.0.md` - remove false production-ready claims or mark old release docs as superseded.

---

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

### Task 2: Camera Service, Secure TEMP Listing, Image URLs

**Files:**
- Create: `services/camera-service.js`
- Create: `services/preview-service.js`
- Create: `tests/unit/camera-service.test.js`
- Modify: `server/secure-filesystem.js`
- Modify: `repositories/file-repository.js`
- Modify: `routes/captura.js`
- Modify: `server/app.js`

**Interfaces:**
- Consumes: `config.camera.executable`
- Produces: `CameraService.getStatus() => Promise<{ running, executableExists, executablePath, message }>`
- Produces: `CameraService.open() => Promise<{ started, executablePath, message }>`
- Produces: `FileRepository.listTempImages() => Promise<Array<{ name, path, url, size, modified, stable, signatureOk, state }>>`
- Produces: `GET /api/status/camera`
- Produces: `POST /api/status/camera/open` requiring `operationId`

- [ ] **Step 1: Write failing camera service tests**

```js
// tests/unit/camera-service.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { CameraService } from '../../services/camera-service.js';

test('camera status reports missing executable without blocking', async (t) => {
  const env = await createTestEnv(t);
  const svc = new CameraService({ config: env.config, processList: async () => '' });
  const status = await svc.getStatus();
  assert.equal(status.running, false);
  assert.equal(status.executableExists, false);
  assert.match(status.message, /not found/i);
});

test('camera status detects executable and running process', async (t) => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const svc = new CameraService({ config: env.config, processList: async () => 'simplusCamera.exe 1234 Console' });
  const status = await svc.getStatus();
  assert.equal(status.running, true);
  assert.equal(status.executableExists, true);
});
```

- [ ] **Step 2: Write failing TEMP listing test**

```js
// tests/integration/captura-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FileRepository } from '../../repositories/file-repository.js';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

async function exists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test('TEMP listing includes only valid image signatures with stable state', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto1.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'fake.jpg'), 'not an image');
  const images = await FileRepository.listTempImages();
  assert.deepEqual(images.map(i => i.name), ['foto1.jpg']);
  assert.equal(images[0].signatureOk, true);
  assert.equal(images[0].state, 'stable');
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm.cmd test -- tests/unit/camera-service.test.js tests/integration/captura-products.test.js`

Expected: FAIL because camera service does not exist and TEMP listing does not validate signatures.

- [ ] **Step 4: Implement camera service**

```js
// services/camera-service.js
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { config as defaultConfig } from '../server/config.js';

const execFileAsync = promisify(execFile);

export class CameraService {
  constructor({ config = defaultConfig, processList = null, starter = null } = {}) {
    this.config = config;
    this.processList = processList || this.defaultProcessList;
    this.starter = starter || this.defaultStarter;
  }

  async defaultProcessList() {
    const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq simplusCamera*']);
    return stdout;
  }

  async defaultStarter(executablePath) {
    const child = spawn(executablePath, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return child.pid;
  }

  async getStatus() {
    const executablePath = this.config.camera.executable;
    const executableExists = fs.existsSync(executablePath);
    const output = await this.processList().catch(() => '');
    const running = /simplusCamera/i.test(output);
    return {
      running,
      executableExists,
      executablePath,
      message: running ? 'simplusCamera.exe is running' : executableExists ? 'Camera executable available' : 'simplusCamera.exe not found'
    };
  }

  async open() {
    const status = await this.getStatus();
    if (!status.executableExists) {
      return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe not found' };
    }
    if (status.running) {
      return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe already running' };
    }
    const pid = await this.starter(status.executablePath);
    return { started: true, pid, executablePath: status.executablePath, message: 'simplusCamera.exe started' };
  }
}
```

- [ ] **Step 5: Strengthen image listing**

In `server/secure-filesystem.js`, make `listAllowedFiles(dirPath, root)` validate signatures by calling `validateImageSignature(fullPath)` and skip invalid files. Use `path.relative` containment with separator check:

```js
export function assertInsideRoot(resolvedPath, allowedRoot) {
  const root = path.resolve(allowedRoot);
  const target = path.resolve(resolvedPath);
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return target;
  throw new Error(`Path traversal attempt: ${resolvedPath}`);
}
```

- [ ] **Step 6: Add image metadata in file repository**

```js
// repositories/file-repository.js listTempImages shape
static async listTempImages() {
  const files = await listAllowedFiles(config.paths.imagesTemp, config.paths.imagesTemp);
  const result = [];
  for (const file of files) {
    const stats = await fs.promises.stat(file.path);
    result.push({
      name: file.name,
      path: file.path,
      url: `/api/captura/imagem/temp/${encodeURIComponent(file.name)}`,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      stable: true,
      signatureOk: true,
      state: 'stable'
    });
  }
  return result;
}
```

- [ ] **Step 7: Wire camera routes**

```js
// server/app.js additions before other route mounts
import { CameraService } from '../services/camera-service.js';

app.get('/api/status/camera', async (_req, res, next) => {
  try {
    const service = app.locals.services.cameraService || new CameraService();
    sendOk(res, await service.getStatus());
  } catch (err) {
    next(err);
  }
});

app.post('/api/status/camera/open', async (req, res, next) => {
  try {
    const operationId = app.locals.operationStore.requireOperationId(req);
    const existing = app.locals.operationStore.begin(operationId, 'camera.open');
    if (existing.status === 'completed') return res.status(200).json(existing.result);
    const service = app.locals.services.cameraService || new CameraService();
    const result = { ok: true, data: await service.open(), requestId: req.id };
    app.locals.operationStore.complete(operationId, result);
    res.json(result);
  } catch (err) {
    sendError(res, 400, err);
  }
});
```

- [ ] **Step 8: Run task tests**

Run: `npm.cmd test -- tests/unit/camera-service.test.js tests/integration/captura-products.test.js tests/integration/api-routes.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 9: Commit**

```bash
git add services/camera-service.js services/preview-service.js server/app.js server/secure-filesystem.js repositories/file-repository.js routes/captura.js tests/unit/camera-service.test.js tests/integration/captura-products.test.js
git commit -m "feat: add local camera status and secure temp images"
```

---

### Task 3: Product Capture, JSON State, Excel Control Workbook

**Files:**
- Modify: `domain/status.js`
- Modify: `domain/lote.js`
- Modify: `server/json-persistence.js`
- Modify: `repositories/lote-repository.js`
- Modify: `repositories/file-repository.js`
- Modify: `services/captura-service.js`
- Modify: `services/excel-service.js`
- Modify: `routes/captura.js`
- Modify: `tests/unit/domain-lote.test.js`
- Modify: `tests/integration/captura-products.test.js`

**Interfaces:**
- Produces: `Produto.isValid(gtin) => true` for any non-empty numeric string up to max length
- Produces: `transitionProduct(produto, event, details)` with enforced state changes
- Produces: `writeJsonAtomic(filePath, data, { backupDir })`
- Produces: `ExcelService.updateControlFromLote(loteNumero) => Promise<{ ok, data: { filePath } }>`
- Consumes: `operationId` requirement from Task 1

- [ ] **Step 1: Write failing domain/capture tests**

```js
// tests/unit/domain-lote.test.js additions
test('Produto accepts any numeric local identifier and preserves zeros', () => {
  assert.equal(Produto.isValid('000123'), true);
  assert.equal(Produto.isValid('1'), true);
  assert.equal(Produto.normalize(' 000123 '), '000123');
  assert.equal(Produto.isValid('ABC123'), false);
});
```

```js
// tests/integration/captura-products.test.js addition
test('save capture moves snapshot, updates JSON, Excel control, and does not overwrite', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto.jpg'), JPG_BYTES);
  const result = await CapturaService.saveCapture('37', '000123', '', '', { operationId: 'save-1' });
  assert.equal(result.ok, true);
  assert.equal(result.data.fotosMovidas, 1);
  assert.equal(await exists(path.join(env.paths.finalizadas, 'LOTE 37', '000123', 'foto.jpg')), true);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_37.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].status, 'pendente_qa');
  assert.equal(await exists(path.join(env.paths.xlsx, 'controle-lotes.xlsx')), true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/unit/domain-lote.test.js tests/integration/captura-products.test.js`

Expected: FAIL because GTIN validation is too strict and `fotosMovidas`/Excel control are not implemented.

- [ ] **Step 3: Implement status transitions**

```js
// domain/status.js
export const ProductStatus = Object.freeze({
  EM_CAPTURA: 'em_captura',
  PENDENTE_QA: 'pendente_qa',
  PRONTO_PARA_ENTREGA: 'pronto_para_entrega',
  ENTREGANDO: 'entregando',
  ENTREGUE: 'entregue',
  ERRO_ENTREGA: 'erro_entrega',
  RETRABALHO: 'retrabalho'
});

export const ProductEvents = Object.freeze({
  CAPTURA_SALVA: 'captura_salva',
  QA_CONCLUIDO: 'qa_concluido',
  ENTREGA_INICIADA: 'entrega_iniciada',
  ENTREGA_CONFIRMADA: 'entrega_confirmada',
  ENTREGA_FALHOU: 'entrega_falhou',
  RETRABALHO_INICIADO: 'retrabalho_iniciado'
});

export function nextProductStatus(current, event) {
  const map = {
    [ProductEvents.CAPTURA_SALVA]: ProductStatus.PENDENTE_QA,
    [ProductEvents.QA_CONCLUIDO]: ProductStatus.PRONTO_PARA_ENTREGA,
    [ProductEvents.ENTREGA_INICIADA]: ProductStatus.ENTREGANDO,
    [ProductEvents.ENTREGA_CONFIRMADA]: ProductStatus.ENTREGUE,
    [ProductEvents.ENTREGA_FALHOU]: ProductStatus.ERRO_ENTREGA,
    [ProductEvents.RETRABALHO_INICIADO]: ProductStatus.RETRABALHO
  };
  const next = map[event];
  if (!next) throw new Error(`Unknown product event: ${event}`);
  return next;
}
```

- [ ] **Step 4: Relax numeric product validation**

```js
// domain/lote.js Produto.isValid replacement
static isValid(gtin) {
  const normalized = String(gtin ?? '').trim();
  return /^\d{1,64}$/.test(normalized);
}
```

- [ ] **Step 5: Finish collision-safe moves**

In `repositories/file-repository.js`, make `moveToFinalizadas()` use deterministic suffix before move:

```js
static async uniqueDestPath(destDir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(destDir, filename);
  let counter = 1;
  while (await fileExists(candidate)) {
    candidate = path.join(destDir, `${base}_${String(counter).padStart(3, '0')}${ext}`);
    counter++;
  }
  return candidate;
}
```

- [ ] **Step 6: Fix capture service moved/copied bug**

```js
// services/captura-service.js response shape
const moveResult = await FileRepository.moveSnapshotToFinalizadas(snapshot, loteNumero, gtin);
produto.markCaptureSaved(moveResult.moved.length);
await LoteRepository.save(lote);
await ExcelService.updateControlFromLote(loteNumero);
return {
  ok: moveResult.failed.length === 0,
  data: {
    lote: lote.numero,
    gtin,
    fotosMovidas: moveResult.moved.length,
    fotosFalhadas: moveResult.failed.length,
    status: produto.status,
    detalhes: moveResult
  },
  error: moveResult.failed.length ? 'Some files failed to move' : undefined
};
```

- [ ] **Step 7: Implement Excel control update**

```js
// services/excel-service.js method
static async updateControlFromLote(loteNumero) {
  const lote = await LoteRepository.load(loteNumero);
  await fs.promises.mkdir(config.paths.xlsx, { recursive: true });
  const filePath = path.join(config.paths.xlsx, 'controle-lotes.xlsx');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.readFile(filePath); } catch {}
  let sheet = workbook.getWorksheet(`Lote ${loteNumero}`);
  if (sheet) workbook.removeWorksheet(sheet.id);
  sheet = workbook.addWorksheet(`Lote ${loteNumero}`);
  sheet.addRow(['EAN', 'Codigo', 'Descricao', 'Data da foto', 'Quantidade de fotos', 'Status', 'Ultima entrega', 'Ultimo erro']);
  for (const item of Object.values(lote.itens)) {
    sheet.addRow([item.gtin, item.codigo || '', item.descricao || '', item.dataFotografia || '', item.quantidadeFotos, item.status, item.ultimaEntregaEm || '', item.ultimoErro || '']);
  }
  await workbook.xlsx.writeFile(filePath);
  return { ok: true, data: { filePath } };
}
```

- [ ] **Step 8: Run task tests**

Run: `npm.cmd test -- tests/unit/domain-lote.test.js tests/integration/captura-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 9: Commit**

```bash
git add domain/status.js domain/lote.js server/json-persistence.js repositories/lote-repository.js repositories/file-repository.js services/captura-service.js services/excel-service.js routes/captura.js tests/unit/domain-lote.test.js tests/integration/captura-products.test.js
git commit -m "feat: implement product capture state and control workbook"
```

---

### Task 4: Planilhas Import, Lookup, Conflicts

**Files:**
- Modify: `domain/excel.js`
- Modify: `services/excel-service.js`
- Modify: `routes/planilhas.js`
- Create/Modify: `tests/integration/planilhas-products.test.js`

**Interfaces:**
- Produces: `ExcelService.importWorkbook({ lote, filePath }) => Promise<{ ok, data: { importId, preview, conflicts } }>`
- Produces: `ExcelService.confirmImport(importId) => Promise<{ ok, data: { inserted, unchanged, conflicts } }>`
- Produces: `ExcelService.lookupCodigo(lote, ean) => Promise<{ ok, data: { codigo, descricao } }>`
- Produces: `POST /api/planilhas/importar` accepting JSON `{ operationId, lote, filePath }` for local file import in Fase 1
- Produces: `POST /api/planilhas/confirmar` accepting `{ operationId, importId }`

- [ ] **Step 1: Write failing import tests**

```js
// tests/integration/planilhas-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import ExcelJS from 'exceljs';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import ExcelService from '../../services/excel-service.js';

async function makeWorkbook(filePath, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Entrada');
  rows.forEach(row => ws.addRow(row));
  await wb.xlsx.writeFile(filePath);
}

test('imports lookup workbook and blocks silent conflicts', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const entrada = path.join(env.paths.xlsx, 'entrada.xlsx');
  await makeWorkbook(entrada, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-1', 'Produto 1']]);
  const imported = await ExcelService.importWorkbook({ lote: '37', filePath: entrada });
  assert.equal(imported.ok, true);
  const confirmed = await ExcelService.confirmImport(imported.data.importId);
  assert.equal(confirmed.data.inserted, 1);
  const conflictFile = path.join(env.paths.xlsx, 'entrada-conflict.xlsx');
  await makeWorkbook(conflictFile, [['EAN', 'Codigo', 'Descricao'], ['000123', 'COD-2', 'Produto 1']]);
  const conflict = await ExcelService.importWorkbook({ lote: '37', filePath: conflictFile });
  assert.equal(conflict.data.conflicts.length, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/planilhas-products.test.js`

Expected: FAIL because `importWorkbook`/`confirmImport` are not implemented.

- [ ] **Step 3: Implement import session storage**

In `services/excel-service.js`, add module-level import session map:

```js
const pendingImports = new Map();

function makeImportId(lote, filePath) {
  return `${lote}:${path.basename(filePath)}:${Date.now()}`;
}
```

- [ ] **Step 4: Implement workbook import**

```js
static async importWorkbook({ lote, filePath }) {
  if (!Lote.isValid(lote)) return { ok: false, error: 'Invalid lote' };
  const ext = path.extname(filePath).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) return { ok: false, error: 'Only .xlsx and .xls are accepted' };
  const stats = await fs.promises.stat(filePath);
  if (stats.size > config.validation.maxSheetSize) return { ok: false, error: 'Spreadsheet exceeds size limit' };
  const items = await this.parseWorkbook(filePath, lote);
  const conflicts = await this.detectLookupConflicts(lote, items);
  const importId = makeImportId(lote, filePath);
  pendingImports.set(importId, { lote, filePath, items, conflicts });
  return { ok: true, data: { importId, preview: items.slice(0, 20), total: items.length, conflicts } };
}
```

- [ ] **Step 5: Implement confirm and lookup**

```js
static async confirmImport(importId) {
  const session = pendingImports.get(importId);
  if (!session) return { ok: false, error: 'Import session not found' };
  if (session.conflicts.length) return { ok: false, error: 'Resolve conflicts before confirming', data: { conflicts: session.conflicts } };
  const result = await this.mergeToLookup(session.lote, session.items);
  pendingImports.delete(importId);
  return result;
}

static async lookupCodigo(lote, ean) {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(config.paths.xlsx, 'lookup-integrado.xlsx');
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.getWorksheet('Lookup') || workbook.worksheets[0];
  for (const row of ws.getRows(2, ws.rowCount - 1) || []) {
    if (String(row.getCell(1).value) === String(lote) && String(row.getCell(2).value) === String(ean)) {
      return { ok: true, data: { codigo: String(row.getCell(3).value || ''), descricao: String(row.getCell(4).value || '') } };
    }
  }
  return { ok: false, error: `Codigo not found for lote ${lote} EAN ${ean}` };
}
```

- [ ] **Step 6: Wire routes**

```js
router.post('/importar', async (req, res) => {
  const operationId = req.app.locals.operationStore.requireOperationId(req);
  req.app.locals.operationStore.begin(operationId, 'planilhas.importar');
  const result = await ExcelService.importWorkbook(req.body);
  req.app.locals.operationStore.complete(operationId, result);
  return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
});
```

- [ ] **Step 7: Run task tests**

Run: `npm.cmd test -- tests/integration/planilhas-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add domain/excel.js services/excel-service.js routes/planilhas.js tests/integration/planilhas-products.test.js
git commit -m "feat: implement local spreadsheet lookup imports"
```

---

### Task 5: QA AP/AT, Unclassify, Delete, Conclude QA

**Files:**
- Modify: `repositories/file-repository.js`
- Modify: `services/delivery-service.js`
- Modify: `routes/qa-hub.js`
- Create/Modify: `tests/integration/qa-products.test.js`

**Interfaces:**
- Produces: `DeliveryService.classifyPhoto(lote, gtin, filename, classification, operationContext)`
- Produces: `DeliveryService.unclassifyPhoto(lote, gtin, filename, fromClassification, operationContext)`
- Produces: `DeliveryService.deletePhoto(lote, gtin, filename, location, operationContext)`
- Produces: `DeliveryService.completeQa(lote, gtin, deliveryType)`

- [ ] **Step 1: Write failing QA tests**

```js
// tests/integration/qa-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import DeliveryService from '../../services/delivery-service.js';

test('classifies AP and AT by moving files, then unclassifies without overwrite', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const root = path.join(env.paths.finalizadas, 'LOTE 37', '000123');
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  const ap = await DeliveryService.classifyPhotoAP('37', '000123', 'a.jpg');
  assert.equal(ap.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'AP', 'a.jpg')), true);
  const undo = await DeliveryService.unclassifyPhoto('37', '000123', 'a.jpg', 'AP');
  assert.equal(undo.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'a.jpg')), true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/qa-products.test.js`

Expected: FAIL because AP/AT methods currently return success without moving files.

- [ ] **Step 3: Implement finalizadas move helper**

```js
// repositories/file-repository.js
static async moveFinalizadaPhoto({ loteNumero, gtin, filename, fromSubfolder = null, toSubfolder = null }) {
  validateFilename(filename);
  const baseDir = path.join(config.paths.finalizadas, `LOTE ${loteNumero}`, gtin);
  const srcDir = fromSubfolder ? path.join(baseDir, fromSubfolder) : baseDir;
  const destDir = toSubfolder ? path.join(baseDir, toSubfolder) : baseDir;
  await createSecureDirectory(destDir);
  const srcPath = securePath(path.join(srcDir, filename), config.paths.finalizadas);
  const destPath = await this.uniqueDestPath(destDir, filename);
  await fs.promises.rename(srcPath, destPath).catch(async err => {
    if (err.code !== 'EXDEV') throw err;
    await fs.promises.copyFile(srcPath, destPath);
    await fs.promises.unlink(srcPath);
  });
  return { srcPath, destPath, destName: path.basename(destPath) };
}
```

- [ ] **Step 4: Implement AP/AT service methods**

```js
static async classifyPhotoAP(lote, gtin, filename) {
  return this.classifyPhoto(lote, gtin, filename, 'AP');
}

static async classifyPhotoAT(lote, gtin, filename) {
  return this.classifyPhoto(lote, gtin, filename, 'AT');
}

static async classifyPhoto(lote, gtin, filename, classification) {
  if (!['AP', 'AT'].includes(classification)) return { ok: false, error: 'Invalid classification' };
  const moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: lote, gtin, filename, toSubfolder: classification });
  await auditLogger.log(`CLASSIFY_${classification}`, { lote, gtin, filename, destName: moved.destName });
  return { ok: true, data: { classified: classification, filename: moved.destName } };
}

static async unclassifyPhoto(lote, gtin, filename, fromClassification = null) {
  const fromSubfolder = fromClassification || (filename.includes('/') ? filename.split('/')[0] : null);
  const cleanFilename = filename.includes('/') ? filename.split('/').pop() : filename;
  if (!['AP', 'AT'].includes(fromSubfolder)) return { ok: false, error: 'fromClassification must be AP or AT' };
  const moved = await FileRepository.moveFinalizadaPhoto({ loteNumero: lote, gtin, filename: cleanFilename, fromSubfolder, toSubfolder: null });
  await auditLogger.log('UNCLASSIFY', { lote, gtin, filename: cleanFilename, fromSubfolder, destName: moved.destName });
  return { ok: true, data: { unclassified: true, filename: moved.destName } };
}
```

- [ ] **Step 5: Update complete QA**

Replace the body of `DeliveryService.completeQa()` with this behavior:

```js
static async completeQa(lote, gtin, deliveryType = DeliveryType.NORMAL) {
  try {
    const loteObj = await LoteRepository.load(lote);
    const produto = loteObj.itens[gtin];
    if (!produto) return { ok: false, error: `Product not found: ${gtin}` };

    const subfolder = deliveryType === DeliveryType.ATUALIZACAO ? 'AT' : null;
    const photos = await FileRepository.listFinalizadasImages(lote, gtin, subfolder);
    if (photos.length === 0) {
      return {
        ok: false,
        error: deliveryType === DeliveryType.ATUALIZACAO
          ? 'No AT photos available for update delivery'
          : 'No root photos available for normal delivery'
      };
    }

    produto.status = ProductStatus.PRONTO_PARA_ENTREGA;
    produto.addHistoricoEvent('qa_concluido', { deliveryType, quantidadeFotosElegiveis: photos.length });
    await LoteRepository.save(loteObj);
    await ExcelService.updateControlFromLote(lote);
    await auditLogger.log('QA_COMPLETO', { lote, gtin, deliveryType, quantidadeFotosElegiveis: photos.length });
    return { ok: true, data: { status: produto.status, deliveryType, quantidadeFotosElegiveis: photos.length } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

- [ ] **Step 6: Wire QA routes with operationId**

```js
router.post('/classificar', async (req, res) => {
  const operationId = req.app.locals.operationStore.requireOperationId(req);
  req.app.locals.operationStore.begin(operationId, 'qa.classificar');
  const { lote, gtin, filename, classification } = req.body;
  const result = classification === 'AP'
    ? await DeliveryService.classifyPhotoAP(lote, gtin, filename)
    : await DeliveryService.classifyPhotoAT(lote, gtin, filename);
  req.app.locals.operationStore.complete(operationId, result);
  return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
});
```

- [ ] **Step 7: Run task tests**

Run: `npm.cmd test -- tests/integration/qa-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add repositories/file-repository.js services/delivery-service.js routes/qa-hub.js tests/integration/qa-products.test.js
git commit -m "feat: implement product QA AP AT classification"
```

---

### Task 6: Delivery Staging, Mock Provider, Retrabalho

**Files:**
- Create: `services/delivery-provider.js`
- Modify: `domain/delivery.js`
- Modify: `services/delivery-service.js`
- Modify: `services/excel-service.js`
- Modify: `routes/qa-hub.js`
- Create/Modify: `tests/integration/delivery-products.test.js`

**Interfaces:**
- Produces: `LocalDeliveryProvider.deliver({ stagingDir, remotePath, manifest })`
- Produces: `DeliveryService.prepareDelivery(lote, gtin, codigo = null, deliveryType = 'normal')`
- Produces: `DeliveryService.executeDelivery(lote, gtin, codigo = null, deliveryType = 'normal')`
- Produces: `DeliveryService.restartRework(lote, gtin = null, codigo = null)`

- [ ] **Step 1: Write failing delivery tests**

```js
// tests/integration/delivery-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import DeliveryService from '../../services/delivery-service.js';

async function seedLoteJson(env, lote, gtin, overrides = {}) {
  await fs.promises.mkdir(env.paths.jsons, { recursive: true });
  const item = {
    gtin,
    codigo: overrides.codigo || null,
    descricao: overrides.descricao || null,
    status: overrides.status || 'pendente_qa',
    dataFotografia: overrides.dataFotografia || '2026-08-14T10:00:00-03:00',
    quantidadeFotos: overrides.quantidadeFotos || 0,
    ultimaEntregaEm: null,
    ultimoErro: null,
    historico: []
  };
  const filePath = path.join(env.paths.jsons, `Lote_${lote}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    lote,
    criadoEm: '2026-08-14T10:00:00-03:00',
    atualizadoEm: '2026-08-14T10:00:00-03:00',
    itens: { [gtin]: item }
  }, null, 2));
}

test('delivery stages root photos and marks delivered only after provider verification', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const productDir = path.join(env.paths.finalizadas, 'LOTE 37', '000123');
  await fs.promises.mkdir(productDir, { recursive: true });
  await fs.promises.writeFile(path.join(productDir, 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  await seedLoteJson(env, '37', '000123', { codigo: 'COD-1', status: 'pronto_para_entrega', quantidadeFotos: 1 });
  const prepared = await DeliveryService.prepareDelivery('37', '000123', 'COD-1', 'normal');
  assert.equal(prepared.ok, true);
  const delivered = await DeliveryService.executeDelivery('37', '000123', 'COD-1', 'normal');
  assert.equal(delivered.ok, true);
  const loteJson = JSON.parse(await fs.promises.readFile(path.join(env.paths.jsons, 'Lote_37.json'), 'utf8'));
  assert.equal(loteJson.itens['000123'].status, 'entregue');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/delivery-products.test.js`

Expected: FAIL because staging/provider verification is not implemented.

- [ ] **Step 3: Implement local delivery provider**

```js
// services/delivery-provider.js
import fs from 'fs';
import path from 'path';

export class LocalDeliveryProvider {
  constructor({ remoteRoot }) {
    this.remoteRoot = remoteRoot;
  }

  async deliver({ stagingDir, remotePath, manifest }) {
    const finalDir = path.join(this.remoteRoot, remotePath.replace(/^[/\\]+/, ''));
    await fs.promises.mkdir(finalDir, { recursive: true });
    for (const file of manifest.files) {
      await fs.promises.copyFile(path.join(stagingDir, file.name), path.join(finalDir, file.name));
    }
    const remoteFiles = await fs.promises.readdir(finalDir);
    const ok = manifest.files.every(file => remoteFiles.includes(file.name));
    return ok
      ? { ok: true, data: { remotePath: finalDir, verifiedCount: remoteFiles.length } }
      : { ok: false, error: 'Remote verification failed' };
  }
}
```

- [ ] **Step 4: Implement staging and manifest**

In `DeliveryService.prepareDelivery`, resolve codigo, select root or AT files, copy to `Entrega/LOTE <lote>/<codigo>/`, compute file sizes and SHA-256 hashes, write `manifest.json`, and return preflight data.

```js
import crypto from 'crypto';

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const bytes = await fs.promises.readFile(filePath);
  hash.update(bytes);
  return hash.digest('hex');
}

static async prepareDelivery(lote, gtin, codigo = null, deliveryType = DeliveryType.NORMAL) {
  try {
    const loteObj = await LoteRepository.load(lote);
    const produto = loteObj.itens[gtin];
    if (!produto) return { ok: false, error: `Product not found: ${gtin}` };
    const codigoInterno = codigo || produto.codigo;
    if (!codigoInterno) return { ok: false, error: 'Internal code required for delivery' };

    const subfolder = deliveryType === DeliveryType.ATUALIZACAO ? 'AT' : null;
    const photos = await FileRepository.listFinalizadasImages(lote, gtin, subfolder);
    if (!photos.length) return { ok: false, error: 'No eligible photos for delivery' };

    const stagingDir = path.join(config.paths.entrega, `LOTE ${lote}`, codigoInterno);
    await fs.promises.mkdir(stagingDir, { recursive: true });
    const manifest = new Manifest(lote, gtin, codigoInterno, deliveryType);
    for (const photo of photos) {
      const dest = path.join(stagingDir, photo.name);
      await fs.promises.copyFile(photo.path, dest);
      const stats = await fs.promises.stat(dest);
      manifest.addFile(photo.name, stats.size, await sha256(dest));
    }

const manifestPath = path.join(stagingDir, 'manifest.json');
await fs.promises.writeFile(manifestPath, JSON.stringify(manifest.toJSON(), null, 2));
    return { ok: true, data: { stagingDir, manifestPath, manifest: manifest.toJSON(), readyForDelivery: true } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

- [ ] **Step 5: Implement execute delivery status sequence**

```js
produto.status = ProductStatus.ENTREGANDO;
await LoteRepository.save(loteObj);
const deliveryResult = await provider.deliver({ stagingDir, remotePath, manifest });
if (!deliveryResult.ok) {
  produto.recordDeliveryError(deliveryResult.error);
  await LoteRepository.save(loteObj);
  return deliveryResult;
}
produto.markDelivered();
await LoteRepository.save(loteObj);
await ExcelService.updateControlFromLote(lote);
```

- [ ] **Step 6: Implement retrabalho**

Replace `DeliveryService.restartRework()` with a version that finds by GTIN or by unique codigo, sets status `retrabalho`, appends history, saves JSON/control workbook, and never moves/deletes local product files:

```js
static async restartRework(lote, gtin = null, codigo = null) {
  try {
    const loteObj = await LoteRepository.load(lote);
    let targetGtin = gtin;
    if (!targetGtin && codigo) {
      const matches = Object.entries(loteObj.itens)
        .filter(([, produto]) => produto.codigo === codigo)
        .map(([ean]) => ean);
      if (matches.length === 0) return { ok: false, error: 'Product not found' };
      if (matches.length > 1) return { ok: false, error: 'Ambiguous code: multiple products match' };
      targetGtin = matches[0];
    }
    if (!targetGtin || !loteObj.itens[targetGtin]) return { ok: false, error: 'Product not found' };
    const produto = loteObj.itens[targetGtin];
    produto.status = ProductStatus.RETRABALHO;
    produto.addHistoricoEvent('retrabalho_iniciado', { codigo: produto.codigo || codigo || null });
    await LoteRepository.save(loteObj);
    await ExcelService.updateControlFromLote(lote);
    await auditLogger.log('RETRABALHO_INICIADO', { lote, gtin: targetGtin, codigo: produto.codigo || codigo || null });
    return { ok: true, data: { status: produto.status, gtin: targetGtin, codigo: produto.codigo || null } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

- [ ] **Step 7: Run task tests**

Run: `npm.cmd test -- tests/integration/delivery-products.test.js`

Expected: PASS with 0 failures.

- [ ] **Step 8: Commit**

```bash
git add services/delivery-provider.js domain/delivery.js services/delivery-service.js services/excel-service.js routes/qa-hub.js tests/integration/delivery-products.test.js
git commit -m "feat: implement safe local delivery workflow"
```

---

### Task 7: Frontend Local Assets and Product Workflow UI

**Files:**
- Modify: `frontend/public/index.html`
- Modify: `frontend/public/main.js`
- Modify: `frontend/public/App.js`
- Modify: `frontend/public/services/api.js`
- Modify: `frontend/public/css/main.css`
- Add local vendor assets under: `frontend/public/vendor/vue/vue.esm-browser.prod.js`, `frontend/public/vendor/bootstrap/bootstrap.min.css`, `frontend/public/vendor/bootstrap/bootstrap.bundle.min.js`

**Interfaces:**
- Consumes: API routes from Tasks 1-6
- Produces: UI for camera status/open, capture, planilhas import, QA AP/AT, delivery preflight, retrabalho, reports

- [ ] **Step 1: Remove CDN imports**

In `frontend/public/index.html`, replace external links with local files:

```html
<link rel="stylesheet" href="./vendor/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="./css/main.css">
<script type="module" src="./main.js"></script>
```

In `frontend/public/main.js`:

```js
import { createApp } from './vendor/vue/vue.esm-browser.prod.js';
import App from './App.js';
import { createApiClient } from './services/api.js';

const app = createApp(App);
app.config.globalProperties.$api = createApiClient('');
app.mount('#app');
```

- [ ] **Step 2: Fix API client typo and operationId**

```js
function operationId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async saveCapture(lote, gtin, codigo = null, descricao = null) {
  return this.request('/api/captura/salvar', {
    method: 'POST',
    data: { operationId: operationId('capture-save'), lote, gtin, codigo, descricao }
  });
}
```

- [ ] **Step 3: Render real image thumbnails**

Use `img.url` returned by the backend:

```html
<img :src="img.url" :alt="img.name" class="thumb-img" @error="markImageError(img)">
```

- [ ] **Step 4: Add camera panel**

Expose status text and button:

```html
<button class="btn btn-sm btn-outline-warning" @click="openCamera">Abrir Camera</button>
<span class="camera-status">{{ camera.message }}</span>
```

- [ ] **Step 5: Add QA action buttons**

For each QA thumbnail:

```html
<button @click="classifyPhoto(photo, 'AP')">AP</button>
<button @click="classifyPhoto(photo, 'AT')">AT</button>
<button @click="unclassifyPhoto(photo)">Voltar</button>
```

- [ ] **Step 6: Add delivery preflight**

Show manifest fields from `/api/entregas/preparar`: lote, GTIN, codigo, type, file count, staging path, and a confirm button that calls `/api/entregas/executar`.

- [ ] **Step 7: Run local server smoke test**

Run: `npm.cmd start`

Expected: server starts at `http://127.0.0.1:3000`. Open the page and confirm browser network panel has no CDN requests.

- [ ] **Step 8: Commit**

```bash
git add frontend/public/index.html frontend/public/main.js frontend/public/App.js frontend/public/services/api.js frontend/public/css/main.css frontend/public/vendor
git commit -m "feat: build local product workflow frontend"
```

---

### Task 8: Reports, Documentation Corrections, Full Verification

**Files:**
- Modify: `services/report-service.js`
- Modify: `routes/qa-hub.js`
- Create/Modify: `tests/integration/reports-products.test.js`
- Modify: `README.md`
- Modify: `OPERACIONAL.md`
- Modify: `STATUS-DESENVOLVIMENTO.md`
- Modify: `TESTE-RESULTADO-v1.0.0.md`
- Modify: `LANCAMENTO-v1.0.0.md`
- Modify: `RELEASE-NOTES-v1.0.0.md`

**Interfaces:**
- Produces: `ReportService.generateProductReport(filters)`
- Produces: `ReportService.generateCsvData(filters)`
- Consumes: JSON lotes, Excel lookup, Finalizadas folders

- [ ] **Step 1: Write failing report test**

```js
// tests/integration/reports-products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import ReportService from '../../services/report-service.js';

async function seedLoteJson(env, lote, gtin, overrides = {}) {
  await fs.promises.mkdir(env.paths.jsons, { recursive: true });
  const item = {
    gtin,
    codigo: overrides.codigo || null,
    descricao: overrides.descricao || null,
    status: overrides.status || 'pendente_qa',
    dataFotografia: overrides.dataFotografia || '2026-08-14T10:00:00-03:00',
    quantidadeFotos: overrides.quantidadeFotos || 0,
    ultimaEntregaEm: null,
    ultimoErro: null,
    historico: []
  };
  await fs.promises.writeFile(path.join(env.paths.jsons, `Lote_${lote}.json`), JSON.stringify({
    schemaVersion: 1,
    lote,
    criadoEm: '2026-08-14T10:00:00-03:00',
    atualizadoEm: '2026-08-14T10:00:00-03:00',
    itens: { [gtin]: item }
  }, null, 2));
}

test('product report filters by lote and status with coherent totals', async (t) => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await seedLoteJson(env, '37', '000123', { codigo: 'COD-1', status: 'entregue', quantidadeFotos: 2 });
  await seedLoteJson(env, '38', '000999', { codigo: 'COD-9', status: 'pendente_qa', quantidadeFotos: 1 });
  const report = await ReportService.generateProductReport({ lote: '37', status: 'entregue' });
  assert.equal(report.ok, true);
  assert.equal(report.data.items.length, 1);
  assert.equal(report.data.stats.entregues, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- tests/integration/reports-products.test.js`

Expected: FAIL until report stats and filters are aligned with Fase 1.

- [ ] **Step 3: Implement report filters**

`generateProductReport(filters)` must iterate `Lote_*.json`, flatten items, apply filters for period, lote, status, gtin, codigo, descricao, and compute stats:

```js
const stats = {
  totalItens: items.length,
  pendentes: items.filter(i => i.status === 'pendente_qa').length,
  prontos: items.filter(i => i.status === 'pronto_para_entrega').length,
  entregues: items.filter(i => i.status === 'entregue').length,
  erros: items.filter(i => i.status === 'erro_entrega').length,
  retrabalho: items.filter(i => i.status === 'retrabalho').length,
  fotos: items.reduce((sum, i) => sum + Number(i.quantidadeFotos || 0), 0)
};
```

- [ ] **Step 4: Implement CSV export with formula protection**

Every cell starting with `=`, `+`, `-`, or `@` must be prefixed with `'` before CSV output.

- [ ] **Step 5: Correct documentation claims**

Replace "Production Ready", "100% completo", and "pronto para produção" claims with:

```md
> Status revisado: Fase 1 cobre produtos em ambiente local. FTP real, Carros e ADSET dependem de fases e validacoes separadas.
```

Keep old release context visible as historical if useful, but do not claim current production readiness.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm.cmd test
```

Expected: all tests pass. If old tests conflict with corrected behavior, update the tests to match the approved spec and rerun.

- [ ] **Step 7: Start server for manual smoke**

Run:

```bash
npm.cmd start
```

Expected:

- `/api/health` returns `{ ok: true }`.
- `/api/status/camera` returns local camera status.
- Frontend loads without CDN requests.
- Captura page displays with empty TEMP state.

- [ ] **Step 8: Commit**

```bash
git add services/report-service.js routes/qa-hub.js tests/integration/reports-products.test.js README.md OPERACIONAL.md STATUS-DESENVOLVIMENTO.md TESTE-RESULTADO-v1.0.0.md LANCAMENTO-v1.0.0.md RELEASE-NOTES-v1.0.0.md
git commit -m "docs: align phase 1 status and reports"
```

---

## Self-Review

- Spec coverage: Tasks cover local independence, camera, capture, JSON, Excel, QA AP/AT, delivery mock/local, retrabalho, reports, tests, frontend offline assets, and documentation corrections.
- Intentional gaps: Carros, OCR plate flow, ADSET, real FTP validation, GitHub updater, LAN auth are outside Fase 1 per approved spec.
- Red-flag scan: The plan avoids incomplete markers and defers no Fase 1 behavior without naming the task that implements it.
- Type consistency: Services use `ok/data/error` result objects, `operationId` on mutating routes, and route prefixes are normalized before frontend work.
