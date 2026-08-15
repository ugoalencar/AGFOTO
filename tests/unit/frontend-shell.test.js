import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const publicDir = path.join(root, 'frontend', 'public');

test('public app entrypoint is self-contained and local', async () => {
  const index = await readFile(path.join(publicDir, 'index.html'), 'utf8');

  assert.doesNotMatch(index, /https?:\/\//i);
  assert.match(index, /src="\.\/app\.js"/);
  assert.match(index, /src="\.\/vendor\/vue\.global\.prod\.js"/);

  for (const file of ['app.js', 'App.vue', 'api.js', 'vendor/vue.global.prod.js']) {
    await access(path.join(publicDir, file));
  }
});

test('public runtime has no CDN dependencies', async () => {
  for (const file of ['index.html', 'app.js', 'api.js', 'App.vue']) {
    const contents = await readFile(path.join(publicDir, file), 'utf8');
    assert.doesNotMatch(contents, /https?:\/\/(?:[^/]*\.)?(?:cdn|unpkg|jsdelivr)\./i);
  }
});

test('product QA rail routes render direct views without hub tabs', async () => {
  const app = await readFile(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
  const publicApp = await readFile(path.join(publicDir, 'App.vue'), 'utf8');

  for (const page of ['entregar', 'qa', 'relatorios']) {
    // O botao pode navegar direto ou por um handler (QA e Entregar passam por
    // irPara para sincronizar as planilhas antes de mostrar a tela).
    assert.match(
      app,
      new RegExp(`@click="(?:activePage = '${page}'|irPara\\('${page}'\\))"`),
      `rail sem navegacao para ${page}`
    );
    assert.match(app, new RegExp(`v-if="activePage === '${page}'"`));
  }

  // Entrar em QA ou Entregar tem que varrer a pasta de planilhas sozinho.
  assert.match(app, /'\/api\/planilhas\/sincronizar'/);

  assert.doesNotMatch(app, /qaHubTab/);
  assert.doesNotMatch(app, /QA Hub Page/);
  assert.doesNotMatch(app, /v-if="false"/);
  assert.equal(publicApp, app);
});

test('product QA layouts stack and retain table scrolling on narrow screens', async () => {
  const css = await readFile(path.join(publicDir, 'css', 'main.css'), 'utf8');

  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.two-column-view,[\s\S]*?\.qa-view,[\s\S]*?\.report-view[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.two-column-view,[\s\S]*?\.qa-view,[\s\S]*?\.report-view[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /\.ag-table-wrap\s*\{[\s\S]*?overflow:\s*auto;/);
});

test('Planilhas is available from Entregar without legacy Phase 1 routes', async () => {
  const app = await readFile(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
  const publicApp = await readFile(path.join(publicDir, 'App.vue'), 'utf8');
  const css = await readFile(path.join(publicDir, 'css', 'main.css'), 'utf8');

  assert.match(app, /activePage === 'entregar'[\s\S]*?Planilha do cliente/);
  assert.match(app, /:disabled="!qaSelectedLote \|\| !planilhaSelecionada \|\| planilhaEmCurso"/);
  assert.match(app, /const loteParaImportar = qaSelectedLote\.value \|\| selectedLote\.value;/);

  // A importacao tem que falar com o servidor: ja existiu aqui um botao que so
  // mostrava "importado (mock)" e nao aplicava nada.
  assert.match(app, /'\/api\/planilhas\/importar'/);
  assert.match(app, /'\/api\/planilhas\/confirmar'/);
  assert.match(app, /'\/api\/planilhas\/aplicar-codigos'/);
  assert.doesNotMatch(app, /mock\)/i);

  assert.doesNotMatch(app, /activePage === 'planilhas'/);
  assert.doesNotMatch(app, /activePage === 'veiculos'/);
  assert.equal(publicApp, app);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.app-shell[\s\S]*?grid-template-columns:\s*1fr;/);
});
