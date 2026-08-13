<template>
  <div class="app-container">
    <header>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="logo">
          <img src="/favicon.svg" alt="AG Foto" class="logo-svg">
          <div>
            <div class="title">AG Foto</div>
            <div class="subtitle">Sistema de Fotografia</div>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button
            @click="activePage = 'captura'"
            :style="{ background: activePage === 'captura' ? '#FF0000' : '#666', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 'bold' }">
            📸 Captura
          </button>
          <button
            @click="activePage = 'planilhas'"
            :style="{ background: activePage === 'planilhas' ? '#FF0000' : '#666', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 'bold' }">
            📊 Planilhas
          </button>
        </div>
      </div>
    </header>

    <main v-if="activePage === 'captura'">
      <div class="panel-inputs">
        <div class="input-group-wrapper">
          <label>Lote</label>
          <input
            v-model="selectedLote"
            @keydown.enter="onLoteSelected"
            type="text"
            placeholder="Digite o número do lote"
            autocomplete="off">
          <button
            @click="onLoteSelected"
            :disabled="!selectedLote"
            style="padding: 0.75rem; background: #FF8800; color: #000; border: none; font-weight: bold; cursor: pointer;">
            Ir
          </button>
        </div>

        <div v-if="selectedLote && loteItems.length > 0" class="input-group-wrapper">
          <label>GTINs no Lote</label>
          <ul class="lote-list">
            <li
              v-for="item in loteItems"
              :key="item.gtin"
              class="lote-item"
              @click="selectedGtin = item.gtin">
              {{ item.gtin }}
              <small>({{ item.quantidadeFotos }})</small>
            </li>
          </ul>
        </div>

        <div class="input-group-wrapper">
          <label>GTIN/EAN</label>
          <input
            v-model="inputGtin"
            @keydown.enter="onGtinEnter"
            type="text"
            placeholder="Leitor ou digite"
            autocomplete="off">
        </div>

        <div v-if="selectedGtin" class="input-group-wrapper">
          <label>Status</label>
          <div style="padding: 0.75rem; background: var(--ag-dark-gray); border: 1px solid var(--ag-border);">
            <span :class="`badge-status ${currentStatus}`">{{ currentStatusLabel }}</span>
          </div>
        </div>

        <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--ag-border);">
          <button
            @click="onSaveCapture"
            :disabled="!selectedLote || !selectedGtin || tempImages.length === 0"
            class="btn-action primary"
            style="width: 100%;">
            Salvar ({{ tempImages.length }})
          </button>
          <button
            @click="onClearTemp"
            :disabled="tempImages.length === 0"
            class="btn-action secondary"
            style="width: 100%; margin-top: 0.5rem;">
            Limpar TEMP
          </button>
        </div>
      </div>

      <div class="stages-container">
        <div class="stage">
          <div class="stage-header">🎬 ATUAL (TEMP)</div>
          <div v-if="tempImages.length === 0" class="stage-content empty">
            Aguardando imagens da câmera...
          </div>
          <div v-else class="stage-content">
            <div
              v-for="img in tempImages"
              :key="img.name"
              class="thumbnail"
              @click="openModal(img)">
              <img :src="`blob:${img.path}`" :alt="img.name" @error="onImageError">
              <div class="thumbnail-overlay">
                <button @click.stop="onImageZoom(img)" class="btn-thumbnail" title="Ampliar">🔍</button>
                <button @click.stop="onImageDelete(img)" class="btn-thumbnail" title="Excluir">❌</button>
              </div>
            </div>
          </div>
        </div>

        <div class="stage">
          <div class="stage-header">📁 ANTERIOR ({{ selectedGtin || '—' }})</div>
          <div v-if="!selectedGtin || previousImages.length === 0" class="stage-content empty">
            {{ selectedGtin ? 'Nenhuma imagem anterior' : 'Selecione um GTIN' }}
          </div>
          <div v-else class="stage-content">
            <div
              v-for="img in previousImages"
              :key="img.name"
              class="thumbnail"
              @click="openModal(img)">
              <img :src="`blob:${img.path}`" :alt="img.name" @error="onImageError">
              <div class="thumbnail-overlay">
                <button @click.stop="onImageZoom(img)" class="btn-thumbnail" title="Ampliar">🔍</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <span v-if="status" :class="`${statusType}`">{{ status }}</span>
    </footer>

    <!-- Planilhas Page -->
    <main v-if="activePage === 'planilhas'" style="padding: 2rem; overflow-y: auto;">
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

    <!-- Modal de Imagem -->
    <div v-if="modalImage" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          {{ modalImage.name }}
          <button @click="closeModal" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 1.5rem;">×</button>
        </div>
        <div class="modal-body">
          <img :src="`blob:${modalImage.path}`" :alt="modalImage.name" class="modal-image">
        </div>
        <div class="modal-footer">
          <button class="btn-action secondary" @click="closeModal">Fechar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

export default {
  name: 'App',
  setup() {
    const activePage = ref('captura'); // 'captura' or 'planilhas'
    const selectedLote = ref('');
    const selectedGtin = ref('');
    const inputGtin = ref('');
    const tempImages = ref([]);
    const previousImages = ref([]);
    const loteItems = ref([]);
    const modalImage = ref(null);
    const status = ref('');
    const statusType = ref('');
    const currentStatus = ref('');
    const excelFile = ref(null);
    const excelItems = ref([]);
    const excelConflicts = ref([]);
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
        setTimeout(() => {
          document.querySelector('input[type="text"]')?.focus();
        }, 100);
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
      if (!selectedLote.value || !excelFile.value) return;

      try {
        showStatus('Importando...', 'success');
        // Send file to server for parsing
        // In production, use FormData with multer
        showStatus(`✓ Excel importado (mock)`, 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    onMounted(async () => {
      // Load initial data
      await loadTempImages();

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
      modalImage,
      status,
      statusType,
      currentStatus,
      currentStatusLabel,
      excelFile,
      excelItems,
      excelConflicts,
      onLoteSelected,
      onGtinEnter,
      onSaveCapture,
      onClearTemp,
      onImageDelete,
      onImageZoom,
      onImageError,
      openModal,
      closeModal,
      onExcelFileSelected,
      onImportExcel
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
