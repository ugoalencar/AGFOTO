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
  CAPTURA_SALVA: 'captura_salva'
});

/**
 * Transições permitidas entre estados
 */
export const StatusTransitions = {
  [ProductStatus.EM_CAPTURA]: [ProductStatus.PENDENTE_QA]
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
    [ProductEvents.CAPTURA_SALVA]: ProductStatus.PENDENTE_QA
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
