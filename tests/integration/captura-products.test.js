import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FileRepository } from '../../repositories/file-repository.js';
import { createApp } from '../../server/app.js';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

async function request(app, requestPath, options = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, options);
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('TEMP listing includes only valid image signatures with stable state', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto1.jpg'), JPG_BYTES);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'fake.jpg'), 'not an image');

  const images = await FileRepository.listTempImages();

  assert.deepEqual(images.map(image => image.name), ['foto1.jpg']);
  assert.equal(images[0].signatureOk, true);
  assert.equal(images[0].state, 'stable');
  assert.equal(images[0].url, '/api/captura/imagem/temp/foto1.jpg');
});

test('TEMP preview serves only a valid image inside its configured directory', async t => {
  const env = await createTestEnv(t);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'foto1.jpg'), JPG_BYTES);
  const app = createApp({ configOverrides: env.config });

  const image = await request(app, '/api/captura/imagem/temp/foto1.jpg');
  const traversal = await request(app, '/api/captura/imagem/temp/%2e%2e%2foutside.jpg');

  assert.equal(image.status, 200);
  assert.match(image.contentType, /^image\/jpeg/);
  assert.deepEqual(image.body, JPG_BYTES);
  assert.equal(traversal.status, 400);
});

test('camera API reports status and opens through the operation middleware', async t => {
  const env = await createTestEnv(t);
  const cameraService = {
    getStatus: async () => ({ running: false, executableExists: true, message: 'Camera executable available' }),
    open: async () => ({ started: true, message: 'simplusCamera.exe started' })
  };
  const app = createApp({ configOverrides: env.config, services: { cameraService } });

  const status = await request(app, '/api/status/camera');
  const opened = await request(app, '/api/status/camera/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationId: 'open-camera' })
  });
  const missingOperationId = await request(app, '/api/status/camera/open', { method: 'POST' });

  assert.deepEqual(JSON.parse(status.body.toString()).data, await cameraService.getStatus());
  assert.deepEqual(JSON.parse(opened.body.toString()).data, await cameraService.open());
  assert.equal(missingOperationId.status, 400);
  assert.match(JSON.parse(missingOperationId.body.toString()).error, /operationId/i);
});
