import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { CameraService } from '../../services/camera-service.js';

test('camera status reports missing executable without blocking', async t => {
  const env = await createTestEnv(t);
  const service = new CameraService({ config: env.config, processList: async () => '' });

  const status = await service.getStatus();

  assert.equal(status.running, false);
  assert.equal(status.executableExists, false);
  assert.match(status.message, /not found/i);
});

test('camera status detects executable and running process', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config,
    processList: async () => 'simplusCamera.exe 1234 Console'
  });

  const status = await service.getStatus();

  assert.equal(status.running, true);
  assert.equal(status.executableExists, true);
});

test('camera open starts an available stopped executable without waiting for it', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config,
    processList: async () => '',
    starter: async executablePath => {
      assert.equal(executablePath, env.config.camera.executable);
      return 1234;
    }
  });

  const result = await service.open();

  assert.deepEqual(result, {
    started: true,
    pid: 1234,
    executablePath: env.config.camera.executable,
    message: 'simplusCamera.exe started'
  });
});
