import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LoteRepository from '../../repositories/lote-repository.js';
import { Lote, Produto } from '../../domain/lote.js';
import { ProductStatus } from '../../domain/status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = path.join(__dirname, '../..', '.test-data');

// Cleanup before and after
async function cleanup() {
  try {
    await fs.promises.rm(path.join(TEST_ROOT, 'dados'), { recursive: true, force: true });
    await fs.promises.rm(path.join(TEST_ROOT, 'Finalizadas'), { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

test('Integration - Load or create lote', async () => {
  await cleanup();

  const lote = await LoteRepository.loadOrCreate('TEST-001');
  assert.strictEqual(lote.numero, 'TEST-001');
  assert.ok(lote.criadoEm);
  assert.deepStrictEqual(lote.itens, {});
});

test('Integration - Add produto to lote', async () => {
  await cleanup();

  const lote = await LoteRepository.loadOrCreate('TEST-002');
  const produto = lote.getOrCreateItem('07890000000001', 'CODE123', 'Produto Teste');

  assert.strictEqual(produto.gtin, '07890000000001');
  assert.strictEqual(produto.codigo, 'CODE123');
  assert.strictEqual(produto.status, ProductStatus.EM_CAPTURA);

  // Marca como captura salva
  produto.markCaptureSaved(5);
  assert.strictEqual(produto.status, ProductStatus.PENDENTE_QA);
  assert.strictEqual(produto.quantidadeFotos, 5);

  // Salva lote
  await LoteRepository.save(lote);

  // Recarrega e valida
  const loaded = await LoteRepository.load('TEST-002');
  const loadedProduto = loaded.itens['07890000000001'];

  assert.strictEqual(loadedProduto.status, ProductStatus.PENDENTE_QA);
  assert.strictEqual(loadedProduto.quantidadeFotos, 5);
  assert.strictEqual(loadedProduto.historico.length, 1);
});

test('Integration - Multiple produtos in same lote', async () => {
  await cleanup();

  const lote = await LoteRepository.loadOrCreate('TEST-003');

  // Adiciona 3 produtos
  lote.getOrCreateItem('GTI1', 'CODE1', 'Produto 1').markCaptureSaved(3);
  lote.getOrCreateItem('GTI2', 'CODE2', 'Produto 2').markCaptureSaved(4);
  lote.getOrCreateItem('GTI3', 'CODE3', 'Produto 3').markCaptureSaved(2);

  await LoteRepository.save(lote);

  // Recarrega
  const loaded = await LoteRepository.load('TEST-003');
  assert.strictEqual(loaded.getAllGtins().length, 3);
  assert.strictEqual(loaded.getTotalPhotos(), 9);
  assert.strictEqual(loaded.countByStatus(ProductStatus.PENDENTE_QA), 3);
});

test('Integration - Append to existing lote', async () => {
  await cleanup();

  // Cria lote com 1 produto
  const lote1 = await LoteRepository.loadOrCreate('TEST-004');
  lote1.getOrCreateItem('GTI1', 'CODE1', 'Produto 1').markCaptureSaved(2);
  await LoteRepository.save(lote1);

  // Carrega novamente e adiciona outro
  const lote2 = await LoteRepository.load('TEST-004');
  lote2.getOrCreateItem('GTI2', 'CODE2', 'Produto 2').markCaptureSaved(3);
  await LoteRepository.save(lote2);

  // Recarrega e valida ambos
  const loaded = await LoteRepository.load('TEST-004');
  assert.strictEqual(loaded.getAllGtins().length, 2);
  assert.strictEqual(loaded.getTotalPhotos(), 5);
});

test('Integration - Lote history events', async () => {
  await cleanup();

  const lote = await LoteRepository.loadOrCreate('TEST-005');
  const produto = lote.getOrCreateItem('GTI1', 'CODE1', 'Produto');

  // Registra múltiplos eventos
  produto.markCaptureSaved(2);
  produto.addHistoricoEvent('custom_event', { detail: 'value' });

  await LoteRepository.save(lote);

  const loaded = await LoteRepository.load('TEST-005');
  const loadedProduto = loaded.itens['GTI1'];

  assert.strictEqual(loadedProduto.historico.length, 2);
  assert.strictEqual(loadedProduto.historico[0].evento, 'captura_salva');
  assert.strictEqual(loadedProduto.historico[1].evento, 'custom_event');
  assert.strictEqual(loadedProduto.historico[1].detalhes.detail, 'value');
});

test('Integration - List all lotes', async () => {
  await cleanup();

  // Cria 3 lotes
  for (let i = 1; i <= 3; i++) {
    const lote = await LoteRepository.loadOrCreate(`BATCH-${i}`);
    lote.getOrCreateItem(`GTI${i}`, `CODE${i}`, `Produto ${i}`).markCaptureSaved(i);
    await LoteRepository.save(lote);
  }

  // Lista
  const lotes = await LoteRepository.listAll();
  assert.strictEqual(lotes.length, 3);

  // Valida ordem alfabética
  assert.strictEqual(lotes[0].numero, 'BATCH-1');
  assert.strictEqual(lotes[1].numero, 'BATCH-2');
  assert.strictEqual(lotes[2].numero, 'BATCH-3');
});

test('Integration - Lote exists check', async () => {
  await cleanup();

  assert.ok(!await LoteRepository.exists('NONEXISTENT'));

  await LoteRepository.loadOrCreate('EXISTS-001');
  assert.ok(await LoteRepository.exists('EXISTS-001'));
});

// Cleanup after all tests
test('cleanup', async () => {
  await cleanup();
});
