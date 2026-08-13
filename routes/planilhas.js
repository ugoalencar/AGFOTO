import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ExcelService from '../services/excel-service.js';
import { config } from '../server/config.js';
import { securePath } from '../server/secure-filesystem.js';
import { Lote } from '../domain/lote.js';

const router = Router();

/**
 * POST /api/planilhas/importar
 * Upload e parse de arquivo Excel
 *
 * Form data:
 * - file: arquivo .xlsx
 * - lote: número do lote
 */
router.post('/importar', async (req, res) => {
  try {
    // Simples parsing sem upload (em produção, usar multer)
    const { lote } = req.body;

    if (!lote || !Lote.isValid(lote)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid lote number',
        requestId: req.id
      });
    }

    // Retorna instruções de upload
    res.json({
      ok: true,
      data: {
        message: 'Upload Excel via POST com form-data',
        supported_formats: ['.xlsx'],
        max_size: '50MB',
        max_rows: 100000
      },
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

/**
 * POST /api/planilhas/unificar
 * Unifica items no lookup-integrado.xlsx
 *
 * Body:
 * {
 *   "lote": "37",
 *   "items": [
 *     { "ean": "...", "codigo": "...", "descricao": "..." }
 *   ]
 * }
 */
router.post('/unificar', express.json(), async (req, res) => {
  try {
    const { lote, items } = req.body;

    if (!lote || !Lote.isValid(lote)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid lote',
        requestId: req.id
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Items required',
        requestId: req.id
      });
    }

    const result = await ExcelService.mergeToLookup(lote, items);

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
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      requestId: req.id
    });
  }
});

/**
 * GET /api/planilhas/conflitos
 * Lista conflitos pendentes
 *
 * Query:
 * - lote: número do lote (opcional)
 */
router.get('/conflitos', (req, res) => {
  try {
    // Placeholder para sistema de conflitos
    res.json({
      ok: true,
      data: {
        message: 'Conflict resolution system placeholder',
        status: 'not_implemented'
      },
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

/**
 * GET /api/planilhas/controle
 * Download controle-lotes.xlsx
 *
 * Query:
 * - lote: número do lote
 */
router.get('/controle', async (req, res) => {
  try {
    const { lote } = req.query;

    if (!lote || !Lote.isValid(lote)) {
      return res.status(400).json({
        ok: false,
        error: 'Lote is required',
        requestId: req.id
      });
    }

    // Gera controle sheet
    const result = await ExcelService.generateBatchControlSheet(lote);

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
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      requestId: req.id
    });
  }
});

/**
 * GET /api/planilhas/reconciliar
 * Reconcilia JSON com Excel
 *
 * Query:
 * - lote: número do lote
 */
router.get('/reconciliar', async (req, res) => {
  try {
    const { lote } = req.query;

    if (!lote || !Lote.isValid(lote)) {
      return res.status(400).json({
        ok: false,
        error: 'Lote is required',
        requestId: req.id
      });
    }

    const result = await ExcelService.reconcile(lote);

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
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
      requestId: req.id
    });
  }
});

export default router;
