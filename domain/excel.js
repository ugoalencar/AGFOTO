/**
 * Entidade para representar um conflito de importação Excel
 */
export class ExcelConflict {
  constructor(lote, ean, field, existingValue, newValue, source) {
    this.id = `${lote}-${ean}-${field}`;
    this.lote = lote;
    this.ean = ean;
    this.field = field; // 'codigo' ou 'descricao'
    this.existingValue = existingValue;
    this.newValue = newValue;
    this.source = source; // nome do arquivo
    this.resolved = false;
    this.resolution = null; // 'keep' | 'use_new' | 'merge'
    this.createdAt = new Date().toISOString();
  }

  resolve(action) {
    if (!['keep', 'use_new', 'merge'].includes(action)) {
      throw new Error(`Invalid resolution action: ${action}`);
    }
    this.resolved = true;
    this.resolution = action;
  }

  toJSON() {
    return {
      id: this.id,
      lote: this.lote,
      ean: this.ean,
      field: this.field,
      existingValue: this.existingValue,
      newValue: this.newValue,
      source: this.source,
      resolved: this.resolved,
      resolution: this.resolution,
      createdAt: this.createdAt
    };
  }

  static fromJSON(data) {
    const conflict = new ExcelConflict(
      data.lote,
      data.ean,
      data.field,
      data.existingValue,
      data.newValue,
      data.source
    );
    conflict.resolved = data.resolved;
    conflict.resolution = data.resolution;
    conflict.createdAt = data.createdAt;
    return conflict;
  }
}

/**
 * Entidade para representar um item de importação Excel
 */
export class ExcelItem {
  constructor(ean, codigo = null, descricao = null) {
    this.ean = String(ean).trim();
    this.codigo = codigo ? String(codigo).trim() : null;
    this.descricao = descricao ? String(descricao).trim() : null;
  }

  isValid() {
    // EAN/GTIN já validado em Produto, aqui apenas verificamos que existe
    return this.ean && this.ean.length > 0;
  }

  toJSON() {
    return {
      ean: this.ean,
      codigo: this.codigo,
      descricao: this.descricao
    };
  }

  static fromJSON(data) {
    return new ExcelItem(data.ean, data.codigo, data.descricao);
  }
}

/**
 * Entidade para representar um resultado de importação
 */
export class ExcelImportResult {
  constructor(filename, lote) {
    this.filename = filename;
    this.lote = lote;
    this.items = [];
    this.conflicts = [];
    this.imported = 0;
    this.skipped = 0;
    this.errors = [];
    this.createdAt = new Date().toISOString();
  }

  addItem(item) {
    if (item.isValid()) {
      this.items.push(item);
    }
  }

  addConflict(conflict) {
    this.conflicts.push(conflict);
  }

  addError(message) {
    this.errors.push(message);
  }

  toJSON() {
    return {
      filename: this.filename,
      lote: this.lote,
      items: this.items.map(i => i.toJSON()),
      conflicts: this.conflicts.map(c => c.toJSON()),
      imported: this.imported,
      skipped: this.skipped,
      errors: this.errors,
      createdAt: this.createdAt
    };
  }

  static fromJSON(data) {
    const result = new ExcelImportResult(data.filename, data.lote);
    result.items = data.items.map(i => ExcelItem.fromJSON(i));
    result.conflicts = data.conflicts.map(c => ExcelConflict.fromJSON(c));
    result.imported = data.imported;
    result.skipped = data.skipped;
    result.errors = data.errors;
    result.createdAt = data.createdAt;
    return result;
  }
}

/**
 * Headers possíveis para EAN/GTIN
 */
export const EXCEL_HEADERS = {
  ean: ['EAN', 'GTIN', 'EAN/GTIN', 'CÓDIGO_EAN'],
  codigo: ['CÓDIGO', 'CODIGO', 'SKU', 'CÓDIGO_INTERNO', 'CODIGO_INTERNO'],
  descricao: ['DESCRIÇÃO', 'DESCRICAO', 'NOME', 'DESCRIÇÃO_SAP', 'DESCRICAO_SAP', 'PRODUTO']
};

/**
 * Normaliza headers para match case-insensitive
 */
export function normalizeHeader(header) {
  if (!header) return null;
  return String(header).trim().toUpperCase();
}

/**
 * Encontra coluna no Excel baseado em headers possíveis
 */
export function findColumnIndex(headers, possibleHeaders) {
  const normalized = headers.map(normalizeHeader);
  const normalizedPossible = possibleHeaders.map(normalizeHeader);

  for (let i = 0; i < normalized.length; i++) {
    if (normalizedPossible.includes(normalized[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Sanitiza valor de célula para prevenir formula injection
 */
export function sanitizeCellValue(value) {
  if (!value) return null;

  const str = String(value).trim();

  // Bloqueia fórmulas que começam com =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    console.warn(`Formula injection attempt blocked: ${str.substring(0, 20)}`);
    return `'${str}`;
  }

  return str;
}

export function toCellString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value.richText) {
    return sanitizeCellValue(value.richText.map(part => part.text).join(''));
  }
  if (typeof value === 'object' && value.text !== undefined) {
    return sanitizeCellValue(value.text);
  }
  return sanitizeCellValue(value);
}

export default {
  ExcelConflict,
  ExcelItem,
  ExcelImportResult,
  EXCEL_HEADERS,
  normalizeHeader,
  findColumnIndex,
  sanitizeCellValue,
  toCellString
};
