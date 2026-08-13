import test from 'node:test';
import assert from 'node:assert';
import { Vehicle, VehiclePhoto, VehicleBatch, PlateOcrResult } from '../../domain/vehicle.js';

test('Vehicle - normalizePlate', () => {
  assert.strictEqual(Vehicle.normalizePlate('ABC1234'), 'ABC1234');
  assert.strictEqual(Vehicle.normalizePlate('abc-1234'), 'ABC1234');
  assert.strictEqual(Vehicle.normalizePlate('  XYZ9K87  '), 'XYZ9K87');
  assert.strictEqual(Vehicle.normalizePlate('MNO-5678'), 'MNO5678');
});

test('Vehicle - create and add photos', () => {
  const vehicle = new Vehicle('37', 'ABC1234');

  assert.strictEqual(vehicle.lote, '37');
  assert.strictEqual(vehicle.placa, 'ABC1234');
  assert.strictEqual(vehicle.photos.length, 0);

  vehicle.addPhoto('plate.jpg', '/path/plate.jpg', 1);
  vehicle.addPhoto('photo2.jpg', '/path/photo2.jpg', 2);

  assert.strictEqual(vehicle.photos.length, 2);
  assert.strictEqual(vehicle.manifest.totalPhotos, 2);
});

test('Vehicle - mark plate photo', () => {
  const vehicle = new Vehicle('37', 'ABC1234');
  const photo = vehicle.addPhoto('plate.jpg', '/path/plate.jpg', 1);

  assert.strictEqual(photo.isPlatePhoto, false);
  photo.markAsPlatePhoto();
  assert.strictEqual(photo.isPlatePhoto, true);
});

test('Vehicle - set plate OCR', () => {
  const vehicle = new Vehicle('37', 'ABC1234');
  const ocr = new PlateOcrResult('ABC1234', 'ABC1234', 'old', 95);

  vehicle.setPlateOcr(ocr);

  assert.ok(vehicle.plateOcr);
  assert.strictEqual(vehicle.plateOcr.confidence, 95);
  assert.ok(vehicle.manifest.ocrData);
});

test('Vehicle - reorder photos', () => {
  const vehicle = new Vehicle('37', 'ABC1234');
  const p1 = vehicle.addPhoto('p1.jpg', '/p1', 1);
  const p2 = vehicle.addPhoto('p2.jpg', '/p2', 2);
  const p3 = vehicle.addPhoto('p3.jpg', '/p3', 3);

  vehicle.reorderPhoto(1, 3);

  // After reordering sequence 1 to position 3, sequences shift
  // Original: [1, 2, 3] -> Move 1 to position 3
  // Result after sort: [2, 3, 1] in sequence order
  assert.strictEqual(p1.sequence, 3);
  assert.strictEqual(p2.sequence, 1);
  assert.strictEqual(p3.sequence, 2);
});

test('VehicleBatch - create and add vehicles', () => {
  const batch = new VehicleBatch('37');

  const v1 = batch.getOrCreateVehicle('ABC1234');
  const v2 = batch.getOrCreateVehicle('XYZ9876');

  assert.strictEqual(v1.placa, 'ABC1234');
  assert.strictEqual(batch.getAllVehicles().length, 2);
});

test('VehicleBatch - reuse vehicle', () => {
  const batch = new VehicleBatch('37');

  const v1 = batch.getOrCreateVehicle('ABC1234');
  v1.addPhoto('p1.jpg', '/p1', 1);

  const v2 = batch.getOrCreateVehicle('ABC1234');
  assert.strictEqual(v1, v2);
  assert.strictEqual(v2.photos.length, 1);
});

test('VehicleBatch - count by status', () => {
  const batch = new VehicleBatch('37');

  const v1 = batch.getOrCreateVehicle('ABC1234');
  const v2 = batch.getOrCreateVehicle('XYZ9876');
  const v3 = batch.getOrCreateVehicle('MNO5678');

  v1.status = 'entregue';
  v2.status = 'entregue';
  v3.status = 'pendente_qa';

  assert.strictEqual(batch.countByStatus('entregue'), 2);
  assert.strictEqual(batch.countByStatus('pendente_qa'), 1);
});

test('VehicleBatch - get total photos', () => {
  const batch = new VehicleBatch('37');

  const v1 = batch.getOrCreateVehicle('ABC1234');
  v1.addPhoto('p1.jpg', '/p1', 1);
  v1.addPhoto('p2.jpg', '/p2', 2);

  const v2 = batch.getOrCreateVehicle('XYZ9876');
  v2.addPhoto('p3.jpg', '/p3', 1);

  assert.strictEqual(batch.getTotalPhotos(), 3);
});

test('PlateOcrResult - reliability', () => {
  const high = new PlateOcrResult('ABC1234', 'ABC1234', 'old', 95);
  const low = new PlateOcrResult('ABC1234', 'ABC1234', 'old', 45);

  assert.ok(high.isReliable());
  assert.ok(!low.isReliable());
});

test('Vehicle - JSON serialization', () => {
  const vehicle = new Vehicle('37', 'ABC1234');
  vehicle.addPhoto('p1.jpg', '/p1', 1);

  const json = vehicle.toJSON();
  assert.strictEqual(json.lote, '37');
  assert.strictEqual(json.placa, 'ABC1234');
  assert.strictEqual(json.photos.length, 1);

  const restored = Vehicle.fromJSON(json);
  assert.strictEqual(restored.placa, json.placa);
  assert.strictEqual(restored.photos.length, 1);
});

test('VehicleBatch - JSON serialization', () => {
  const batch = new VehicleBatch('37');
  batch.getOrCreateVehicle('ABC1234').addPhoto('p1.jpg', '/p1', 1);
  batch.getOrCreateVehicle('XYZ9876').addPhoto('p2.jpg', '/p2', 1);

  const json = batch.toJSON();
  assert.strictEqual(json.vehicles.length, 2);

  const restored = VehicleBatch.fromJSON(json);
  assert.strictEqual(restored.getAllVehicles().length, 2);
});
