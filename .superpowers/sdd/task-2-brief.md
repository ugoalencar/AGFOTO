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

