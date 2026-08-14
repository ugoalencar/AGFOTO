import { ProductEvents, ProductStatus, transitionProduct } from './status.js';

/**
 * Entidade Lote (batch)
 * Representa um lote de fotografias com múltiplos produtos
 */
export class Lote {
  constructor(numero) {
    this.numero = String(numero);
    this.criadoEm = new Date().toISOString();
    this.atualizadoEm = new Date().toISOString();
    this.itens = {};
  }

  /**
   * Normaliza número de lote
   */
  static normalize(numero) {
    if (!numero || typeof numero !== 'string') {
      throw new Error('Lote number must be a non-empty string');
    }
    return numero.trim();
  }

  /**
   * Valida se número de lote é seguro
   */
  static isValid(numero) {
    if (!numero || typeof numero !== 'string') return false;
    if (numero.length > 50) return false;
    if (/[<>:"|?*\\/]/.test(numero)) return false;
    return true;
  }

  /**
   * Adiciona ou obtém produto no lote
   */
  getOrCreateItem(gtin, codigo, descricao) {
    if (!this.itens[gtin]) {
      this.itens[gtin] = new Produto(gtin, codigo, descricao);
    }
    this.atualizadoEm = new Date().toISOString();
    return this.itens[gtin];
  }

  /**
   * Retorna todos os GTINs do lote
   */
  getAllGtins() {
    return Object.keys(this.itens);
  }

  /**
   * Conta fotos por status
   */
  countByStatus(status) {
    return Object.values(this.itens).filter(item => item.status === status).length;
  }

  /**
   * Retorna total de fotos
   */
  getTotalPhotos() {
    return Object.values(this.itens).reduce((sum, item) => sum + item.quantidadeFotos, 0);
  }

  /**
   * Serializa para JSON
   */
  toJSON() {
    return {
      schemaVersion: 1,
      lote: this.numero,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
      itens: Object.fromEntries(
        Object.entries(this.itens).map(([gtin, item]) => [gtin, item.toJSON()])
      )
    };
  }

  /**
   * Reconstrói a partir de JSON
   */
  static fromJSON(data) {
    const lote = new Lote(data.lote);
    lote.criadoEm = data.criadoEm;
    lote.atualizadoEm = data.atualizadoEm;

    for (const [gtin, itemData] of Object.entries(data.itens || {})) {
      lote.itens[gtin] = Produto.fromJSON(itemData);
    }

    return lote;
  }
}

/**
 * Entidade Produto dentro de um Lote
 */
export class Produto {
  constructor(gtin, codigo = null, descricao = null) {
    this.gtin = String(gtin);
    this.codigo = codigo ? String(codigo) : null;
    this.descricao = descricao ? String(descricao) : null;
    this.status = ProductStatus.EM_CAPTURA;
    this.dataFotografia = null;
    this.quantidadeFotos = 0;
    this.ultimaEntregaEm = null;
    this.ultimoErro = null;
    this.historico = [];
  }

  /**
   * Normaliza GTIN/EAN (preserva zeros à esquerda)
   */
  static normalize(gtin) {
    if (!gtin) throw new Error('GTIN is required');
    const normalized = String(gtin).trim();
    if (normalized.length === 0) throw new Error('GTIN cannot be empty');
    return normalized;
  }

  /**
   * Valida se GTIN/EAN é válido
   * Aceita 8, 12, 13 ou 14 dígitos
   */
  static isValid(gtin) {
    const normalized = String(gtin).trim();
    return /^\d{1,64}$/.test(normalized);
  }

  /**
   * Registra evento no histórico
   */
  addHistoricoEvent(evento, detalhes = {}) {
    this.historico.push({
      evento,
      em: new Date().toISOString(),
      detalhes
    });
    this.atualizadoEm = new Date().toISOString();
  }

  /**
   * Atualiza quantidade de fotos
   */
  updatePhotoCount(count) {
    this.quantidadeFotos = Math.max(0, count);
    if (this.dataFotografia === null && count > 0) {
      this.dataFotografia = new Date().toISOString();
    }
    this.addHistoricoEvent('foto_count_updated', { quantidadeFotos: count });
  }

  /**
   * Marca como captura salva (muda status para pendente_qa)
   */
  markCaptureSaved(photoCount) {
    this.updatePhotoCount(photoCount);
    transitionProduct(this, ProductEvents.CAPTURA_SALVA, { quantidadeFotos: photoCount });
  }

  /**
   * Registra erro de entrega
   */
  recordDeliveryError(error) {
    this.ultimoErro = error;
    this.status = ProductStatus.ERRO_ENTREGA;
    this.addHistoricoEvent('erro_entrega', { erro: error });
  }

  /**
   * Marca como entregue
   */
  markDelivered() {
    this.status = ProductStatus.ENTREGUE;
    this.ultimaEntregaEm = new Date().toISOString();
    this.ultimoErro = null;
    this.addHistoricoEvent('entregue', { em: this.ultimaEntregaEm });
  }

  /**
   * Serializa para JSON
   */
  toJSON() {
    return {
      gtin: this.gtin,
      codigo: this.codigo,
      descricao: this.descricao,
      status: this.status,
      dataFotografia: this.dataFotografia,
      quantidadeFotos: this.quantidadeFotos,
      ultimaEntregaEm: this.ultimaEntregaEm,
      ultimoErro: this.ultimoErro,
      historico: this.historico
    };
  }

  /**
   * Reconstrói a partir de JSON
   */
  static fromJSON(data) {
    const produto = new Produto(data.gtin, data.codigo, data.descricao);
    produto.status = data.status;
    produto.dataFotografia = data.dataFotografia;
    produto.quantidadeFotos = data.quantidadeFotos;
    produto.ultimaEntregaEm = data.ultimaEntregaEm;
    produto.ultimoErro = data.ultimoErro;
    produto.historico = data.historico || [];
    return produto;
  }
}

export default { Lote, Produto };
