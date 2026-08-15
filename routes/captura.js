import express from 'express';
import { Router } from 'express';
import CapturaService from '../services/captura-service.js';
import { Lote, Produto } from '../domain/lote.js';
import { PreviewService } from '../services/preview-service.js';
import { sendError } from '../server/response.js';

const router = Router();

/**
 * GET /api/captura/temp
 * Lista imagens atuais em images/temp/
 */
router.get('/temp', async (req, res) => {
  const result = await CapturaService.getTempImages();

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
});

/**
 * GET /api/lotes
 * Lista todos os lotes
 */
const listLotesHandler = async (req, res) => {
  const result = await CapturaService.listAllLotes();

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
};

router.get('/', listLotesHandler);
router.get('/lotes', listLotesHandler);

/**
 * GET /api/lotes/:numero
 * Obtém detalhes de um lote
 */
const getLoteHandler = async (req, res) => {
  const { numero } = req.params;

  if (!numero || !Lote.isValid(numero)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid lote number',
      requestId: req.id
    });
  }

  const result = await CapturaService.getLoteDetails(numero);

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
};

router.get('/lotes/:numero', getLoteHandler);

/**
 * POST /api/captura/salvar
 * Salva fotos capturadas para um lote e GTIN
 *
 * Body:
 * {
 *   "lote": "37",
 *   "gtin": "07890000000001",
 *   "codigo": "CODIGO_123",
 *   "descricao": "Produto exemplo"
 * }
 */
router.post('/salvar', express.json(), async (req, res) => {
  const { lote, gtin, codigo, descricao } = req.body;

  // Validações
  if (!lote || typeof lote !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'Lote is required and must be string',
      requestId: req.id
    });
  }

  if (!gtin || typeof gtin !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'GTIN is required and must be string',
      requestId: req.id
    });
  }

  if (!Lote.isValid(lote)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid lote number: ${lote}`,
      requestId: req.id
    });
  }

  if (!Produto.isValid(gtin)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid GTIN: ${gtin}`,
      requestId: req.id
    });
  }

  const result = await CapturaService.saveCapture(lote, gtin, codigo, descricao);

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
});

/**
 * DELETE /api/captura/temp
 * Limpa arquivos de TEMP
 *
 * Body:
 * {
 *   "filenames": ["IMG001.jpg", "IMG002.jpg"]
 * }
 */
router.delete('/temp', express.json(), async (req, res) => {
  const { filenames } = req.body;

  if (!Array.isArray(filenames)) {
    return res.status(400).json({
      ok: false,
      error: 'Filenames must be an array',
      requestId: req.id
    });
  }

  const result = await CapturaService.clearTemp(filenames);

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
});

/**
 * GET /api/imagens/anterior
 * Lista imagens já capturadas de um GTIN
 *
 * Query params:
 * - lote: número do lote
 * - gtin: código GTIN
 * - subfolder: 'AP' ou 'AT' (opcional)
 */
router.get('/anterior', async (req, res) => {
  const { lote, gtin, subfolder } = req.query;

  if (!lote || !gtin) {
    return res.status(400).json({
      ok: false,
      error: 'Lote and GTIN are required',
      requestId: req.id
    });
  }

  if (!Lote.isValid(lote)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid lote: ${lote}`,
      requestId: req.id
    });
  }

  if (!Produto.isValid(gtin)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid GTIN: ${gtin}`,
      requestId: req.id
    });
  }

  const result = await CapturaService.getPreviousImages(lote, gtin, subfolder);

  if (result.ok) {
    res.json({
      ok: true,
      data: result.data,
      requestId: req.id
    });
  } else {
    res.status(400).json({
      ok: false,
      error: result.error,
      requestId: req.id
    });
  }
});

router.get('/imagem/temp/:filename', async (req, res) => {
  try {
    const service = req.app.locals.services.previewService || new PreviewService();
    return res.sendFile(await service.resolveTempImage(req.params.filename));
  } catch (error) {
    return sendError(res, error.code === 'ENOENT' ? 404 : 400, error);
  }
});

router.get('/imagem/finalizadas/:lote/:gtin/:filename', async (req, res) => {
  try {
    const service = req.app.locals.services.previewService || new PreviewService();
    return res.sendFile(await service.resolveFinalizedImage(req.params.lote, req.params.gtin, req.params.filename));
  } catch (error) {
    return sendError(res, error.code === 'ENOENT' ? 404 : 400, error);
  }
});

router.get('/imagem/finalizadas/:lote/:gtin/:subfolder/:filename', async (req, res) => {
  try {
    const service = req.app.locals.services.previewService || new PreviewService();
    return res.sendFile(await service.resolveFinalizedImage(req.params.lote, req.params.gtin, req.params.filename, req.params.subfolder));
  } catch (error) {
    return sendError(res, error.code === 'ENOENT' ? 404 : 400, error);
  }
});

router.get('/:numero/itens', getLoteHandler);
router.get('/:numero', getLoteHandler);

export default router;
