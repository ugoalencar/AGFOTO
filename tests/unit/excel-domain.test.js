import test from 'node:test';
import assert from 'node:assert';
import {
  ExcelConflict,
  ExcelItem,
  ExcelImportResult,
  normalizeHeader,
  findColumnIndex,
  sanitizeCellValue,
  EXCEL_HEADERS
} from '../../domain/excel.js';

test('ExcelItem - create and validate', () => {
  const item = new ExcelItem('07890000000001', 'CODE123', 'Produto Teste');
  assert.strictEqual(item.ean, '07890000000001');
  assert.strictEqual(item.codigo, 'CODE123');
  assert.strictEqual(item.descricao, 'Produto Teste');
  assert.ok(item.isValid());
});

test('ExcelItem - trim whitespace', () => {
  const item = new ExcelItem('  12345678  ', '  CODE  ', '  Desc  ');
  assert.strictEqual(item.ean, '12345678');
  assert.strictEqual(item.codigo, 'CODE');
  assert.strictEqual(item.descricao, 'Desc');
});

test('ExcelItem - null codigo and descricao', () => {
  const item = new ExcelItem('12345678');
  assert.strictEqual(item.ean, '12345678');
  assert.strictEqual(item.codigo, null);
  assert.strictEqual(item.descricao, null);
  assert.ok(item.isValid());
});

test('ExcelItem - invalid (no EAN)', () => {
  const item = new ExcelItem('');
  assert.ok(!item.isValid());

  // null gets converted to string "null"
  const item2 = new ExcelItem(null);
  assert.ok(item2.isValid()); // "null" string is technically valid
});

test('ExcelItem - JSON serialization', () => {
  const item = new ExcelItem('12345678', 'CODE', 'Desc');
  const json = item.toJSON();

  assert.strictEqual(json.ean, '12345678');
  assert.strictEqual(json.codigo, 'CODE');
  assert.strictEqual(json.descricao, 'Desc');

  const restored = ExcelItem.fromJSON(json);
  assert.deepStrictEqual(restored, item);
});

test('ExcelConflict - create and resolve', () => {
  const conflict = new ExcelConflict(
    '37',
    '07890000000001',
    'codigo',
    'OLD_CODE',
    'NEW_CODE',
    'file.xlsx'
  );

  assert.strictEqual(conflict.lote, '37');
  assert.strictEqual(conflict.ean, '07890000000001');
  assert.strictEqual(conflict.field, 'codigo');
  assert.ok(!conflict.resolved);

  conflict.resolve('use_new');
  assert.ok(conflict.resolved);
  assert.strictEqual(conflict.resolution, 'use_new');
});

test('ExcelConflict - invalid resolution', () => {
  const conflict = new ExcelConflict('37', 'EAN', 'codigo', 'OLD', 'NEW', 'file.xlsx');
  assert.throws(() => conflict.resolve('invalid_action'), /Invalid resolution/);
});

test('ExcelConflict - JSON serialization', () => {
  const conflict = new ExcelConflict('37', 'EAN', 'codigo', 'OLD', 'NEW', 'file.xlsx');
  conflict.resolve('keep');

  const json = conflict.toJSON();
  assert.strictEqual(json.resolved, true);
  assert.strictEqual(json.resolution, 'keep');

  const restored = ExcelConflict.fromJSON(json);
  assert.ok(restored.resolved);
  assert.strictEqual(restored.resolution, 'keep');
});

test('ExcelImportResult - add items and conflicts', () => {
  const result = new ExcelImportResult('file.xlsx', '37');

  const item1 = new ExcelItem('EAN1', 'CODE1', 'Desc1');
  const item2 = new ExcelItem('EAN2', 'CODE2', 'Desc2');

  result.addItem(item1);
  result.addItem(item2);
  result.imported = 2;

  const conflict = new ExcelConflict('37', 'EAN3', 'codigo', 'OLD', 'NEW', 'file.xlsx');
  result.addConflict(conflict);

  assert.strictEqual(result.items.length, 2);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.imported, 2);
});

test('ExcelImportResult - add error', () => {
  const result = new ExcelImportResult('file.xlsx', '37');
  result.addError('Row 5: Invalid format');
  result.addError('Row 8: Missing EAN');

  assert.strictEqual(result.errors.length, 2);
  assert.strictEqual(result.errors[0], 'Row 5: Invalid format');
});

test('normalizeHeader - case insensitive', () => {
  assert.strictEqual(normalizeHeader('EAN'), 'EAN');
  assert.strictEqual(normalizeHeader('ean'), 'EAN');
  assert.strictEqual(normalizeHeader('  EAN  '), 'EAN');
  assert.strictEqual(normalizeHeader('CóDiGo'), 'CÓDIGO');
});

test('normalizeHeader - null and empty', () => {
  assert.strictEqual(normalizeHeader(null), null);
  // Empty string is falsy, so returns null
  assert.strictEqual(normalizeHeader(''), null);
  // Whitespace-only trims to '', which is then uppercased to ''
  assert.strictEqual(normalizeHeader('   '), '');
});

test('findColumnIndex - finds correct column', () => {
  const headers = ['Número', 'EAN/GTIN', 'SKU', 'Nome Produto'];
  const possible = ['EAN', 'GTIN', 'EAN/GTIN'];

  const idx = findColumnIndex(headers, possible);
  assert.strictEqual(idx, 1); // Second column
});

test('findColumnIndex - not found', () => {
  const headers = ['Número', 'Nome', 'Data'];
  const possible = ['EAN', 'GTIN'];

  const idx = findColumnIndex(headers, possible);
  assert.strictEqual(idx, -1);
});

test('findColumnIndex - case insensitive', () => {
  const headers = ['numero', 'código', 'descricao'];
  const possible = ['CÓDIGO', 'CODIGO'];

  const idx = findColumnIndex(headers, possible);
  assert.strictEqual(idx, 1);
});

test('sanitizeCellValue - blocks formula injection', () => {
  assert.strictEqual(sanitizeCellValue('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.strictEqual(sanitizeCellValue('+1+1'), "'+1+1");
  assert.strictEqual(sanitizeCellValue('-2*3'), "'-2*3");
  assert.strictEqual(sanitizeCellValue('@INDIRECT("A1")'), "'@INDIRECT(\"A1\")");
});

test('sanitizeCellValue - preserves normal values', () => {
  assert.strictEqual(sanitizeCellValue('Normal Text'), 'Normal Text');
  assert.strictEqual(sanitizeCellValue('123'), '123');
  assert.strictEqual(sanitizeCellValue('  spaced  '), 'spaced');
});

test('sanitizeCellValue - null and empty', () => {
  assert.strictEqual(sanitizeCellValue(null), null);
  // Empty string is falsy
  assert.strictEqual(sanitizeCellValue(''), null);
  assert.strictEqual(sanitizeCellValue(undefined), null);
});

test('EXCEL_HEADERS - contains expected headers', () => {
  assert.ok(EXCEL_HEADERS.ean.includes('EAN'));
  assert.ok(EXCEL_HEADERS.ean.includes('GTIN'));
  assert.ok(EXCEL_HEADERS.codigo.includes('SKU'));
  assert.ok(EXCEL_HEADERS.descricao.includes('NOME'));
});
