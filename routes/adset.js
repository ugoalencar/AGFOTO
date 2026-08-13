import express from 'express';
import { AdsetService } from '../services/adset-service.js';
import { config } from '../server/config.js';

const router = express.Router();

// Instância global do serviço (mantém sessão ativa)
let adsetService = null;

/**
 * Middleware para inicializar serviço com modo configurado
 */
const initAdsetService = (req, res, next) => {
  if (!adsetService) {
    const mode = req.query.mode || config.adset?.mode || 'mock';
    adsetService = new AdsetService({ mode });
  }
  next();
};

router.use(initAdsetService);

/**
 * POST /api/adset/login
 * Login na plataforma ADSET
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'email and password required'
      });
    }

    const result = await adsetService.login(email, password);

    if (!result.ok) {
      return res.status(401).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/adset/status
 * Status da sessão ADSET
 */
router.get('/status', (req, res) => {
  const isLoggedIn = adsetService && adsetService.sessionId !== null;

  res.json({
    ok: true,
    data: {
      loggedIn: isLoggedIn,
      mode: adsetService?.mode || 'mock',
      sessionId: isLoggedIn ? '***' : null,
      message: isLoggedIn ? 'ADSET session active' : 'Not logged in'
    }
  });
});

/**
 * GET /api/adset/publicados
 * Lista veículos publicados
 */
router.get('/publicados', async (req, res, next) => {
  try {
    if (!adsetService || !adsetService.sessionId) {
      return res.status(401).json({
        ok: false,
        error: 'Not logged in to ADSET'
      });
    }

    const result = await adsetService.listPublished();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/adset/rascunhos
 * Lista veículos em rascunho
 */
router.get('/rascunhos', async (req, res, next) => {
  try {
    if (!adsetService || !adsetService.sessionId) {
      return res.status(401).json({
        ok: false,
        error: 'Not logged in to ADSET'
      });
    }

    const result = await adsetService.listUnpublished();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/adset/validar/:lote/:placa
 * Valida veículo antes de entregar
 */
router.post('/validar/:lote/:placa', async (req, res, next) => {
  try {
    if (!adsetService || !adsetService.sessionId) {
      return res.status(401).json({
        ok: false,
        error: 'Not logged in to ADSET'
      });
    }

    const { lote, placa } = req.params;
    const result = await adsetService.validateVehicle(lote, placa);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/adset/entregar/:lote/:placa
 * Entrega veículo para ADSET
 */
router.post('/entregar/:lote/:placa', async (req, res, next) => {
  try {
    if (!adsetService || !adsetService.sessionId) {
      return res.status(401).json({
        ok: false,
        error: 'Not logged in to ADSET'
      });
    }

    const { lote, placa } = req.params;
    const result = await adsetService.deliverVehicle(lote, placa);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/adset/dry-run/relatorio
 * Relatório de dry-runs executados
 */
router.get('/dry-run/relatorio', (req, res) => {
  if (!adsetService) {
    return res.status(400).json({
      ok: false,
      error: 'ADSET service not initialized'
    });
  }

  const result = adsetService.getDryRunReport();
  res.json(result);
});

/**
 * POST /api/adset/dry-run/limpar
 * Limpa histórico de dry-runs
 */
router.post('/dry-run/limpar', (req, res) => {
  if (!adsetService) {
    return res.status(400).json({
      ok: false,
      error: 'ADSET service not initialized'
    });
  }

  const result = adsetService.clearDryRun();
  res.json(result);
});

/**
 * POST /api/adset/logout
 * Logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    if (!adsetService) {
      return res.json({ ok: true });
    }

    const result = await adsetService.logout();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
