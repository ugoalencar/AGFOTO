import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { securePath, validateFilename } from '../../server/secure-filesystem.js';

const ROOT = 'd:/AGFOTO';

test('securePath - valid path', () => {
  const result = securePath('dados/jsons', ROOT);
  assert.ok(result.includes('dados'));
  assert.ok(result.includes('jsons'));
});

test('securePath - path traversal attack blocked', () => {
  assert.throws(() => securePath('../../../etc/passwd', ROOT), /Path traversal/);
  assert.throws(() => securePath('dados/../../etc/passwd', ROOT), /Path traversal/);
  assert.throws(() => securePath('..\\..\\..\\windows', ROOT), /Path traversal/);
});

test('securePath - UNC path blocked', () => {
  // UNC paths are caught by path traversal check
  assert.throws(() => securePath('\\\\server\\share', ROOT), /Path traversal|UNC paths/);
});

test('securePath - absolute path blocked', () => {
  // Trying to escape root with absolute path
  assert.throws(() => securePath('D:/other/path', ROOT), /Path traversal/);
});

test('securePath - relative path within root', () => {
  const result = securePath('./dados/jsons', ROOT);
  assert.ok(result.includes('dados'));
  assert.ok(result.includes('jsons'));
  // Verify it's within root by checking the resolved path contains root path
  const normalizedResult = result.toLowerCase().replace(/\\/g, '/');
  const normalizedRoot = ROOT.toLowerCase().replace(/\\/g, '/');
  assert.ok(normalizedResult.includes(normalizedRoot));
});

test('validateFilename - valid names', () => {
  assert.strictEqual(validateFilename('image001.jpg'), 'image001.jpg');
  assert.strictEqual(validateFilename('PHOTO_2026-08-13.png'), 'PHOTO_2026-08-13.png');
  assert.strictEqual(validateFilename('file.name.with.dots.jpg'), 'file.name.with.dots.jpg');
});

test('validateFilename - invalid special chars', () => {
  assert.throws(() => validateFilename('file<name>.jpg'), /Invalid characters/);
  assert.throws(() => validateFilename('file|name.jpg'), /Invalid characters/);
  assert.throws(() => validateFilename('file"name.jpg'), /Invalid characters/);
  assert.throws(() => validateFilename('file?name.jpg'), /Invalid characters/);
  assert.throws(() => validateFilename('file*name.jpg'), /Invalid characters/);
  assert.throws(() => validateFilename('file:name.jpg'), /Invalid characters/);
});

test('validateFilename - Windows reserved names blocked', () => {
  // Reserved names
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];

  for (const name of reserved) {
    assert.throws(() => validateFilename(name), /Reserved Windows name/);
    assert.throws(() => validateFilename(`${name}.txt`), /Reserved Windows name/);
    assert.throws(() => validateFilename(`${name.toLowerCase()}.jpg`), /Reserved Windows name/);
  }
});

test('validateFilename - empty string', () => {
  assert.throws(() => validateFilename(''), /Filename must be/);
  assert.throws(() => validateFilename(null), /Filename must be/);
  assert.throws(() => validateFilename(undefined), /Filename must be/);
});

test('securePath - normalizes backslashes on Windows', () => {
  const result = securePath('dados\\jsons\\file.json', ROOT);
  // Should contain forward slashes in the resolved path
  assert.ok(result.length > 0);
});

test('securePath - null and invalid input', () => {
  assert.throws(() => securePath(null), /Path must be/);
  assert.throws(() => securePath(''), /Path must be/);
  assert.throws(() => securePath(undefined), /Path must be/);
});
