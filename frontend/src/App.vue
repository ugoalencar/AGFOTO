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

<main v-if="activePage === 'captura'" class="ag-view capture-view">
  <section class="ag-card capture-entry">
    <header class="ag-card-header">
      <h2 class="ag-card-title">Entrada</h2>
    </header>
    <div class="ag-card-body" style="display:flex;flex-direction:column;gap:18px">
      <div>
        <label class="ag-label">Lote</label>
        <select class="ag-field is-large" v-model="selectedLote" @change="onLoteSelected">
          <option value="">Selecione um lote</option>
          <option v-for="lote in availableLotes" :key="lote" :value="lote">{{ lote }}</option>
        </select>
      </div>

      <div>
        <label class="ag-label">GTIN / EAN</label>
        <input class="ag-field is-large" v-model="inputGtin" @keydown.enter="onGtinEnter" type="text" placeholder="Leitor ou digitação" autocomplete="off">
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

  <section id="capture-stage" class="ag-card capture-stage">
    <div class="stage-head">
      <h3 class="stage-title">Palco atual</h3>
      <span class="ag-chip">TEMP monitorando</span>
      <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ tempImages.length }} imagens</span>
    </div>
    <div v-if="tempImages.length === 0" class="stage-grid stage-empty">Aguardando imagens da camera</div>
    <div v-else class="stage-grid">
      <div v-for="img in tempImages" :key="img.name" class="thumbnail" @click="openModal(img)">
        <img :src="`/api/captura/imagem/temp/${img.name}`" :alt="img.name" @error="onImageError">
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
    <div v-else id="previous-grid" class="stage-grid">
      <div v-for="img in previousImages" :key="img.name" class="thumbnail" @click="openModal(img)">
        <img :src="`/api/captura/imagem/finalizadas/${selectedLote}/${selectedGtin}/${img.name}`" :alt="img.name" @error="onImageError">
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

    <!-- Planilhas Page -->
    <main v-if="activePage === 'legacy-planilhas'" style="padding: 2rem; overflow-y: auto;">
      <div style="max-width: 900px;">
        <h2 style="color: #FF0000; margin-bottom: 1.5rem;">📊 Importação de Planilhas</h2>
        <p style="color: var(--ag-border); margin-bottom: 1.5rem;">Upload Excel com EAN, Código e Descrição para unificar no master catalog.</p>

        <div style="background: var(--ag-dark-gray); padding: 1.5rem; border: 2px solid var(--ag-border); margin-bottom: 2rem;">
          <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Lote:</label>
          <input
            v-model="selectedLote"
            type="text"
            placeholder="Digite número do lote"
            style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">

          <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Arquivo Excel (.xlsx):</label>
          <input
            @change="onExcelFileSelected"
            type="file"
            accept=".xlsx"
            style="width: 100%; padding: 0.75rem; margin-bottom: 1rem;">

          <div v-if="excelFile" style="background: var(--ag-bg); padding: 1rem; border: 1px solid var(--ag-border); margin-bottom: 1rem; font-size: 0.875rem;">
            <div><strong>Arquivo:</strong> {{ excelFile.name }}</div>
            <div><strong>Items:</strong> {{ excelItems.length }}</div>
            <div><strong>Conflitos:</strong> {{ excelConflicts.length }}</div>
          </div>

          <button
            @click="onImportExcel"
            :disabled="!selectedLote || !excelFile"
            class="btn-action primary"
            style="width: 100%; margin-top: 1rem;">
            Importar e Unificar
          </button>
        </div>

        <div v-if="excelConflicts.length > 0" style="background: #FFB400; padding: 1.5rem; border: 2px solid #FF8800; color: #000;">
          <h3 style="margin-top: 0;">⚠️ {{ excelConflicts.length }} Conflitos Detectados</h3>
          <div style="max-height: 200px; overflow-y: auto;">
            <div v-for="(c, idx) in excelConflicts" :key="idx" style="background: rgba(255,255,255,0.3); padding: 0.75rem; margin-bottom: 0.5rem; font-size: 0.875rem;">
              <strong>{{ c.lote }}/{{ c.ean }}</strong> → {{ c.field }}<br>
              Existe: {{ c.existingValue }} | Nova: {{ c.newValue }}
            </div>
          </div>
        </div>

        <div v-if="excelItems.length > 0" style="margin-top: 2rem;">
          <h3>Items a Importar (mostrando primeiros 10):</h3>
          <div style="overflow-x: auto; border: 1px solid var(--ag-border);">
            <table style="width: 100%; font-size: 0.875rem;">
              <thead style="background: var(--ag-dark-gray);">
                <tr>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">EAN</th>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Código</th>
                  <th style="padding: 0.75rem; text-align: left;">Descrição</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in excelItems.slice(0, 10)" :key="idx" style="border-bottom: 1px solid var(--ag-border);">
                  <td style="padding: 0.75rem;">{{ item.ean }}</td>
                  <td style="padding: 0.75rem;">{{ item.codigo }}</td>
                  <td style="padding: 0.75rem;">{{ item.descricao }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="excelItems.length > 10" style="padding: 1rem; text-align: center; color: var(--ag-border);">
            ... e {{ excelItems.length - 10 }} items adicionais
          </div>
        </div>
      </div>
    </main>

    <main v-if="activePage === 'entregar'" class="ag-view two-column-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Lote</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Selecionar lote</label>
          <input class="ag-field" v-model="qaSelectedLote" type="text" placeholder="Numero do lote">
          <button class="ag-btn is-primary" style="width:100%;margin-top:10px" @click="onLoadQaProducts" :disabled="!qaSelectedLote">Carregar produtos</button>
          <p style="color:var(--ag-muted);font-size:12px;margin-top:14px">Entrega local/mock com staging, manifesto e verificacao antes de marcar entregue.</p>
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
        </div>
      </section>
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Produtos prontos para entrega</h2><span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ qaProducts.length }} itens</span></header><div class="ag-table-wrap"><table class="ag-table"><thead><tr><th>GTIN</th><th>Codigo</th><th>Fotos</th><th>Acao</th></tr></thead><tbody><tr v-for="product in qaProducts" :key="`${product.gtin}:${product.codigo}`"><td>{{ product.gtin }}</td><td>{{ product.codigo }}</td><td>{{ product.quantidadeFotos }}</td><td><button class="ag-btn is-warning" @click="onPrepareDelivery(product)" :disabled="deliveryProductKey === `${product.gtin}:${product.codigo}`">{{ deliveryProductKey === `${product.gtin}:${product.codigo}` ? 'Entregando' : 'Entregar' }}</button></td></tr></tbody></table></div></section>
    </main>
    <main v-if="activePage === 'qa'" class="ag-view qa-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Navegar</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Lote</label>
          <select class="ag-field" v-model="qaPhotoLote" @change="onQaLoteChange">
            <option value="">Selecione um lote</option>
            <option v-for="lote in qaAvailableLotes" :key="lote" :value="lote">{{ lote }}</option>
          </select>

          <label class="ag-label" style="margin-top:12px">GTIN</label>
          <select class="ag-field" v-model="qaPhotoGtin" :disabled="qaAvailableGtins.length === 0">
            <option value="">{{ qaAvailableGtins.length > 0 ? 'Selecione um GTIN' : 'Sem GTINs pendentes' }}</option>
            <option v-for="gtin in qaAvailableGtins" :key="gtin" :value="gtin">{{ gtin }}</option>
          </select>

          <button class="ag-btn is-primary" style="width:100%;margin-top:12px" @click="onLoadQaPhotos" :disabled="!qaPhotoLote || !qaPhotoGtin">Carregar fotos</button>
        </div>
      </section>
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">{{ qaPhotoGtin || 'Fotos para QA' }}</h2><span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ qaPhotos.length }} imagens</span></header><div class="stage-grid"><div v-for="photo in qaPhotos" :key="photo.filename" class="qa-photo-card"><div style="height:74px;display:grid;place-items:center;background:var(--ag-panel);margin-bottom:8px">Foto</div><div style="font-family:var(--ag-mono);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ photo.filename }}</div><div style="display:flex;gap:4px;margin-top:8px"><button class="ag-btn" style="flex:1;padding:5px 6px" @click="onClassifyPhoto(photo, 'AP')">AP</button><button class="ag-btn is-warning" style="flex:1;padding:5px 6px" @click="onClassifyPhoto(photo, 'AT')">AT</button></div></div></div><div style="padding:10px 14px;border-top:1px solid var(--ag-line)"><button class="ag-btn is-primary" @click="onCompleteQa" :disabled="qaPhotos.length === 0">Concluir QA</button></div></section>
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Marcacoes</h2></header><div class="ag-card-body" style="color:var(--ag-muted);font-size:13px"><p><b style="color:var(--ag-yellow)">AP</b> fica fora da entrega normal.</p><p><b style="color:var(--ag-orange)">AT</b> entra na entrega de atualizacao.</p><p>Desfazer e exclusao continuam registrados por auditoria.</p></div></section>
    </main>
    <main v-if="activePage === 'relatorios'" class="ag-view report-view">
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Filtros e totais</h2></header><div class="ag-card-body"><label class="ag-label">Status</label><select class="ag-field" v-model="reportStatus"><option value="">Todos</option><option value="pendente_qa">Pendente QA</option><option value="pronto_para_entrega">Pronto para Entrega</option><option value="entregue">Entregue</option><option value="erro_entrega">Erro na Entrega</option><option value="retrabalho">Retrabalho</option></select><button class="ag-btn is-primary" style="width:100%;margin-top:12px" @click="onLoadReport">Gerar relatorio</button><div v-if="reportStats" class="kpi-grid" style="margin-top:14px"><div class="kpi-card"><strong>{{ reportStats.totalItens ?? reportStats.totalItems ?? 0 }}</strong><span>Itens</span></div><div class="kpi-card"><strong>{{ reportStats.entregues ?? reportStats.entregue ?? 0 }}</strong><span>Entregues</span></div><div class="kpi-card"><strong>{{ reportStats.prontos ?? reportStats.pronto_para_entrega ?? 0 }}</strong><span>Prontos</span></div><div class="kpi-card"><strong>{{ reportStats.retrabalho ?? 0 }}</strong><span>Retrabalho</span></div></div></div></section>
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Detalhamento</h2><span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ reportItems.length }} linhas</span></header><div class="ag-table-wrap"><table class="ag-table"><thead><tr><th>Lote</th><th>GTIN</th><th>Codigo</th><th>Descricao</th><th>Fotos</th><th>Status</th></tr></thead><tbody><tr v-for="item in reportItems" :key="`${item.lote}:${item.gtin}`"><td>{{ item.lote }}</td><td>{{ item.gtin }}</td><td>{{ item.codigo }}</td><td>{{ item.descricao }}</td><td>{{ item.quantidadeFotos }}</td><td><span :class="`badge-status ${item.status}`">{{ item.status }}</span></td></tr></tbody></table></div></section>
    </main>
    <!-- Veículos Page -->
    <main v-if="activePage === 'legacy-veiculos'" style="padding: 2rem; overflow-y: auto;">
      <div style="max-width: 1000px;">
        <h2 style="color: #FF0000; margin-bottom: 1.5rem;">🚗 Gerenciamento de Veículos</h2>
        <p style="color: var(--ag-border); margin-bottom: 1.5rem;">Importar fotos de cartão de memória, processar OCR de placas, QA e entregar para ADSET.</p>

        <div style="background: var(--ag-dark-gray); padding: 1.5rem; border: 2px solid var(--ag-border); margin-bottom: 2rem;">
          <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Lote:</label>
          <input
            v-model="vehiclesLote"
            type="text"
            placeholder="Digite número do lote"
            style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">

          <button
            @click="onLoadVehicles"
            :disabled="!vehiclesLote"
            class="btn-action primary"
            style="width: 100%;">
            Carregar Veículos
          </button>
        </div>

        <div v-if="vehicles.length > 0" style="margin-top: 2rem;">
          <h3>Veículos no Lote ({{ vehicles.length }})</h3>
          <div style="overflow-x: auto; border: 1px solid var(--ag-border);">
            <table style="width: 100%; font-size: 0.875rem;">
              <thead style="background: var(--ag-dark-gray);">
                <tr>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Placa</th>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Fotos</th>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">OCR</th>
                  <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Status</th>
                  <th style="padding: 0.75rem; text-align: left;">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(vehicle, idx) in vehicles" :key="idx" style="border-bottom: 1px solid var(--ag-border);">
                  <td style="padding: 0.75rem; font-weight: bold;">{{ vehicle.placa }}</td>
                  <td style="padding: 0.75rem;">{{ vehicle.fotos }}</td>
                  <td style="padding: 0.75rem;">{{ vehicle.ocrConfidence ? vehicle.ocrConfidence + '%' : 'Não' }}</td>
                  <td style="padding: 0.75rem;">
                    <span :style="{ background: vehicle.status === 'entregue' ? '#00AA00' : '#FFB400', color: vehicle.status === 'entregue' ? '#fff' : '#000', padding: '0.25rem 0.5rem', borderRadius: '2px', fontSize: '0.75rem', fontWeight: 'bold' }">
                      {{ vehicle.status === 'entregue' ? 'Entregue' : 'Pendente' }}
                    </span>
                  </td>
                  <td style="padding: 0.75rem;">
                    <button
                      @click="onCompleteVehicleQa(vehicle.placa)"
                      :disabled="vehicle.status === 'entregue'"
                      style="background: #FF8800; color: #000; border: none; padding: 0.4rem 0.8rem; cursor: pointer; font-weight: bold; font-size: 0.7rem; margin-right: 0.25rem;">
                      QA ✓
                    </button>
                    <button
                      @click="onDeliverVehicle(vehicle.placa)"
                      :disabled="vehicle.status !== 'pronto_para_entrega'"
                      style="background: #00AA00; color: #fff; border: none; padding: 0.4rem 0.8rem; cursor: pointer; font-weight: bold; font-size: 0.7rem;">
                      Entregar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="vehicles.length === 0 && vehiclesLote" style="padding: 2rem; text-align: center; color: var(--ag-border);">
          Nenhum veículo encontrado para este lote.
        </div>
      </div>
    </main>

    <!-- Modal de Imagem -->
    <div v-if="modalImage" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          {{ modalImage.name }}
          <button @click="closeModal" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 1.5rem;">×</button>
        </div>
        <div class="modal-body">
          <img :src="getImageUrl(modalImage)" :alt="modalImage.name" class="modal-image">
        </div>
        <div class="modal-footer">
          <button class="btn-action secondary" @click="closeModal">Fechar</button>
        </div>
      </div>
    </div>
      </div>

      <footer class="ag-footer">
        <span v-if="status" class="ag-status" :class="statusType">{{ status }}</span>
      </footer>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

export default {
  name: 'App',
  setup() {
    const activePage = ref('captura'); // 'captura', 'entregar', 'qa', 'relatorios'
    const selectedLote = ref('');
    const selectedGtin = ref('');
    const inputGtin = ref('');
    const tempImages = ref([]);
    const previousImages = ref([]);
    const loteItems = ref([]);
    const availableLotes = ref([]);
    const modalImage = ref(null);
    const status = ref('');
    const statusType = ref('');
    const currentStatus = ref('');
    const excelFile = ref(null);
    const excelItems = ref([]);
    const excelConflicts = ref([]);

    // Product QA state
    const qaSelectedLote = ref('');
    const qaProducts = ref([]);
    const deliveryProductKey = ref('');
    const qaPhotoLote = ref('');
    const qaPhotoGtin = ref('');
    const qaPhotos = ref([]);
    const qaAvailableLotes = ref([]);
    const qaAvailableGtins = ref([]);
    const reportStatus = ref('');
    const reportItems = ref([]);
    const reportStats = ref(null);

    // Vehicles state
    const vehiclesLote = ref('');
    const vehicles = ref([]);

    let refreshInterval = null;

    // Computed
    const currentStatusLabel = computed(() => {
      const labels = {
        em_captura: 'Em Captura',
        pendente_qa: 'Pendente QA',
        pronto_para_entrega: 'Pronto para Entrega',
        entregando: 'Entregando',
        entregue: 'Entregue',
        erro_entrega: 'Erro na Entrega',
        retrabalho: 'Retrabalho'
      };
      return labels[currentStatus.value] || currentStatus.value;
    });

    // Methods
    const showStatus = (message, type = 'success') => {
      status.value = message;
      statusType.value = type;
      setTimeout(() => {
        status.value = '';
        statusType.value = '';
      }, 3000);
    };

    const makeOperationId = prefix => {
      const randomId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `${prefix}-${randomId}`;
    };

    const loadAvailableLotes = async () => {
      try {
        const response = await this.$api.request('/api/lotes');
        if (response.ok) {
          availableLotes.value = (response.data.lotes || []).map(lote => lote.numero || lote);
          await loadQaLotes();
        }
      } catch (err) {
        availableLotes.value = [];
      }
    };

    const loadTempImages = async () => {
      try {
        const response = await this.$api.getTempImages();
        if (response.ok) {
          tempImages.value = response.data.images || [];
        }
      } catch (err) {
        console.error('Error loading temp images:', err);
      }
    };

    const loadLote = async () => {
      if (!selectedLote.value) {
        loteItems.value = [];
        return;
      }

      try {
        const response = await this.$api.getLote(selectedLote.value);
        if (response.ok) {
          loteItems.value = response.data.itens || [];
        }
      } catch (err) {
        console.error('Error loading lote:', err);
      }
    };

    const loadPreviousImages = async () => {
      if (!selectedLote.value || !selectedGtin.value) {
        previousImages.value = [];
        currentStatus.value = '';
        return;
      }

      try {
        const response = await this.$api.getPreviousImages(
          selectedLote.value,
          selectedGtin.value
        );
        if (response.ok) {
          previousImages.value = response.data.images || [];

          // Find the item to get status
          const item = loteItems.value.find(i => i.gtin === selectedGtin.value);
          if (item) {
            currentStatus.value = item.status;
          }
        }
      } catch (err) {
        console.error('Error loading previous images:', err);
      }
    };

    const onLoteSelected = async () => {
      selectedGtin.value = '';
      inputGtin.value = '';
      currentStatus.value = '';
      await loadLote();
      showStatus(`Lote ${selectedLote.value} selecionado`, 'success');
    };

    const onGtinEnter = () => {
      if (inputGtin.value && selectedLote.value) {
        selectedGtin.value = inputGtin.value;
        inputGtin.value = '';
        loadPreviousImages();
      }
    };

    const onSaveCapture = async () => {
      if (!selectedLote.value || !selectedGtin.value || tempImages.value.length === 0) return;

      try {
        const response = await this.$api.saveCaptureCapture(
          selectedLote.value,
          selectedGtin.value,
          '',
          ''
        );

        if (response.ok) {
          showStatus(`✓ ${response.data.fotosCopidas} fotos salvas`, 'success');
          selectedGtin.value = '';
          inputGtin.value = '';
          currentStatus.value = '';
          await loadTempImages();
          await loadLote();
          await loadPreviousImages();
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onClearTemp = async () => {
      if (!confirm(`Remover ${tempImages.value.length} imagens?`)) return;

      try {
        const filenames = tempImages.value.map(img => img.name);
        const response = await this.$api.clearTemp(filenames);

        if (response.ok) {
          showStatus(`✓ ${response.data.removed.length} imagens removidas`, 'success');
          await loadTempImages();
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onImageDelete = async (img) => {
      if (!confirm(`Remover ${img.name}?`)) return;

      try {
        await this.$api.clearTemp([img.name]);
        await loadTempImages();
        showStatus('Imagem removida', 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onImageZoom = (img) => {
      openModal(img);
    };

    const onImageError = (e) => {
      e.target.parentElement.classList.add('error');
      e.target.parentElement.textContent = 'Erro';
    };

    const getImageUrl = (img) => {
      if (!img) return '';
      const isFromTemp = tempImages.value.some(t => t.name === img.name);
      if (isFromTemp) {
        return `/api/captura/imagem/temp/${img.name}`;
      }
      return `/api/captura/imagem/finalizadas/${selectedLote.value}/${selectedGtin.value}/${img.name}`;
    };

    const openModal = (img) => {
      modalImage.value = img;
    };

    const closeModal = () => {
      modalImage.value = null;
    };

    const onExcelFileSelected = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      excelFile.value = file;
      excelItems.value = [];
      excelConflicts.value = [];

      // Read and parse file (placeholder - real parsing on server)
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          // In production, would parse with exceljs or send to server
          showStatus(`✓ ${file.name} selecionado (${file.size} bytes)`, 'success');
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onImportExcel = async () => {
      const loteParaImportar = selectedLote.value || qaSelectedLote.value;
      if (!loteParaImportar || !excelFile.value) return;

      try {
        showStatus('Importando...', 'success');
        // Send file to server for parsing
        // In production, use FormData with multer
        showStatus(`✓ Excel importado (mock)`, 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    // Product QA methods
    const onLoadQaProducts = async () => {
      if (!qaSelectedLote.value) return;

      try {
        const response = await this.$api.request(`/api/qa/produtos/${qaSelectedLote.value}`);
        if (response.ok) {
          qaProducts.value = response.data.ready || [];
          showStatus(`✓ ${qaProducts.value.length} produtos carregados`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const loadQaLotes = async () => {
      try {
        const response = await this.$api.request('/api/lotes');
        if (response.ok) {
          qaAvailableLotes.value = (response.data.lotes || []).map(lote => lote.numero || lote);
        }
      } catch (err) {
        qaAvailableLotes.value = [];
      }
    };

    const onQaLoteChange = async () => {
      qaAvailableGtins.value = [];
      qaPhotoGtin.value = '';
      qaPhotos.value = [];

      if (!qaPhotoLote.value) return;

      try {
        const response = await this.$api.request(
          `/api/lotes/${qaPhotoLote.value}/itens`
        );
        if (response.ok) {
          // Filtra apenas GTINs que precisam de QA (pendente_qa ou retrabalho)
          const pendingQa = (response.data.itens || []).filter(
            item => item.status === 'pendente_qa' || item.status === 'retrabalho'
          );
          qaAvailableGtins.value = pendingQa.map(item => item.gtin || item);
          showStatus(`✓ ${qaAvailableGtins.value.length} GTINs pendentes de QA`, 'success');
        }
      } catch (err) {
        showStatus(`✗ Erro ao carregar GTINs`, 'error');
      }
    };

    const onLoadQaPhotos = async () => {
      if (!qaPhotoLote.value || !qaPhotoGtin.value) return;

      try {
        const response = await this.$api.request(
          `/api/qa/fotos/${qaPhotoLote.value}/${qaPhotoGtin.value}`
        );
        if (response.ok) {
          qaPhotos.value = response.data.photos || [];
          showStatus(`✓ ${qaPhotos.value.length} fotos carregadas`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onClassifyPhoto = async (photo, classification) => {
      try {
        const response = await this.$api.request(
          '/api/qa/classificar',
          {
            method: 'POST',
            data: {
              lote: qaPhotoLote.value,
              gtin: qaPhotoGtin.value,
              filename: photo.filename,
              classification
            }
          }
        );
        if (response.ok) {
          photo.classification = classification;
          showStatus(`✓ Foto classificada como ${classification}`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onCompleteQa = async () => {
      if (!qaPhotoLote.value || !qaPhotoGtin.value) return;

      try {
        const response = await this.$api.request(
          '/api/qa/concluir',
          {
            method: 'POST',
            data: {
              lote: qaPhotoLote.value,
              gtin: qaPhotoGtin.value,
              deliveryType: 'normal'
            }
          }
        );
        if (response.ok) {
          showStatus(`✓ QA concluído - Pronto para entrega`, 'success');
          qaPhotos.value = [];
          qaPhotoGtin.value = '';
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onPrepareDelivery = async (product) => {
      const productKey = `${product.gtin}:${product.codigo}`;
      if (deliveryProductKey.value) return;
      deliveryProductKey.value = productKey;
      try {
        const prepareResponse = await this.$api.request(
          '/api/entregas/preparar',
          {
            method: 'POST',
            data: {
              lote: qaSelectedLote.value,
              gtin: product.gtin,
              codigo: product.codigo,
              deliveryType: 'normal',
              operationId: makeOperationId('delivery-prepare')
            }
          }
        );
        if (!prepareResponse.ok) {
          showStatus(`✗ ${prepareResponse.error}`, 'error');
          return;
        }

        const executeResponse = await this.$api.request(
          '/api/entregas/executar',
          {
            method: 'POST',
            data: {
              lote: qaSelectedLote.value,
              gtin: product.gtin,
              codigo: product.codigo,
              deliveryType: 'normal',
              attemptId: prepareResponse.data.attemptId,
              operationId: makeOperationId('delivery-execute')
            }
          }
        );

        if (executeResponse.ok) {
          showStatus(`✓ Entrega concluida - ${prepareResponse.data.manifest.fileCount} arquivos`, 'success');
          await onLoadQaProducts();
        } else {
          showStatus(`✗ ${executeResponse.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        deliveryProductKey.value = '';
      }
    };

    const onLoadReport = async () => {
      try {
        const query = reportStatus.value ? `?status=${reportStatus.value}` : '';
        const response = await this.$api.request(`/api/relatorios/produtos${query}`);
        if (response.ok) {
          reportItems.value = response.data.items || [];
          reportStats.value = response.data.stats || {};
          showStatus(`✓ Relatório gerado - ${reportItems.value.length} itens`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    // Vehicle methods
    const onLoadVehicles = async () => {
      try {
        const response = await this.$api.request(`/api/carros/${vehiclesLote.value}`);
        if (response.ok) {
          vehicles.value = response.data.vehicles || [];
          showStatus(`✓ ${vehicles.value.length} veículos carregados`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onCompleteVehicleQa = async (placa) => {
      try {
        const response = await this.$api.request(`/api/carros/${vehiclesLote.value}/${placa}/qa`, {
          method: 'POST'
        });
        if (response.ok) {
          showStatus(`✓ QA concluído para ${placa}`, 'success');
          await onLoadVehicles();
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onDeliverVehicle = async (placa) => {
      try {
        const response = await this.$api.request(`/api/carros/${vehiclesLote.value}/${placa}/entregar`, {
          method: 'POST'
        });
        if (response.ok) {
          showStatus(`✓ ${placa} entregue para ADSET`, 'success');
          await onLoadVehicles();
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    onMounted(async () => {
      // Load initial data
      await loadAvailableLotes();
      await loadTempImages();
      await loadQaLotes();

      // Refresh temp images every 2 seconds
      refreshInterval = setInterval(loadTempImages, 2000);
    });

    onUnmounted(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    });

    return {
      activePage,
      selectedLote,
      selectedGtin,
      inputGtin,
      tempImages,
      previousImages,
      loteItems,
      availableLotes,
      modalImage,
      status,
      statusType,
      currentStatus,
      currentStatusLabel,
      excelFile,
      excelItems,
      excelConflicts,
      qaSelectedLote,
      qaProducts,
      deliveryProductKey,
      qaPhotoLote,
      qaPhotoGtin,
      qaPhotos,
      qaAvailableLotes,
      qaAvailableGtins,
      reportStatus,
      reportItems,
      reportStats,
      vehiclesLote,
      vehicles,
      onLoteSelected,
      onGtinEnter,
      onSaveCapture,
      onClearTemp,
      onImageDelete,
      onImageZoom,
      onImageError,
      openModal,
      closeModal,
      getImageUrl,
      onExcelFileSelected,
      onImportExcel,
      onLoadQaProducts,
      loadQaLotes,
      onQaLoteChange,
      onLoadQaPhotos,
      onClassifyPhoto,
      onCompleteQa,
      onPrepareDelivery,
      onLoadReport,
      onLoadVehicles,
      onCompleteVehicleQa,
      onDeliverVehicle
    };
  }
};
</script>

<style scoped>
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
