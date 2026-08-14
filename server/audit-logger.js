import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
function getAuditDir() {
  return config.paths.auditoria || path.join(config.paths.dados, 'auditoria');
}

/**
 * Logger de auditoria append-only
 * Cada ação destrutiva ou crítica é registrada de forma imutável
 */
export class AuditLogger {
  constructor() {
    this.requestId = null;
    this.initialized = false;
  }

  /**
   * Inicializa o diretório de auditoria
   */
  async init() {
    if (this.initialized) return;

    try {
      await fs.promises.mkdir(getAuditDir(), { recursive: true });
      this.initialized = true;
    } catch (err) {
      console.error(`Failed to initialize audit: ${err.message}`);
      throw err;
    }
  }

  /**
   * Define requestId para correlação
   */
  setRequestId(id) {
    this.requestId = id;
  }

  /**
   * Registra evento de forma append-only
   */
  async log(action, details = {}) {
    await this.init();

    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      action,
      details: sanitize(details),
      hostname: os.hostname(),
      userAgent: process.env.USER || 'system'
    };

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(getAuditDir(), `audit_${today}.jsonl`);

    try {
      // Append uma linha (JSONL format)
      await fs.promises.appendFile(
        logFile,
        JSON.stringify(entry) + '\n',
        'utf8'
      );
    } catch (err) {
      console.error(`Audit log failed: ${err.message}`);
      throw new Error(`Audit log failed: ${err.message}`);
    }

    return entry.id;
  }

  /**
   * Lê logs de auditoria com filtros
   */
  async read(filters = {}) {
    await this.init();

    const { action, startDate, endDate, limit = 1000 } = filters;
    const entries = [];

    try {
      const auditDir = getAuditDir();
      const files = await fs.promises.readdir(auditDir);
      const logFiles = files.filter(f => f.startsWith('audit_') && f.endsWith('.jsonl'));

      for (const file of logFiles.sort().reverse()) {
        const filePath = path.join(auditDir, file);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines.reverse()) {
          const entry = JSON.parse(line);

          // Aplica filtros
          if (action && entry.action !== action) continue;
          if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue;
          if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue;

          entries.push(entry);

          if (entries.length >= limit) break;
        }

        if (entries.length >= limit) break;
      }
    } catch (err) {
      console.error(`Cannot read audit logs: ${err.message}`);
    }

    return entries;
  }
}

/**
 * Remove informações sensíveis antes de registrar
 */
function sanitize(obj) {
  const sensitive = ['password', 'token', 'secret', 'credential', 'key'];
  const result = JSON.parse(JSON.stringify(obj));

  function clean(o) {
    for (const key in o) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        o[key] = '***REDACTED***';
      } else if (typeof o[key] === 'object' && o[key] !== null) {
        clean(o[key]);
      }
    }
  }

  clean(result);
  return result;
}

/**
 * Ações de auditoria obrigatórias
 */
export async function auditDelete(filePath, details = {}) {
  const audit = new AuditLogger();
  return audit.log('DELETE', { filePath, ...details });
}

export async function auditClassify(gtin, classification, details = {}) {
  const audit = new AuditLogger();
  return audit.log('CLASSIFY', { gtin, classification, ...details });
}

export async function auditImport(source, count, details = {}) {
  const audit = new AuditLogger();
  return audit.log('IMPORT', { source, count, ...details });
}

export async function auditDeliver(gtin, destination, details = {}) {
  const audit = new AuditLogger();
  return audit.log('DELIVER', { gtin, destination, ...details });
}

export async function auditRework(gtin, reason, details = {}) {
  const audit = new AuditLogger();
  return audit.log('REWORK', { gtin, reason, ...details });
}

export async function auditReorder(lote, placa, order, details = {}) {
  const audit = new AuditLogger();
  return audit.log('REORDER', { lote, placa, order, ...details });
}

export async function auditUpdate(source, target, details = {}) {
  const audit = new AuditLogger();
  return audit.log('UPDATE', { source, target, ...details });
}

export const auditLogger = new AuditLogger();

export default { auditLogger, AuditLogger };
