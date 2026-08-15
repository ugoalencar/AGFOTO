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
    {{ excelFile.name }} Â· {{ excelItems.length }} itens Â· {{ excelConflicts.length }} conflitos
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

