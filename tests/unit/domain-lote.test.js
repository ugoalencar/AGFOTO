import test from 'node:test';
import assert from 'node:assert';
import { Lote, Produto } from '../../domain/lote.js';
import { ProductStatus } from '../../domain/status.js';

test('Lote - normalize number', () => {
  assert.strictEqual(Lote.normalize('37'), '37');
  assert.strictEqual(Lote.normalize('  37  '), '37');
  assert.throws(() => Lote.normalize(''), /Lote number must be/);
  assert.throws(() => Lote.normalize(null), /Lote number must be/);
});

test('Lote - validate number', () => {
  assert.ok(Lote.isValid('37'));
  assert.ok(Lote.isValid('LOTE-2026-08-13'));
  assert.ok(!Lote.isValid(''));
  assert.ok(!Lote.isValid(null));
  assert.ok(!Lote.isValid('a'.repeat(51))); // Too long
  assert.ok(!Lote.isValid('lote<>invalid'));
});

test('Lote - create and add items', () => {
  const lote = new Lote('37');
  assert.strictEqual(lote.numero, '37');
  assert.ok(lote.criadoEm);
  assert.deepStrictEqual(lote.itens, {});

  const produto = lote.getOrCreateItem('07890000000001', 'CODIGO_123', 'Produto');
  assert.ok(produto);
  assert.strictEqual(produto.gtin, '07890000000001');
  assert.strictEqual(produto.codigo, 'CODIGO_123');

  // Getting same item again returns same object
  const produto2 = lote.getOrCreateItem('07890000000001', 'OTHER_CODE', 'Other');
  assert.strictEqual(produto2, produto);
  assert.strictEqual(produto2.codigo, 'CODIGO_123'); // Not updated
});

test('Lote - getAllGtins', () => {
  const lote = new Lote('37');
  lote.getOrCreateItem('07890000000001', 'CODE1', 'Desc1');
  lote.getOrCreateItem('07890000000002', 'CODE2', 'Desc2');

  const gtins = lote.getAllGtins();
  assert.strictEqual(gtins.length, 2);
  assert.ok(gtins.includes('07890000000001'));
  assert.ok(gtins.includes('07890000000002'));
});

test('Lote - countByStatus', () => {
  const lote = new Lote('37');
  const p1 = lote.getOrCreateItem('GTI1', 'C1', 'D1');
  const p2 = lote.getOrCreateItem('GTI2', 'C2', 'D2');
  const p3 = lote.getOrCreateItem('GTI3', 'C3', 'D3');

  p1.status = ProductStatus.ENTREGUE;
  p2.status = ProductStatus.ENTREGUE;
  p3.status = ProductStatus.PENDENTE_QA;

  assert.strictEqual(lote.countByStatus(ProductStatus.ENTREGUE), 2);
  assert.strictEqual(lote.countByStatus(ProductStatus.PENDENTE_QA), 1);
});

test('Produto - normalize GTIN', () => {
  assert.strictEqual(Produto.normalize('07890000000001'), '07890000000001');
  assert.strictEqual(Produto.normalize('  12345678  '), '12345678');
  assert.throws(() => Produto.normalize(''), /GTIN/);
  assert.throws(() => Produto.normalize(null), /GTIN/);
});

test('Produto - validate GTIN', () => {
  // Valid lengths: 8, 12, 13, 14
  assert.ok(Produto.isValid('12345678')); // 8
  assert.ok(Produto.isValid('123456789012')); // 12
  assert.ok(Produto.isValid('1234567890123')); // 13
  assert.ok(Produto.isValid('12345678901234')); // 14

  // Invalid
  assert.ok(!Produto.isValid('123')); // Too short
  assert.ok(!Produto.isValid('123456789012345')); // Too long
  assert.ok(!Produto.isValid('ABCD1234')); // Non-numeric
  assert.ok(!Produto.isValid('')); // Empty
});

test('Produto - preserve leading zeros in GTIN', () => {
  const produto = new Produto('07890000000001');
  assert.strictEqual(produto.gtin, '07890000000001');
  assert.strictEqual(produto.gtin[0], '0'); // Preserved!
});

test('Produto - initial status', () => {
  const produto = new Produto('12345678', 'CODE', 'Desc');
  assert.strictEqual(produto.status, ProductStatus.EM_CAPTURA);
});

test('Produto - markCaptureSaved', () => {
  const produto = new Produto('12345678');
  produto.markCaptureSaved(5);

  assert.strictEqual(produto.status, ProductStatus.PENDENTE_QA);
  assert.strictEqual(produto.quantidadeFotos, 5);
  assert.ok(produto.dataFotografia);

  // Histórico registrado (foto_count_updated + captura_salva)
  assert.strictEqual(produto.historico.length, 2);
  assert.strictEqual(produto.historico[0].evento, 'foto_count_updated');
  assert.strictEqual(produto.historico[1].evento, 'captura_salva');
  assert.strictEqual(produto.historico[1].detalhes.quantidadeFotos, 5);
});

test('Produto - JSON serialization', () => {
  const produto = new Produto('12345678', 'CODE', 'Desc');
  produto.markCaptureSaved(3);

  const json = produto.toJSON();
  assert.strictEqual(json.gtin, '12345678');
  assert.strictEqual(json.codigo, 'CODE');
  assert.strictEqual(json.status, ProductStatus.PENDENTE_QA);
  assert.strictEqual(json.quantidadeFotos, 3);
});

test('Produto - JSON deserialization', () => {
  const original = new Produto('12345678', 'CODE', 'Desc');
  original.markCaptureSaved(3);

  const json = original.toJSON();
  const restored = Produto.fromJSON(json);

  assert.strictEqual(restored.gtin, original.gtin);
  assert.strictEqual(restored.codigo, original.codigo);
  assert.strictEqual(restored.status, original.status);
  assert.strictEqual(restored.quantidadeFotos, original.quantidadeFotos);
  assert.strictEqual(restored.historico.length, original.historico.length);
});

test('Lote - JSON serialization and deserialization', () => {
  const lote = new Lote('37');
  const p1 = lote.getOrCreateItem('GTI1', 'C1', 'D1');
  p1.markCaptureSaved(3);

  const json = lote.toJSON();
  assert.strictEqual(json.schemaVersion, 1);
  assert.strictEqual(json.lote, '37');

  const restored = Lote.fromJSON(json);
  assert.strictEqual(restored.numero, '37');
  assert.strictEqual(restored.getAllGtins().length, 1);

  const restoredP1 = restored.itens['GTI1'];
  assert.strictEqual(restoredP1.status, ProductStatus.PENDENTE_QA);
  assert.strictEqual(restoredP1.quantidadeFotos, 3);
});
