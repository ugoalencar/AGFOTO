import test from 'node:test';
import assert from 'node:assert';
import {
  Manifest,
  DeliveryRecord,
  DeliveryStatus,
  DeliveryType,
  QaPhoto
} from '../../domain/delivery.js';

test('Manifest - create and add files', () => {
  const manifest = new Manifest('37', '07890000000001', 'CODE123', DeliveryType.NORMAL);

  assert.strictEqual(manifest.lote, '37');
  assert.strictEqual(manifest.gtin, '07890000000001');
  assert.strictEqual(manifest.codigo, 'CODE123');
  assert.strictEqual(manifest.deliveryType, DeliveryType.NORMAL);
  assert.strictEqual(manifest.fileCount, 0);
  assert.strictEqual(manifest.totalSize, 0);
});

test('Manifest - add files and calculate totals', () => {
  const manifest = new Manifest('37', 'EAN', 'CODE', DeliveryType.NORMAL);

  manifest.addFile('photo1.jpg', 1500000, 'hash1');
  manifest.addFile('photo2.jpg', 2000000, 'hash2');

  assert.strictEqual(manifest.fileCount, 2);
  assert.strictEqual(manifest.totalSize, 3500000);
  assert.ok(manifest.checksums['photo1.jpg']);
  assert.ok(manifest.checksums['photo2.jpg']);
});

test('Manifest - JSON serialization', () => {
  const manifest = new Manifest('37', 'EAN', 'CODE', DeliveryType.ATUALIZACAO);
  manifest.addFile('update.jpg', 1000000, 'hash');
  manifest.complete();

  const json = manifest.toJSON();
  assert.strictEqual(json.lote, '37');
  assert.strictEqual(json.deliveryType, DeliveryType.ATUALIZACAO);
  assert.ok(json.completedAt);

  const restored = Manifest.fromJSON(json);
  assert.strictEqual(restored.lote, json.lote);
  assert.strictEqual(restored.fileCount, 1);
});

test('DeliveryRecord - lifecycle', () => {
  const record = new DeliveryRecord('37', 'EAN', 'CODE', DeliveryType.NORMAL);

  assert.strictEqual(record.status, DeliveryStatus.PENDING);
  assert.strictEqual(record.attemptedAt, null);

  // Inicia tentativa
  const manifest = new Manifest('37', 'EAN', 'CODE');
  record.startAttempt(manifest);

  assert.strictEqual(record.status, DeliveryStatus.IN_PROGRESS);
  assert.ok(record.attemptedAt);

  // Completa
  record.complete('/fotos/LOTE 37/CODE');

  assert.strictEqual(record.status, DeliveryStatus.COMPLETED);
  assert.ok(record.completedAt);
  assert.ok(record.duration !== null); // Can be 0 if too fast
});

test('DeliveryRecord - fail', () => {
  const record = new DeliveryRecord('37', 'EAN', 'CODE', DeliveryType.NORMAL);
  record.startAttempt(new Manifest('37', 'EAN', 'CODE'));

  record.fail('Connection timeout');

  assert.strictEqual(record.status, DeliveryStatus.FAILED);
  assert.strictEqual(record.error, 'Connection timeout');
  assert.ok(record.duration !== null); // Can be 0 if too fast
});

test('DeliveryRecord - JSON serialization', () => {
  const record = new DeliveryRecord('37', 'EAN', 'CODE', DeliveryType.NORMAL);
  record.startAttempt(new Manifest('37', 'EAN', 'CODE'));
  record.complete('/fotos/LOTE 37/CODE');

  const json = record.toJSON();
  assert.strictEqual(json.status, DeliveryStatus.COMPLETED);

  const restored = DeliveryRecord.fromJSON(json);
  assert.strictEqual(restored.status, DeliveryStatus.COMPLETED);
  assert.ok(restored.completedAt);
});

test('QaPhoto - classification', () => {
  const photo = new QaPhoto('image.jpg', '/path/to/image.jpg');

  assert.strictEqual(photo.classification, null);
  assert.strictEqual(photo.classifiedAt, null);

  photo.markAsAP();
  assert.strictEqual(photo.classification, 'AP');
  assert.ok(photo.classifiedAt);

  photo.unclassify();
  assert.strictEqual(photo.classification, null);
  assert.strictEqual(photo.classifiedAt, null);
});

test('QaPhoto - switch classifications', () => {
  const photo = new QaPhoto('image.jpg', '/path');

  photo.markAsAP();
  assert.strictEqual(photo.classification, 'AP');

  photo.markAsAT();
  assert.strictEqual(photo.classification, 'AT');
});

test('DeliveryType constants', () => {
  assert.strictEqual(DeliveryType.NORMAL, 'normal');
  assert.strictEqual(DeliveryType.ATUALIZACAO, 'atualizacao');
});

test('DeliveryStatus constants', () => {
  assert.ok(DeliveryStatus.PENDING);
  assert.ok(DeliveryStatus.COMPLETED);
  assert.ok(DeliveryStatus.FAILED);
});
