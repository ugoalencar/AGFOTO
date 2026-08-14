import express, { Router } from 'express';
import DeliveryService from '../services/delivery-service.js';
import ReportService from '../services/report-service.js';
import { Lote, Produto } from '../domain/lote.js';

const router = Router();

function hasValidQaIdentifiers(lote, gtin) {
  return Lote.isValid(lote) && Produto.isValid(gtin);
}

/**
 * GET /api/qa/produtos/:lote
 * Lista produtos de um lote prontos para QA
 */
router.get('/produtos/:lote', async (req, res) => {
  const { lote } = req.params;

  if (!Lote.isValid(lote)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid lote',
      requestId: req.id
    });
  }

  const result = await DeliveryService.listReadyForDelivery(lote);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/qa/fotos/:lote/:gtin
 * Carrega fotos para QA
 */
router.get('/fotos/:lote/:gtin', async (req, res) => {
  const { lote, gtin } = req.params;

  if (!Lote.isValid(lote) || !Produto.isValid(gtin)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid lote or GTIN',
      requestId: req.id
    });
  }

  const result = await DeliveryService.loadQaPhotos(lote, gtin);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/qa/classificar
 * Classifica foto como AP ou AT
 *
 * Body: { lote, gtin, filename, classification }
 */
router.post('/classificar', express.json(), async (req, res) => {
  const { lote, gtin, filename, classification } = req.body;

  if (!hasValidQaIdentifiers(lote, gtin) || !filename || !['AP', 'AT'].includes(classification)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid parameters',
      requestId: req.id
    });
  }

  let result;
  const operationContext = { operationId: req.body.operationId || req.headers['x-operation-id'] };
  if (classification === 'AP') {
    result = await DeliveryService.classifyPhotoAP(lote, gtin, filename, operationContext);
  } else {
    result = await DeliveryService.classifyPhotoAT(lote, gtin, filename, operationContext);
  }

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/qa/desclassificar
 * Remove classificação de foto
 */
router.post('/desclassificar', express.json(), async (req, res) => {
  const { lote, gtin, filename, fromClassification = null } = req.body;

  if (!hasValidQaIdentifiers(lote, gtin) || !filename) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid parameters',
      requestId: req.id
    });
  }

  const operationContext = { operationId: req.body.operationId || req.headers['x-operation-id'] };
  const result = await DeliveryService.unclassifyPhoto(lote, gtin, filename, fromClassification, operationContext);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/qa/excluir
 * Exclui uma foto classificada ou da raiz e registra auditoria.
 */
router.post('/excluir', express.json(), async (req, res) => {
  const { lote, gtin, filename, location = 'root' } = req.body;

  if (!hasValidQaIdentifiers(lote, gtin) || !filename) {
    return res.status(400).json({ ok: false, error: 'Invalid parameters', requestId: req.id });
  }

  const operationContext = { operationId: req.body.operationId || req.headers['x-operation-id'] };
  const result = await DeliveryService.deletePhoto(lote, gtin, filename, location, operationContext);
  if (result.ok) {
    return res.json({ ok: true, data: result.data, requestId: req.id });
  }
  return res.status(400).json({ ok: false, error: result.error, requestId: req.id });
});

/**
 * POST /api/qa/concluir
 * Conclui QA e muda status para pronto_para_entrega
 */
router.post('/concluir', express.json(), async (req, res) => {
  const { lote, gtin, deliveryType = 'normal' } = req.body;

  if (!hasValidQaIdentifiers(lote, gtin)) {
    return res.status(400).json({
      ok: false,
      error: 'Lote and GTIN required',
      requestId: req.id
    });
  }

  const result = await DeliveryService.completeQa(lote, gtin, deliveryType);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/entregas/preparar
 * Prepara entrega (staging + manifest)
 */
router.post('/preparar', express.json(), async (req, res) => {
  const { lote, gtin, codigo, deliveryType = 'normal' } = req.body;

  if (!lote || !gtin || !codigo) {
    return res.status(400).json({
      ok: false,
      error: 'Lote, GTIN, and codigo required',
      requestId: req.id
    });
  }

  const result = await DeliveryService.prepareDelivery(lote, gtin, codigo, deliveryType);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/entregas/executar
 * Executa entrega via FTP
 */
router.post('/executar', express.json(), async (req, res) => {
  const { lote, gtin, codigo, deliveryType = 'normal' } = req.body;

  if (!lote || !gtin || !codigo) {
    return res.status(400).json({
      ok: false,
      error: 'Lote, GTIN, and codigo required',
      requestId: req.id
    });
  }

  const result = await DeliveryService.executeDelivery(lote, gtin, codigo, deliveryType);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * POST /api/retrabalhos
 * Reinicia produto para retrabalho
 */
router.post('/', express.json(), async (req, res) => {
  const { lote, gtin = null, codigo = null } = req.body;

  if (!lote || (!gtin && !codigo)) {
    return res.status(400).json({
      ok: false,
      error: 'Lote and (GTIN or codigo) required',
      requestId: req.id
    });
  }

  const result = await DeliveryService.restartRework(lote, gtin, codigo);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/produtos
 * Relatório de produtos com filtros
 */
router.get('/produtos', async (req, res) => {
  const filters = {
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null,
    lote: req.query.lote || null,
    status: req.query.status || null,
    gtin: req.query.gtin || null,
    codigo: req.query.codigo || null,
    descricao: req.query.descricao || null
  };

  const result = await ReportService.generateProductReport(filters);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/lotes
 * Relatório de lotes
 */
router.get('/lotes', async (req, res) => {
  const result = await ReportService.generateBatchReport();

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/status
 * Resumo por status
 */
router.get('/status', async (req, res) => {
  const result = await ReportService.generateStatusSummary();

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/exportar
 * Exporta dados para XLSX
 *
 * Query: filtros (lote, status, etc)
 */
router.get('/exportar', async (req, res) => {
  const filters = {
    lote: req.query.lote || null,
    status: req.query.status || null
  };

  const result = await ReportService.generateExportData(filters);

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id,
      note: 'Use CSV endpoint for actual file download'
    });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/csv
 * Exporta em formato CSV
 */
router.get('/csv', async (req, res) => {
  const filters = {
    lote: req.query.lote || null,
    status: req.query.status || null
  };

  const result = await ReportService.generateCsvData(filters);

  if (result.ok) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
    res.send(result.data.csv);
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

/**
 * GET /api/relatorios/validar
 * Valida consistência de lote
 */
router.get('/validar/:lote', async (req, res) => {
  const { lote } = req.params;

  if (!Lote.isValid(lote)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid lote',
      requestId: req.id
    });
  }

  const result = await ReportService.validateConsistency(lote);

  if (result.ok) {
    res.json({ ok: true, data: result.data, requestId: req.id });
  } else {
    res.status(400).json({ ok: false, error: result.error, requestId: req.id });
  }
});

export default router;
