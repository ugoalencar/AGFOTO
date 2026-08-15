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

