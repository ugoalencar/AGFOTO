import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import capturaRoutes from '../routes/captura.js';
import planilhasRoutes from '../routes/planilhas.js';
import qaHubRoutes from '../routes/qa-hub.js';
import { auditLogger } from './audit-logger.js';
import { applyConfigOverrides } from './config.js';
import { createOperationStore } from './operation-store.js';
import { sendError, sendOk } from './response.js';
import { CameraService } from '../services/camera-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PHASE_ONE_BLOCKED_PATHS = new Set([
  '/api/entregas/executar',
  '/api/qa/executar',
  '/api/retrabalhos/executar',
  '/api/relatorios/executar',
  '/api/carros',
  '/api/adset'
]);

function blockPhaseOneRoutes(req, res, next) {
  if (MUTATING_METHODS.has(req.method) && PHASE_ONE_BLOCKED_PATHS.has(req.path)) {
    return sendError(res, 404, `Not found: ${req.originalUrl}`);
  }
  return next();
}

function operationMiddleware(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const store = req.app.locals.operationStore;
  let operationId;
  try {
    operationId = store.requireOperationId(req);
    const operation = store.begin(operationId, `${req.method} ${req.path}`);
    if (operation.status === 'completed') {
      return res.status(operation.result.status).json({
        ...operation.result.body,
        requestId: req.id
      });
    }
  } catch (error) {
    return sendError(res, error.message.includes('already in progress') ? 409 : 400, error);
  }

  const json = res.json.bind(res);
  res.json = body => {
    store.complete(operationId, { status: res.statusCode, body });
    return json(body);
  };
  return next();
}

export function createApp({ configOverrides = null, services = {} } = {}) {
  if (configOverrides) applyConfigOverrides(configOverrides);

  const app = express();
  app.locals.services = services;
  app.locals.operationStore = services.operationStore || createOperationStore();

  app.use((req, res, next) => {
    req.id = uuidv4();
    auditLogger.setRequestId(req.id);
    res.setHeader('X-Request-ID', req.id);
    next();
  });
  app.use(blockPhaseOneRoutes);
  app.use(express.json({ limit: '10mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(operationMiddleware);

  app.get('/api/health', (_req, res) => sendOk(res, {
    timestamp: new Date().toISOString(),
    environment: 'local'
  }));
  app.get('/api/version', (_req, res) => sendOk(res, {
    version: '1.0.0-fase1',
    name: 'AG Fotografia',
    displayName: 'AG Foto'
  }));
  app.get('/api/status/camera', async (_req, res, next) => {
    try {
      const service = app.locals.services.cameraService || new CameraService();
      return sendOk(res, await service.getStatus());
    } catch (error) {
      return next(error);
    }
  });
  app.post('/api/status/camera/open', async (_req, res, next) => {
    try {
      const service = app.locals.services.cameraService || new CameraService();
      return sendOk(res, await service.open());
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api/captura', capturaRoutes);
  app.use('/api/lotes', capturaRoutes);
  app.use('/api/imagens', capturaRoutes);
  app.use('/api/planilhas', planilhasRoutes);
  app.use('/api/qa', qaHubRoutes);
  app.use('/api/retrabalhos', qaHubRoutes);
  app.use('/api/relatorios', qaHubRoutes);

  app.use(express.static(path.join(rootDir, 'frontend', 'public')));
  app.use((req, res) => sendError(res, 404, `Not found: ${req.path}`));
  app.use((err, req, res, _next) => {
    if (
      err.type === 'entity.parse.failed' &&
      MUTATING_METHODS.has(req.method) &&
      !req.headers['x-operation-id']
    ) {
      return sendError(res, 400, 'operationId is required');
    }
    console.error('Error:', err);
    sendError(res, err.status || 500, err.expose ? err.message : 'Internal server error');
  });

  return app;
}
