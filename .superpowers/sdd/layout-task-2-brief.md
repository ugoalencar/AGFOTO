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

