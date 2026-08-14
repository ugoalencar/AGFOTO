import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FileRepository } from '../../repositories/file-repository.js';
import { createApp } from '../../server/app.js';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const RIFF_WAV_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20
]);

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

test('TEMP preview rejects a valid image reached through a symlink outside TEMP', async t => {
  const env = await createTestEnv(t);
  const outsideImage = path.join(env.root, 'outside.jpg');
  const linkedImage = path.join(env.paths.imagesTemp, 'linked.jpg');
  await fs.promises.writeFile(outsideImage, JPG_BYTES);
  try {
    await fs.promises.symlink(outsideImage, linkedImage, 'file');
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Creating symlinks requires Windows Developer Mode or elevated privileges');
      return;
    }
    throw error;
  }
  const app = createApp({ configOverrides: env.config });

  const preview = await request(app, '/api/captura/imagem/temp/linked.jpg');

  assert.equal(preview.status, 400);
});

test('TEMP listing and preview reject a WAV file renamed as WebP', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await fs.promises.writeFile(path.join(env.paths.imagesTemp, 'audio.webp'), RIFF_WAV_BYTES);
  const app = createApp({ configOverrides: env.config });

  const images = await FileRepository.listTempImages();
  const preview = await request(app, '/api/captura/imagem/temp/audio.webp');

  assert.deepEqual(images, []);
  assert.equal(preview.status, 400);
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
