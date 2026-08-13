/**
 * Estados possíveis para um produto em lote
 */
export const ProductStatus = {
  EM_CAPTURA: 'em_captura',
  PENDENTE_QA: 'pendente_qa',
  PRONTO_PARA_ENTREGA: 'pronto_para_entrega',
  ENTREGANDO: 'entregando',
  ENTREGUE: 'entregue',
  ERRO_ENTREGA: 'erro_entrega',
  RETRABALHO: 'retrabalho'
};

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

export default { ProductStatus, StatusTransitions, canTransition, getStatusLabel };
