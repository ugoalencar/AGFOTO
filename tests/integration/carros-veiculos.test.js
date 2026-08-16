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
  // Recomeca a pasta: chamar duas vezes no mesmo teste (simulando um segundo
  // cartao) nao pode devolver as fotos da primeira junto.
  await fs.promises.rm(origem, { recursive: true, force: true });
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

// --- Duas etapas: organizar aqui, editar fora, voltar para QA e entrega -----

test('placa nasce organizada e o QA a torna pronta para entrega', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const recemImportada = await VehicleService.listarPorData(DIA);
  assert.equal(recemImportada.data.placas[0].status, 'organizado');

  const aprovada = await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  assert.equal(aprovada.ok, true, aprovada.error);
  assert.equal(aprovada.data.status, 'pronto_para_entrega');

  const depois = await VehicleService.listarPorData(DIA);
  assert.equal(depois.data.placas[0].status, 'pronto_para_entrega');
  assert.ok(depois.data.placas[0].aprovadoEm);
});

test('entrega e recusada enquanto a placa nao passou pelo QA', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const semQa = await VehicleService.entregarPlaca(DIA, 'ABC1234');

  assert.equal(semQa.ok, false);
  assert.match(semQa.error, /QA/i);

  await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  const comQa = await VehicleService.entregarPlaca(DIA, 'ABC1234');
  assert.equal(comQa.ok, true, comQa.error);
  assert.equal(comQa.data.status, 'entregue');
});

test('reabrir devolve a placa para organizada e bloqueia a entrega de novo', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');

  const reaberta = await VehicleService.reabrirPlaca(DIA, 'ABC1234');
  assert.equal(reaberta.data.status, 'organizado');

  const entrega = await VehicleService.entregarPlaca(DIA, 'ABC1234');
  assert.equal(entrega.ok, false);
});

test('aprovar recusa placa sem foto nenhuma', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await VehicleService.criarPlaca(DIA, 'ABC1234');

  const result = await VehicleService.aprovarPlaca(DIA, 'ABC1234');

  assert.equal(result.ok, false);
  assert.match(result.error, /sem fotos/i);
});

test('relatorio soma placas e fotos por situacao, entre dias', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);

  const fotos = await montarOrigem(env, ['p1.jpg', 'a.jpg', 'p2.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  fotos[2].placa = 'XYZ9K87';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  await VehicleService.entregarPlaca(DIA, 'ABC1234');

  const geral = await VehicleService.relatorio();

  assert.equal(geral.ok, true, geral.error);
  assert.equal(geral.data.resumo.placas, 2);
  assert.equal(geral.data.resumo.fotos, 4);
  assert.equal(geral.data.resumo.entregues, 1);
  assert.equal(geral.data.resumo.organizadas, 1);

  const soEntregues = await VehicleService.relatorio({ status: 'entregue' });
  assert.deepEqual(soEntregues.data.itens.map(i => i.placa), ['ABC1234']);
  assert.ok(soEntregues.data.itens[0].entregueEm);
});

test('a situacao sobrevive a releitura do disco', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');

  // O disco diz quais placas existem; o JSON do dia diz em que ponto elas estao.
  const json = path.join(env.paths.jsons, `Carros_${DIA}.json`);
  assert.equal(await fs.promises.stat(json).then(() => true, () => false), true);

  const relido = await VehicleService.listarPorData(DIA);
  assert.equal(relido.data.placas[0].status, 'pronto_para_entrega');
});

// --- Ordem pela hora do disparo (EXIF) -------------------------------------

// JPEG minimo com DateTimeOriginal, montado na mao para nao trazer dependencia
// so para o teste.
function jpegComExif(dataStr, marca) {
  const valor = Buffer.concat([Buffer.from(dataStr, 'ascii'), Buffer.from([0])]);

  const tiff = Buffer.alloc(8 + 18 + 18 + valor.length);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(0x2a, 2);
  tiff.writeUInt32LE(8, 4);

  // IFD0: ponteiro para o Exif IFD
  let o = 8;
  tiff.writeUInt16LE(1, o); o += 2;
  tiff.writeUInt16LE(0x8769, o); tiff.writeUInt16LE(4, o + 2);
  tiff.writeUInt32LE(1, o + 4); tiff.writeUInt32LE(26, o + 8); o += 12;
  tiff.writeUInt32LE(0, o); o += 4;

  // Exif IFD: DateTimeOriginal
  tiff.writeUInt16LE(1, o); o += 2;
  tiff.writeUInt16LE(0x9003, o); tiff.writeUInt16LE(2, o + 2);
  tiff.writeUInt32LE(valor.length, o + 4); tiff.writeUInt32LE(44, o + 8); o += 12;
  tiff.writeUInt32LE(0, o); o += 4;
  valor.copy(tiff, o);

  const corpo = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.alloc(2), corpo]);
  app1.writeUInt16BE(corpo.length + 2, 2);

  // SOI + APP1 + assinatura JFIF que a validacao aceita + marca de conteudo
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app1,
    Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.from([marca])
  ]);
}

test('a sequencia segue a hora do disparo, nao o nome nem a data do arquivo', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const origem = path.join(env.root, 'cartao-exif');
  await fs.promises.mkdir(origem, { recursive: true });

  // Nomes fora de ordem e mtime invertido: so o EXIF esta certo.
  const fotos = [
    ['IMG_900.jpg', '2026:08:15 09:00:00', 1],
    ['IMG_100.jpg', '2026:08:15 09:01:00', 2],
    ['IMG_500.jpg', '2026:08:15 09:02:00', 3]
  ];
  for (let i = 0; i < fotos.length; i++) {
    const [nome, quando, marca] = fotos[i];
    const arquivo = path.join(origem, nome);
    await fs.promises.writeFile(arquivo, jpegComExif(quando, marca));
    const mtime = new Date(2026, 7, 15, 20, fotos.length - i); // ordem inversa
    await fs.promises.utimes(arquivo, mtime, mtime);
  }

  const scan = await VehicleService.scanFolder(origem);

  assert.equal(scan.ok, true, scan.error);
  assert.deepEqual(scan.data.fotos.map(f => f.name), ['IMG_900.jpg', 'IMG_100.jpg', 'IMG_500.jpg']);
  assert.equal(scan.data.semExif, 0);
  assert.ok(scan.data.fotos.every(f => f.origemDaHora === 'exif'));
});

test('sem EXIF a hora cai para a do arquivo e a tela e avisada', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const origem = path.join(env.root, 'cartao-sem-exif');
  await fs.promises.mkdir(origem, { recursive: true });

  for (let i = 0; i < 2; i++) {
    const arquivo = path.join(origem, `foto${i}.jpg`);
    await fs.promises.writeFile(arquivo, bytesDaFoto(i));
    const quando = new Date(2026, 7, 15, 10, i);
    await fs.promises.utimes(arquivo, quando, quando);
  }

  const scan = await VehicleService.scanFolder(origem);

  assert.equal(scan.data.semExif, 2);
  assert.ok(scan.data.fotos.every(f => f.origemDaHora === 'arquivo'));
  assert.deepEqual(scan.data.fotos.map(f => f.name), ['foto0.jpg', 'foto1.jpg']);
});

// --- Carro sem placa reconhecida -------------------------------------------

test('carro sem placa vai para NAO-RECONHECIDO em vez de ficar sem destino', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'x.jpg', 'y.jpg']);

  fotos[0].placa = 'ABC1234';
  fotos[2].placa = '?'; // a tela diz "aqui comeca um carro", sem saber a placa

  const result = await VehicleService.importarParaData(DIA, fotos);

  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.placas, 2);
  assert.deepEqual(result.data.naoReconhecidas, ['NAO-RECONHECIDO']);
  assert.deepEqual(await listar(env, 'ABC1234'), ['ABC1234_0.jpg', 'ABC1234_1.jpg']);
  assert.deepEqual(await listar(env, 'NAO-RECONHECIDO'),
    ['NAO-RECONHECIDO_0.jpg', 'NAO-RECONHECIDO_1.jpg']);
});

test('dois carros sem placa no mesmo dia nao caem na mesma pasta', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);

  fotos[0].placa = '?';
  fotos[2].placa = '?';

  const result = await VehicleService.importarParaData(DIA, fotos);

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.data.naoReconhecidas, ['NAO-RECONHECIDO', 'NAO-RECONHECIDO-2']);
  assert.equal((await listar(env, 'NAO-RECONHECIDO')).length, 2);
  assert.equal((await listar(env, 'NAO-RECONHECIDO-2')).length, 2);
});

test('uma segunda importacao nao mistura com o nao reconhecido da primeira', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);

  const primeira = await montarOrigem(env, ['a.jpg', 'b.jpg']);
  primeira[0].placa = '?';
  await VehicleService.importarParaData(DIA, primeira);

  const segunda = await montarOrigem(env, ['c.jpg', 'd.jpg']);
  segunda[0].placa = '?';
  await VehicleService.importarParaData(DIA, segunda);

  assert.equal((await listar(env, 'NAO-RECONHECIDO')).length, 2);
  assert.equal((await listar(env, 'NAO-RECONHECIDO-2')).length, 2);
});

test('o QA renomeia a pasta nao reconhecida para a placa certa', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['a.jpg', 'b.jpg']);
  fotos[0].placa = '?';
  await VehicleService.importarParaData(DIA, fotos);

  const result = await VehicleService.renomearPlaca(DIA, 'NAO-RECONHECIDO', 'ABC1234');

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(await listar(env, 'NAO-RECONHECIDO'), []);
  assert.deepEqual(await listar(env, 'ABC1234'), ['ABC1234_0.jpg', 'ABC1234_1.jpg']);
});

test('a url da foto muda quando o conteudo muda, para o navegador nao mostrar o cache', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const antes = (await VehicleService.listarPorData(DIA)).data.placas[0].fotos;
  // Reordenar troca o conteudo mantendo os nomes: sem versao na url o navegador
  // reexibiria a imagem antiga e a tela pareceria nao reagir.
  assert.ok(antes.every(f => /\?v=\d+-\d+$/.test(f.url)), `url sem versao: ${antes[0].url}`);

  await VehicleService.reordenarFotos(DIA, 'ABC1234', [
    'ABC1234_2.jpg', 'ABC1234_0.jpg', 'ABC1234_1.jpg'
  ]);

  const depois = (await VehicleService.listarPorData(DIA)).data.placas[0].fotos;

  assert.deepEqual(depois.map(f => f.name), antes.map(f => f.name), 'os nomes seguem iguais');
  assert.notDeepEqual(
    depois.map(f => f.url), antes.map(f => f.url),
    'a url precisa mudar quando a foto daquela posicao muda'
  );
});

test('a url so muda quando a foto daquela posicao muda', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  const primeira = (await VehicleService.listarPorData(DIA)).data.placas[0].fotos;
  const segunda = (await VehicleService.listarPorData(DIA)).data.placas[0].fotos;

  // Duas leituras seguidas sem alteracao devolvem a mesma url: a versao nao pode
  // mudar a toa, senao o navegador rebaixaria toda foto a cada abertura de tela.
  assert.deepEqual(segunda.map(f => f.url), primeira.map(f => f.url));
});

async function entregues(env, placa) {
  const dir = path.join(env.paths.entrega, DIA, placa);
  const arquivos = await fs.promises.readdir(dir)
    .then(l => l.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    .catch(() => []);

  const marcas = [];
  for (const nome of arquivos) {
    const buf = await fs.promises.readFile(path.join(dir, nome));
    marcas.push(buf[buf.length - 1]);
  }
  return { arquivos, marcas };
}

test('entregar copia as fotos para Entrega/DD-MM-AAAA/PLACA na ordem do QA', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  // A ordem escolhida no QA e a que o ADSET recebe: a primeira foto vira a capa.
  await VehicleService.reordenarFotos(DIA, 'ABC1234', [
    'ABC1234_2.jpg', 'ABC1234_0.jpg', 'ABC1234_1.jpg'
  ]);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');

  const result = await VehicleService.entregarPlaca(DIA, 'ABC1234');

  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.fotos, 3);

  const { arquivos, marcas } = await entregues(env, 'ABC1234');
  assert.deepEqual(arquivos, ['ABC1234_0.jpg', 'ABC1234_1.jpg', 'ABC1234_2.jpg']);
  assert.deepEqual(marcas, [2, 0, 1], 'a ordem do QA precisa chegar em Entrega');

  // Entregar copia: as fotos seguem em Carros para reentrega ou correcao.
  assert.equal((await listar(env, 'ABC1234')).length, 3);
});

test('entrega recusada nao deixa pasta pela metade em Entrega', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);

  // Sem QA a entrega para antes de copiar qualquer coisa.
  await VehicleService.entregarPlaca(DIA, 'ABC1234');

  assert.deepEqual((await entregues(env, 'ABC1234')).arquivos, []);
});

test('reentregar depois de corrigir substitui o que estava em Entrega', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg', 'b.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  await VehicleService.entregarPlaca(DIA, 'ABC1234');

  assert.deepEqual((await entregues(env, 'ABC1234')).marcas, [0, 1, 2]);

  // O usuario percebe um erro, reabre, tira uma foto e entrega de novo: Entrega
  // nao pode ficar com a foto excluida sobrando da primeira vez.
  await VehicleService.reabrirPlaca(DIA, 'ABC1234');
  await VehicleService.excluirFoto(DIA, 'ABC1234', 'ABC1234_1.jpg');
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  await VehicleService.entregarPlaca(DIA, 'ABC1234');

  // Excluir deixa buraco na numeracao (_0, _2) de proposito - renumerar mexeria
  // no conteudo das outras. O que importa e a foto excluida nao sobrar aqui.
  const { arquivos, marcas } = await entregues(env, 'ABC1234');
  assert.deepEqual(arquivos, ['ABC1234_0.jpg', 'ABC1234_2.jpg']);
  assert.deepEqual(marcas, [0, 2]);
});

// --- Guardas do envio ao ADSET ---------------------------------------------
// O envio APAGA as fotos do anuncio publicado na conta do cliente. Estes testes
// cobrem as recusas: e onde um erro custa caro e nao da para desfazer.

async function placaEntregue(env) {
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');
  await VehicleService.entregarPlaca(DIA, 'ABC1234');
}

test('envio ao ADSET recusa enquanto o modo estiver desligado', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await placaEntregue(env);

  const result = await VehicleService.enviarAoAdset(DIA, 'ABC1234');

  assert.equal(result.ok, false);
  assert.match(result.error, /desligado/i);
});

test('envio ao ADSET recusa sem usuario e senha configurados', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await placaEntregue(env);

  const result = await VehicleService.enviarAoAdset(DIA, 'ABC1234', { modo: 'ensaio' });

  assert.equal(result.ok, false);
  assert.match(result.error, /senha|usuario/i);
});

test('envio ao ADSET recusa placa que ainda nao foi entregue', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const fotos = await montarOrigem(env, ['p.jpg', 'a.jpg']);
  fotos[0].placa = 'ABC1234';
  await VehicleService.importarParaData(DIA, fotos);
  await VehicleService.aprovarPlaca(DIA, 'ABC1234');

  // Aprovada mas nao entregue: nao existe pasta em Entrega para subir.
  const result = await VehicleService.enviarAoAdset(DIA, 'ABC1234', { modo: 'real' });

  assert.equal(result.ok, false);
  assert.match(result.error, /Entregue a placa primeiro/i);
});

test('envio ao ADSET recusa modo que nao existe', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  await placaEntregue(env);

  const result = await VehicleService.enviarAoAdset(DIA, 'ABC1234', { modo: 'producao' });

  assert.equal(result.ok, false);
  assert.match(result.error, /desconhecido/i);
});

// --- Configuracao do ADSET pela tela ----------------------------------------
// A senha e o campo delicado: ela nunca sai do servidor, entao a tela sempre
// manda o campo vazio ao salvar qualquer outra coisa.

test('salvar sem senha nova mantem a senha ja guardada', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const { salvarConfigAdset, lerConfigAdset } = await import('../../services/adset-session.js');
  const { config } = await import('../../server/config.js');

  await salvarConfigAdset({
    modo: 'ensaio', usuario: 'foto@ag.com.br', senha: 'segredo', manterConectado: false
  });
  assert.equal(config.adset.password, 'segredo');

  // A tela nunca recebe a senha, entao mudar so o modo chega aqui com ela vazia.
  const depois = await salvarConfigAdset({
    modo: 'real', usuario: 'foto@ag.com.br', senha: '', manterConectado: true
  });

  assert.equal(depois.ok, true, depois.error);
  assert.equal(config.adset.password, 'segredo', 'a senha nao pode ser apagada por omissao');
  assert.equal(config.adset.modo, 'real');
  assert.equal(lerConfigAdset().senhaGuardada, true);
});

test('a configuracao devolvida para a tela nunca leva a senha', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const { salvarConfigAdset, lerConfigAdset } = await import('../../services/adset-session.js');

  await salvarConfigAdset({
    modo: 'ensaio', usuario: 'foto@ag.com.br', senha: 'segredo', manterConectado: false
  });

  const visivel = lerConfigAdset();

  assert.equal(JSON.stringify(visivel).includes('segredo'), false);
  assert.equal(visivel.senhaGuardada, true);
  // O usuario gravado precisa chegar na tela: o estado da sessao ja apagou este
  // campo uma vez por usar o mesmo nome.
  assert.equal(visivel.usuario, 'foto@ag.com.br');
});

test('sair do modo desligado sem credencial e recusado', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const { salvarConfigAdset } = await import('../../services/adset-session.js');
  const { config } = await import('../../server/config.js');
  config.adset.password = '';

  const result = await salvarConfigAdset({ modo: 'real', usuario: '', senha: '' });

  assert.equal(result.ok, false);
  assert.match(result.error, /usuario e senha/i);
});

test('modo invalido e recusado antes de gravar', async t => {
  const env = await createTestEnv(t);
  applyConfigOverrides(env.config);
  const { salvarConfigAdset } = await import('../../services/adset-session.js');

  const result = await salvarConfigAdset({ modo: 'producao', usuario: 'a@b.c', senha: 'x' });

  assert.equal(result.ok, false);
  assert.match(result.error, /invalido/i);
});
