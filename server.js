#!/usr/bin/env node

import { createApp } from './server/app.js';
import { config, initConfig, createExampleConfigs } from './server/config.js';
import { auditLogger } from './server/audit-logger.js';
import { getWatcher } from './services/filesystem-watcher.js';

async function start() {
  await initConfig();
  await createExampleConfigs();

  const app = createApp();
  const watcher = getWatcher();
  await watcher.start();

  const host = config.server.lanEnabled ? '0.0.0.0' : config.server.host;
  app.listen(config.server.port, host, () => {
    console.log(`Server running on http://${config.server.host}:${config.server.port}`);
    auditLogger.log('SERVER_START', { host: config.server.host, port: config.server.port });
  });
}

process.on('SIGINT', () => {
  const watcher = getWatcher();
  watcher?.stop();
  auditLogger.log('SERVER_STOP', { reason: 'SIGINT' });
  process.exit(0);
});

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
