# AGFOTO Product Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Phase 1 product UI to match the approved `agfoto-layout.html` visual direction while preserving all existing local/offline product workflows.

**Architecture:** Keep the current Vue single-file app and API calls, but replace the visual shell and page structure incrementally. Move repeated visual styles into `frontend/public/css/main.css`; keep workflow methods in `frontend/src/App.vue` unchanged unless a view needs a small state adapter.

**Tech Stack:** Vue 3 Composition API, static CSS, local Express-served frontend assets, Node test runner.

## Global Constraints

- The UI must stay local/offline and must not load Google Fonts, CDN CSS, or remote scripts.
- The first operational screen remains Captura.
- The rail for Phase 1 must expose only Captura, Entregar, QA, and Relatorios.
- Carros, OCR, ADSET, real external FTP, Redmine, Java, and `start.jar` remain outside this redesign.
- Delivery labels must say local/mock delivery, not real connected FTP.
- Existing API contracts and `operationId` behavior must be preserved.
- Backend behavior must not be rewritten for this visual pass.
- All existing automated tests must continue passing.

---

## File Structure

- Modify `frontend/public/css/main.css`: replace the current broad header/panel styling with layout tokens and reusable AGFOTO shell classes.
- Modify `frontend/src/App.vue`: restructure the template into an app shell, rail navigation, compact topbar, and product views.
- Modify `docs/superpowers/specs/2026-08-14-agfoto-layout-redesign-design.md` only if implementation discovers an approved spec correction is needed.
- Test with `npm.cmd test` and a direct Vue script syntax check because the project currently has no frontend build command.

---

### Task 1: Visual Tokens And App Shell

**Files:**
- Modify: `frontend/public/css/main.css`
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: existing `activePage`, `qaHubTab`, `status`, `statusType`, `currentStatusLabel`.
- Produces: CSS classes `.app-shell`, `.ag-rail`, `.ag-topbar`, `.ag-view`, `.ag-card`, `.ag-btn`, `.ag-status`, and a template shell that later tasks reuse.

- [ ] **Step 1: Add CSS tokens and shell classes**

Replace the top variable block in `frontend/public/css/main.css` with these tokens while keeping later thumbnail/modal/status rules available for reuse:

```css
:root {
  --ag-ink: #0B0B0D;
  --ag-panel: #131318;
  --ag-panel-2: #1A1A21;
  --ag-panel-3: #212129;
  --ag-line: #2B2B34;
  --ag-text: #EDEDF0;
  --ag-muted: #8C8C99;
  --ag-red: #E8262B;
  --ag-orange: #FF6A13;
  --ag-yellow: #FFC20E;
  --ag-ok: #2EA043;
  --ag-radius: 6px;
  --ag-display: Impact, "Arial Narrow", sans-serif;
  --ag-body: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --ag-mono: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  --ag-bg: var(--ag-ink);
  --ag-fg: var(--ag-text);
  --ag-border: var(--ag-line);
  --ag-dark-gray: var(--ag-panel-2);
}
```

Append these base shell classes:

```css
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--ag-ink);
  color: var(--ag-text);
  font-family: var(--ag-body);
}

button,
input,
select {
  font-family: inherit;
}

:focus-visible {
  outline: 2px solid var(--ag-orange);
  outline-offset: 2px;
}

.app-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  background: var(--ag-ink);
  overflow: hidden;
}

.ag-rail {
  background: #08080A;
  border-right: 1px solid var(--ag-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 0;
}

.ag-rail-button {
  width: 58px;
  padding: 9px 4px 8px;
  border: 0;
  border-radius: var(--ag-radius);
  background: none;
  color: var(--ag-muted);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  font-family: var(--ag-display);
  font-size: 12px;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.ag-rail-button:hover,
.ag-rail-button.is-active {
  color: var(--ag-text);
  background: var(--ag-panel-2);
}

.ag-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ag-topbar {
  height: 52px;
  border-bottom: 1px solid var(--ag-line);
  background: var(--ag-panel);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  flex-shrink: 0;
}

.ag-wordmark {
  font-family: var(--ag-display);
  font-size: 23px;
  letter-spacing: .02em;
  text-transform: uppercase;
}

.ag-context {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: 6px;
  min-width: 0;
}

.ag-chip {
  background: var(--ag-panel-2);
  border: 1px solid var(--ag-line);
  border-radius: 20px;
  padding: 5px 12px;
  font-family: var(--ag-mono);
  font-size: 11.5px;
  color: var(--ag-text);
}

.ag-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ag-view {
  height: 100%;
  min-height: 0;
  padding: 12px;
  gap: 12px;
  overflow: hidden;
}

.ag-card {
  background: var(--ag-panel);
  border: 1px solid var(--ag-line);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ag-card-header {
  padding: 11px 14px;
  border-bottom: 1px solid var(--ag-line);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ag-card-title {
  margin: 0;
  font-family: var(--ag-display);
  font-size: 15px;
  letter-spacing: .1em;
  text-transform: uppercase;
  font-weight: 600;
}

.ag-card-body {
  padding: 14px;
  overflow: auto;
  min-height: 0;
}
```

- [ ] **Step 2: Replace the root template shell**

In `frontend/src/App.vue`, replace the opening header/nav structure with:

```vue
<template>
  <div class="app-shell">
    <nav class="ag-rail" aria-label="Produtos">
      <img src="/favicon.svg" alt="AG Foto" class="ag-rail-mark">
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'captura' }" @click="activePage = 'captura'">
        <span>CAP</span>
        <small>Captura</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'entregar' }" @click="activePage = 'entregar'">
        <span>ENT</span>
        <small>Entregar</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'qa' }" @click="activePage = 'qa'">
        <span>QA</span>
        <small>QA</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'relatorios' }" @click="activePage = 'relatorios'">
        <span>REL</span>
        <small>Relat.</small>
      </button>
      <div class="ag-rail-foot">Fase 1<br>Produtos</div>
    </nav>

    <div class="ag-main">
      <header class="ag-topbar">
        <div class="ag-wordmark"><b>AG</b> Foto</div>
        <div class="ag-chip">Produtos</div>
        <div class="ag-context">
          <span v-if="selectedLote" class="ag-chip">Lote {{ selectedLote }}</span>
          <span class="ag-chip">Entrega local/mock</span>
        </div>
      </header>

      <div class="ag-content">
        <!-- Existing page sections move here in later tasks. -->
      </div>

      <footer class="ag-footer">
        <span v-if="status" :class="statusType">{{ status }}</span>
      </footer>
    </div>
  </div>
</template>
```

Do not remove the script methods yet. Keep the footer status behavior.

- [ ] **Step 3: Update page state names**

In `frontend/src/App.vue`, change:

```js
const activePage = ref('captura'); // 'captura', 'planilhas', 'qa-hub', 'veiculos'
const qaHubTab = ref('entregar'); // 'entregar', 'qa', 'relatorios'
```

to:

```js
const activePage = ref('captura'); // 'captura', 'entregar', 'qa', 'relatorios'
```

Keep `qaHubTab` only if code still references it during this task; remove it in Task 3 after the views are split.

- [ ] **Step 4: Run syntax check**

Run:

```powershell
@'
import fs from 'fs';
const vue = fs.readFileSync('frontend/src/App.vue', 'utf8');
const script = vue.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('script block not found');
const js = script
  .replace(/import \{ ref, computed, onMounted, onUnmounted \} from 'vue';/, 'const ref = computed = onMounted = onUnmounted = null;')
  .replace(/export default/, 'const component =');
new Function(js);
console.log('App.vue script syntax OK');
'@ | node --input-type=module -
```

Expected: `App.vue script syntax OK`.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.vue frontend/public/css/main.css
git commit -m "feat: add AGFOTO product app shell"
```

---

### Task 2: Capture View Three-Column Layout

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/public/css/main.css`

**Interfaces:**
- Consumes: `selectedLote`, `selectedGtin`, `inputGtin`, `tempImages`, `previousImages`, `loteItems`, `currentStatusLabel`, `onLoteSelected`, `onGtinEnter`, `onSaveCapture`, `onClearTemp`, `openModal`, `onImageZoom`, `onImageDelete`, `onImageError`.
- Produces: `.capture-view`, `.capture-entry`, `.capture-stage`, `.capture-lote-list`, and `.stage-grid` markup used only by the Captura screen.

- [ ] **Step 1: Add capture-specific CSS**

Append to `frontend/public/css/main.css`:

```css
.capture-view {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr) 300px;
}

.ag-label {
  display: block;
  font-family: var(--ag-display);
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--ag-muted);
  margin-bottom: 5px;
}

.ag-field {
  width: 100%;
  background: var(--ag-panel-2);
  border: 1px solid var(--ag-line);
  border-radius: var(--ag-radius);
  padding: 9px 11px;
  color: var(--ag-text);
  font-family: var(--ag-mono);
  font-size: 14px;
}

.ag-field.is-large {
  font-size: 19px;
  padding: 11px;
}

.ag-field:focus {
  border-color: var(--ag-orange);
  outline: none;
}

.ag-btn {
  border: 1px solid var(--ag-line);
  background: var(--ag-panel-2);
  border-radius: var(--ag-radius);
  padding: 8px 14px;
  cursor: pointer;
  color: var(--ag-text);
  font-family: var(--ag-display);
  font-size: 14px;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.ag-btn.is-primary {
  background: linear-gradient(180deg, var(--ag-red), #B81216);
  border-color: #8E0F13;
  color: #fff;
}

.ag-btn.is-warning {
  background: transparent;
  border-color: #4A3A12;
  color: var(--ag-yellow);
}

.ag-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.capture-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--ag-line);
}

.capture-stage {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 0;
}

.stage-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ag-line);
  background: var(--ag-panel);
}

.stage-head + .stage-grid + .stage-head,
.capture-stage > .stage-head:nth-of-type(2),
.capture-stage > .stage-grid:nth-of-type(2) {
  border-left: 1px solid var(--ag-line);
}

.stage-title {
  margin: 0;
  font-family: var(--ag-display);
  font-size: 14px;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.stage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
  padding: 10px;
  overflow: auto;
  align-content: start;
}

.stage-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34px 16px;
  color: var(--ag-muted);
  text-align: center;
}

.capture-lote-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
}

.capture-lote-list li {
  padding: 9px 12px;
  border-bottom: 1px solid var(--ag-line);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-family: var(--ag-mono);
  font-size: 12.5px;
}
```

- [ ] **Step 2: Replace the Captura template section**

Inside `.ag-content`, replace the current `main v-if="activePage === 'captura'"` block with:

```vue
<main v-if="activePage === 'captura'" class="ag-view capture-view">
  <section class="ag-card capture-entry">
    <header class="ag-card-header">
      <h2 class="ag-card-title">Entrada</h2>
    </header>
    <div class="ag-card-body" style="display:flex;flex-direction:column;gap:18px">
      <div>
        <label class="ag-label">Lote</label>
        <input class="ag-field is-large" v-model="selectedLote" @keydown.enter="onLoteSelected" type="text" placeholder="Numero do lote" autocomplete="off">
        <button class="ag-btn is-warning" style="width:100%;margin-top:8px" @click="onLoteSelected" :disabled="!selectedLote">Selecionar lote</button>
      </div>

      <div>
        <label class="ag-label">GTIN / EAN</label>
        <input class="ag-field is-large" v-model="inputGtin" @keydown.enter="onGtinEnter" type="text" placeholder="Leitor ou digitacao" autocomplete="off">
      </div>

      <div v-if="selectedGtin">
        <label class="ag-label">Status</label>
        <span :class="`badge-status ${currentStatus}`">{{ currentStatusLabel }}</span>
      </div>

      <div class="capture-actions">
        <button class="ag-btn is-primary" @click="onSaveCapture" :disabled="!selectedLote || !selectedGtin || tempImages.length === 0">
          Salvar ({{ tempImages.length }})
        </button>
        <button class="ag-btn is-warning" @click="onClearTemp" :disabled="tempImages.length === 0">
          Limpar TEMP
        </button>
      </div>
    </div>
  </section>

  <section class="ag-card capture-stage">
    <div class="stage-head">
      <h3 class="stage-title">Palco atual</h3>
      <span class="ag-chip">TEMP monitorando</span>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ tempImages.length }} imagens</span>
    </div>
    <div v-if="tempImages.length === 0" class="stage-grid stage-empty">Aguardando imagens da camera</div>
    <div v-else class="stage-grid">
      <div v-for="img in tempImages" :key="img.name" class="thumbnail" @click="openModal(img)">
        <img :src="`blob:${img.path}`" :alt="img.name" @error="onImageError">
        <div class="thumbnail-overlay">
          <button @click.stop="onImageZoom(img)" class="btn-thumbnail" title="Ampliar">+</button>
          <button @click.stop="onImageDelete(img)" class="btn-thumbnail" title="Excluir">x</button>
        </div>
      </div>
    </div>

    <div class="stage-head">
      <h3 class="stage-title">Palco anterior</h3>
      <span class="ag-chip">{{ selectedGtin || 'sem GTIN' }}</span>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ previousImages.length }} imagens</span>
    </div>
    <div v-if="!selectedGtin || previousImages.length === 0" class="stage-grid stage-empty">
      {{ selectedGtin ? 'Nenhuma imagem anterior' : 'Selecione um GTIN' }}
    </div>
    <div v-else class="stage-grid">
      <div v-for="img in previousImages" :key="img.name" class="thumbnail" @click="openModal(img)">
        <img :src="`blob:${img.path}`" :alt="img.name" @error="onImageError">
        <div class="thumbnail-overlay">
          <button @click.stop="onImageZoom(img)" class="btn-thumbnail" title="Ampliar">+</button>
        </div>
      </div>
    </div>
  </section>

  <section class="ag-card">
    <header class="ag-card-header">
      <h2 class="ag-card-title">GTINs do lote</h2>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ loteItems.length }} itens</span>
    </header>
    <ul class="capture-lote-list">
      <li v-for="item in loteItems" :key="item.gtin" @click="selectedGtin = item.gtin">
        <span>{{ item.gtin }}</span>
        <small style="margin-left:auto;color:var(--ag-muted)">{{ item.quantidadeFotos }} fotos</small>
      </li>
    </ul>
  </section>
</main>
```

- [ ] **Step 3: Verify syntax**

Run the same `node --input-type=module` Vue script syntax check from Task 1.

Expected: `App.vue script syntax OK`.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
node --test tests/integration/captura-products.test.js tests/integration/qa-products.test.js
```

Expected: all tests pass except any pre-existing Windows symlink skip if included indirectly.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.vue frontend/public/css/main.css
git commit -m "feat: redesign product capture view"
```

---

### Task 3: Split QA Hub Into Entregar, QA, And Relatorios Views

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/public/css/main.css`

**Interfaces:**
- Consumes: `qaSelectedLote`, `qaProducts`, `deliveryProductKey`, `qaPhotoLote`, `qaPhotoGtin`, `qaPhotos`, `reportStatus`, `reportItems`, `reportStats`, `onLoadQaProducts`, `onPrepareDelivery`, `onLoadQaPhotos`, `onClassifyPhoto`, `onCompleteQa`, `onLoadReport`.
- Produces: Direct `activePage` routes for `entregar`, `qa`, and `relatorios`; removes the need for visible QA Hub tabs.

- [ ] **Step 1: Add QA/Delivery/Report layout CSS**

Append:

```css
.two-column-view {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
}

.qa-view {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr) 210px;
}

.report-view {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
}

.ag-table-wrap {
  overflow: auto;
  min-height: 0;
}

.ag-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ag-table th {
  text-align: left;
  font-family: var(--ag-display);
  font-size: 12px;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--ag-muted);
  font-weight: 600;
  padding: 8px 10px;
  border-bottom: 1px solid var(--ag-line);
  position: sticky;
  top: 0;
  background: var(--ag-panel);
  z-index: 1;
}

.ag-table td {
  padding: 9px 10px;
  border-bottom: 1px solid #1F1F26;
  font-family: var(--ag-mono);
  font-size: 12.5px;
}

.ag-table tr:hover td {
  background: var(--ag-panel-2);
}

.qa-photo-card {
  border: 1px solid var(--ag-line);
  border-radius: 5px;
  background: var(--ag-panel-2);
  min-height: 132px;
  padding: 8px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.kpi-card {
  background: var(--ag-panel-2);
  border: 1px solid var(--ag-line);
  border-radius: 8px;
  padding: 12px 14px;
}

.kpi-card strong {
  display: block;
  font-family: var(--ag-display);
  font-size: 31px;
  line-height: 1;
}
```

- [ ] **Step 2: Replace Entregar view**

Create a new direct section under `.ag-content`:

```vue
<main v-if="activePage === 'entregar'" class="ag-view two-column-view">
  <section class="ag-card">
    <header class="ag-card-header">
      <h2 class="ag-card-title">Lote</h2>
    </header>
    <div class="ag-card-body">
      <label class="ag-label">Selecionar lote</label>
      <input class="ag-field" v-model="qaSelectedLote" type="text" placeholder="Numero do lote">
      <button class="ag-btn is-primary" style="width:100%;margin-top:10px" @click="onLoadQaProducts" :disabled="!qaSelectedLote">
        Carregar produtos
      </button>
      <p style="color:var(--ag-muted);font-size:12px;margin-top:14px">
        Entrega local/mock com staging, manifesto e verificacao antes de marcar entregue.
      </p>
    </div>
  </section>

  <section class="ag-card">
    <header class="ag-card-header">
      <h2 class="ag-card-title">Produtos prontos para entrega</h2>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ qaProducts.length }} itens</span>
    </header>
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead>
          <tr><th>GTIN</th><th>Codigo</th><th>Fotos</th><th>Acao</th></tr>
        </thead>
        <tbody>
          <tr v-for="product in qaProducts" :key="`${product.gtin}:${product.codigo}`">
            <td>{{ product.gtin }}</td>
            <td>{{ product.codigo }}</td>
            <td>{{ product.quantidadeFotos }}</td>
            <td>
              <button class="ag-btn is-warning" @click="onPrepareDelivery(product)" :disabled="deliveryProductKey === `${product.gtin}:${product.codigo}`">
                {{ deliveryProductKey === `${product.gtin}:${product.codigo}` ? 'Entregando' : 'Entregar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
```

Do not add checkboxes or bulk delivery in this task because bulk delivery is not implemented.

- [ ] **Step 3: Replace QA view**

Create:

```vue
<main v-if="activePage === 'qa'" class="ag-view qa-view">
  <section class="ag-card">
    <header class="ag-card-header"><h2 class="ag-card-title">Navegar</h2></header>
    <div class="ag-card-body">
      <label class="ag-label">Lote</label>
      <input class="ag-field" v-model="qaPhotoLote" type="text" placeholder="Lote">
      <label class="ag-label" style="margin-top:12px">GTIN</label>
      <input class="ag-field" v-model="qaPhotoGtin" type="text" placeholder="GTIN">
      <button class="ag-btn is-primary" style="width:100%;margin-top:12px" @click="onLoadQaPhotos" :disabled="!qaPhotoLote || !qaPhotoGtin">
        Carregar fotos
      </button>
    </div>
  </section>

  <section class="ag-card">
    <header class="ag-card-header">
      <h2 class="ag-card-title">{{ qaPhotoGtin || 'Fotos para QA' }}</h2>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ qaPhotos.length }} imagens</span>
    </header>
    <div class="stage-grid">
      <div v-for="photo in qaPhotos" :key="photo.filename" class="qa-photo-card">
        <div style="height:74px;display:grid;place-items:center;background:var(--ag-panel);margin-bottom:8px">Foto</div>
        <div style="font-family:var(--ag-mono);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ photo.filename }}</div>
        <div style="display:flex;gap:4px;margin-top:8px">
          <button class="ag-btn" style="flex:1;padding:5px 6px" @click="onClassifyPhoto(photo, 'AP')">AP</button>
          <button class="ag-btn is-warning" style="flex:1;padding:5px 6px" @click="onClassifyPhoto(photo, 'AT')">AT</button>
        </div>
      </div>
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--ag-line)">
      <button class="ag-btn is-primary" @click="onCompleteQa" :disabled="qaPhotos.length === 0">Concluir QA</button>
    </div>
  </section>

  <section class="ag-card">
    <header class="ag-card-header"><h2 class="ag-card-title">Marcacoes</h2></header>
    <div class="ag-card-body" style="color:var(--ag-muted);font-size:13px">
      <p><b style="color:var(--ag-yellow)">AP</b> fica fora da entrega normal.</p>
      <p><b style="color:var(--ag-orange)">AT</b> entra na entrega de atualizacao.</p>
      <p>Desfazer e exclusao continuam registrados por auditoria.</p>
    </div>
  </section>
</main>
```

- [ ] **Step 4: Replace Relatorios view**

Create:

```vue
<main v-if="activePage === 'relatorios'" class="ag-view report-view">
  <section class="ag-card">
    <header class="ag-card-header"><h2 class="ag-card-title">Filtros e totais</h2></header>
    <div class="ag-card-body">
      <label class="ag-label">Status</label>
      <select class="ag-field" v-model="reportStatus">
        <option value="">Todos</option>
        <option value="pendente_qa">Pendente QA</option>
        <option value="pronto_para_entrega">Pronto para Entrega</option>
        <option value="entregue">Entregue</option>
        <option value="erro_entrega">Erro na Entrega</option>
        <option value="retrabalho">Retrabalho</option>
      </select>
      <button class="ag-btn is-primary" style="width:100%;margin-top:12px" @click="onLoadReport">Gerar relatorio</button>
      <div v-if="reportStats" class="kpi-grid" style="margin-top:14px">
        <div class="kpi-card"><strong>{{ reportStats.totalItems || 0 }}</strong><span>Itens</span></div>
        <div class="kpi-card"><strong>{{ reportStats.entregue || 0 }}</strong><span>Entregues</span></div>
        <div class="kpi-card"><strong>{{ reportStats.pronto_para_entrega || 0 }}</strong><span>Prontos</span></div>
        <div class="kpi-card"><strong>{{ reportStats.retrabalho || 0 }}</strong><span>Retrabalho</span></div>
      </div>
    </div>
  </section>

  <section class="ag-card">
    <header class="ag-card-header">
      <h2 class="ag-card-title">Detalhamento</h2>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ reportItems.length }} linhas</span>
    </header>
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead>
          <tr><th>Lote</th><th>GTIN</th><th>Codigo</th><th>Descricao</th><th>Fotos</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in reportItems" :key="`${item.lote}:${item.gtin}`">
            <td>{{ item.lote }}</td>
            <td>{{ item.gtin }}</td>
            <td>{{ item.codigo }}</td>
            <td>{{ item.descricao }}</td>
            <td>{{ item.quantidadeFotos }}</td>
            <td><span :class="`badge-status ${item.status}`">{{ item.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
```

- [ ] **Step 5: Remove obsolete QA tab rendering**

Remove the old `main v-if="activePage === 'qa-hub'"` block and `qaHubTab` references from the template and returned setup object. If the script declares `qaHubTab`, remove:

```js
const qaHubTab = ref('entregar');
```

and remove `qaHubTab` from the returned object.

- [ ] **Step 6: Run tests**

Run:

```powershell
node --test tests/integration/delivery-products.test.js tests/integration/qa-products.test.js tests/integration/api-routes.test.js
```

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/App.vue frontend/public/css/main.css
git commit -m "feat: redesign product QA hub views"
```

---

### Task 4: Planilhas Access, Phase 1 Cleanup, And Responsive Polish

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/public/css/main.css`

**Interfaces:**
- Consumes: existing spreadsheet state and handlers `excelFile`, `excelItems`, `excelConflicts`, `onExcelFileSelected`, `onImportExcel`.
- Produces: a Planilhas tool card reachable from Entregar, no active Carros page in Phase 1, and responsive CSS.

- [ ] **Step 1: Move Planilhas controls into Entregar side card**

Inside the Entregar left card body, after the lote loader, add:

```vue
<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line)">
  <label class="ag-label">Planilha do cliente</label>
  <input class="ag-field" type="file" accept=".xlsx" @change="onExcelFileSelected">
  <button class="ag-btn is-warning" style="width:100%;margin-top:10px" @click="onImportExcel" :disabled="!qaSelectedLote || !excelFile">
    Unificar planilha
  </button>
  <div v-if="excelFile" style="font-family:var(--ag-mono);font-size:11px;color:var(--ag-muted);margin-top:8px">
    {{ excelFile.name }} · {{ excelItems.length }} itens · {{ excelConflicts.length }} conflitos
  </div>
</div>
```

In `onImportExcel`, ensure it uses the selected lote from the delivery context when `selectedLote` is empty:

```js
const loteParaImportar = selectedLote.value || qaSelectedLote.value;
```

and use `loteParaImportar` in the request payload and validation.

- [ ] **Step 2: Remove or hide active Veiculos page from Phase 1 shell**

Remove the rail button and direct access to the old `activePage === 'veiculos'` page from the Phase 1 shell. Leave vehicle methods in the script only if removing them causes unnecessary churn; they must not be reachable from the active Phase 1 UI.

- [ ] **Step 3: Add responsive CSS**

Append:

```css
@media (max-width: 1180px) {
  .capture-view,
  .qa-view,
  .two-column-view,
  .report-view {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .capture-stage {
    min-height: 520px;
  }
}

@media (max-width: 760px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .ag-rail {
    flex-direction: row;
    justify-content: flex-start;
    overflow-x: auto;
    padding: 8px 10px;
  }

  .ag-rail-button {
    width: auto;
    min-width: 70px;
  }

  .ag-topbar {
    height: auto;
    min-height: 52px;
    flex-wrap: wrap;
    padding: 10px 12px;
  }

  .capture-stage {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(180px, 1fr) auto minmax(180px, 1fr);
  }
}
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm.cmd test
```

Expected: `180 passed, 0 failed, 1 skipped` or the same count plus any added tests. The symlink skip on Windows is acceptable.

Run the Vue script syntax check from Task 1.

Expected: `App.vue script syntax OK`.

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.vue frontend/public/css/main.css
git commit -m "feat: polish product layout responsiveness"
```

---

### Task 5: Manual Browser Verification And Final Review

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-agfoto-layout-redesign-design.md` only if a verified mismatch requires documenting an approved scope correction.

**Interfaces:**
- Consumes: completed visual implementation from Tasks 1-4.
- Produces: final verification evidence and review package.

- [ ] **Step 1: Start local server**

Run:

```powershell
npm.cmd start
```

Expected: server starts on configured localhost port, normally `127.0.0.1:3000`. If port is occupied, stop the conflicting local process or use the existing running app if it is this project.

- [ ] **Step 2: Verify desktop views manually**

Open the app locally and check:

```text
Captura:
- rail visible
- topbar visible
- Entrada column visible
- Palco Atual and Palco Anterior visible
- GTIN list column visible

Entregar:
- lote loader visible
- planilha tool visible
- delivery table visible
- copy says local/mock, not FTP connected

QA:
- navigation fields visible
- photo grid visible
- AP/AT legend visible

Relatorios:
- filters visible
- KPI cards visible after loading report
- detail table visible
```

- [ ] **Step 3: Run final automated checks**

Run:

```powershell
npm.cmd test
git diff --check
```

Expected: tests pass and diff check is clean.

- [ ] **Step 4: Generate review diff**

Run:

```powershell
$base='ef9e563'
$head=(git rev-parse --short HEAD)
$range="$base..HEAD"
$out=".superpowers/sdd/review-layout-$base..$head.diff"
git diff --binary "$range" -- frontend/src/App.vue frontend/public/css/main.css docs/superpowers/specs/2026-08-14-agfoto-layout-redesign-design.md | Set-Content -Path $out -Encoding utf8
Get-Item $out | Select-Object FullName,Length
```

Expected: review diff file exists and is non-empty.

- [ ] **Step 5: Request code review**

Ask an independent reviewer to check:

```text
Review the AGFOTO product layout redesign against docs/superpowers/specs/2026-08-14-agfoto-layout-redesign-design.md.
Focus on: no external fonts/CDNs, no active Carros/ADSET/FTP real flows, first screen Captura, delivery still local/mock, operationId calls preserved, no broken Vue bindings, layout follows the reference direction.
```

- [ ] **Step 6: Fix findings or close task**

If reviewer finds issues, fix them in a new commit and rerun final automated checks. If approved, report the final commit range and verification results to the user.

## Self-Review

- Spec coverage: Tasks cover shell, rail, topbar, Captura, Entregar, QA, Relatorios, Planilhas access, offline constraints, no active Carros, local/mock delivery copy, responsiveness, and verification.
- Placeholder scan: no unresolved placeholder language remains.
- Type consistency: all referenced Vue state and handlers exist in the current `App.vue` except `qaHubTab`, which Task 3 explicitly removes after splitting views.
