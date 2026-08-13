<template>
  <div class="app-container">
    <header>
      <div class="logo">
        <img src="/favicon.svg" alt="AG Foto" class="logo-svg">
        <div>
          <div class="title">AG Foto</div>
          <div class="subtitle">Captura de Produtos</div>
        </div>
      </div>
    </header>

    <main>
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
      onLoteSelected,
      onGtinEnter,
      onSaveCapture,
      onClearTemp,
      onImageDelete,
      onImageZoom,
      onImageError,
      openModal,
      closeModal
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
