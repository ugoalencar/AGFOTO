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

