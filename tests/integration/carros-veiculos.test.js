import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { applyConfigOverrides } from '../../server/config.js';
import { VehicleService } from '../../services/vehicle-service.js';

const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const DIA = '15-08-2026';

// Cada foto recebe um byte final proprio para dar para seguir o conteudo depois
// de renomear - o nome nao serve de identidade quando a ordem muda.
function bytesDaFoto(marca) {
  return Buffer.concat([JPG_BYTES, Buffer.from([marca])]);
}

async function montarOrigem(env, nomes) {
  const origem = path.join(env.root, 'cartao');
  await fs.promises.mkdir(origem, { recursive: true });

  for (let i = 0; i < nomes.length; i++) {
    const arquivo = path.join(origem, nomes[i]);
    await fs.promises.writeFile(arquivo, bytesDaFoto(i));
    // mtime crescente: e a ordem da sequencia que separa um veiculo do outro.
    const quando = new Date(2026, 7, 15, 10, i);
    await fs.promises.utimes(arquivo, quando, quando);
  }

  const scan = await VehicleService.scanFolder(origem);
  assert.equal(scan.ok, true, scan.error);
  return scan.data.fotos;
}

function pastaPlaca(env, placa) {
  return path.join(env.paths.carros, DIA, placa);
}

async function listar(env, placa) {
  return fs.promises.readdir(pastaPlaca(env, placa))
    .then(l => l.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    .catch(() => []);
}

async function marcas(env, placa) {
  const arquivos = await listar(env, placa);
  const saida = [];
  for (const nome of arquivos) {
    const buf = await fs.promises.readFile(path.join(pastaPlaca(env, placa), nome));
    saida.push(buf[buf.length - 1]);
  }
  return saida;
}

test('importar agrupa pela placa e copia para Carros/DD-MM-AAAA/PLACA', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);

  fotos[0].placa = 'ABC1234';
  fotos[2].placa = 'XYZ9K87';

  const result = await VehicleService.importarParaData(DIA, fotos);

  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.placas, 2);
  assert.equal(result.data.fotos, 4);
  assert.deepEqual(await listar(env, 'ABC1234'), ['ABC1234_0.jpg', 'ABC1234_1.jpg']);
  assert.deepEqual(await listar(env, 'XYZ9K87'), ['XYZ9K87_0.jpg', 'XYZ9K87_1.jpg']);

  // O cartao e a copia de seguranca: importar copia, nao move.
  assert.equal(await fs.promises.stat(fotos[0].path).then(() => true, () => false), true);
});

test('fotos antes da primeira placa sao devolvidas em vez de sumirem', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['solta.jpg', 'placa.jpg', 'carro.jpg']);

  fotos[1].placa = 'ABC1234';

  const result = await VehicleService.importarParaData(DIA, fotos);

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.ignoradas, ['solta.jpg']);
  assert.equal(result.data.fotos, 2);
});

test('importar sem nenhuma placa recusa em vez de criar pasta vazia', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['a.jpg', 'b.jpg']);

  const result = await VehicleService.importarParaData(DIA, fotos);

  assert.equal(result.ok, false);
  assert.match(result.error, /placa/i);
  assert.equal(await fs.promises.readdir(env.paths.carros).then(l => l.length), 0);
});

test('listar o dia le as placas do disco', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'c.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.listarPorData(DIA);

  assert.equal(result.ok, true);
  assert.equal(result.data.placas.length, 1);
  assert.equal(result.data.placas[0].placa, 'ABC1234');
  assert.equal(result.data.placas[0].total, 2);
});

test('criar placa vazia e mover para ela separa dois carros que ficaram juntos', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  // Sem a foto da placa do segundo carro, tudo cai no primeiro.
  const fotos = await montarOrigem(env, ['p.jpg', 'a1.jpg', 'b1.jpg', 'b2.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  assert.equal((await listar(env, 'ABC1234')).length, 4);

  const criada = await VehicleService.criarPlaca(DIA, 'XYZ9K87');
  assert.equal(criada.ok, true, criada.error);
  assert.deepEqual(await listar(env, 'XYZ9K87'), []);

  await VehicleService.moverFoto(DIA, 'ABC1234', 'XYZ9K87', 'ABC1234_2.jpg');
  await VehicleService.moverFoto(DIA, 'ABC1234', 'XYZ9K87', 'ABC1234_3.jpg');

  assert.deepEqual(await listar(env, 'ABC1234'), ['ABC1234_0.jpg', 'ABC1234_1.jpg']);
  // Renomeadas para a placa de destino: o nome nao pode dizer uma placa estando
  // dentro de outra.
  assert.deepEqual(await listar(env, 'XYZ9K87'), ['XYZ9K87_0.jpg', 'XYZ9K87_1.jpg']);
});

test('criar placa que ja existe nao apaga o que estava la', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'c.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.criarPlaca(DIA, 'ABC1234');

  assert.equal(result.ok, false);
  assert.match(result.error, /ja existe/i);
  assert.equal((await listar(env, 'ABC1234')).length, 2);
});

test('reordenar troca a ordem do conteudo, nao so os nomes', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  assert.deepEqual(await marcas(env, 'ABC1234'), [0, 1, 2]);

  const result = await VehicleService.reordenarFotos(DIA, 'ABC1234', [
    'ABC1234_2.jpg', 'ABC1234_0.jpg', 'ABC1234_1.jpg'
  ]);

  assert.equal(result.ok, true, result.error);
  // Os nomes continuam _0.._2; o que mudou foi qual foto esta em cada posicao.
  assert.deepEqual(await listar(env, 'ABC1234'), ['ABC1234_0.jpg', 'ABC1234_1.jpg', 'ABC1234_2.jpg']);
  assert.deepEqual(await marcas(env, 'ABC1234'), [2, 0, 1]);
});

test('reordenar recusa uma lista que nao bate com as fotos da placa', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.reordenarFotos(DIA, 'ABC1234', ['ABC1234_0.jpg']);

  assert.equal(result.ok, false);
  assert.match(result.error, /nao corresponde/i);
  assert.deepEqual(await marcas(env, 'ABC1234'), [0, 1]);
});

test('excluir tira so a foto pedida e preserva a ordem das outras', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.excluirFoto(DIA, 'ABC1234', 'ABC1234_1.jpg');

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(await marcas(env, 'ABC1234'), [0, 2]);
});

test('corrigir a placa renomeia a pasta e os arquivos', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.renomearPlaca(DIA, 'ABC1234', 'ABC1235');

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(await listar(env, 'ABC1234'), []);
  assert.deepEqual(await listar(env, 'ABC1235'), ['ABC1235_0.jpg', 'ABC1235_1.jpg']);
  assert.deepEqual(await marcas(env, 'ABC1235'), [0, 1]);
});

test('corrigir para uma placa existente junta as fotos sem sobrescrever', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  // A mesma placa digitada de dois jeitos vira duas pastas.
  const fotos = await montarOrigem(env, ['p1.jpg', 'a.jpg', 'p2.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  fotos[2].placa = 'ABC1235';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.renomearPlaca(DIA, 'ABC1235', 'ABC1234');

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(await listar(env, 'ABC1235'), []);
  // As quatro fotos, nenhuma perdida.
  assert.deepEqual(await marcas(env, 'ABC1234'), [0, 1, 2, 3]);
});

test('placa e data invalidas sao recusadas antes de mexer em pasta', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);

  const dataRuim = await VehicleService.criarPlaca('2026-08-15', 'ABC1234');
  assert.equal(dataRuim.ok, false);
  assert.match(dataRuim.error, /Data invalida/i);

  const placaRuim = await VehicleService.criarPlaca(DIA, '../fora');
  assert.equal(placaRuim.ok, false);
  assert.match(placaRuim.error, /Placa invalida/i);

  assert.equal(await fs.promises.readdir(env.paths.carros).then(l => l.length), 0);
});

test('mover foto recusa nome com caminho', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.moverFoto(DIA, 'ABC1234', 'XYZ9K87', '../ABC1234_0.jpg');

  assert.equal(result.ok, false);
  assert.match(result.error, /traversal/i);
  assert.deepEqual(await marcas(env, 'ABC1234'), [0, 1]);
});

test('navegar lista subpastas e conta as fotos da pasta atual', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);

  const raiz = path.join(env.root, 'cartao');
  const dcim = path.join(raiz, 'DCIM');
  await fs.promises.mkdir(dcim, { recursive: true });
  await fs.promises.writeFile(path.join(dcim, 'a.jpg'), bytesDaFoto(1));
  await fs.promises.writeFile(path.join(dcim, 'b.jpg'), bytesDaFoto(2));

  const naRaiz = await VehicleService.navegar(raiz);
  assert.equal(naRaiz.ok, true, naRaiz.error);
  assert.deepEqual(naRaiz.data.pastas.map(p => p.nome), ['DCIM']);
  assert.equal(naRaiz.data.fotos, 0);
  assert.equal(naRaiz.data.pai, path.dirname(raiz));

  const dentro = await VehicleService.navegar(dcim);
  assert.equal(dentro.data.fotos, 2, 'a contagem ajuda a reconhecer a pasta certa');
  assert.deepEqual(dentro.data.pastas, []);
});

test('navegar devolve erro em vez de pendurar quando a pasta nao responde', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);

  const result = await VehicleService.navegar(path.join(env.root, 'nao-existe'));

  assert.equal(result.ok, false);
  assert.match(result.error, /nao respondeu|nao encontrada|ENOENT/i);
});

test('navegar e recusado quando a LAN esta ligada', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const { config } = await import('../../server/config.js');
  const antes = config.server.lanEnabled;
  config.server.lanEnabled = true;
  t.after(() => { config.server.lanEnabled = antes; });

  const result = await VehicleService.navegar(env.root);

  assert.equal(result.ok, false);
  assert.match(result.error, /LAN/i);
});
