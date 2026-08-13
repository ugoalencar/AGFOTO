import test from 'node:test';
import assert from 'node:assert';
import { MockAdsetProvider } from '../../services/adset-provider.js';

test('MockAdsetProvider - login success', async () => {
  const provider = new MockAdsetProvider();
  const result = await provider.login('test@example.com', 'password123');

  assert.ok(result.ok);
  assert.ok(result.sessionId);
  assert.ok(result.sessionId.startsWith('MOCK_SESSION_'));
});

test('MockAdsetProvider - login fails with missing credentials', async () => {
  const provider = new MockAdsetProvider();
  const result = await provider.login('', 'password');

  assert.ok(!result.ok);
  assert.ok(result.error);
});

test('MockAdsetProvider - fetch published vehicles', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');
  const result = await provider.fetchPublished(login.sessionId);

  assert.ok(result.ok);
  assert.ok(Array.isArray(result.published));
  assert.strictEqual(result.published.length, 0); // Começa vazio
});

test('MockAdsetProvider - fetch unpublished vehicles', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');
  const result = await provider.fetchUnpublished(login.sessionId);

  assert.ok(result.ok);
  assert.ok(Array.isArray(result.unpublished));
});

test('MockAdsetProvider - validate plate unique (new)', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');
  const result = await provider.validatePlateUnique(login.sessionId, 'ABC1234');

  assert.ok(result.ok);
  assert.ok(result.unique);
  assert.strictEqual(result.existing, null);
});

test('MockAdsetProvider - submit vehicle', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');

  const vehicle = {
    placa: 'XYZ9876',
    fotos: [
      { filename: 'photo1.jpg', path: '/path/photo1.jpg' },
      { filename: 'photo2.jpg', path: '/path/photo2.jpg' }
    ]
  };

  const result = await provider.submitVehicle(login.sessionId, vehicle);

  assert.ok(result.ok);
  assert.ok(result.vehicleId);
  assert.ok(result.message.includes('XYZ9876'));
  assert.strictEqual(result.status, 'Rascunho');
});

test('MockAdsetProvider - plate becomes not unique after submit', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');

  const vehicle = {
    placa: 'MNO5678',
    fotos: []
  };

  // Primeiro submit
  const submit1 = await provider.submitVehicle(login.sessionId, vehicle);
  assert.ok(submit1.ok);

  // Validação após submit
  const validate = await provider.validatePlateUnique(login.sessionId, 'MNO5678');
  assert.ok(validate.ok);
  assert.ok(!validate.unique); // Agora existe
});

test('MockAdsetProvider - reject duplicate submit', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');

  const vehicle = {
    placa: 'JKL1234',
    fotos: []
  };

  // Primeiro submit
  await provider.submitVehicle(login.sessionId, vehicle);

  // Tentativa de novo submit com mesma placa
  const submit2 = await provider.submitVehicle(login.sessionId, vehicle);
  assert.ok(!submit2.ok);
  assert.ok(submit2.error.includes('already exists'));
});

test('MockAdsetProvider - logout', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');
  const logout = await provider.logout(login.sessionId);

  assert.ok(logout.ok);
});

test('MockAdsetProvider - invalid session on operations', async () => {
  const provider = new MockAdsetProvider();
  const invalidSession = 'INVALID_SESSION_123';

  const result = await provider.fetchPublished(invalidSession);
  assert.ok(!result.ok);
  assert.ok(result.error.includes('Invalid session'));
});

test('MockAdsetProvider - plate normalization', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');

  // Submit com lowercase
  const submit = await provider.submitVehicle(login.sessionId, {
    placa: 'abc1234',
    fotos: []
  });

  assert.ok(submit.ok);

  // Validate com uppercase
  const validate = await provider.validatePlateUnique(login.sessionId, 'ABC1234');
  assert.ok(!validate.unique); // Deve encontrar como existente (normalizado)
});

test('MockAdsetProvider - multiple sessions', async () => {
  const provider = new MockAdsetProvider();

  const session1 = await provider.login('user1@example.com', 'pass1');
  const session2 = await provider.login('user2@example.com', 'pass2');

  assert.ok(session1.ok);
  assert.ok(session2.ok);
  assert.notStrictEqual(session1.sessionId, session2.sessionId);

  // Cada sessão tem seu próprio espaço
  await provider.submitVehicle(session1.sessionId, { placa: 'AAA1111', fotos: [] });

  const validate1 = await provider.validatePlateUnique(session1.sessionId, 'AAA1111');
  assert.ok(!validate1.unique);

  // Session 2 vê a mesma placa (compartilhado)
  const validate2 = await provider.validatePlateUnique(session2.sessionId, 'AAA1111');
  assert.ok(!validate2.unique);
});

test('MockAdsetProvider - fetch published after submit', async () => {
  const provider = new MockAdsetProvider();
  const login = await provider.login('test@example.com', 'pass');

  // Simula movimentação de rascunho para publicado
  const vehicle = {
    placa: 'DEF9012',
    fotos: [{ filename: 'photo.jpg', path: '/path/photo.jpg' }]
  };

  await provider.submitVehicle(login.sessionId, vehicle);

  // Verifica se consta em rascunhos
  const unpublished = await provider.fetchUnpublished(login.sessionId);
  const draftVehicle = unpublished.unpublished.find(v => v.placa === 'DEF9012');
  assert.ok(draftVehicle);
  assert.strictEqual(draftVehicle.status, 'Rascunho');
});
