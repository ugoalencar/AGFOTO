import express from 'express';
import { Router } from 'express';
import CapturaService from '../services/captura-service.js';
import { Lote, Produto } from '../domain/lote.js';
import { PreviewService } from '../services/preview-service.js';
import { sendError } from '../server/response.js';
import { config } from '../server/config.js';
import fs from 'fs';

const router = Router();

/**
 * GET /api/captura/temp
 * Lista imagens atuais em images/temp/
 */
router.get('/temp', async (req, res) => {
  // ?gtin= renomeia o que chegou usando o GTIN selecionado, antes de listar.
  const result = await CapturaService.getTempImages(
    req.query.gtin || null,
    req.query.lote || null
  );

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
  // Captura e QA gerenciam imagem, entao so veem lote que existe em disco.
  // ?historico=1 devolve tudo que ha no JSON (usado por quem so le dados).
  const result = req.query.historico === '1'
    ? await CapturaService.listAllLotes()
    : await CapturaService.listLotesComImagens();

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

/**
 * GET /api/lotes/finalizados/lista
 * Lista apenas lotes com imagens finalizadas
 * MUST come before /:numero route
 */
router.get('/finalizados/lista', (req, res) => {
  try {
    const finalDir = config.paths.finalizadas;
    const allEntries = fs.readdirSync(finalDir, { withFileTypes: true });
    const dirs = allEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => name.startsWith('LOTE '));
    const lotes = dirs.map(d => d.replace(/^LOTE /, ''));

    console.log('[DEBUG] finalDir:', finalDir);
    console.log('[DEBUG] allEntries:', allEntries.map(e => e.name));
    console.log('[DEBUG] dirs:', dirs);
    console.log('[DEBUG] lotes:', lotes);

    res.json({
      ok: true,
      data: { lotes },
      requestId: req.id
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      requestId: req.id
    });
  }
});

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

  // Mesma regra da listagem: por padrao so os GTINs que tem foto em disco.
  const result = await CapturaService.getLoteDetails(numero, {
    somenteComImagens: req.query.historico !== '1'
  });

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
  const { lote, gtin, codigo, descricao, obs } = req.body;

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

  const result = await CapturaService.saveCapture(lote, gtin, codigo, descricao, obs);

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

/**
 * POST /api/captura/marcar
 * Toggle de sufixo (_coding, _RT, _IS, _AP) no nome dos arquivos marcados.
 *
 * Body: { location: 'temp'|'finalizadas', filenames: [], suffix: '_coding', lote?, gtin? }
 */
router.post('/marcar', express.json(), async (req, res) => {
  const { location, filenames, suffix, lote, gtin } = req.body;

  if (!['temp', 'finalizadas'].includes(location)) {
    return res.status(400).json({ ok: false, error: 'location must be temp or finalizadas', requestId: req.id });
  }
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ ok: false, error: 'filenames must be a non-empty array', requestId: req.id });
  }
  if (location === 'finalizadas') {
    if (!Lote.isValid(lote)) {
      return res.status(400).json({ ok: false, error: `Invalid lote: ${lote}`, requestId: req.id });
    }
    if (!Produto.isValid(gtin)) {
      return res.status(400).json({ ok: false, error: `Invalid GTIN: ${gtin}`, requestId: req.id });
    }
  }

  const result = await CapturaService.markPhotos({ location, filenames, suffix, lote, gtin });
  return res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    data: result.data,
    error: result.error,
    requestId: req.id
  });
});

/**
 * POST /api/captura/tag-subpasta
 * Move (ou desfaz) a marcacao RT/IS/AP de fotos ja salvas.
 *
 * Body: { lote, gtin, filenames: [], pasta: 'RT'|'IS'|'AP' }
 */
router.post('/tag-subpasta', express.json(), async (req, res) => {
  const { lote, gtin, filenames, pasta } = req.body;

  if (!Lote.isValid(lote)) {
    return res.status(400).json({ ok: false, error: `Invalid lote: ${lote}`, requestId: req.id });
  }
  if (!Produto.isValid(gtin)) {
    return res.status(400).json({ ok: false, error: `Invalid GTIN: ${gtin}`, requestId: req.id });
  }
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ ok: false, error: 'filenames must be a non-empty array', requestId: req.id });
  }

  const result = await CapturaService.tagSubfolder({ lote, gtin, filenames, pasta });
  return res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    data: result.data,
    error: result.error,
    requestId: req.id
  });
});

/**
 * GET /api/captura/imagens/subpastas?lote=&gtin=
 * Lista as fotos que estao em RT/IS/AP
 */
router.get('/imagens/subpastas', async (req, res) => {
  const { lote, gtin } = req.query;

  if (!Lote.isValid(lote) || !Produto.isValid(gtin)) {
    return res.status(400).json({ ok: false, error: 'Invalid lote or GTIN', requestId: req.id });
  }

  const result = await CapturaService.getSubfolderImages(lote, gtin);
  return res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    data: result.data,
    error: result.error,
    requestId: req.id
  });
});

/**
 * DELETE /api/captura/imagem/finalizadas
 * Remove uma foto ja salva (raiz ou subpasta).
 *
 * Body: { lote, gtin, filename, location? }
 */
router.delete('/imagem/finalizadas', express.json(), async (req, res) => {
  const { lote, gtin, filename, location } = req.body;

  if (!Lote.isValid(lote)) {
    return res.status(400).json({ ok: false, error: `Invalid lote: ${lote}`, requestId: req.id });
  }
  if (!Produto.isValid(gtin)) {
    return res.status(400).json({ ok: false, error: `Invalid GTIN: ${gtin}`, requestId: req.id });
  }
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ ok: false, error: 'filename is required', requestId: req.id });
  }

  const result = await CapturaService.deleteFinalizadaPhoto({ lote, gtin, filename, location });
  return res.status(result.ok ? 200 : 400).json({
    ok: result.ok,
    data: result.data,
    error: result.error,
    requestId: req.id
  });
});

router.get('/:numero/itens', getLoteHandler);
router.get('/:numero', getLoteHandler);

export default router;
