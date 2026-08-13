import test from 'node:test';
import assert from 'node:assert';
import { MockFtpProvider, FtpService } from '../../services/ftp-service.js';

test('MockFtpProvider - connect/disconnect', async () => {
  const provider = new MockFtpProvider();

  assert.strictEqual(provider.connected, false);

  await provider.connect();
  assert.strictEqual(provider.connected, true);

  await provider.disconnect();
  assert.strictEqual(provider.connected, false);
});

test('MockFtpProvider - upload file', async () => {
  const provider = new MockFtpProvider();
  await provider.connect();

  const result = await provider.uploadFile('/local/photo.jpg', '/remote/LOTE 37/CODE/photo.jpg');

  assert.ok(result.success);
  assert.ok(result.hash);
  assert.ok(result.size > 0);
});

test('MockFtpProvider - verify file', async () => {
  const provider = new MockFtpProvider();
  await provider.connect();

  // Upload first
  const uploadResult = await provider.uploadFile('/local/photo.jpg', '/remote/LOTE 37/photo.jpg');
  assert.ok(uploadResult.success);

  // Verify
  const verifyResult = await provider.verifyFile('/remote/LOTE 37/photo.jpg');
  assert.ok(verifyResult.exists);
  assert.strictEqual(verifyResult.hash, uploadResult.hash);
});

test('MockFtpProvider - list files', async () => {
  const provider = new MockFtpProvider();
  await provider.connect();

  await provider.uploadFile('/local/photo1.jpg', '/remote/LOTE 37/photo1.jpg');
  await provider.uploadFile('/local/photo2.jpg', '/remote/LOTE 37/photo2.jpg');

  const files = await provider.listFiles('/remote/LOTE 37');

  assert.strictEqual(files.length, 2);
  assert.ok(files.some(f => f.name === 'photo1.jpg'));
  assert.ok(files.some(f => f.name === 'photo2.jpg'));
});

test('MockFtpProvider - rename file', async () => {
  const provider = new MockFtpProvider();
  await provider.connect();

  await provider.uploadFile('/local/photo.jpg', '/remote/LOTE 37/photo.jpg');

  const renameResult = await provider.renameRemote(
    '/remote/LOTE 37/photo.jpg',
    '/remote/LOTE 37/final/photo.jpg'
  );

  assert.ok(renameResult.success);

  // Verify old path gone
  const oldVerify = await provider.verifyFile('/remote/LOTE 37/photo.jpg');
  assert.strictEqual(oldVerify.exists, false);

  // Verify new path exists
  const newVerify = await provider.verifyFile('/remote/LOTE 37/final/photo.jpg');
  assert.ok(newVerify.exists);
});

test('MockFtpProvider - not connected error', async () => {
  const provider = new MockFtpProvider();

  assert.rejects(async () => {
    await provider.uploadFile('/local/photo.jpg', '/remote/photo.jpg');
  }, /Not connected/);
});

test('FtpService - build remote path', () => {
  const service = new FtpService();

  const path = service.buildRemotePath('37', 'CODE123');

  assert.ok(path.includes('LOTE'));
  assert.ok(path.includes('37'));
  assert.ok(path.includes('CODE123'));
});

test('FtpService - block path traversal', () => {
  const service = new FtpService();

  assert.throws(() => {
    service.buildRemotePath('37', '../../../etc/passwd');
  }, /Invalid remote path/);
});

test('FtpService - connect and disconnect', async () => {
  const provider = new MockFtpProvider();
  const service = new FtpService(provider);

  const connectResult = await service.connect();
  assert.ok(connectResult.ok);

  const disconnectResult = await service.disconnect();
  assert.ok(disconnectResult.ok);
});

test('FtpService - upload file', async () => {
  const provider = new MockFtpProvider();
  const service = new FtpService(provider);

  await service.connect();

  const result = await service.uploadFile('/local/photo.jpg', '/remote/photo.jpg');

  assert.ok(result.ok);
  assert.ok(result.data.hash);
});

test('FtpService - list remote files', async () => {
  const provider = new MockFtpProvider();
  const service = new FtpService(provider);

  await service.connect();

  await service.uploadFile('/local/photo1.jpg', '/remote/photo1.jpg');
  await service.uploadFile('/local/photo2.jpg', '/remote/photo2.jpg');

  const result = await service.listRemoteFiles('/remote');

  assert.ok(result.ok);
  assert.strictEqual(result.data.count, 2);
});
