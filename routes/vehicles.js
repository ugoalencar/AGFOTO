import express from 'express';
import { VehicleService } from '../services/vehicle-service.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';

const router = express.Router();

/**
 * POST /api/carros/importar
 * Importa fotos de cartão de memória e processa com OCR
 */
router.post('/importar', async (req, res, next) => {
  try {
    const { lote, photos } = req.body;

    if (!lote || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'lote and photos array required'
      });
    }

    const result = await VehicleService.importVehiclePhotos(lote, photos);

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/:lote
 * Lista veículos de um lote
 */
router.get('/:lote', async (req, res, next) => {
  try {
    const { lote } = req.params;

    const result = await VehicleService.loadVehicles(lote);

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/:lote/:placa
 * Detalhe de um veículo
 */
router.get('/:lote/:placa', async (req, res, next) => {
  try {
    const { lote, placa } = req.params;

    const result = await VehicleRepository.loadVehicle(lote, placa);

    if (!result.ok) {
      return res.status(404).json({ ok: false, error: 'Vehicle not found' });
    }

    const vehicle = result.data;

    res.json({
      ok: true,
      data: {
        ...vehicle.toJSON(),
        totalPhotos: vehicle.photos.length
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/carros/:lote/:placa/ordem
 * Reordena fotos de um veículo
 */
router.patch('/:lote/:placa/ordem', async (req, res, next) => {
  try {
    const { lote, placa } = req.params;
    const { reorderList } = req.body;

    if (!Array.isArray(reorderList)) {
      return res.status(400).json({
        ok: false,
        error: 'reorderList array required'
      });
    }

    const result = await VehicleService.reorderPhotos(lote, placa, reorderList);

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/:lote/:placa/qa
 * Marca veículo como pronto para entrega
 */
router.post('/:lote/:placa/qa', async (req, res, next) => {
  try {
    const { lote, placa } = req.params;

    const result = await VehicleService.completeVehicleQa(lote, placa);

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/:lote/:placa/entregar
 * Entrega veículo para ADSET
 */
router.post('/:lote/:placa/entregar', async (req, res, next) => {
  try {
    const { lote, placa } = req.params;

    const result = await VehicleService.deliverToAdset(lote, placa);

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/relatorios/resumo
 * Relatório de veículos
 */
router.get('/relatorios/resumo', async (req, res, next) => {
  try {
    const { lote, status } = req.query;

    const result = await VehicleService.generateReport({
      lote: lote || null,
      status: status || null
    });

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
