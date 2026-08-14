/**
 * Estados possíveis para um produto em lote
 */
export const ProductStatus = Object.freeze({
  EM_CAPTURA: 'em_captura',
  PENDENTE_QA: 'pendente_qa',
  PRONTO_PARA_ENTREGA: 'pronto_para_entrega',
  ENTREGANDO: 'entregando',
  ENTREGUE: 'entregue',
  ERRO_ENTREGA: 'erro_entrega',
  RETRABALHO: 'retrabalho'
});

export const ProductEvents = Object.freeze({
  CAPTURA_SALVA: 'captura_salva',
  QA_CONCLUIDO: 'qa_concluido',
  ENTREGA_INICIADA: 'entrega_iniciada',
  ENTREGA_CONFIRMADA: 'entrega_confirmada',
  ENTREGA_FALHOU: 'entrega_falhou',
  RETRABALHO_INICIADO: 'retrabalho_iniciado'
});

/**
 * Transições permitidas entre estados
 */
export const StatusTransitions = {
  [ProductStatus.EM_CAPTURA]: [ProductStatus.PENDENTE_QA],
  [ProductStatus.PENDENTE_QA]: [ProductStatus.PRONTO_PARA_ENTREGA, ProductStatus.RETRABALHO],
  [ProductStatus.PRONTO_PARA_ENTREGA]: [ProductStatus.ENTREGANDO, ProductStatus.RETRABALHO],
  [ProductStatus.ENTREGANDO]: [ProductStatus.ENTREGUE, ProductStatus.ERRO_ENTREGA],
  [ProductStatus.ERRO_ENTREGA]: [ProductStatus.ENTREGANDO, ProductStatus.RETRABALHO],
  [ProductStatus.RETRABALHO]: [ProductStatus.PENDENTE_QA]
};

/**
 * Valida transição de status
 */
export function canTransition(currentStatus, targetStatus) {
  const allowed = StatusTransitions[currentStatus];
  return allowed && allowed.includes(targetStatus);
}

export function nextProductStatus(currentStatus, event) {
  const targets = {
    [ProductEvents.CAPTURA_SALVA]: ProductStatus.PENDENTE_QA,
    [ProductEvents.QA_CONCLUIDO]: ProductStatus.PRONTO_PARA_ENTREGA,
    [ProductEvents.ENTREGA_INICIADA]: ProductStatus.ENTREGANDO,
    [ProductEvents.ENTREGA_CONFIRMADA]: ProductStatus.ENTREGUE,
    [ProductEvents.ENTREGA_FALHOU]: ProductStatus.ERRO_ENTREGA,
    [ProductEvents.RETRABALHO_INICIADO]: ProductStatus.RETRABALHO
  };
  const targetStatus = targets[event];
  if (!targetStatus) throw new Error(`Unknown product event: ${event}`);
  if (!canTransition(currentStatus, targetStatus)) {
    throw new Error(`Invalid product transition: ${currentStatus} -> ${targetStatus}`);
  }
  return targetStatus;
}

export function transitionProduct(produto, event, details = {}) {
  const targetStatus = nextProductStatus(produto.status, event);
  produto.status = targetStatus;
  produto.addHistoricoEvent(event, details);
  return produto;
}

/**
 * Obtém descrição legível do status
 */
export function getStatusLabel(status) {
  const labels = {
    [ProductStatus.EM_CAPTURA]: 'Em Captura',
    [ProductStatus.PENDENTE_QA]: 'Pendente QA',
    [ProductStatus.PRONTO_PARA_ENTREGA]: 'Pronto para Entrega',
    [ProductStatus.ENTREGANDO]: 'Entregando',
    [ProductStatus.ENTREGUE]: 'Entregue',
    [ProductStatus.ERRO_ENTREGA]: 'Erro na Entrega',
    [ProductStatus.RETRABALHO]: 'Retrabalho'
  };
  return labels[status] || status;
}

export default {
  ProductStatus,
  ProductEvents,
  StatusTransitions,
  canTransition,
  nextProductStatus,
  transitionProduct,
  getStatusLabel
};
