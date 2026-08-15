import { Router } from 'express';
import ExcelService from '../services/excel-service.js';
import { Lote } from '../domain/lote.js';
import { sendError, sendOk } from '../server/response.js';

const router = Router();

router.get('/arquivos', async (_req, res) => {
  try {
    const result = await ExcelService.listAvailableWorkbooks();
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

/**
 * POST /api/planilhas/sincronizar
 * Varre a pasta de planilhas e preenche os codigos que estiverem faltando.
 * A tela chama sozinha ao abrir QA e Entregar.
 */
router.post('/sincronizar', async (_req, res) => {
  try {
    const result = await ExcelService.syncWorkbooksToLotes();
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.post('/aplicar-codigos', async (req, res) => {
  try {
    const result = await ExcelService.applyLookupToLote(req.body?.lote);
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.post('/importar', async (req, res) => {
  try {
    const result = await ExcelService.importWorkbook(req.body || {});
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.post('/confirmar', async (req, res) => {
  try {
    const result = await ExcelService.confirmImport(req.body?.importId);
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.post('/unificar', async (req, res) => {
  try {
    const { lote, items } = req.body || {};
    if (!Lote.isValid(lote)) return sendError(res, 400, 'Invalid lote');
    if (!Array.isArray(items) || items.length === 0) return sendError(res, 400, 'Items required');
    const result = await ExcelService.mergeToLookup(lote, items);
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.get('/conflitos', (_req, res) => sendOk(res, {
  message: 'Conflict resolution system placeholder',
  status: 'not_implemented'
}));

router.get('/controle', async (req, res) => {
  try {
    const { lote } = req.query;
    if (!Lote.isValid(lote)) return sendError(res, 400, 'Lote is required');
    const result = await ExcelService.generateBatchControlSheet(lote);
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

router.get('/reconciliar', async (req, res) => {
  try {
    const { lote } = req.query;
    if (!Lote.isValid(lote)) return sendError(res, 400, 'Lote is required');
    const result = await ExcelService.reconcile(lote);
    return result.ok ? sendOk(res, result.data) : sendError(res, 400, result.error);
  } catch (error) {
    return sendError(res, 400, error);
  }
});

export default router;
