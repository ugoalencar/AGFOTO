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
    assert.match(app, new RegExp(`@click="activePage = '${page}'"`));
    assert.match(app, new RegExp(`v-if="activePage === '${page}'"`));
  }

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
