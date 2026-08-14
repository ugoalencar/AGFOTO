<template>
  <div class="app-shell">
    <nav class="ag-rail" aria-label="Produtos">
      <img src="/favicon.svg" alt="AG Foto" class="ag-rail-mark">
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'captura' }" @click="activePage = 'captura'">
        <span>CAP</span>
        <small>Captura</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'entregar' }" @click="activePage = 'entregar'; qaHubTab = 'entregar'">
        <span>ENT</span>
        <small>Entregar</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'qa' }" @click="activePage = 'qa'; qaHubTab = 'qa'">
        <span>QA</span>
        <small>QA</small>
      </button>
      <button class="ag-rail-button" :class="{ 'is-active': activePage === 'relatorios' }" @click="activePage = 'relatorios'; qaHubTab = 'relatorios'">
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

    <!-- QA Hub Page -->
    <main v-if="['entregar', 'qa', 'relatorios'].includes(activePage)" style="padding: 0; display: flex; flex-direction: column; overflow: hidden;">
      <!-- Sub-tabs -->
      <div style="display: flex; gap: 0; background: #333; border-bottom: 2px solid #FF0000;">
        <button
          @click="activePage = 'entregar'; qaHubTab = 'entregar'"
          :style="{ flex: 1, background: qaHubTab === 'entregar' ? '#FF0000' : '#444', color: '#fff', border: 'none', padding: '1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }">
          📤 Entregar
        </button>
        <button
          @click="activePage = 'qa'; qaHubTab = 'qa'"
          :style="{ flex: 1, background: qaHubTab === 'qa' ? '#FF0000' : '#444', color: '#fff', border: 'none', padding: '1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }">
          🔍 QA
        </button>
        <button
          @click="activePage = 'relatorios'; qaHubTab = 'relatorios'"
          :style="{ flex: 1, background: qaHubTab === 'relatorios' ? '#FF0000' : '#444', color: '#fff', border: 'none', padding: '1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }">
          📊 Relatórios
        </button>
      </div>

      <!-- Tab Content -->
      <div style="flex: 1; overflow-y: auto; padding: 2rem;">
        <!-- Aba Entregar -->
        <div v-if="qaHubTab === 'entregar'">
          <h2 style="color: #FF0000;">📤 Entrega de Produtos</h2>

          <div style="background: var(--ag-dark-gray); padding: 1.5rem; border: 2px solid var(--ag-border); margin-bottom: 2rem;">
            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Selecione Lote:</label>
            <input
              v-model="qaSelectedLote"
              type="text"
              placeholder="Digite número do lote"
              style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">

            <button
              @click="onLoadQaProducts"
              :disabled="!qaSelectedLote"
              class="btn-action primary"
              style="width: 100%;">
              Carregar Produtos
            </button>
          </div>

          <div v-if="qaProducts.length > 0" style="margin-top: 2rem;">
            <h3>Produtos Prontos para Entrega ({{ qaProducts.length }})</h3>
            <div style="overflow-x: auto; border: 1px solid var(--ag-border);">
              <table style="width: 100%; font-size: 0.875rem;">
                <thead style="background: var(--ag-dark-gray);">
                  <tr>
                    <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">GTIN</th>
                    <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Código</th>
                    <th style="padding: 0.75rem; text-align: left; border-right: 1px solid var(--ag-border);">Qtd Fotos</th>
                    <th style="padding: 0.75rem; text-align: left;">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(product, idx) in qaProducts" :key="idx" style="border-bottom: 1px solid var(--ag-border);">
                    <td style="padding: 0.75rem;">{{ product.gtin }}</td>
                    <td style="padding: 0.75rem;">{{ product.codigo }}</td>
                    <td style="padding: 0.75rem;">{{ product.quantidadeFotos }}</td>
                    <td style="padding: 0.75rem;">
                      <button
                        @click="onPrepareDelivery(product)"
                        :disabled="deliveryProductKey === `${product.gtin}:${product.codigo}`"
                        style="background: #FF8800; color: #000; border: none; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; font-size: 0.75rem;">
                        {{ deliveryProductKey === `${product.gtin}:${product.codigo}` ? 'Entregando...' : 'Entregar' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Aba QA -->
        <div v-if="qaHubTab === 'qa'">
          <h2 style="color: #FF0000;">🔍 Classificação de Fotos</h2>

          <div style="background: var(--ag-dark-gray); padding: 1.5rem; border: 2px solid var(--ag-border); margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Lote:</label>
                <input
                  v-model="qaPhotoLote"
                  type="text"
                  placeholder="Lote"
                  style="width: 100%; padding: 0.75rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">
              </div>
              <div>
                <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">GTIN:</label>
                <input
                  v-model="qaPhotoGtin"
                  type="text"
                  placeholder="GTIN"
                  style="width: 100%; padding: 0.75rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">
              </div>
            </div>

            <button
              @click="onLoadQaPhotos"
              :disabled="!qaPhotoLote || !qaPhotoGtin"
              class="btn-action primary"
              style="width: 100%; margin-top: 1rem;">
              Carregar Fotos
            </button>
          </div>

          <div v-if="qaPhotos.length > 0" style="margin-top: 2rem;">
            <h3>Fotos para QA ({{ qaPhotos.length }})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem;">
              <div
                v-for="(photo, idx) in qaPhotos"
                :key="idx"
                style="border: 2px solid var(--ag-border); padding: 0.5rem; text-align: center; font-size: 0.75rem;">
                <div style="background: var(--ag-dark-gray); height: 100px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem;">
                  📷
                </div>
                <div style="margin-bottom: 0.5rem;">{{ photo.filename.substring(0, 15) }}...</div>
                <div style="display: flex; gap: 0.25rem; margin-bottom: 0.5rem;">
                  <button
                    @click="onClassifyPhoto(photo, 'AP')"
                    style="flex: 1; background: #FFB400; color: #000; border: none; padding: 0.25rem; cursor: pointer; font-size: 0.7rem;">
                    AP
                  </button>
                  <button
                    @click="onClassifyPhoto(photo, 'AT')"
                    style="flex: 1; background: #00AA00; color: #fff; border: none; padding: 0.25rem; cursor: pointer; font-size: 0.7rem;">
                    AT
                  </button>
                </div>
                <div style="padding: 0.25rem; background: var(--ag-border); border-radius: 2px;">
                  {{ photo.classification || '—' }}
                </div>
              </div>
            </div>

            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
              <button
                @click="onCompleteQa"
                class="btn-action primary"
                style="flex: 1;">
                Concluir QA
              </button>
            </div>
          </div>
        </div>

        <!-- Aba Relatórios -->
        <div v-if="qaHubTab === 'relatorios'">
          <h2 style="color: #FF0000;">📊 Relatórios</h2>

          <div style="background: var(--ag-dark-gray); padding: 1.5rem; border: 2px solid var(--ag-border); margin-bottom: 2rem;">
            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Filtrar por Status:</label>
            <select
              v-model="reportStatus"
              style="width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 2px solid var(--ag-border); background: var(--ag-bg); color: var(--ag-fg);">
              <option value="">— Todos —</option>
              <option value="pendente_qa">Pendente QA</option>
              <option value="pronto_para_entrega">Pronto para Entrega</option>
              <option value="entregue">Entregue</option>
              <option value="erro_entrega">Erro na Entrega</option>
              <option value="retrabalho">Retrabalho</option>
            </select>

            <button
              @click="onLoadReport"
              class="btn-action primary"
              style="width: 100%;">
              Gerar Relatório
            </button>
          </div>

          <div v-if="reportStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #FF0000; padding: 1rem; border-radius: 4px; color: #fff;">
              <div style="font-size: 0.75rem; opacity: 0.8;">Total Itens</div>
              <div style="font-size: 1.5rem; font-weight: bold;">{{ reportStats.totalItens }}</div>
            </div>
            <div style="background: #00AA00; padding: 1rem; border-radius: 4px; color: #fff;">
              <div style="font-size: 0.75rem; opacity: 0.8;">Entregues</div>
              <div style="font-size: 1.5rem; font-weight: bold;">{{ reportStats.entregues }}</div>
            </div>
            <div style="background: #FFB400; padding: 1rem; border-radius: 4px; color: #000;">
              <div style="font-size: 0.75rem; opacity: 0.8;">Pendentes</div>
              <div style="font-size: 1.5rem; font-weight: bold;">{{ reportStats.pendentes }}</div>
            </div>
            <div style="background: #FF6600; padding: 1rem; border-radius: 4px; color: #fff;">
              <div style="font-size: 0.75rem; opacity: 0.8;">Erros</div>
              <div style="font-size: 1.5rem; font-weight: bold;">{{ reportStats.erros }}</div>
            </div>
          </div>

          <div v-if="reportItems.length > 0" style="margin-top: 2rem;">
            <h3>Resultados ({{ reportItems.length }} itens)</h3>
            <div style="overflow-x: auto; border: 1px solid var(--ag-border); max-height: 400px; overflow-y: auto;">
              <table style="width: 100%; font-size: 0.75rem;">
                <thead style="background: var(--ag-dark-gray); position: sticky; top: 0;">
                  <tr>
                    <th style="padding: 0.5rem; text-align: left;">GTIN</th>
                    <th style="padding: 0.5rem; text-align: left;">Código</th>
                    <th style="padding: 0.5rem; text-align: left;">Status</th>
                    <th style="padding: 0.5rem; text-align: left;">Fotos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in reportItems.slice(0, 20)" :key="idx" style="border-bottom: 1px solid var(--ag-border);">
                    <td style="padding: 0.5rem;">{{ item.gtin }}</td>
                    <td style="padding: 0.5rem;">{{ item.codigo }}</td>
                    <td style="padding: 0.5rem;"><span :class="`badge-status ${item.status}`">{{ item.status }}</span></td>
                    <td style="padding: 0.5rem;">{{ item.quantidadeFotos }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Veículos Page -->
    <main v-if="activePage === 'veiculos'" style="padding: 2rem; overflow-y: auto;">
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
          <img :src="`blob:${modalImage.path}`" :alt="modalImage.name" class="modal-image">
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
    const qaHubTab = ref('entregar'); // 'entregar', 'qa', 'relatorios'
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

    // QA Hub state
    const qaSelectedLote = ref('');
    const qaProducts = ref([]);
    const deliveryProductKey = ref('');
    const qaPhotoLote = ref('');
    const qaPhotoGtin = ref('');
    const qaPhotos = ref([]);
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

    // QA Hub methods
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
      qaHubTab,
      qaSelectedLote,
      qaProducts,
      deliveryProductKey,
      qaPhotoLote,
      qaPhotoGtin,
      qaPhotos,
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
      onExcelFileSelected,
      onImportExcel,
      onLoadQaProducts,
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
