import express from 'express';
import { VehicleService } from '../services/vehicle-service.js';
import { VehicleRepository } from '../repositories/vehicle-repository.js';

const router = express.Router();

const responder = (res, result) => res
  .status(result.ok ? 200 : 400)
  .json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });

/**
 * GET /api/carros/navegar?caminho=
 * Lista unidades e subpastas para escolher a origem sem digitar o caminho.
 */
router.get('/navegar', async (req, res, next) => {
  try {
    responder(res, await VehicleService.navegar(req.query.caminho));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/pasta?caminho=E:/DCIM/100CANON
 * Le a pasta de origem (cartao de memoria ou outra) e devolve as fotos na
 * sequencia em que foram tiradas.
 *
 * Declarada antes de /:lote para nao ser capturada por ela.
 */
router.get('/pasta', async (req, res, next) => {
  try {
    const result = await VehicleService.scanFolder(req.query.caminho, {
      lerPlacas: req.query.ocr !== '0'
    });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/pasta/imagem/:filename
 * Serve uma foto da pasta lida, para a conferencia antes de importar.
 */
router.get('/pasta/imagem/:filename', async (req, res) => {
  try {
    return res.sendFile(await VehicleService.resolveFolderPhoto(req.params.filename));
  } catch (error) {
    return res.status(error.code === 'ENOENT' ? 404 : 400).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/carros/datas
 * Dias que ja tem fotos importadas.
 */
router.get('/datas', async (_req, res, next) => {
  try {
    responder(res, await VehicleService.listarDatas());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/dia/:data
 * Placas do dia, com as fotos de cada uma - lidas do disco.
 */
router.get('/dia/:data', async (req, res, next) => {
  try {
    responder(res, await VehicleService.listarPorData(req.params.data));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/foto/:data/:placa/:filename
 */
router.get('/foto/:data/:placa/:filename', async (req, res) => {
  try {
    const { data, placa, filename } = req.params;
    return res.sendFile(await VehicleService.resolveVehiclePhoto(data, placa, filename));
  } catch (error) {
    return res.status(error.code === 'ENOENT' ? 404 : 400).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/carros/importar-pasta
 * Copia a pasta lida para Carros/DD-MM-AAAA, agrupando pelas placas informadas.
 *
 * Body: { data, fotos: [{ name, placa? }] }
 */
router.post('/importar-pasta', express.json(), async (req, res, next) => {
  try {
    const { data, fotos } = req.body;
    responder(res, await VehicleService.importarParaData(data, fotos));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/placa
 * Cria uma placa vazia no dia, para receber fotos que ficaram no carro errado.
 *
 * Body: { data, placa }
 */
router.post('/placa', express.json(), async (req, res, next) => {
  try {
    responder(res, await VehicleService.criarPlaca(req.body?.data, req.body?.placa));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/carros/relatorio?data=&status=
 */
router.get('/relatorio', async (req, res, next) => {
  try {
    responder(res, await VehicleService.relatorio({
      data: req.query.data || null,
      status: req.query.status || null
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/aprovar   Body: { data, placa }
 * QA aprova a placa depois da edicao externa.
 */
router.post('/aprovar', express.json(), async (req, res, next) => {
  try {
    responder(res, await VehicleService.aprovarPlaca(req.body?.data, req.body?.placa));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/reabrir   Body: { data, placa }
 */
router.post('/reabrir', express.json(), async (req, res, next) => {
  try {
    responder(res, await VehicleService.reabrirPlaca(req.body?.data, req.body?.placa));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/entregar   Body: { data, placa }
 */
router.post('/entregar', express.json(), async (req, res, next) => {
  try {
    responder(res, await VehicleService.entregarPlaca(req.body?.data, req.body?.placa));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/reordenar
 * Body: { data, placa, ordem: [nomes na ordem desejada] }
 */
router.post('/reordenar', express.json(), async (req, res, next) => {
  try {
    const { data, placa, ordem } = req.body || {};
    responder(res, await VehicleService.reordenarFotos(data, placa, ordem));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/excluir-foto
 * Body: { data, placa, arquivo }
 */
router.post('/excluir-foto', express.json(), async (req, res, next) => {
  try {
    const { data, placa, arquivo } = req.body || {};
    responder(res, await VehicleService.excluirFoto(data, placa, arquivo));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/renomear-placa
 * Body: { data, de, para }
 */
router.post('/renomear-placa', express.json(), async (req, res, next) => {
  try {
    const { data, de, para } = req.body || {};
    responder(res, await VehicleService.renomearPlaca(data, de, para));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carros/mover-foto
 * Move uma foto de uma placa para outra dentro do mesmo dia.
 *
 * Body: { data, de, para, arquivo }
 */
router.post('/mover-foto', express.json(), async (req, res, next) => {
  try {
    const { data, de, para, arquivo } = req.body || {};
    responder(res, await VehicleService.moverFoto(data, de, para, arquivo));
  } catch (err) {
    next(err);
  }
});

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
