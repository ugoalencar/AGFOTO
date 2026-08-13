#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { config, initConfig, createExampleConfigs } from './server/config.js';
import { auditLogger } from './server/audit-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Request ID para auditoria
app.use((req, res, next) => {
  req.id = uuidv4();
  auditLogger.setRequestId(req.id);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'local'
  });
});

// Version
app.get('/api/version', (req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    name: 'AG Fotografia',
    displayName: 'AG Foto'
  });
});

// Status da câmera
app.get('/api/status/camera', (req, res) => {
  // TODO: Implementar detecção de processo simplusCamera.exe
  res.json({
    ok: true,
    camera: {
      connected: false,
      message: 'Camera status check not yet implemented'
    }
  });
});

// Placeholder para rotas futuras
app.get('/api/captura/temp', (req, res) => {
  res.json({
    ok: true,
    data: {
      temp: [],
      message: 'Captura module not yet implemented'
    }
  });
});

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    requestId: req.id
  });
});

/**
 * Inicializa e inicia o servidor
 */
async function start() {
  try {
    console.log('\n=== AG FOTOGRAFIA ===\n');

    // Inicializa configurações
    await initConfig();
    await createExampleConfigs();

    // Informações de startup
    console.log(`Host: ${config.server.host}`);
    console.log(`Port: ${config.server.port}`);
    console.log(`Root: ${config.paths.root}`);
    console.log(`LAN Enabled: ${config.server.lanEnabled}\n`);

    // Inicia servidor
    const host = config.server.lanEnabled ? '0.0.0.0' : config.server.host;
    app.listen(config.server.port, host, () => {
      console.log(`✓ Server running on http://${config.server.host}:${config.server.port}`);
      console.log('\nPress Ctrl+C to stop\n');

      auditLogger.log('SERVER_START', {
        host: config.server.host,
        port: config.server.port
      });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Tratamento de sinais
process.on('SIGINT', () => {
  console.log('\n\nServer stopping...');
  auditLogger.log('SERVER_STOP', { reason: 'SIGINT' });
  process.exit(0);
});

// Inicia
start();
