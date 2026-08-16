<template>
  <div class="app-shell">
    <nav class="ag-rail" :aria-label="plataforma === 'carros' ? 'Carros' : 'Produtos'">
      <img src="/graph/ag-simbolo.svg" alt="AG Fotografia" class="ag-rail-mark">

      <!-- Produtos e Carros sao plataformas separadas, cada uma com suas
           secoes, rodando no mesmo servidor. -->
      <template v-if="plataforma === 'produtos'">
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'captura' }" @click="activePage = 'captura'">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h3l1.5-2h9L18 8h3v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>
          <span>CAP</span>
          <small>Captura</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'entregar' }" @click="irPara('entregar')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>
          <span>ENT</span>
          <small>Entregar</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'qa' }" @click="irPara('qa')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
          <span>QA</span>
          <small>QA</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'relatorios' }" @click="activePage = 'relatorios'">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
          <span>REL</span>
          <small>Relat.</small>
        </button>
      </template>

      <template v-else>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'carros' }" @click="irParaCarros('carros')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10m0 0 4-4m-4 4-4-4"/><path d="M4 15v4h16v-4"/></svg>
          <span>IMP</span>
          <small>Importar</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'carros-qa' }" @click="irParaCarros('carros-qa')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
          <span>QA</span>
          <small>QA</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'carros-entrega' }" @click="irParaCarros('carros-entrega')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>
          <span>ENT</span>
          <small>Entrega</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'carros-relatorios' }" @click="irParaCarros('carros-relatorios')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
          <span>REL</span>
          <small>Relat.</small>
        </button>
        <button class="ag-rail-button" :class="{ 'is-active': activePage === 'carros-ajustes' }" @click="irParaCarros('carros-ajustes')">
          <svg class="ag-rail-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg>
          <span>SET</span>
          <small>Ajustes</small>
        </button>
      </template>

      <div class="ag-rail-foot">{{ plataforma === 'carros' ? 'Carros' : 'Fase 1' }}<br>{{ plataforma === 'carros' ? 'ADSET' : 'Produtos' }}</div>
    </nav>

    <div class="ag-main">
      <header class="ag-topbar">
        <div class="ag-wordmark"><img src="/graph/ag-horizontal.svg" alt="AG Fotografia"></div>
        <div class="ag-plataformas">
          <button :class="{ ativa: plataforma === 'produtos' }" @click="trocarPlataforma('produtos')">Produtos</button>
          <button :class="{ ativa: plataforma === 'carros' }" @click="trocarPlataforma('carros')">Carros</button>
        </div>

        <button class="ag-atualizar" :class="{ 'tem-novidade': atualizacao.temNovidade }"
                :title="atualizacaoTitulo" @click="onAtualizarSistema"
                :disabled="atualizando">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>
          </svg>
          <span>{{ atualizando ? 'Atualizando...' : 'Atualizar' }}</span>
          <b v-if="atualizacao.temNovidade">{{ atualizacao.atualizacoesPendentes }}</b>
        </button>
        <div class="ag-context">
          <span v-if="plataforma === 'produtos' && selectedLote" class="ag-chip">{{ rotuloLote(selectedLote) }}</span>
          <span v-if="plataforma === 'carros' && carrosData" class="ag-chip">{{ carrosData }}</span>
          <span class="ag-chip">{{ plataforma === 'carros' ? `ADSET ${adsetModo}` : 'Entrega local/mock' }}</span>
          <button v-if="plataforma === 'produtos'"
                  class="ag-camera" :class="`is-${cameraEstado}`"
                  :title="cameraMensagem + ' - clique para religar o simplusCamera'"
                  @click="onReligarCamera">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 8h3l1.5-2h9L18 8h3v11H3z"/><circle cx="12" cy="13" r="3.5"/>
            </svg>
            <span>{{ cameraRotulo }}</span>
          </button>
        </div>
      </header>

      <div class="ag-content">

<main v-if="activePage === 'captura'" class="ag-view capture-view">
  <!-- Row 1: busca do GTIN + descricao do produto -->
  <div class="capture-row-topo">
    <div class="capture-busca">
      <span class="capture-busca-icone">#</span>
      <input class="ag-field" v-model="inputGtin" @keydown.enter="onGtinSearch" type="text" placeholder="Digite o GTIN" autocomplete="off">
      <button class="ag-btn is-primary" @click="onGtinSearch" :disabled="!inputGtin">Buscar</button>
    </div>
    <div class="capture-info-box">
      <span class="capture-info-label">Produto:</span>
      <span class="capture-info-value">{{ descricaoProduto }}</span>
      <span v-if="selectedGtin" :class="`badge-status ${currentStatus}`" style="margin-left:auto">{{ currentStatusLabel }}</span>
    </div>
  </div>

  <!-- Row 2: coluna esquerda (palcos) + coluna direita (lote/GTINs) -->
  <div class="capture-row-principal">
    <!-- Coluna esquerda -->
    <div class="capture-coluna-esq">
      <section class="ag-card">
        <header class="ag-card-header">
          <h3 class="ag-card-title">Atual</h3>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ tempImages.length }} imagens</span>
        </header>
        <div class="ag-card-body">
          <div v-if="tempImages.length === 0" class="grid-empty">Nenhuma imagem nesta sessao</div>
          <div v-else class="grid-miniaturas">
            <div v-for="img in tempImages" :key="img.name" class="miniatura" @click="openModal(img, 'temp')">
              <img :src="`/api/captura/imagem/temp/${img.name}`" :alt="img.name" @error="onImageError">
              <button class="btn-deletar" @click.stop="onImageDelete(img)" title="Excluir">&times;</button>
            </div>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h3 class="ag-card-title">Anterior</h3>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ previousImages.length }} imagens</span>
        </header>
        <!-- Somente conferencia: os apontamentos das fotos ja salvas sao feitos no QA. -->
        <div class="ag-card-body">
          <div v-if="!selectedGtin" class="grid-empty">Selecione um GTIN</div>
          <div v-else-if="previousImages.length === 0" class="grid-empty">Nenhuma imagem anterior</div>
          <div v-else class="grid-miniaturas">
            <div v-for="img in previousImages" :key="img.name" class="miniatura" @click="openModal(img, 'anterior')">
              <img :src="`/api/captura/imagem/finalizadas/${selectedLote}/${selectedGtin}/${img.name}`" :alt="img.name" @error="onImageError">
              <button class="btn-deletar" @click.stop="onDeletePrevious(img)" title="Excluir">&times;</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Observacao do GTIN. Apontamento de foto e do QA, nao da captura. -->
      <div class="capture-obs-bar">
        <span class="capture-obs-label">Obs</span>
        <textarea class="ag-field" v-model="observacoes" rows="1" placeholder="Observacoes sobre o GTIN"></textarea>
      </div>

      <!-- Botoes de acao -->
      <div class="capture-acoes">
        <button class="ag-btn is-primary" @click="onSaveCapture"
                :disabled="!selectedLote || !selectedGtin || tempImages.length === 0 || salvandoCaptura">
          {{ salvandoCaptura ? 'Salvando...' : `Salvar (${tempImages.length})` }}
        </button>
        <button class="ag-btn is-ok" @click="onFinalizar"
                :disabled="!selectedLote || !selectedGtin || finalizandoCaptura">
          {{ finalizandoCaptura ? 'Finalizando...' : 'Finalizar' }}
        </button>
        <button class="ag-btn is-warning" @click="onClearTemp" :disabled="tempImages.length === 0">
          Limpar TEMP
        </button>
      </div>
    </div>

    <!-- Coluna direita -->
    <div class="capture-coluna-dir">
      <div class="capture-lote-head">
        <div class="capture-campo">
          <span class="capture-campo-label">Lote</span>
          <select class="ag-field" v-model="selectedLote" @change="onLoteSelected">
            <option value="">Selecione</option>
            <option v-for="lote in availableLotes" :key="lote" :value="lote">{{ rotuloLote(lote) }}</option>
          </select>
        </div>
        <div class="capture-campo">
          <span class="capture-campo-label">Qtde</span>
          <input class="ag-field" :value="loteItems.length" readonly>
        </div>
      </div>

      <section class="ag-card">
        <header class="ag-card-header">
          <h3 class="ag-card-title">GTINs do Lote</h3>
        </header>
        <div class="ag-table-wrap" style="max-height:400px;overflow-y:auto">
          <table class="ag-table">
            <thead>
              <tr><th>GTIN</th><th>Descricao</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in loteItems" :key="item.gtin"
                  class="linha-gtin" :class="{ ativa: selectedGtin === item.gtin }"
                  @click="selecionarGtinDaLista(item)">
                <td>{{ item.gtin }}</td>
                <td>{{ item.descricao }}</td>
                <td><span :class="`badge-status ${item.status}`">{{ item.status }}</span></td>
              </tr>
              <tr v-if="loteItems.length === 0">
                <td colspan="3" style="color:var(--ag-muted)">Selecione um lote</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
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
          <select class="ag-field" v-model="qaSelectedLote" @change="onLoadQaProducts">
            <option value="">Selecione um lote</option>
            <option v-for="lote in availableLotes" :key="lote" :value="lote">{{ rotuloLote(lote) }}</option>
          </select>

          <div style="margin-top:14px;padding:10px 12px;background:var(--ag-panel);border:1px solid var(--ag-line);border-radius:var(--ag-radius);font-size:12px;color:var(--ag-muted)">
            <div style="margin-bottom:6px">Destino de cada produto:</div>
            <code style="font-family:var(--ag-mono);color:var(--ag-text)">
              Entrega/{{ rotuloLote(qaSelectedLote || 'xxx') }}/&lt;codigo&gt;
            </code>
            <div style="margin-top:8px">A pasta usa o <b>codigo</b> do produto, nao o GTIN.</div>
          </div>

          <div v-if="entregaSemCodigo.length > 0" class="entrega-alerta">
            {{ entregaSemCodigo.length }} produto(s) ainda estao com o GTIN no lugar do codigo.
            Nenhuma planilha da pasta tem o EAN deles.
          </div>

          <!-- A sincronizacao nunca sobrescreve codigo ja definido; o que
               divergiu aparece aqui em vez de ser aplicado. -->
          <div v-if="planilhasConflitos.length > 0" class="entrega-alerta">
            {{ planilhasConflitos.length }} divergencia(s) entre planilha e produto - nada foi alterado:
            <div v-for="(c, i) in planilhasConflitos.slice(0, 5)" :key="i"
                 style="font-family:var(--ag-mono);font-size:11px;margin-top:4px">
              {{ c.ean || c.planilha }}: {{ c.motivo }}
            </div>
          </div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line)">
            <label class="ag-label">Planilha do cliente</label>
            <select class="ag-field" v-model="planilhaSelecionada">
              <option value="">{{ planilhas.length ? 'Selecione a planilha' : 'Nenhuma planilha em dados/xlsx' }}</option>
              <option v-for="arq in planilhas" :key="arq.nome" :value="arq.nome">{{ arq.nome }}</option>
            </select>
            <div style="font-size:11px;color:var(--ag-muted);margin-top:6px">
              Coloque o .xlsx em <code style="font-family:var(--ag-mono)">dados/xlsx</code> e recarregue a lista.
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="ag-btn" @click="onCarregarPlanilhas" :disabled="planilhaEmCurso">Recarregar</button>
              <button class="ag-btn is-warning" style="flex:1" @click="onImportExcel"
                      :disabled="!qaSelectedLote || !planilhaSelecionada || planilhaEmCurso">
                {{ planilhaEmCurso ? 'Importando...' : 'Importar e aplicar' }}
              </button>
            </div>
            <div v-if="excelConflicts.length > 0" class="entrega-alerta">
              {{ excelConflicts.length }} conflito(s) entre a planilha e o catalogo. Nada foi aplicado.
              <div v-for="(c, i) in excelConflicts.slice(0, 5)" :key="i" style="font-family:var(--ag-mono);font-size:11px;margin-top:4px">
                {{ c.ean }} · {{ c.field }}: "{{ c.existingValue }}" -> "{{ c.newValue }}"
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">Prontos para entrega</h2>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">
            {{ entregaSelecionados.length }} de {{ qaProducts.length }} selecionados
          </span>
        </header>

        <div v-if="!qaSelectedLote" class="grid-empty">Selecione um lote</div>
        <div v-else-if="qaProducts.length === 0" class="grid-empty">
          Nenhum produto pronto para entrega neste lote. Conclua o QA primeiro.
        </div>

        <div v-else class="ag-table-wrap">
          <table class="ag-table">
            <thead>
              <tr>
                <th style="width:34px">
                  <input type="checkbox" :checked="entregaTodosSelecionados" @change="onToggleTodosEntrega">
                </th>
                <th>GTIN</th>
                <th>Codigo (pasta)</th>
                <th>Descricao</th>
                <th>Fotos</th>
                <th>Situacao</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in qaProducts" :key="product.gtin"
                  :class="{ 'linha-selecionada': entregaSelecionados.includes(product.gtin) }">
                <td>
                  <input type="checkbox" :value="product.gtin" v-model="entregaSelecionados"
                         :disabled="entregaEmCurso">
                </td>
                <td>{{ product.gtin }}</td>
                <td>
                  <span :class="{ 'codigo-pendente': product.codigo === product.gtin }">
                    {{ product.codigo || '(sem codigo)' }}
                  </span>
                </td>
                <td>{{ product.descricao }}</td>
                <td>{{ product.quantidadeFotos }}</td>
                <td>
                  <span class="badge-status" :class="entregaResultados[product.gtin]?.classe || ''">
                    {{ entregaResultados[product.gtin]?.texto || 'aguardando' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="qaProducts.length > 0" class="qa-rodape">
          <button class="ag-btn is-ok" @click="onEntregarSelecionados"
                  :disabled="entregaSelecionados.length === 0 || entregaEmCurso">
            {{ entregaEmCurso ? `Entregando ${entregaProgresso}...` : `Entregar selecionados (${entregaSelecionados.length})` }}
          </button>
          <span style="color:var(--ag-muted);font-size:12px">
            Cada produto passa por staging, manifesto e verificacao antes de virar entregue.
          </span>
        </div>

        <!-- O produto entregue sai da lista de prontos; sem isso o resultado
             sumiria da tela junto com ele. -->
        <div v-if="entregaResumo.length > 0" class="entrega-resumo">
          <div class="entrega-resumo-titulo">Ultima entrega</div>
          <div v-for="item in entregaResumo" :key="item.gtin" class="entrega-resumo-linha">
            <span :class="item.ok ? 'entrega-ok' : 'entrega-erro'">{{ item.ok ? '✓' : '✗' }}</span>
            <span style="font-family:var(--ag-mono)">{{ item.gtin }}</span>
            <span style="color:var(--ag-muted)">→</span>
            <span style="font-family:var(--ag-mono)">{{ rotuloLote(qaSelectedLote) }}/{{ item.codigo }}</span>
            <span style="margin-left:auto;color:var(--ag-muted)">
              {{ item.ok ? `${item.arquivos} arquivo(s)` : item.error }}
            </span>
          </div>
        </div>
      </section>
    </main>
    <main v-if="activePage === 'qa'" class="ag-view qa-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Navegar</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Lote</label>
          <select class="ag-field" v-model="qaPhotoLote" @change="onQaLoteChange">
            <option value="">Selecione um lote</option>
            <option v-for="lote in qaAvailableLotes" :key="lote" :value="lote">{{ rotuloLote(lote) }}</option>
          </select>

          <label class="ag-label" style="margin-top:12px">GTIN ({{ qaAvailableGtins.length }})</label>
          <ul class="clinerules" v-if="qaAvailableGtins.length > 0">
            <li v-for="gtin in qaAvailableGtins" :key="gtin"
                class="clinerule" :class="{ active: qaPhotoGtin === gtin }"
                @click="onSelectQaGtin(gtin)">
              {{ gtin }}
            </li>
          </ul>
          <div v-else style="padding:0.75rem;color:var(--ag-muted);font-size:0.875rem">
            {{ qaPhotoLote ? 'Sem GTINs pendentes de QA' : 'Selecione um lote' }}
          </div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line);color:var(--ag-muted);font-size:12px">
            <p style="margin:0 0 6px"><b class="qa-tag-ap">AP</b> fica fora da entrega normal.</p>
            <p style="margin:0 0 6px"><b class="qa-tag-at">AT</b> entra na entrega de atualizacao.</p>
            <p style="margin:0">Clicar na marcacao ja aplicada desfaz. Tudo fica na auditoria.</p>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">{{ qaPhotoGtin || 'Fotos para QA' }}</h2>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">
            {{ qaPhotos.length }} imagens · {{ qaClassificadas }} marcadas
          </span>
        </header>

        <div class="ag-card-body">
          <div v-if="!qaPhotoGtin" class="grid-empty">Selecione um GTIN para revisar</div>
          <div v-else-if="qaPhotos.length === 0" class="grid-empty">Nenhuma foto salva para este GTIN</div>
          <div v-else class="grid-miniaturas">
            <div v-for="photo in qaPhotos" :key="photo.filename"
                 class="miniatura"
                 :class="{ 'qa-ap': photo.classification === 'AP', 'qa-at': photo.classification === 'AT' }">
              <img :src="photo.url" :alt="photo.filename" @click="openModal(photo, 'qa')" @error="onImageError">
              <span v-if="photo.classification" class="qa-selo" :class="photo.classification.toLowerCase()">
                {{ photo.classification }}
              </span>
              <button class="btn-deletar" @click.stop="onQaDeletePhoto(photo)" title="Excluir">&times;</button>
              <div class="qa-acoes">
                <button class="qa-botao ap" :class="{ ativo: photo.classification === 'AP' }"
                        :disabled="qaEmCurso" @click.stop="onClassifyPhoto(photo, 'AP')">AP</button>
                <button class="qa-botao at" :class="{ ativo: photo.classification === 'AT' }"
                        :disabled="qaEmCurso" @click.stop="onClassifyPhoto(photo, 'AT')">AT</button>
              </div>
            </div>
          </div>
        </div>

        <div class="qa-rodape">
          <label class="qa-tipo">
            <span>Entrega</span>
            <select class="ag-field" v-model="qaDeliveryType" :disabled="qaEmCurso">
              <option value="normal">Normal - {{ qaFotosNormais }} foto(s) sem marcacao</option>
              <option value="atualizacao">Atualizacao - {{ qaFotosAt }} foto(s) AT</option>
            </select>
          </label>

          <button class="ag-btn is-ok" @click="onCompleteQa"
                  :disabled="!qaPhotoGtin || qaEmCurso || qaFotosElegiveis === 0"
                  :title="qaMotivoBloqueio">
            Concluir QA
          </button>
          <button class="ag-btn is-warning" @click="onSendToRework" :disabled="!qaPhotoGtin || qaEmCurso">
            Mandar para retrabalho
          </button>

          <span v-if="qaMotivoBloqueio" class="qa-aviso">{{ qaMotivoBloqueio }}</span>
        </div>
      </section>
    </main>
    <main v-if="activePage === 'carros'" class="ag-view two-column-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Carregar</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Dia</label>
          <input class="ag-field" v-model="carrosData" type="text" placeholder="DD-MM-AAAA"
                 @change="onCarregarDia">
          <div style="font-size:11px;color:var(--ag-muted);margin-top:6px">
            As fotos vao para <code style="font-family:var(--ag-mono)">Carros/{{ carrosData || 'DD-MM-AAAA' }}/PLACA</code>
          </div>

          <label class="ag-label" style="margin-top:14px">Pasta das fotos</label>
          <div style="display:flex;gap:8px">
            <input class="ag-field is-caminho" v-model="carrosPasta" type="text"
                   placeholder="E:/DCIM/100CANON" @keydown.enter="onLerPastaCarros" style="flex:1">
            <button class="ag-btn" @click="onAbrirExplorador">Procurar</button>
          </div>
          <button class="ag-btn is-primary" style="width:100%;margin-top:10px"
                  @click="onLerPastaCarros" :disabled="!carrosPasta || carrosLendo">
            {{ carrosLendo ? 'Lendo...' : 'Carregar' }}
          </button>

          <!-- Explorador: o navegador nao entrega o caminho real de uma pasta,
               entao quem lista o disco e o servidor. -->
          <div v-if="explorerAberto" class="explorer">
            <div class="explorer-topo">
              <button class="ag-btn explorer-subir" @click="onExplorarPai"
                      :disabled="!explorerPai && !explorerAtual">&larr;</button>
              <span class="explorer-caminho">{{ explorerAtual || 'Este computador' }}</span>
              <button class="ag-btn explorer-fechar" @click="explorerAberto = false">&times;</button>
            </div>

            <div v-if="explorerErro" class="explorer-erro">{{ explorerErro }}</div>

            <ul class="explorer-lista">
              <li v-for="pasta in explorerPastas" :key="pasta.caminho"
                  @click="onExplorar(pasta.caminho)">
                {{ pasta.nome }}
              </li>
              <li v-if="explorerPastas.length === 0" class="explorer-vazio">
                Nenhuma subpasta aqui
              </li>
            </ul>

            <div class="explorer-rodape">
              <span>{{ explorerFotos }} foto(s) nesta pasta</span>
              <button class="ag-btn is-ok" @click="onUsarPastaAtual" :disabled="!explorerAtual">
                Usar esta pasta
              </button>
            </div>
          </div>

          <div v-if="carrosFotos.length > 0" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--ag-line)">
            <div style="font-size:12px;color:var(--ag-muted);margin-bottom:8px">
              {{ carrosFotos.length }} fotos · {{ carrosGrupos.length }} carro(s) ·
              {{ carrosPlacasInformadas }} placa(s)
            </div>
            <div v-if="carrosPlacasLidas > 0" style="font-size:11px;color:var(--ag-ok);margin-bottom:8px">
              {{ carrosPlacasLidas }} placa(s) lida(s) das fotos. Confira antes de importar:
              o OCR erra com placa suja, torta ou de longe.
            </div>
            <div v-if="carrosSemPlaca > 0" class="entrega-alerta">
              {{ carrosSemPlaca }} carro(s) sem placa reconhecida. Eles entram como
              NAO-RECONHECIDO e voce renomeia no QA - ou digite a placa aqui mesmo.
            </div>

            <!-- Fotos do mesmo carro saem juntas; entre um carro e outro ha uma
                 pausa. O corte e ajustavel porque esse ritmo muda com o trabalho. -->
            <label class="ag-label" style="margin-top:4px">Separar carros a cada</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input class="ag-field" type="number" min="1" max="60" v-model.number="carrosIntervalo"
                     style="width:70px">
              <span style="font-size:12px;color:var(--ag-muted)">minuto(s) de pausa</span>
            </div>
            <div v-if="carrosSemExif > 0" class="entrega-alerta">
              {{ carrosSemExif }} foto(s) sem a hora do disparo no EXIF: nelas a ordem
              usa a data do arquivo, que copiar ou editar pode ter mudado. Confira a
              sequencia antes de importar.
            </div>
            <div class="entrega-alerta" v-if="carrosFotosAntesDaPlaca > 0">
              As {{ carrosFotosAntesDaPlaca }} primeira(s) foto(s) estao antes de qualquer placa
              e nao entram em nenhum veiculo.
            </div>
            <button class="ag-btn is-ok" style="width:100%;margin-top:10px"
                    @click="onImportarCarros"
                    :disabled="!carrosData || carrosGrupos.length === 0 || carrosImportando">
              {{ carrosImportando ? 'Importando...' : `Importar ${carrosGrupos.length} carro(s)` }}
            </button>
            <div style="font-size:11px;color:var(--ag-muted);margin-top:6px">
              Copia as fotos para <code style="font-family:var(--ag-mono)">Carros/{{ carrosData }}/PLACA</code>.
              O cartao nao e apagado.
            </div>
          </div>

          <!-- Placas do dia: escolher qual vai para o palco, e receber fotos
               arrastadas de outra placa. -->
          <div v-if="carrosPlacas.length > 0" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line)">
            <label class="ag-label">Placas do dia ({{ carrosPlacas.length }})</label>
            <ul class="placa-lista">
              <li v-for="placa in carrosPlacas" :key="placa.placa"
                  :class="{ ativa: carrosPlacaSelecionada === placa.placa, alvo: carrosPlacaAlvo === placa.placa }"
                  @click="carrosPlacaSelecionada = placa.placa"
                  @dragover.prevent="carrosPlacaAlvo = placa.placa"
                  @dragleave="carrosPlacaAlvo = ''"
                  @drop.prevent="onSoltarNaPlaca(placa.placa)">
                <span class="placa-lista-nome" :class="{ 'nao-reconhecida': placa.placa.startsWith('NAO-RECONHECIDO') }">{{ placa.placa }}</span>
                <span class="placa-lista-total">{{ placa.total }}</span>
              </li>
            </ul>
            <div style="font-size:11px;color:var(--ag-muted);margin-top:6px">
              Arraste uma foto do palco para outra placa desta lista para move-la.
            </div>
          </div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line)">
            <label class="ag-label">Criar placa</label>
            <div style="display:flex;gap:8px">
              <input class="ag-field" v-model="carrosNovaPlaca" type="text" placeholder="ABC1234"
                     maxlength="8" style="flex:1;text-transform:uppercase"
                     @keydown.enter="onCriarPlaca">
              <button class="ag-btn" @click="onCriarPlaca" :disabled="!carrosData || !carrosNovaPlaca">
                Criar
              </button>
            </div>
            <div style="font-size:11px;color:var(--ag-muted);margin-top:6px">
              Quando faltou a foto da placa e dois carros ficaram juntos: crie a placa
              e arraste para ela as fotos que sao dela.
            </div>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">{{ carrosFotos.length ? 'Fotos na sequencia' : 'Placas do dia' }}</h2>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">
            {{ carrosFotos.length ? carrosPasta : `${carrosPlacas.length} placa(s) · ${carrosTotalFotos} fotos` }}
          </span>
        </header>

        <!-- Onde os arquivos foram parar, para nao precisar adivinhar. -->
        <div v-if="!carrosFotos.length && carrosPastaDestino" class="carros-destino">
          <span>Gravado em</span>
          <code>{{ carrosPastaDestino }}</code>
        </div>

        <div class="ag-card-body">
          <!-- Sequencia recem-carregada, ja separada em carros pelo intervalo
               entre as fotos: basta uma placa por grupo. -->
          <div v-if="carrosFotos.length > 0">
            <div v-for="(grupo, g) in carrosGrupos" :key="g" class="grupo-carro">
              <div class="grupo-cabecalho">
                <span class="grupo-titulo">Carro {{ g + 1 }}</span>
                <span class="grupo-info">
                  {{ grupo.fotos.length }} foto(s) · {{ formatarHora(grupo.fotos[0].capturadaEm) }}
                  &rarr; {{ formatarHora(grupo.fotos[grupo.fotos.length - 1].capturadaEm) }}
                </span>
                <span v-if="grupo.lida" class="grupo-lida" title="Placa lida da foto - confira">
                  lida
                </span>
                <span v-else class="grupo-nao-lida" title="Placa nao reconhecida: entra como NAO-RECONHECIDO e voce renomeia no QA">
                  nao reconhecida
                </span>
                <input class="ag-field grupo-placa" :value="grupo.placa"
                       type="text" maxlength="8" placeholder="placa deste carro"
                       @input="definirPlacaDoGrupo(g, $event.target.value)">
              </div>
              <div class="carros-sequencia">
                <div v-for="foto in grupo.fotos" :key="foto.name"
                     class="carro-foto" :class="{ 'e-placa': !!grupo.placa }">
                  <div class="carro-foto-seq">{{ foto.sequencia }}</div>
                  <img :src="`/api/carros/pasta/imagem/${encodeURIComponent(foto.name)}`"
                       :alt="foto.name" @click="openModal({ name: foto.name }, 'carros')">
                  <div class="carro-foto-nome" :title="foto.name">
                    {{ formatarHora(foto.capturadaEm) }}
                    <span v-if="foto.origemDaHora === 'arquivo'" class="hora-arquivo" title="Sem EXIF: hora do arquivo">~</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="carrosPlacas.length === 0" class="grid-empty">
            Nenhuma placa neste dia. Aponte a pasta das fotos e carregue.
          </div>

          <div v-else class="grid-empty">
            {{ carrosPlacas.length }} placa(s) gravadas. Va para QA quando as fotos
            voltarem da edicao.
          </div>

        </div>
      </section>
    </main>

    <main v-if="activePage === 'relatorios'" class="ag-view report-view">
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Filtros e totais</h2></header><div class="ag-card-body"><label class="ag-label">Status</label><select class="ag-field" v-model="reportStatus"><option value="">Todos</option><option value="pendente_qa">Pendente QA</option><option value="pronto_para_entrega">Pronto para Entrega</option><option value="entregue">Entregue</option><option value="erro_entrega">Erro na Entrega</option><option value="retrabalho">Retrabalho</option></select><button class="ag-btn is-primary" style="width:100%;margin-top:12px" @click="onLoadReport">Gerar relatorio</button><div v-if="reportStats" class="kpi-grid" style="margin-top:14px"><div class="kpi-card"><strong>{{ reportStats.totalItens ?? reportStats.totalItems ?? 0 }}</strong><span>Itens</span></div><div class="kpi-card"><strong>{{ reportStats.entregues ?? reportStats.entregue ?? 0 }}</strong><span>Entregues</span></div><div class="kpi-card"><strong>{{ reportStats.prontos ?? reportStats.pronto_para_entrega ?? 0 }}</strong><span>Prontos</span></div><div class="kpi-card"><strong>{{ reportStats.retrabalho ?? 0 }}</strong><span>Retrabalho</span></div></div></div></section>
      <section class="ag-card"><header class="ag-card-header"><h2 class="ag-card-title">Detalhamento</h2><span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ reportItems.length }} linhas</span></header><div class="ag-table-wrap"><table class="ag-table"><thead><tr><th>Lote</th><th>GTIN</th><th>Codigo</th><th>Descricao</th><th>Fotos</th><th>Status</th></tr></thead><tbody><tr v-for="item in reportItems" :key="`${item.lote}:${item.gtin}`"><td>{{ rotuloLote(item.lote) }}</td><td>{{ item.gtin }}</td><td>{{ item.codigo }}</td><td>{{ item.descricao }}</td><td>{{ item.quantidadeFotos }}</td><td><span :class="`badge-status ${item.status}`">{{ item.status }}</span></td></tr></tbody></table></div></section>
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

    <!-- ============ CARROS: QA depois da edicao externa ============ -->
    <main v-if="activePage === 'carros-qa'" class="ag-view two-column-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Placas do dia</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Dia</label>
          <select class="ag-field" v-model="carrosData" @change="onCarregarDia">
            <option v-for="d in carrosDatas" :key="d" :value="d">{{ d }}</option>
            <option v-if="carrosDatas.length === 0" :value="carrosData">{{ carrosData }}</option>
          </select>
          <div v-if="carrosDatas.length > 1" style="font-size:11px;color:var(--ag-muted);margin-top:6px">
            A edicao externa costuma demorar: o dia comeca no ultimo com fotos, nao no de hoje.
          </div>

          <ul class="placa-lista" style="margin-top:12px" v-if="carrosPlacas.length > 0">
            <li v-for="placa in carrosPlacas" :key="placa.placa"
                :class="{ ativa: carrosPlacaSelecionada === placa.placa, alvo: carrosPlacaAlvo === placa.placa }"
                @click="carrosPlacaSelecionada = placa.placa"
                @dragover.prevent="carrosPlacaAlvo = placa.placa"
                @dragleave="carrosPlacaAlvo = ''"
                @drop.prevent="onSoltarNaPlaca(placa.placa)">
              <span class="placa-lista-nome" :class="{ 'nao-reconhecida': placa.placa.startsWith('NAO-RECONHECIDO') }">{{ placa.placa }}</span>
              <span class="badge-status" :class="placa.status">{{ rotuloStatusCarro(placa.status) }}</span>
              <span class="placa-lista-total">{{ placa.total }}</span>
            </li>
          </ul>
          <div v-else class="grid-empty">Nenhuma placa neste dia.</div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--ag-line);color:var(--ag-muted);font-size:12px">
            <p style="margin:0 0 6px">As fotos sao editadas num programa de fora e
            voltam para esta pasta.</p>
            <p style="margin:0">Confira a ordem, marque a capa e aprove para liberar a entrega.</p>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">{{ placaAtual ? placaAtual.placa : 'QA dos carros' }}</h2>
          <span v-if="placaAtual" style="margin-left:auto;color:var(--ag-muted);font-size:12px">
            {{ placaAtual.total }} foto(s)
          </span>
        </header>

        <div class="ag-card-body">
          <div v-if="!placaAtual" class="grid-empty">Escolha uma placa para revisar.</div>

          <div v-else-if="placaAtual.total === 0" class="grid-empty">
            Placa vazia. Arraste fotos de outra placa para ca.
          </div>

          <div v-else class="palco-fotos">
            <div v-for="(foto, i) in placaAtual.fotos" :key="foto.name"
                 class="palco-foto"
                 :class="{ 'alvo-foto': carrosFotoAlvo === foto.name, capa: i === 0 }"
                 draggable="true"
                 @dragstart="onArrastarFoto(placaAtual.placa, foto.name)"
                 @dragover.prevent.stop="carrosFotoAlvo = foto.name"
                 @dragleave="carrosFotoAlvo = ''"
                 @drop.prevent.stop="onSoltarNaFoto(placaAtual.placa, i)">
              <div class="palco-foto-topo">
                <span class="palco-pos">{{ i + 1 }}</span>
                <span v-if="i === 0" class="palco-capa">capa</span>
                <button class="btn-deletar" @click.stop="onExcluirFotoCarro(placaAtual.placa, foto.name)"
                        title="Excluir">&times;</button>
              </div>
              <img :src="foto.url" :alt="foto.name"
                   @click="openModal({ name: foto.name, url: foto.url }, 'carros')">
              <div class="palco-foto-acoes">
                <button class="ag-btn" :disabled="i === 0"
                        @click.stop="onMoverPosicao(i, i - 1)" title="Mover para tras">&#8592;</button>
                <span class="palco-foto-nome">{{ foto.name }}</span>
                <button class="ag-btn" :disabled="i === placaAtual.fotos.length - 1"
                        @click.stop="onMoverPosicao(i, i + 1)" title="Mover para frente">&#8594;</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="placaAtual" class="qa-rodape">
          <button class="ag-btn is-ok" @click="onAprovarPlaca"
                  :disabled="placaAtual.total === 0 || placaAtual.status === 'entregue' || carrosEmCurso">
            Aprovar para entrega
          </button>
          <button class="ag-btn is-warning" @click="onReabrirPlaca"
                  :disabled="placaAtual.status === 'organizado' || carrosEmCurso">
            Reabrir
          </button>
          <button class="ag-btn placa-acao" @click="onRenomearPlaca(placaAtual.placa)">Corrigir placa</button>
          <span style="color:var(--ag-muted);font-size:12px">
            Situacao: {{ rotuloStatusCarro(placaAtual.status) }}
          </span>
        </div>
      </section>
    </main>

    <!-- ============ CARROS: entrega ao ADSET ============ -->
    <main v-if="activePage === 'carros-entrega'" class="ag-view two-column-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Dia</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Dia</label>
          <select class="ag-field" v-model="carrosData" @change="onCarregarDia">
            <option v-for="d in carrosDatas" :key="d" :value="d">{{ d }}</option>
            <option v-if="carrosDatas.length === 0" :value="carrosData">{{ carrosData }}</option>
          </select>
          <button class="ag-btn" style="width:100%;margin-top:12px" @click="onAbrirPastaEntrega">
            Abrir pasta Entrega
          </button>

          <div class="entrega-alerta" style="margin-top:14px">
            Entregar copia as fotos aprovadas, na ordem do QA, para
            <code style="font-family:var(--ag-mono)">Entrega/{{ carrosData }}/PLACA</code>.
          </div>

          <label class="ag-label" style="margin-top:16px">Envio ao site do ADSET</label>
          <div v-if="adsetModo === 'desligado'" class="entrega-alerta">
            Desligado. Preencha usuario, senha e modo em
            <code style="font-family:var(--ag-mono)">adset-config.json</code>.
          </div>
          <div v-else style="font-size:11px;color:var(--ag-muted);overflow-wrap:anywhere">
            Modo <b>{{ adsetModo }}</b> como <b>{{ adsetUsuario || '-' }}</b>.
            <span v-if="adsetModo === 'ensaio'">
              O ensaio acha a placa e para antes de excluir as fotos do anuncio.
            </span>
            <span v-else style="color:var(--ag-yellow)">
              Modo real: APAGA as fotos que o anuncio ja tem e sobe as nossas.
            </span>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">Prontas para entrega</h2>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">
            {{ carrosProntas.length }} de {{ carrosPlacas.length }} placa(s)
          </span>
        </header>
        <div class="ag-card-body">
          <div v-if="carrosProntas.length === 0" class="grid-empty">
            Nenhuma placa aprovada neste dia. Aprove no QA primeiro.
          </div>
          <div v-else class="ag-table-wrap">
            <table class="ag-table">
              <thead><tr><th>Placa</th><th>Fotos</th><th>Aprovada em</th><th>Acao</th></tr></thead>
              <tbody>
                <tr v-for="placa in carrosProntas" :key="placa.placa">
                  <td style="font-family:var(--ag-mono)">{{ placa.placa }}</td>
                  <td>{{ placa.total }}</td>
                  <td>{{ formatarData(placa.aprovadoEm) }}</td>
                  <td>
                    <button class="ag-btn is-ok" @click="onEntregarPlaca(placa.placa)"
                            :disabled="carrosEmCurso">Entregar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <template v-if="carrosEntregues.length > 0">
            <h3 class="ag-label" style="margin-top:22px">Entregues — subir no ADSET</h3>
            <div class="ag-table-wrap">
              <table class="ag-table">
                <thead><tr><th>Placa</th><th>Fotos</th><th>Entregue em</th><th>Acao</th></tr></thead>
                <tbody>
                  <tr v-for="placa in carrosEntregues" :key="placa.placa">
                    <td style="font-family:var(--ag-mono)">{{ placa.placa }}</td>
                    <td>{{ placa.total }}</td>
                    <td>{{ formatarData(placa.entregueEm) }}</td>
                    <td>
                      <button class="ag-btn" @click="onEnviarAoAdset(placa.placa, 'ensaio')"
                              :disabled="carrosEmCurso || adsetModo === 'desligado'">Ensaio</button>
                      <button class="ag-btn is-primary" style="margin-left:6px"
                              @click="onEnviarAoAdset(placa.placa, 'real')"
                              :disabled="carrosEmCurso || adsetModo !== 'real'">Enviar</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </section>
    </main>

    <!-- ============ CARROS: ajustes do ADSET ============ -->
    <main v-if="activePage === 'carros-ajustes'" class="ag-view two-column-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Conta do ADSET</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Usuario</label>
          <input class="ag-field is-caminho" v-model="adsetForm.usuario" type="text"
                 autocomplete="off" placeholder="nome@empresa.com.br">

          <label class="ag-label" style="margin-top:14px">Senha</label>
          <input class="ag-field" v-model="adsetForm.senha" type="password"
                 autocomplete="new-password"
                 :placeholder="adsetCfg.senhaGuardada ? 'guardada - deixe em branco para manter' : 'digite a senha'">

          <label class="ag-label" style="margin-top:14px">Modo</label>
          <select class="ag-field" v-model="adsetForm.modo">
            <option value="desligado">Desligado</option>
            <option value="ensaio">Ensaio</option>
            <option value="real">Real</option>
          </select>

          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="ag-btn is-primary" style="flex:1"
                    @click="onSalvarAdset" :disabled="adsetSalvando">
              {{ adsetSalvando ? 'Salvando...' : 'Salvar' }}
            </button>
            <button class="ag-btn" @click="onTestarAdset"
                    :disabled="adsetTestando || adsetForm.modo === 'desligado'">
              {{ adsetTestando ? 'Testando...' : 'Testar' }}
            </button>
          </div>

          <label class="ag-check" style="margin-top:18px">
            <input type="checkbox" v-model="adsetForm.manterConectado">
            <span>Manter conectado</span>
          </label>
          <div class="ag-check-ajuda">
            Reaproveita o login entre operacoes. Fecha sozinha apos 30 min parada.
          </div>

          <label class="ag-check" style="margin-top:12px">
            <input type="checkbox" v-model="adsetForm.visivel">
            <span>Abrir o navegador na tela</span>
          </label>
          <div class="ag-check-ajuda">
            Acompanhe cada clique na conta. Recomendado nas primeiras vezes.
          </div>

        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Atualizacao do sistema</h2></header>
        <div class="ag-card-body">
          <div class="ag-table-wrap">
            <table class="ag-table">
              <tbody>
                <tr><td>Versao aqui</td><td>{{ atualizacao.versaoLocal || '-' }}</td></tr>
                <tr><td>Versao no GitHub</td><td>{{ atualizacao.versaoRemota || '-' }}</td></tr>
                <tr><td>Branch</td><td>{{ atualizacao.branch || '-' }}</td></tr>
                <tr>
                  <td>Situacao</td>
                  <td>
                    <span v-if="atualizacao.temNovidade" style="color:var(--ag-yellow)">
                      {{ atualizacao.atualizacoesPendentes }} atualizacao(oes) disponivel(is)
                    </span>
                    <span v-else-if="atualizacao.conectado" style="color:var(--ag-ok)">em dia</span>
                    <span v-else style="color:var(--ag-muted)">nao ligado ao GitHub</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="ag-btn" @click="onVerificarAtualizacao" :disabled="atualizando">
              Verificar
            </button>
            <button class="ag-btn is-primary" @click="onAtualizarSistema"
                    :disabled="atualizando || !atualizacao.podeAtualizar">
              {{ atualizando ? 'Atualizando...' : 'Atualizar agora' }}
            </button>
          </div>

          <div v-if="atualizacao.erroRede" class="entrega-alerta" style="margin-top:14px">
            {{ atualizacao.erroRede }}
          </div>

          <div v-if="atualizacao.alteracoesLocais && atualizacao.alteracoesLocais.length"
               class="entrega-alerta" style="margin-top:14px">
            Ha {{ atualizacao.alteracoesLocais.length }} alteracao(oes) local(is) nesta pasta.
            A atualizacao nao roda enquanto elas existirem - ela nunca sobrescreve
            trabalho seu. Rode <code style="font-family:var(--ag-mono)">instalar.bat</code>
            para guarda-las num commit local.
          </div>

          <div v-if="atualizacaoResultado" class="entrega-alerta" style="margin-top:14px">
            {{ atualizacaoResultado }}
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Situacao</h2></header>
        <div class="ag-card-body">
          <div class="ag-table-wrap">
            <table class="ag-table">
              <tbody>
                <tr><td>Modo</td><td><b>{{ adsetCfg.modo }}</b></td></tr>
                <tr><td>Usuario</td><td>{{ adsetCfg.usuario || '-' }}</td></tr>
                <tr><td>Senha</td><td>{{ adsetCfg.senhaGuardada ? 'guardada' : 'nao configurada' }}</td></tr>
                <tr><td>Manter conectado</td><td>{{ adsetCfg.manterConectado ? 'sim' : 'nao' }}</td></tr>
                <tr>
                  <td>Sessao</td>
                  <td>
                    <span :style="{ color: adsetCfg.conectada ? 'var(--ag-ok)' : 'var(--ag-muted)' }">
                      {{ adsetCfg.conectada ? 'conectada' : 'fechada' }}
                    </span>
                    <span v-if="adsetCfg.desde" style="color:var(--ag-muted)">
                      desde {{ formatarData(adsetCfg.desde) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button class="ag-btn is-danger" style="margin-top:14px"
                  @click="onDesconectarAdset" :disabled="!adsetCfg.conectada">
            Desconectar agora
          </button>

          <div v-if="adsetTeste" class="entrega-alerta" style="margin-top:16px">
            {{ adsetTeste }}
          </div>

          <div class="entrega-alerta" style="margin-top:16px">
            O modo <b>real</b> APAGA as fotos que o anuncio tem hoje e sobe as
            nossas. Nao da para desfazer. Use o <b>ensaio</b> primeiro: ele faz o
            caminho inteiro e para antes de excluir.
          </div>

          <div style="font-size:12px;color:var(--ag-muted);line-height:1.6;margin-top:16px">
            <p style="margin:0 0 10px"><b>Manter conectado</b> reaproveita o navegador
            ja logado entre uma operacao e outra. Cada login leva uns 10 segundos:
            sem isso, enviar cinco placas sao cinco logins.</p>
            <p style="margin:0 0 10px"><b>Testar</b> so entra e confere se a conta
            enxerga o estoque. Nao encosta em anuncio nenhum.</p>
            <p style="margin:0">A senha fica em
            <code style="font-family:var(--ag-mono)">adset-config.json</code>, que
            esta fora do git, e nunca volta para esta tela - por isso o campo
            aparece vazio mesmo com a senha guardada.</p>
          </div>
        </div>
      </section>
    </main>

    <!-- ============ CARROS: relatorios ============ -->
    <main v-if="activePage === 'carros-relatorios'" class="ag-view report-view">
      <section class="ag-card">
        <header class="ag-card-header"><h2 class="ag-card-title">Filtros</h2></header>
        <div class="ag-card-body">
          <label class="ag-label">Dia</label>
          <input class="ag-field" v-model="carrosRelData" type="text" placeholder="todos">

          <label class="ag-label" style="margin-top:12px">Situacao</label>
          <select class="ag-field" v-model="carrosRelStatus">
            <option value="">Todas</option>
            <option value="organizado">Organizado</option>
            <option value="pronto_para_entrega">Pronto para entrega</option>
            <option value="entregue">Entregue</option>
          </select>

          <button class="ag-btn is-primary" style="width:100%;margin-top:12px"
                  @click="onCarregarRelatorioCarros">Gerar relatorio</button>

          <div v-if="carrosResumo" class="kpi-grid" style="margin-top:14px">
            <div class="kpi-card"><strong>{{ carrosResumo.dias }}</strong><span>Dias</span></div>
            <div class="kpi-card"><strong>{{ carrosResumo.placas }}</strong><span>Placas</span></div>
            <div class="kpi-card"><strong>{{ carrosResumo.fotos }}</strong><span>Fotos</span></div>
            <div class="kpi-card"><strong>{{ carrosResumo.entregues }}</strong><span>Entregues</span></div>
          </div>
        </div>
      </section>

      <section class="ag-card">
        <header class="ag-card-header">
          <h2 class="ag-card-title">Detalhamento</h2>
          <span style="margin-left:auto;color:var(--ag-muted);font-size:12px">{{ carrosRelItens.length }} linhas</span>
        </header>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>Dia</th><th>Placa</th><th>Fotos</th><th>Situacao</th><th>Entregue em</th></tr></thead>
            <tbody>
              <tr v-for="item in carrosRelItens" :key="`${item.data}:${item.placa}`">
                <td>{{ item.data }}</td>
                <td style="font-family:var(--ag-mono)">{{ item.placa }}</td>
                <td>{{ item.fotos }}</td>
                <td><span class="badge-status" :class="item.status">{{ rotuloStatusCarro(item.status) }}</span></td>
                <td>{{ item.entregueEm ? formatarData(item.entregueEm) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- Preview em tela cheia (mesmo comportamento do sphoto) -->
    <div v-if="modalImage" class="preview-overlay" @click="closeModal">
      <div class="preview-topo" @click.stop>
        <button class="preview-fechar" @click="closeModal" title="Fechar (Esc)">&times;</button>
        <div class="preview-setas" v-if="modalTotal > 1">
          <button class="preview-seta" @click="navegarPreview(-1)" title="Anterior (seta esquerda)">&lsaquo;</button>
          <span class="preview-contador">{{ modalIndice + 1 }} / {{ modalTotal }}</span>
          <button class="preview-seta" @click="navegarPreview(1)" title="Proxima (seta direita)">&rsaquo;</button>
        </div>
      </div>

      <div class="preview-corpo" @click.stop>
        <img :src="modalUrl" :alt="modalImage.name" @load="onPreviewLoad">
      </div>

      <div class="preview-rodape" @click.stop>
        <div class="preview-info">
          <span>{{ modalImage.name }}</span>
          <span class="preview-sep">|</span>
          <span>{{ modalResolucao }}</span>
          <span class="preview-sep">|</span>
          <span>{{ formatarTamanho(modalImage.size) }}</span>
          <span class="preview-sep">|</span>
          <span>{{ formatarData(modalImage.modified) }}</span>
        </div>
        <div class="preview-acoes">
          <button class="ag-btn is-warning" @click="onPreviewDelete">Deletar</button>
          <a class="ag-btn" :href="modalUrl" :download="modalImage.name">Baixar</a>
          <button class="ag-btn" @click="copiarUrlPreview">URL</button>
        </div>
      </div>
    </div>
      </div>

      <footer class="ag-footer">
        <span v-if="status" class="ag-status" :class="statusType"
              @click="dispensarStatus" title="Clique para dispensar">{{ status }}</span>
      </footer>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

export default {
  name: 'App',
  setup() {
    const activePage = ref('captura');
    // Duas plataformas no mesmo servidor: cada uma com suas proprias secoes.
    const plataforma = ref('produtos'); // 'captura', 'entregar', 'qa', 'relatorios'
    const selectedLote = ref('');
    const selectedGtin = ref('');
    const inputGtin = ref('');
    const tempImages = ref([]);
    const previousImages = ref([]);
    const loteItems = ref([]);
    const availableLotes = ref([]);
    const modalImage = ref(null);
    const modalOrigem = ref('temp'); // 'temp' | 'anterior' | 'qa'
    const modalResolucao = ref('...');
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
    const qaEmCurso = ref(false);
    const qaDeliveryType = ref('normal');
    const entregaSelecionados = ref([]);
    const entregaResultados = ref({});
    const entregaEmCurso = ref(false);
    const entregaProgresso = ref('');
    const entregaResumo = ref([]);
    const planilhas = ref([]);
    const planilhaSelecionada = ref('');
    const planilhaEmCurso = ref(false);
    const planilhasConflitos = ref([]);

    // Carros
    const carrosData = ref('');
    const carrosPlacas = ref([]);
    const carrosNovaPlaca = ref('');
    const carrosPlacaAlvo = ref('');
    const carrosFotoAlvo = ref('');
    const explorerAberto = ref(false);
    const explorerAtual = ref(null);
    const explorerPai = ref(null);
    const explorerPastas = ref([]);
    const explorerFotos = ref(0);
    const explorerErro = ref('');
    const carrosPastaDestino = ref('');
    const carrosPlacaSelecionada = ref('');
    const carrosEmCurso = ref(false);
    const carrosSemExif = ref(0);
    const carrosIntervalo = ref(3);
    const carrosPlacasLidas = ref(0);
    const carrosDatas = ref([]);
    const placasPorGrupo = ref({});
    const carrosRelData = ref('');
    const carrosRelStatus = ref('');
    const carrosRelItens = ref([]);
    const carrosResumo = ref(null);
    const carrosArrastando = ref(null);
    const carrosPasta = ref('');
    const carrosFotos = ref([]);
    const carrosLendo = ref(false);
    const carrosImportando = ref(false);
    const reportStatus = ref('');
    const reportItems = ref([]);
    const reportStats = ref(null);

    // Vehicles state
    const vehiclesLote = ref('');
    const vehicles = ref([]);

    // Miniaturas e marcacao (mesma mecanica do sphoto)
    const observacoes = ref('');
    const descricaoProduto = ref('...');
    const salvandoCaptura = ref(false);
    const finalizandoCaptura = ref(false);

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

    // Lote sempre exibido como "LOTE xxx"; o valor enviado a API segue so o numero.
    const rotuloLote = numero => (numero ? `LOTE ${numero}` : '');

    const entregaTodosSelecionados = computed(() => (
      qaProducts.value.length > 0 && entregaSelecionados.value.length === qaProducts.value.length
    ));

    // Codigo igual ao GTIN significa que a planilha do cliente ainda nao foi
    // aplicada: a pasta de entrega sairia com o GTIN.
    const entregaSemCodigo = computed(() => (
      qaProducts.value.filter(p => !p.codigo || p.codigo === p.gtin)
    ));

    // Placa aberta no palco. Sem ela o palco fica vazio pedindo escolha.
    const placaAtual = computed(() => (
      carrosPlacas.value.find(p => p.placa === carrosPlacaSelecionada.value) || null
    ));

    // Entrega so lista o que o QA aprovou.
    const carrosProntas = computed(() => (
      carrosPlacas.value.filter(p => p.status === 'pronto_para_entrega')
    ));

    const carrosEntregues = computed(() => (
      carrosPlacas.value.filter(p => p.status === 'entregue')
    ));

    const carrosTotalFotos = computed(() => carrosPlacas.value.reduce((s, p) => s + p.total, 0));

    // Agrupa a sequencia em carros pela pausa entre as fotos. Sem leitura de
    // placa, e o sinal mais confiavel que existe: fotos do mesmo carro saem em
    // seguida, e entre um carro e outro o fotografo se desloca.
    const carrosGrupos = computed(() => {
      const grupos = [];
      const limite = Math.max(1, Number(carrosIntervalo.value) || 3) * 60 * 1000;

      for (const foto of carrosFotos.value) {
        const instante = new Date(foto.capturadaEm).getTime();
        const atual = grupos[grupos.length - 1];
        const anterior = atual?.fotos[atual.fotos.length - 1];
        const pausa = anterior ? instante - new Date(anterior.capturadaEm).getTime() : Infinity;

        // Placa lida na foto abre um carro - e o sinal mais forte. Sem leitura,
        // a pausa entre as fotos decide.
        const abrePorPlaca = !!foto.placaSugerida;

        if (!atual || abrePorPlaca || pausa > limite) {
          const indice = grupos.length;
          grupos.push({
            // O usuario pode ter corrigido a placa: a correcao vence a leitura.
            placa: placasPorGrupo.value[indice] ?? (foto.placaSugerida || ''),
            lida: foto.placaSugerida || null,
            confianca: foto.placaConfianca ?? null,
            fotos: [foto]
          });
        } else {
          atual.fotos.push(foto);
        }
      }
      return grupos;
    });

    const carrosPlacasInformadas = computed(() => (
      carrosGrupos.value.filter(g => (g.placa || '').trim()).length
    ));

    const carrosSemPlaca = computed(() => (
      carrosGrupos.value.filter(g => !(g.placa || '').trim()).length
    ));

    // Foto antes da primeira placa nao pertence a veiculo nenhum.
    const carrosFotosAntesDaPlaca = computed(() => {
      const primeira = carrosFotos.value.findIndex(f => (f.placa || '').trim());
      return primeira < 0 ? 0 : primeira;
    });

    const qaClassificadas = computed(() => qaPhotos.value.filter(photo => photo.classification).length);

    // A entrega normal leva as fotos da raiz; a de atualizacao leva so as AT.
    // As AP ficam de fora das duas - e o proposito da marcacao.
    const qaFotosNormais = computed(() => qaPhotos.value.filter(photo => !photo.classification).length);
    const qaFotosAt = computed(() => qaPhotos.value.filter(photo => photo.classification === 'AT').length);
    const qaFotosElegiveis = computed(() => (
      qaDeliveryType.value === 'atualizacao' ? qaFotosAt.value : qaFotosNormais.value
    ));

    const qaMotivoBloqueio = computed(() => {
      if (!qaPhotoGtin.value || qaFotosElegiveis.value > 0) return '';
      return qaDeliveryType.value === 'atualizacao'
        ? 'Marque ao menos uma foto como AT para concluir a entrega de atualizacao.'
        : 'Todas as fotos estao marcadas: a entrega normal ficaria sem nenhuma.';
    });

    // Methods
    let statusTimer = null;

    // Erro fica bem mais tempo que confirmacao: sumindo em 3 segundos como
    // antes, uma falha de importacao passava despercebida e parecia que o
    // clique nao tinha feito nada. Clicar no aviso dispensa.
    const showStatus = (message, type = 'success') => {
      status.value = message;
      statusType.value = type;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        status.value = '';
        statusType.value = '';
      }, type === 'error' ? 15000 : 3000);
    };

    const dispensarStatus = () => {
      clearTimeout(statusTimer);
      status.value = '';
      statusType.value = '';
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
        // Manda o GTIN selecionado para a foto ja entrar no palco com o nome dele.
        const response = await this.$api.getTempImages(
          selectedGtin.value || null,
          selectedLote.value || null
        );
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
            descricaoProduto.value = item.descricao || item.gtin;
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

    const onGtinSearch = async () => {
      if (!inputGtin.value || !selectedLote.value) return;

      selectedGtin.value = inputGtin.value;
      await loadPreviousImages();
      showStatus(`✓ GTIN ${inputGtin.value} carregado`, 'success');
    };

    const onSaveCapture = async () => {
      if (!selectedLote.value || !selectedGtin.value || tempImages.value.length === 0) return;
      if (salvandoCaptura.value) return;

      salvandoCaptura.value = true;
      try {
        const response = await this.$api.saveCaptureCapture(
          selectedLote.value,
          selectedGtin.value,
          '',
          '',
          observacoes.value
        );

        if (response.ok) {
          showStatus(`✓ ${response.data.fotosMovidas} fotos salvas`, 'success');
          // O GTIN continua selecionado: as fotos que sairam da TEMP tem que aparecer
          // agora no palco Anterior, igual no sphoto.
          observacoes.value = '';
          await loadTempImages();
          await loadLote();
          await loadPreviousImages();
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        salvandoCaptura.value = false;
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
        return `/api/captura/imagem/temp/${encodeURIComponent(img.name)}`;
      }
      return `/api/captura/imagem/finalizadas/${encodeURIComponent(selectedLote.value)}/${encodeURIComponent(selectedGtin.value)}/${encodeURIComponent(img.name)}`;
    };

    // ---- Preview em tela cheia -------------------------------------------------
    // Navega dentro do palco de onde a foto foi aberta, como no sphoto.
    const previewLista = computed(() => {
      if (modalOrigem.value === 'temp') {
        return tempImages.value.map(img => ({
          name: img.name,
          url: `/api/captura/imagem/temp/${encodeURIComponent(img.name)}`,
          size: img.size,
          modified: img.modified
        }));
      }
      if (modalOrigem.value === 'anterior') {
        return previousImages.value.map(img => ({
          name: img.name,
          url: getImageUrl(img),
          size: img.size,
          modified: img.modified
        }));
      }
      return qaPhotos.value.map(photo => ({
        name: photo.filename,
        url: photo.url,
        size: photo.size,
        modified: photo.modified
      }));
    });

    const modalIndice = computed(() => (
      modalImage.value
        ? previewLista.value.findIndex(img => img.name === modalImage.value.name)
        : -1
    ));
    const modalTotal = computed(() => previewLista.value.length);
    const modalUrl = computed(() => modalImage.value?.url || '');

    const formatarTamanho = bytes => {
      if (!bytes) return 'N/D';
      const unidades = ['B', 'KB', 'MB', 'GB'];
      let valor = bytes;
      let i = 0;
      while (valor >= 1024 && i < unidades.length - 1) {
        valor /= 1024;
        i++;
      }
      return `${valor.toFixed(i === 0 ? 0 : 1)} ${unidades[i]}`;
    };

    const formatarData = iso => {
      if (!iso) return 'N/D';
      const data = new Date(iso);
      return Number.isNaN(data.getTime()) ? 'N/D' : data.toLocaleString('pt-BR');
    };

    const openModal = (img, origem = 'temp') => {
      modalOrigem.value = origem;
      const nome = img.name || img.filename;
      // Pega a entrada da lista pra ter os metadados mesmo quando o clique veio de
      // um objeto parcial.
      modalImage.value = previewLista.value.find(item => item.name === nome)
        || { name: nome, url: img.url || getImageUrl({ name: nome }), size: img.size, modified: img.modified };
      modalResolucao.value = '...';
    };

    const closeModal = () => {
      modalImage.value = null;
      modalResolucao.value = '...';
    };

    const navegarPreview = direcao => {
      const lista = previewLista.value;
      if (lista.length === 0) return;
      const atual = modalIndice.value;
      // Circular, igual ao sphoto.
      const proximo = (atual + direcao + lista.length) % lista.length;
      modalImage.value = lista[proximo];
      modalResolucao.value = '...';
    };

    // O sphoto mostra "N/A" aqui porque o servidor nao manda a resolucao; a imagem
    // ja carregada sabe as dimensoes, entao da pra preencher de graca.
    const onPreviewLoad = evento => {
      const { naturalWidth, naturalHeight } = evento.target;
      modalResolucao.value = naturalWidth ? `${naturalWidth} x ${naturalHeight}` : 'N/D';
    };

    const copiarUrlPreview = async () => {
      if (!modalImage.value) return;
      const url = `${window.location.origin}${modalImage.value.url}`;
      try {
        await navigator.clipboard.writeText(url);
        showStatus('✓ URL copiada', 'success');
      } catch {
        showStatus('✗ Nao foi possivel copiar a URL', 'error');
      }
    };

    // Excluir de dentro do preview: cada palco tem o seu caminho de exclusao.
    const onPreviewDelete = async () => {
      if (!modalImage.value) return;
      const alvo = { name: modalImage.value.name };
      const origem = modalOrigem.value;
      closeModal();

      if (origem === 'temp') return onImageDelete(alvo);
      if (origem === 'anterior') return onDeletePrevious(alvo);
      return onQaDeletePhoto({ filename: alvo.name });
    };

    const onPreviewKeydown = evento => {
      if (!modalImage.value) return;
      if (evento.key === 'ArrowLeft') navegarPreview(-1);
      else if (evento.key === 'ArrowRight') navegarPreview(1);
      else if (evento.key === 'Escape') closeModal();
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

    // QA e Entregar dependem do codigo do produto, entao a pasta de planilhas e
    // varrida ao entrar em qualquer uma das duas: o usuario so larga o .xlsx la.
    const sincronizarPlanilhas = async () => {
      try {
        const response = await this.$api.request('/api/planilhas/sincronizar', {
          method: 'POST',
          data: { operationId: makeOperationId('planilha-sync') }
        });
        if (!response.ok) return;

        planilhasConflitos.value = response.data.conflitos || [];
        if (response.data.aplicados.length > 0) {
          showStatus(`✓ ${response.data.aplicados.length} codigo(s) preenchidos pela planilha`, 'success');
          if (qaSelectedLote.value) await onLoadQaProducts();
          if (selectedLote.value) await loadLote();
        }
      } catch {
        // sincronizacao e best-effort: nao pode atrapalhar a navegacao
      }
    };

    const trocarPlataforma = async destino => {
      plataforma.value = destino;
      if (destino === 'carros') {
        activePage.value = 'carros';
        await onCarregarConfigAdset();
        await onCarregarDatas();
        await onCarregarDia();
      } else {
        activePage.value = 'captura';
      }
    };

    const irParaCarros = async pagina => {
      activePage.value = pagina;

      if (pagina === 'carros') {
        // Importar e sempre sobre o dia de hoje.
        await onCarregarDatas();
        await onCarregarDia();
      } else {
        await abrirUltimoDiaComFotos();
      }

      if (pagina === 'carros-relatorios') await onCarregarRelatorioCarros();
      if (pagina === 'carros-entrega' || pagina === 'carros-ajustes') await onCarregarConfigAdset();
      if (pagina === 'carros-ajustes') await onVerificarAtualizacao({ silencioso: true });
    };

    const irPara = async pagina => {
      activePage.value = pagina;
      if (pagina === 'qa' || pagina === 'entregar') {
        await onCarregarPlanilhas();
        await sincronizarPlanilhas();
      }
    };

    const onExplorar = async caminho => {
      explorerErro.value = '';
      try {
        const response = await this.$api.request('/api/carros/navegar', {
          query: caminho ? { caminho } : {}
        });
        if (!response.ok) {
          explorerErro.value = response.error;
          return;
        }
        explorerAtual.value = response.data.atual;
        explorerPai.value = response.data.pai;
        explorerPastas.value = response.data.pastas || [];
        explorerFotos.value = response.data.fotos || 0;
      } catch (err) {
        explorerErro.value = err.message;
      }
    };

    const onAbrirExplorador = async () => {
      explorerAberto.value = true;
      // Abre onde o caminho digitado aponta, se houver; senao, nas unidades.
      await onExplorar(carrosPasta.value || '');
    };

    const onExplorarPai = async () => {
      await onExplorar(explorerPai.value || '');
    };

    const onUsarPastaAtual = async () => {
      if (!explorerAtual.value) return;
      carrosPasta.value = explorerAtual.value;
      explorerAberto.value = false;
      await onLerPastaCarros();
    };

    const onLerPastaCarros = async () => {
      if (!carrosPasta.value || carrosLendo.value) return;
      carrosLendo.value = true;
      try {
        const response = await this.$api.request('/api/carros/pasta', {
          query: { caminho: carrosPasta.value }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        carrosFotos.value = (response.data.fotos || []).map(f => ({ ...f, placa: '' }));
        carrosSemExif.value = response.data.semExif || 0;
        carrosPlacasLidas.value = response.data.placasLidas || 0;
        placasPorGrupo.value = {};
        showStatus(`✓ ${carrosFotos.value.length} fotos lidas`, 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        carrosLendo.value = false;
      }
    };

    const definirPlacaDoGrupo = (indice, valor) => {
      placasPorGrupo.value = { ...placasPorGrupo.value, [indice]: (valor || '').toUpperCase() };
    };

    const formatarHora = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const rotuloStatusCarro = status => ({
      organizado: 'Organizado',
      pronto_para_entrega: 'Pronto',
      entregue: 'Entregue',
      erro_entrega: 'Erro'
    }[status] || status || 'Organizado');

    const acaoCarro = async (rota, dados, sucesso) => {
      if (carrosEmCurso.value) return;
      carrosEmCurso.value = true;
      try {
        const response = await this.$api.request(rota, {
          method: 'POST',
          data: { ...dados, operationId: makeOperationId('carros') }
        });
        if (!response.ok) {
          showStatus(`\u2717 ${response.error}`, 'error');
          return null;
        }
        showStatus(sucesso(response.data), 'success');
        await onCarregarDia();
        return response.data;
      } catch (err) {
        showStatus(`\u2717 ${err.message}`, 'error');
        return null;
      } finally {
        carrosEmCurso.value = false;
      }
    };

    const onAprovarPlaca = async () => {
      if (!placaAtual.value) return;
      await acaoCarro('/api/carros/aprovar',
        { data: carrosData.value, placa: placaAtual.value.placa },
        d => `\u2713 ${d.placa} aprovada (${d.fotos} fotos)`);
    };

    const onReabrirPlaca = async () => {
      if (!placaAtual.value) return;
      await acaoCarro('/api/carros/reabrir',
        { data: carrosData.value, placa: placaAtual.value.placa },
        d => `\u2713 ${d.placa} reaberta`);
    };

    const onEntregarPlaca = async placa => {
      await acaoCarro('/api/carros/entregar',
        { data: carrosData.value, placa },
        d => `\u2713 ${d.placa}: ${d.fotos} fotos copiadas para ${d.destino}`);
    };

    // Estado da camera. O simplusCamera.exe nao morre quando a camera e desligada
    // ou o cabo sai, entao o servidor cruza o processo com o dispositivo USB - aqui
    // so mostramos o resultado.
    const cameraEstado = ref('desconhecido');
    const cameraMensagem = ref('Verificando a camera...');
    let cameraTimer = null;

    const cameraRotulo = computed(() => ({
      conectada: 'Camera',
      sem_dispositivo: 'Sem camera',
      sem_processo: 'Camera parada',
      desconectada: 'Sem camera',
      desconhecido: 'Camera...'
    })[cameraEstado.value] || 'Camera');

    const verificarCamera = async () => {
      try {
        const response = await this.$api.request('/api/status/camera');
        if (!response.ok) throw new Error(response.error || 'sem resposta');

        const d = response.data;
        cameraMensagem.value = d.message;
        cameraEstado.value = d.connected ? 'conectada'
          : d.running ? 'sem_dispositivo'
          : d.devicePresent ? 'sem_processo'
          : 'desconectada';
      } catch (err) {
        // Servidor fora do ar tambem e "nao da para fotografar agora".
        cameraEstado.value = 'desconectada';
        cameraMensagem.value = 'Sem resposta do servidor';
      }
    };

    const onReligarCamera = async () => {
      showStatus('Religando a camera...', 'info');
      try {
        const response = await this.$api.request('/api/status/camera/open', {
          method: 'POST',
          data: { operationId: makeOperationId('camera') }
        });
        showStatus(response.ok ? `✓ ${response.data.message}` : `✗ ${response.error}`,
          response.ok ? 'success' : 'error');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
      await verificarCamera();
    };

    // Atualizacao do sistema pelo GitHub.
    const atualizacao = ref({
      conectado: false, temNovidade: false, atualizacoesPendentes: 0,
      versaoLocal: null, versaoRemota: null, branch: null,
      alteracoesLocais: [], podeAtualizar: false, erroRede: null
    });
    const atualizando = ref(false);
    const atualizacaoResultado = ref('');

    const atualizacaoTitulo = computed(() => {
      const a = atualizacao.value;
      if (!a.conectado) return 'Pasta nao ligada ao GitHub - rode instalar.bat';
      if (a.erroRede) return a.erroRede;
      if (a.temNovidade) return `${a.atualizacoesPendentes} atualizacao(oes) esperando - clique para aplicar`;
      return `Sistema em dia (${a.versaoLocal || '-'})`;
    });

    const onVerificarAtualizacao = async ({ silencioso = false } = {}) => {
      try {
        const response = await this.$api.request('/api/sistema/atualizacao');
        if (response.ok) atualizacao.value = response.data;
        if (!silencioso) {
          showStatus(atualizacao.value.temNovidade
            ? `${atualizacao.value.atualizacoesPendentes} atualizacao(oes) disponivel(is)`
            : '✓ Sistema em dia', 'info');
        }
      } catch (err) {
        if (!silencioso) showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onAtualizarSistema = async () => {
      await onVerificarAtualizacao({ silencioso: true });

      if (!atualizacao.value.temNovidade) {
        showStatus('✓ O sistema ja esta em dia', 'success');
        return;
      }
      if (!atualizacao.value.podeAtualizar) {
        showStatus(`✗ ${atualizacao.value.erroRede || 'Ha alteracoes locais nesta pasta'}`, 'error');
        return;
      }
      // Atualizar troca o codigo debaixo de quem esta trabalhando; se houver
      // foto no palco, ela nao se perde, mas a tela recarrega.
      if (!window.confirm(
        `Aplicar ${atualizacao.value.atualizacoesPendentes} atualizacao(oes)?

`
        + 'A tela vai recarregar ao terminar.'
      )) return;

      atualizando.value = true;
      atualizacaoResultado.value = '';
      showStatus('Baixando a atualizacao...', 'info');

      try {
        const response = await this.$api.request('/api/sistema/atualizacao/aplicar', {
          method: 'POST',
          data: { operationId: makeOperationId('atualizar') }
        });

        if (!response.ok) {
          atualizacaoResultado.value = response.error;
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }

        const d = response.data;
        if (d.jaEstavaAtualizado) {
          showStatus('✓ O sistema ja estava em dia', 'success');
          return;
        }

        atualizacaoResultado.value = `Atualizado de ${d.versaoAnterior} para ${d.versao}: `
          + `${d.arquivos.length} arquivo(s).`
          + (d.mexeuEmDependencia ? ' Mudou dependencia - rode instalar.bat.' : '')
          + (d.precisaReiniciar
              ? ' Mexeu no servidor: feche pelo atalho "AG Foto - Parar" e ligue de novo.'
              : ' Recarregando a tela...');

        showStatus(`✓ Atualizado para ${d.versao}`, 'success');

        // Só o navegador basta quando nada do servidor mudou. Recarga forcada
        // porque css e App.vue ficam em cache.
        if (!d.precisaReiniciar) setTimeout(() => window.location.reload(true), 2500);
      } catch (err) {
        atualizacaoResultado.value = err.message;
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        atualizando.value = false;
        await onVerificarAtualizacao({ silencioso: true });
      }
    };

    const adsetModo = ref('desligado');
    const adsetUsuario = ref(null);
    const adsetCfg = ref({
      modo: 'desligado', usuario: '', senhaGuardada: false,
      manterConectado: false, visivel: false, conectada: false, desde: null
    });
    // Formulario separado do estado guardado: o que voce digita so vale depois
    // de Salvar, e a senha nunca chega do servidor para ser preenchida aqui.
    const adsetForm = ref({
      usuario: '', senha: '', modo: 'desligado',
      manterConectado: false, visivel: false
    });
    const adsetSalvando = ref(false);
    const adsetTestando = ref(false);
    const adsetTeste = ref('');

    const onCarregarConfigAdset = async () => {
      try {
        const response = await this.$api.request('/api/carros/adset/config');
        if (!response.ok) throw new Error(response.error);

        adsetCfg.value = response.data;
        adsetModo.value = response.data.modo;
        adsetUsuario.value = response.data.usuario;

        adsetForm.value = {
          usuario: response.data.usuario || '',
          senha: '',
          modo: response.data.modo,
          manterConectado: response.data.manterConectado,
          visivel: response.data.visivel
        };
      } catch {
        adsetModo.value = 'desligado';
      }
    };

    const onSalvarAdset = async () => {
      adsetSalvando.value = true;
      try {
        const response = await this.$api.request('/api/carros/adset/config', {
          method: 'POST',
          data: { ...adsetForm.value, operationId: makeOperationId('adset-config') }
        });

        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }

        adsetCfg.value = response.data;
        adsetModo.value = response.data.modo;
        adsetUsuario.value = response.data.usuario;
        // Some do campo depois de salva: nao fica senha parada na tela.
        adsetForm.value.senha = '';
        showStatus('✓ Configuracao do ADSET salva', 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        adsetSalvando.value = false;
      }
    };

    const onTestarAdset = async () => {
      adsetTestando.value = true;
      adsetTeste.value = '';
      showStatus('Entrando no ADSET...', 'info');
      try {
        const response = await this.$api.request('/api/carros/adset/testar', {
          method: 'POST',
          data: { operationId: makeOperationId('adset-teste') }
        });

        if (!response.ok) {
          adsetTeste.value = `Falhou: ${response.error}`;
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }

        const d = response.data;
        adsetTeste.value = `Entrou como ${d.usuario}. `
          + `A lista de publicados respondeu com ${d.veiculosNaPrimeiraPagina} veiculo(s) `
          + `na primeira pagina. `
          + (d.mantidaAberta ? 'A sessao ficou aberta para as proximas operacoes.'
                             : 'A sessao foi fechada em seguida.');
        showStatus('✓ Conexao com o ADSET OK', 'success');
      } catch (err) {
        adsetTeste.value = `Falhou: ${err.message}`;
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        adsetTestando.value = false;
        await onCarregarConfigAdset();
      }
    };

    const onDesconectarAdset = async () => {
      try {
        await this.$api.request('/api/carros/adset/desconectar', {
          method: 'POST',
          data: { operationId: makeOperationId('adset-sair') }
        });
        showStatus('✓ Sessao do ADSET encerrada', 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
      await onCarregarConfigAdset();
    };

    // O modo real APAGA as fotos do anuncio publicado na conta do cliente. Uma
    // confirmacao antes, porque nao ha como desfazer.
    const onEnviarAoAdset = async (placa, modo) => {
      if (modo === 'real') {
        const certeza = window.confirm(
          `Enviar ${placa} ao ADSET?\n\n` +
          'As fotos que o anuncio tem hoje serao APAGADAS e substituidas pelas ' +
          'nossas, na ordem do QA. Nao da para desfazer.'
        );
        if (!certeza) return;
      }

      showStatus(modo === 'ensaio'
        ? `Ensaio de ${placa}: abrindo o ADSET...`
        : `Enviando ${placa} ao ADSET...`, 'info');

      await acaoCarro('/api/carros/adset/enviar',
        { data: carrosData.value, placa, modo },
        d => d.ensaio
          ? `✓ Ensaio de ${d.placa}: achou em "${d.lista}", ${d.fotosAEnviar} fotos prontas`
          : `✓ ${d.placa}: ${d.fotosEnviadas} fotos no ADSET (${d.lista})`);
    };

    // A entrega termina fora do sistema, subindo as fotos no site do ADSET;
    // abrir a pasta daqui evita o usuario procurar o caminho na mao.
    const onAbrirPastaEntrega = async () => {
      try {
        const response = await this.$api.request('/api/carros/abrir-entrega', {
          method: 'POST',
          data: { operationId: makeOperationId('carros') }
        });
        if (!response.ok) showStatus(`✗ ${response.error}`, 'error');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onCarregarRelatorioCarros = async () => {
      try {
        const query = {};
        if (carrosRelData.value) query.data = carrosRelData.value;
        if (carrosRelStatus.value) query.status = carrosRelStatus.value;

        const response = await this.$api.request('/api/carros/relatorio', { query });
        if (!response.ok) {
          showStatus(`\u2717 ${response.error}`, 'error');
          return;
        }
        carrosRelItens.value = response.data.itens || [];
        carrosResumo.value = response.data.resumo || null;
      } catch (err) {
        showStatus(`\u2717 ${err.message}`, 'error');
      }
    };

    // Dias que ja tem fotos, do mais recente para o mais antigo.
    const onCarregarDatas = async () => {
      try {
        const response = await this.$api.request('/api/carros/datas');
        carrosDatas.value = response.ok ? (response.data.datas || []) : [];
      } catch {
        carrosDatas.value = [];
      }
      return carrosDatas.value;
    };

    // QA e Entrega acontecem depois da edicao externa, que leva dias: abrir no
    // dia de hoje deixava a tela vazia justamente quando ha trabalho a fazer.
    const abrirUltimoDiaComFotos = async () => {
      const datas = await onCarregarDatas();
      if (datas.length > 0 && !datas.includes(carrosData.value)) {
        carrosData.value = datas[0];
      }
      await onCarregarDia();
    };

    const onCarregarDia = async () => {
      if (!carrosData.value) { carrosPlacas.value = []; return; }
      try {
        const response = await this.$api.request(`/api/carros/dia/${encodeURIComponent(carrosData.value)}`);
        carrosPlacas.value = response.ok ? (response.data.placas || []) : [];
        carrosPastaDestino.value = response.ok ? (response.data.pasta || '') : '';

        // Mantem a placa aberta se ela ainda existe; senao abre a primeira,
        // para o palco nunca ficar vazio a toa.
        const aindaExiste = carrosPlacas.value.some(p => p.placa === carrosPlacaSelecionada.value);
        if (!aindaExiste) {
          carrosPlacaSelecionada.value = carrosPlacas.value[0]?.placa || '';
        }
      } catch {
        carrosPlacas.value = [];
      }
    };

    const onImportarCarros = async () => {
      if (!carrosData.value || carrosImportando.value) return;
      carrosImportando.value = true;
      try {
        const response = await this.$api.request('/api/carros/importar-pasta', {
          method: 'POST',
          data: {
            data: carrosData.value,
            // Cada grupo vira um carro: a placa vai na primeira foto dele e as
            // demais seguem junto, que e o formato que o servidor espera.
            // Grupo sem placa vai com o marcador '?': o servidor cria a pasta
            // NAO-RECONHECIDO em vez de deixar as fotos sem destino.
            fotos: carrosGrupos.value.flatMap(grupo => grupo.fotos.map((f, i) => ({
              name: f.name,
              placa: i === 0 ? (grupo.placa || '?') : ''
            }))),
            operationId: makeOperationId('carros-importar')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        const d = response.data;
        // Carro sem placa sai como aviso, nao como confirmacao: ele precisa ser
        // renomeado no QA e some da tela se passar batido como sucesso.
        const naoRec = (d.naoReconhecidas || []).length;
        showStatus(
          `✓ ${d.placas} carro(s), ${d.fotos} fotos em ${d.data}`
            + (naoRec ? ` · ${naoRec} sem placa (renomeie no QA)` : '')
            + (d.ignoradas.length ? ` · ${d.ignoradas.length} ignorada(s)` : ''),
          naoRec ? 'error' : 'success'
        );
        carrosFotos.value = [];
        await onCarregarDatas();
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        carrosImportando.value = false;
      }
    };

    const onCriarPlaca = async () => {
      if (!carrosData.value || !carrosNovaPlaca.value) return;
      try {
        const response = await this.$api.request('/api/carros/placa', {
          method: 'POST',
          data: {
            data: carrosData.value,
            placa: carrosNovaPlaca.value,
            operationId: makeOperationId('carros-placa')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        showStatus(`✓ Placa ${response.data.placa} criada`, 'success');
        carrosNovaPlaca.value = '';
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    // Soltar sobre uma foto: mesma placa reordena, placa diferente move para
    // aquela posicao. Soltar no bloco (fora das fotos) manda para o fim.
    // Grava a nova ordem. Usada tanto pelo arrasto quanto pelas setas.
    const aplicarOrdem = async (placa, nomes) => {
      try {
        const response = await this.$api.request('/api/carros/reordenar', {
          method: 'POST',
          data: {
            data: carrosData.value,
            placa,
            ordem: nomes,
            operationId: makeOperationId('carros-reordenar')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onSoltarNaFoto = async (placaDestino, posicao) => {
      const arrastada = carrosArrastando.value;
      carrosFotoAlvo.value = '';
      carrosPlacaAlvo.value = '';
      if (!arrastada) return;

      if (arrastada.placa !== placaDestino) {
        carrosArrastando.value = null;
        return moverFotoDeCarro(arrastada, placaDestino);
      }

      const placa = carrosPlacas.value.find(p => p.placa === placaDestino);
      carrosArrastando.value = null;
      if (!placa) return;

      const nomes = placa.fotos.map(f => f.name);
      const de = nomes.indexOf(arrastada.arquivo);
      if (de < 0 || de === posicao) return;

      nomes.splice(posicao, 0, ...nomes.splice(de, 1));
      await aplicarOrdem(placaDestino, nomes);
    };

    // Reordena por clique, reaproveitando o mesmo caminho do arrasto.
    const onMoverPosicao = async (de, para) => {
      const placa = placaAtual.value;
      if (!placa || para < 0 || para >= placa.fotos.length) return;

      const nomes = placa.fotos.map(f => f.name);
      nomes.splice(para, 0, ...nomes.splice(de, 1));
      await aplicarOrdem(placa.placa, nomes);
    };

    const onExcluirFotoCarro = async (placa, arquivo) => {
      if (!confirm(`Excluir ${arquivo}?`)) return;
      try {
        const response = await this.$api.request('/api/carros/excluir-foto', {
          method: 'POST',
          data: {
            data: carrosData.value,
            placa,
            arquivo,
            operationId: makeOperationId('carros-excluir')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        showStatus('✓ Foto excluida', 'success');
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onRenomearPlaca = async placaAtual => {
      const nova = prompt(`Corrigir a placa ${placaAtual} para:`, placaAtual);
      if (!nova || nova.trim().toUpperCase() === placaAtual) return;
      try {
        const response = await this.$api.request('/api/carros/renomear-placa', {
          method: 'POST',
          data: {
            data: carrosData.value,
            de: placaAtual,
            para: nova,
            operationId: makeOperationId('carros-renomear')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        showStatus(`✓ ${response.data.de} virou ${response.data.para}`, 'success');
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onArrastarFoto = (placa, arquivo) => {
      carrosArrastando.value = { placa, arquivo };
    };

    // Soltar numa placa move o arquivo de pasta; a foto e renomeada para a placa
    // de destino, senao o nome diria uma placa e ela estaria dentro de outra.
    const moverFotoDeCarro = async (arrastada, placaDestino) => {
      try {
        const response = await this.$api.request('/api/carros/mover-foto', {
          method: 'POST',
          data: {
            data: carrosData.value,
            de: arrastada.placa,
            para: placaDestino,
            arquivo: arrastada.arquivo,
            operationId: makeOperationId('carros-mover')
          }
        });
        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }
        showStatus(`✓ ${arrastada.arquivo} movida para ${placaDestino}`, 'success');
        await onCarregarDia();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onSoltarNaPlaca = async placaDestino => {
      const arrastada = carrosArrastando.value;
      carrosPlacaAlvo.value = '';
      carrosFotoAlvo.value = '';
      carrosArrastando.value = null;
      if (!arrastada || arrastada.placa === placaDestino) return;
      return moverFotoDeCarro(arrastada, placaDestino);
    };

    const onCarregarPlanilhas = async () => {
      try {
        const response = await this.$api.request('/api/planilhas/arquivos');
        planilhas.value = response.ok ? (response.data.arquivos || []) : [];
      } catch {
        planilhas.value = [];
      }
    };

    // Importa a planilha do cliente e aplica os codigos ao lote. Sao tres passos
    // no servidor: ler o arquivo, confirmar (grava no catalogo integrado) e
    // aplicar ao lote - so depois disso a pasta de entrega deixa de usar o GTIN.
    const onImportExcel = async () => {
      const loteParaImportar = qaSelectedLote.value || selectedLote.value;
      if (!loteParaImportar || !planilhaSelecionada.value || planilhaEmCurso.value) return;

      planilhaEmCurso.value = true;
      excelConflicts.value = [];

      try {
        const importar = await this.$api.request('/api/planilhas/importar', {
          method: 'POST',
          data: {
            lote: loteParaImportar,
            filePath: planilhaSelecionada.value,
            operationId: makeOperationId('planilha-importar')
          }
        });
        if (!importar.ok) {
          showStatus(`✗ ${importar.error}`, 'error');
          return;
        }

        excelItems.value = importar.data.preview || [];
        if (importar.data.conflicts?.length) {
          excelConflicts.value = importar.data.conflicts;
          showStatus(`✗ ${importar.data.conflicts.length} conflito(s): nada foi aplicado`, 'error');
          return;
        }

        const confirmar = await this.$api.request('/api/planilhas/confirmar', {
          method: 'POST',
          data: { importId: importar.data.importId, operationId: makeOperationId('planilha-confirmar') }
        });
        if (!confirmar.ok) {
          showStatus(`✗ ${confirmar.error}`, 'error');
          return;
        }

        const aplicar = await this.$api.request('/api/planilhas/aplicar-codigos', {
          method: 'POST',
          data: { lote: loteParaImportar, operationId: makeOperationId('planilha-aplicar') }
        });
        if (!aplicar.ok) {
          showStatus(`✗ ${aplicar.error}`, 'error');
          return;
        }

        const semCodigo = aplicar.data.semCorrespondencia.length;
        showStatus(
          `✓ ${importar.data.total} itens importados · ${aplicar.data.atualizados.length} codigo(s) aplicados`
            + (semCodigo ? ` · ${semCodigo} sem correspondencia` : ''),
          'success'
        );
        await onLoadQaProducts();
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        planilhaEmCurso.value = false;
      }
    };

    // Product QA methods
    const onLoadQaProducts = async ({ preservarResultados = false } = {}) => {
      if (!preservarResultados) {
        entregaSelecionados.value = [];
        entregaResultados.value = {};
        entregaResumo.value = [];
      }

      if (!qaSelectedLote.value) {
        qaProducts.value = [];
        return;
      }

      try {
        const response = await this.$api.request(`/api/qa/produtos/${encodeURIComponent(qaSelectedLote.value)}`);
        if (response.ok) {
          qaProducts.value = response.data.ready || [];
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

    const onQaLoteChange = async ({ manterSelecao = false } = {}) => {
      qaAvailableGtins.value = [];
      if (!manterSelecao) {
        qaPhotoGtin.value = '';
        qaPhotos.value = [];
      }

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

    const onLoadQaPhotos = async ({ silencioso = false } = {}) => {
      if (!qaPhotoLote.value || !qaPhotoGtin.value) {
        qaPhotos.value = [];
        return;
      }

      try {
        const response = await this.$api.request(
          `/api/qa/fotos/${encodeURIComponent(qaPhotoLote.value)}/${encodeURIComponent(qaPhotoGtin.value)}`
        );
        if (response.ok) {
          qaPhotos.value = response.data.photos || [];
          if (!silencioso) showStatus(`✓ ${qaPhotos.value.length} fotos carregadas`, 'success');
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const onSelectQaGtin = async gtin => {
      qaPhotoGtin.value = gtin;
      await onLoadQaPhotos();
    };

    // Classificar move o arquivo para a subpasta AP/AT (e desclassificar traz de
    // volta). O nome pode mudar em colisao, entao sempre recarregamos a lista em vez
    // de confiar no estado local.
    const onClassifyPhoto = async (photo, classification) => {
      if (qaEmCurso.value) return;
      qaEmCurso.value = true;

      const desfazer = photo.classification === classification;
      const rota = desfazer ? '/api/qa/desclassificar' : '/api/qa/classificar';
      const data = {
        lote: qaPhotoLote.value,
        gtin: qaPhotoGtin.value,
        filename: photo.filename,
        operationId: makeOperationId(desfazer ? 'qa-desclassificar' : 'qa-classificar')
      };
      if (desfazer) data.fromClassification = photo.classification;
      else data.classification = classification;

      try {
        const response = await this.$api.request(rota, { method: 'POST', data });
        if (response.ok) {
          showStatus(desfazer ? `✓ Marcacao ${classification} desfeita` : `✓ Foto marcada como ${classification}`, 'success');
          await onLoadQaPhotos({ silencioso: true });
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        qaEmCurso.value = false;
      }
    };

    const onQaDeletePhoto = async photo => {
      if (!confirm(`Excluir ${photo.filename}?`)) return;
      qaEmCurso.value = true;
      try {
        const response = await this.$api.request('/api/qa/excluir', {
          method: 'POST',
          data: {
            lote: qaPhotoLote.value,
            gtin: qaPhotoGtin.value,
            filename: photo.filename,
            location: photo.location || 'root',
            operationId: makeOperationId('qa-excluir')
          }
        });
        if (response.ok) {
          showStatus('✓ Foto excluida', 'success');
          await onLoadQaPhotos({ silencioso: true });
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        qaEmCurso.value = false;
      }
    };

    const onCompleteQa = async () => {
      if (!qaPhotoLote.value || !qaPhotoGtin.value) return;
      qaEmCurso.value = true;

      try {
        const response = await this.$api.request('/api/qa/concluir', {
          method: 'POST',
          data: {
            lote: qaPhotoLote.value,
            gtin: qaPhotoGtin.value,
            deliveryType: qaDeliveryType.value,
            operationId: makeOperationId('qa-concluir')
          }
        });
        if (response.ok) {
          const tipo = qaDeliveryType.value === 'atualizacao' ? 'atualizacao' : 'normal';
          showStatus(`✓ QA concluido - pronto para entrega ${tipo} (${response.data.quantidadeFotosElegiveis} fotos)`, 'success');
          qaPhotos.value = [];
          qaPhotoGtin.value = '';
          // O GTIN sai da fila de pendentes, entao a lista precisa refletir isso.
          await onQaLoteChange({ manterSelecao: false });
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        qaEmCurso.value = false;
      }
    };

    const onSendToRework = async () => {
      if (!qaPhotoLote.value || !qaPhotoGtin.value) return;
      if (!confirm(`Mandar ${qaPhotoGtin.value} para retrabalho?`)) return;
      qaEmCurso.value = true;

      try {
        const response = await this.$api.request('/api/retrabalhos', {
          method: 'POST',
          data: {
            lote: qaPhotoLote.value,
            gtin: qaPhotoGtin.value,
            operationId: makeOperationId('qa-retrabalho')
          }
        });
        if (response.ok) {
          showStatus('✓ GTIN devolvido para retrabalho', 'success');
          await onLoadQaPhotos({ silencioso: true });
        } else {
          showStatus(`✗ ${response.error}`, 'error');
        }
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        qaEmCurso.value = false;
      }
    };

    // Entrega um produto: preparar (staging + manifesto) e executar (envio +
    // verificacao). Devolve o resultado em vez de so avisar na tela, para o lote
    // inteiro poder ser processado em sequencia.
    const entregarProduto = async product => {
      try {
        const prepareResponse = await this.$api.request('/api/entregas/preparar', {
          method: 'POST',
          data: {
            lote: qaSelectedLote.value,
            gtin: product.gtin,
            codigo: product.codigo,
            deliveryType: 'normal',
            operationId: makeOperationId('delivery-prepare')
          }
        });
        if (!prepareResponse.ok) return { ok: false, error: prepareResponse.error };

        const executeResponse = await this.$api.request('/api/entregas/executar', {
          method: 'POST',
          data: {
            lote: qaSelectedLote.value,
            gtin: product.gtin,
            codigo: product.codigo,
            deliveryType: 'normal',
            attemptId: prepareResponse.data.attemptId,
            operationId: makeOperationId('delivery-execute')
          }
        });
        if (!executeResponse.ok) return { ok: false, error: executeResponse.error };

        return { ok: true, arquivos: prepareResponse.data.manifest.fileCount };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    };

    const onToggleTodosEntrega = () => {
      entregaSelecionados.value = entregaTodosSelecionados.value
        ? []
        : qaProducts.value.map(product => product.gtin);
    };

    const onEntregarSelecionados = async () => {
      if (entregaSelecionados.value.length === 0 || entregaEmCurso.value) return;

      const alvos = qaProducts.value.filter(p => entregaSelecionados.value.includes(p.gtin));
      entregaEmCurso.value = true;
      entregaResultados.value = {};
      entregaResumo.value = [];

      let entregues = 0;
      let falhas = 0;

      try {
        for (let i = 0; i < alvos.length; i++) {
          const product = alvos[i];
          entregaProgresso.value = `${i + 1}/${alvos.length}`;
          entregaResultados.value = {
            ...entregaResultados.value,
            [product.gtin]: { texto: 'entregando', classe: 'entregando' }
          };

          const resultado = await entregarProduto(product);
          entregaResultados.value = {
            ...entregaResultados.value,
            [product.gtin]: resultado.ok
              ? { texto: `entregue (${resultado.arquivos} arq.)`, classe: 'entregue' }
              : { texto: resultado.error, classe: 'erro_entrega' }
          };
          entregaResumo.value = [...entregaResumo.value, {
            gtin: product.gtin,
            codigo: product.codigo,
            ok: resultado.ok,
            arquivos: resultado.arquivos,
            error: resultado.error
          }];

          if (resultado.ok) entregues++;
          else falhas++;
        }

        showStatus(
          falhas === 0
            ? `✓ ${entregues} produto(s) entregues`
            : `${entregues} entregue(s), ${falhas} com erro`,
          falhas === 0 ? 'success' : 'error'
        );

        entregaSelecionados.value = [];
        await onLoadQaProducts({ preservarResultados: true });
      } finally {
        entregaEmCurso.value = false;
        entregaProgresso.value = '';
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
      await onCarregarPlanilhas();

      // Carros agrupa por dia, nao por lote; o padrao e hoje.
      const hoje = new Date();
      const dois = n => String(n).padStart(2, '0');
      carrosData.value = `${dois(hoje.getDate())}-${dois(hoje.getMonth() + 1)}-${hoje.getFullYear()}`;
      await onCarregarDia();

      // Uma checada silenciosa ao abrir: o aviso de novidade precisa aparecer
      // sem o usuario ir procurar. Nao repete em laco - atualizacao nao e algo
      // que sai enquanto ele fotografa.
      await onVerificarAtualizacao({ silencioso: true });

      // Refresh temp images every 2 seconds
      refreshInterval = setInterval(loadTempImages, 2000);

      // A camera cai sem avisar - cabo puxado, bateria, modo de espera. Sondar a
      // cada 5s deixa a tela dizer isso antes do fotografo perder uma sessao
      // inteira achando que o sistema e que nao esta salvando. Consulta o
      // dispositivo USB no Windows, entao 5s e um meio-termo entre demorar a
      // perceber e ficar chamando PowerShell o tempo todo.
      await verificarCamera();
      cameraTimer = setInterval(verificarCamera, 5000);

      // Setas e Esc navegam o preview, como no sphoto.
      document.addEventListener('keydown', onPreviewKeydown);
    });

    const onDeletePrevious = async img => {
      if (!confirm(`Remover ${img.name}?`)) return;
      try {
        await this.$api.request('/api/captura/imagem/finalizadas', {
          method: 'DELETE',
          data: {
            lote: selectedLote.value,
            gtin: selectedGtin.value,
            filename: img.name,
            operationId: makeOperationId('delete-final')
          }
        });
        await loadPreviousImages();
        showStatus('✓ Imagem removida', 'success');
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      }
    };

    const selecionarGtinDaLista = item => {
      inputGtin.value = item.gtin;
      descricaoProduto.value = item.descricao || item.gtin;
      onGtinSearch();
    };

    // Finalizar = garantir que o que esta em TEMP foi salvo e liberar o palco pro
    // proximo GTIN. Salvar ja move o produto para pendente_qa, entao aqui nao ha
    // chamada extra - no sphoto este botao avisa o Redmine, que aqui nao existe.
    const onFinalizar = async () => {
      if (!selectedLote.value || !selectedGtin.value) return;
      if (finalizandoCaptura.value) return;

      finalizandoCaptura.value = true;
      try {
        // Salva o que estiver no palco Atual antes de fechar.
        if (tempImages.value.length > 0) {
          await onSaveCapture();
        }

        // Fechar de verdade e mudar o status: sem isso o GTIN nunca chega ao QA.
        const response = await this.$api.request('/api/captura/finalizar', {
          method: 'POST',
          data: {
            lote: selectedLote.value,
            gtin: selectedGtin.value,
            operationId: makeOperationId('finalizar')
          }
        });

        if (!response.ok) {
          showStatus(`✗ ${response.error}`, 'error');
          return;
        }

        showStatus(`✓ ${selectedGtin.value} finalizado - ${response.data.quantidadeFotos} fotos pendentes de QA`, 'success');
        await loadLote();
        selectedGtin.value = '';
        inputGtin.value = '';
        descricaoProduto.value = '...';
        currentStatus.value = '';
        previousImages.value = [];
        observacoes.value = '';
      } catch (err) {
        showStatus(`✗ ${err.message}`, 'error');
      } finally {
        finalizandoCaptura.value = false;
      }
    };

    onUnmounted(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (cameraTimer) {
        clearInterval(cameraTimer);
      }
      document.removeEventListener('keydown', onPreviewKeydown);
    });

    return {
      activePage,
      plataforma,
      trocarPlataforma,
      irParaCarros,
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
      dispensarStatus,
      currentStatus,
      currentStatusLabel,
      observacoes,
      descricaoProduto,
      salvandoCaptura,
      finalizandoCaptura,
      onDeletePrevious,
      selecionarGtinDaLista,
      onFinalizar,
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
      qaEmCurso,
      qaClassificadas,
      qaDeliveryType,
      entregaSelecionados,
      entregaResultados,
      entregaEmCurso,
      entregaProgresso,
      entregaResumo,
      entregaTodosSelecionados,
      entregaSemCodigo,
      onToggleTodosEntrega,
      onEntregarSelecionados,
      planilhas,
      planilhaSelecionada,
      planilhaEmCurso,
      onCarregarPlanilhas,
      carrosData,
      carrosPlacas,
      carrosNovaPlaca,
      carrosPlacaAlvo,
      carrosFotoAlvo,
      explorerAberto,
      explorerAtual,
      explorerPai,
      explorerPastas,
      explorerFotos,
      explorerErro,
      carrosPastaDestino,
      carrosPlacaSelecionada,
      carrosEmCurso,
      carrosSemExif,
      carrosIntervalo,
      carrosPlacasLidas,
      carrosDatas,
      onCarregarDatas,
      carrosSemPlaca,
      carrosGrupos,
      definirPlacaDoGrupo,
      formatarHora,
      carrosProntas,
      carrosRelData,
      carrosRelStatus,
      carrosRelItens,
      carrosResumo,
      rotuloStatusCarro,
      onAprovarPlaca,
      onReabrirPlaca,
      onEntregarPlaca,
      onAbrirPastaEntrega,
      carrosEntregues,
      adsetModo,
      adsetUsuario,
      onEnviarAoAdset,
      atualizacao,
      atualizando,
      atualizacaoTitulo,
      atualizacaoResultado,
      onVerificarAtualizacao,
      onAtualizarSistema,
      adsetCfg,
      adsetForm,
      adsetSalvando,
      adsetTestando,
      adsetTeste,
      onSalvarAdset,
      onTestarAdset,
      onDesconectarAdset,
      cameraEstado,
      cameraRotulo,
      cameraMensagem,
      onReligarCamera,
      onCarregarRelatorioCarros,
      placaAtual,
      onMoverPosicao,
      onAbrirExplorador,
      onExplorar,
      onExplorarPai,
      onUsarPastaAtual,
      carrosTotalFotos,
      carrosPasta,
      carrosFotos,
      carrosLendo,
      carrosImportando,
      carrosPlacasInformadas,
      carrosFotosAntesDaPlaca,
      onLerPastaCarros,
      onCarregarDia,
      onCriarPlaca,
      onArrastarFoto,
      onSoltarNaPlaca,
      onSoltarNaFoto,
      onExcluirFotoCarro,
      onRenomearPlaca,
      onImportarCarros,
      sincronizarPlanilhas,
      planilhasConflitos,
      irPara,
      rotuloLote,
      qaFotosNormais,
      qaFotosAt,
      qaFotosElegiveis,
      qaMotivoBloqueio,
      onSelectQaGtin,
      onQaDeletePhoto,
      onSendToRework,
      modalOrigem,
      modalResolucao,
      modalIndice,
      modalTotal,
      modalUrl,
      navegarPreview,
      onPreviewLoad,
      onPreviewDelete,
      copiarUrlPreview,
      formatarTamanho,
      formatarData,
      reportStatus,
      reportItems,
      reportStats,
      vehiclesLote,
      vehicles,
      onLoteSelected,
      onGtinEnter,
      onGtinSearch,
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
