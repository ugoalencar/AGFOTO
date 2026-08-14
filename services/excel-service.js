import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  ExcelItem,
  ExcelConflict,
  ExcelImportResult,
  EXCEL_HEADERS,
  findColumnIndex,
  sanitizeCellValue,
  toCellString
} from '../domain/excel.js';
import { config } from '../server/config.js';
import { auditLogger } from '../server/audit-logger.js';
import LoteRepository from '../repositories/lote-repository.js';
import { assertInsideRoot } from '../server/secure-filesystem.js';
import { Lote } from '../domain/lote.js';

const pendingImports = new Map();

function makeImportId(lote, filePath) {
  return `${lote}:${path.basename(filePath)}:${Date.now()}`;
}

async function resolveLocalWorkbook(filePath) {
  if (typeof filePath !== 'string' || /^https?:\/\//i.test(filePath) || /^file:/i.test(filePath)) {
    throw new Error('Workbook path must be a local path');
  }
  const candidate = path.resolve(filePath);
  assertInsideRoot(candidate, config.paths.xlsx);
  const [realRoot, realFile] = await Promise.all([
    fs.promises.realpath(config.paths.xlsx),
    fs.promises.realpath(candidate)
  ]);
  assertInsideRoot(realFile, realRoot);
  return realFile;
}

/**
 * Serviço de Excel
 * Gerencia importação, unificação e exportação de planilhas
 */
export class ExcelService {
  /**
   * Rebuilds one lote sheet in the local control workbook from the JSON source.
   */
  static async updateControlFromLote(loteNumero) {
    const lote = await LoteRepository.load(loteNumero);
    await fs.promises.mkdir(config.paths.xlsx, { recursive: true });

    const filePath = path.join(config.paths.xlsx, 'controle-lotes.xlsx');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch {
      // A missing or unreadable derivative is rebuilt from the operational JSON.
    }

    const sheetName = `Lote ${loteNumero}`;
    const existingSheet = workbook.getWorksheet(sheetName);
    if (existingSheet) workbook.removeWorksheet(existingSheet.id);

    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([
      'EAN', 'Codigo', 'Descricao', 'Data da foto',
      'Quantidade de fotos', 'Status', 'Ultima entrega', 'Ultimo erro'
    ]);
    for (const item of Object.values(lote.itens)) {
      sheet.addRow([
        item.gtin,
        item.codigo || '',
        item.descricao || '',
        item.dataFotografia || '',
        item.quantidadeFotos,
        item.status,
        item.ultimaEntregaEm || '',
        item.ultimoErro || ''
      ]);
    }

    await workbook.xlsx.writeFile(filePath);
    return { ok: true, data: { filePath } };
  }

  /**
   * Lê arquivo Excel e extrai items
   */
  static async parseExcelFile(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('No worksheets found');
      }

      // Detecta headers (primeira linha)
      const firstRow = worksheet.getRow(1);
      const headers = (firstRow.values || []).slice(1);

      // Encontra colunas
      const eanIdx = findColumnIndex(headers, EXCEL_HEADERS.ean);
      const codigoIdx = findColumnIndex(headers, EXCEL_HEADERS.codigo);
      const descricaoIdx = findColumnIndex(headers, EXCEL_HEADERS.descricao);

      if (eanIdx < 0) {
        throw new Error('EAN/GTIN column not found');
      }

      // Lê linhas de dados
      const items = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const ean = sanitizeCellValue(row.getCell(eanIdx + 1).value);
        if (!ean) return; // Skip empty rows

        const codigo = codigoIdx >= 0 ? sanitizeCellValue(row.getCell(codigoIdx + 1).value) : null;
        const descricao = descricaoIdx >= 0 ? sanitizeCellValue(row.getCell(descricaoIdx + 1).value) : null;

        items.push(new ExcelItem(ean, codigo, descricao));
      });

      return {
        ok: true,
        data: {
          items,
          count: items.length
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: `Cannot parse Excel: ${err.message}`
      };
    }
  }

  /**
   * Importa items e detecta conflitos
   */
  static async parseWorkbook(filePath, lote) {
    const parsed = await this.parseExcelFile(filePath);
    if (!parsed.ok) return parsed;
    if (parsed.data.count > config.validation.maxSheetRows) {
      return { ok: false, error: 'Spreadsheet exceeds row limit' };
    }
    return { ok: true, data: parsed.data.items };
  }

  static async detectLookupConflicts(lote, items) {
    const existing = new Map();
    const lookupPath = path.join(config.paths.xlsx, 'lookup-integrado.xlsx');
    try {
      await fs.promises.access(lookupPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(lookupPath);
      const worksheet = workbook.getWorksheet('Lookup') || workbook.worksheets[0];
      worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowLote = toCellString(row.getCell(1).value);
        const ean = toCellString(row.getCell(2).value);
        if (rowLote === String(lote) && ean) {
          existing.set(ean, { codigo: toCellString(row.getCell(3).value), descricao: toCellString(row.getCell(4).value) });
        }
      });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const conflicts = [];
    const staged = new Map();
    for (const item of items) {
      const current = staged.get(item.ean) || existing.get(item.ean);
      if (current) {
        for (const field of ['codigo', 'descricao']) {
          if (current[field] !== item[field]) {
            conflicts.push(new ExcelConflict(lote, item.ean, field, current[field], item[field], 'lookup'));
          }
        }
      }
      staged.set(item.ean, { codigo: item.codigo, descricao: item.descricao });
    }
    return conflicts;
  }

  static async importWorkbook({ lote, filePath }) {
    try {
      if (!Lote.isValid(lote)) return { ok: false, error: 'Invalid lote' };
      const safePath = await resolveLocalWorkbook(filePath);
      const ext = path.extname(safePath).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) return { ok: false, error: 'Only .xlsx and .xls are accepted' };
      const stats = await fs.promises.stat(safePath);
      if (!stats.isFile()) return { ok: false, error: 'Workbook path must be a file' };
      if (stats.size > config.validation.maxSheetSize) return { ok: false, error: 'Spreadsheet exceeds size limit' };

      const parsed = await this.parseWorkbook(safePath, lote);
      if (!parsed.ok) return parsed;
      const conflicts = await this.detectLookupConflicts(lote, parsed.data);
      const importId = makeImportId(lote, safePath);
      pendingImports.set(importId, { lote: String(lote), filePath: safePath, items: parsed.data, conflicts });
      return { ok: true, data: { importId, preview: parsed.data.slice(0, 20), total: parsed.data.length, conflicts } };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  static async confirmImport(importId) {
    const session = pendingImports.get(importId);
    if (!session) return { ok: false, error: 'Import session not found' };
    if (session.conflicts.length) {
      return { ok: false, error: 'Resolve conflicts before confirming', data: { conflicts: session.conflicts } };
    }
    const result = await this.mergeToLookup(session.lote, session.items);
    if (result.ok) pendingImports.delete(importId);
    return result;
  }

  static async lookupCodigo(lote, ean) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(path.join(config.paths.xlsx, 'lookup-integrado.xlsx'));
      const worksheet = workbook.getWorksheet('Lookup') || workbook.worksheets[0];
      for (const row of worksheet?.getRows(2, Math.max(0, worksheet.rowCount - 1)) || []) {
        if (toCellString(row.getCell(1).value) === String(lote) && toCellString(row.getCell(2).value) === String(ean)) {
          return { ok: true, data: { codigo: toCellString(row.getCell(3).value) || '', descricao: toCellString(row.getCell(4).value) || '' } };
        }
      }
      return { ok: false, error: `Codigo not found for lote ${lote} EAN ${ean}` };
    } catch (error) {
      return { ok: false, error: `Cannot lookup codigo: ${error.message}` };
    }
  }

  static async importItems(lote, items, source = 'upload') {
    try {
      const loteObj = await LoteRepository.load(lote);
      const result = new ExcelImportResult(source, lote);

      // Chave de deduplicação: lote + EAN
      const dedup = new Map();

      for (const item of items) {
        const key = `${lote}-${item.ean}`;

        // Verificar se já existe neste lote
        const existing = loteObj.itens[item.ean];

        if (dedup.has(key)) {
          // Conflito dentro do mesmo arquivo
          const prev = dedup.get(key);
          if (item.codigo !== prev.codigo || item.descricao !== prev.descricao) {
            if (item.codigo !== prev.codigo) {
              result.addConflict(
                new ExcelConflict(lote, item.ean, 'codigo', prev.codigo, item.codigo, source)
              );
            }
            if (item.descricao !== prev.descricao) {
              result.addConflict(
                new ExcelConflict(lote, item.ean, 'descricao', prev.descricao, item.descricao, source)
              );
            }
          }
        } else if (existing) {
          // Conflito com dados existentes no lote
          if (existing.codigo !== item.codigo || existing.descricao !== item.descricao) {
            if (existing.codigo !== item.codigo) {
              result.addConflict(
                new ExcelConflict(lote, item.ean, 'codigo', existing.codigo, item.codigo, source)
              );
            }
            if (existing.descricao !== item.descricao) {
              result.addConflict(
                new ExcelConflict(lote, item.ean, 'descricao', existing.descricao, item.descricao, source)
              );
            }
          }
          result.skipped++;
        } else {
          // Novo item
          dedup.set(key, item);
          result.addItem(item);
          result.imported++;
        }
      }

      await auditLogger.log('EXCEL_IMPORT', {
        lote,
        source,
        imported: result.imported,
        skipped: result.skipped,
        conflicts: result.conflicts.length
      });

      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  /**
   * Merges items no lookup-integrado.xlsx
   */
  static async mergeToLookup(lote, items) {
    try {
      const lookupPath = path.join(config.paths.xlsx, 'lookup-integrado.xlsx');

      let workbook = new ExcelJS.Workbook();
      let worksheet;

      // Carrega ou cria novo
      try {
        await workbook.xlsx.readFile(lookupPath);
        worksheet = workbook.getWorksheet('Lookup') || workbook.worksheets[0];
      } catch {
        workbook = new ExcelJS.Workbook();
        worksheet = workbook.addWorksheet('Lookup');

        // Headers
        worksheet.columns = [
          { header: 'Lote', key: 'lote' },
          { header: 'EAN', key: 'ean' },
          { header: 'Código', key: 'codigo' },
          { header: 'Descrição', key: 'descricao' },
          { header: 'Importado em', key: 'importedAt' }
        ];
      }

      // Mapeia dados existentes
      const existingMap = new Map();
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowLote = toCellString(row.getCell(1).value);
        const ean = toCellString(row.getCell(2).value);
        if (rowLote && ean) {
          existingMap.set(`${rowLote}-${ean}`, rowNumber);
        }
      });

      // Adiciona ou atualiza items
      let inserted = 0;
      let unchanged = 0;
      for (const item of items) {
        const key = `${lote}-${item.ean}`;
        const rowIdx = existingMap.get(key);
        if (rowIdx) {
          unchanged++;
        } else {
          // Novo
          worksheet.addRow({ lote, ean: item.ean, codigo: item.codigo, descricao: item.descricao, importedAt: new Date().toISOString() });
          inserted++;
        }
      }

      // Salva
      await workbook.xlsx.writeFile(lookupPath);

      return {
        ok: true,
        data: {
          path: lookupPath,
          added: inserted,
          inserted,
          unchanged,
          conflicts: [],
          total: worksheet.rowCount - 1
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: `Cannot merge to lookup: ${err.message}`
      };
    }
  }

  /**
   * Gera controle-lotes.xlsx para um lote específico
   */
  static async generateBatchControlSheet(loteNumero) {
    try {
      const lote = await LoteRepository.load(loteNumero);
      const controlPath = path.join(config.paths.xlsx, `controle-lotes-${loteNumero}.xlsx`);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(loteNumero);

      // Headers
      worksheet.columns = [
        { header: 'EAN', key: 'ean', width: 15 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descrição', key: 'descricao', width: 30 },
        { header: 'Data da Foto', key: 'dataFotografia', width: 20 },
        { header: 'Quantidade de Fotos', key: 'quantidadeFotos', width: 15 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Última Entrega', key: 'ultimaEntregaEm', width: 20 },
        { header: 'Último Erro', key: 'ultimoErro', width: 30 }
      ];

      // Estilo header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'center' };

      // Dados
      let rowNum = 2;
      for (const [gtin, produto] of Object.entries(lote.itens)) {
        worksheet.addRow({
          ean: gtin,
          codigo: produto.codigo,
          descricao: produto.descricao,
          dataFotografia: produto.dataFotografia,
          quantidadeFotos: produto.quantidadeFotos,
          status: produto.status,
          ultimaEntregaEm: produto.ultimaEntregaEm,
          ultimoErro: produto.ultimoErro
        });
        rowNum++;
      }

      await workbook.xlsx.writeFile(controlPath);

      return {
        ok: true,
        data: {
          path: controlPath,
          rows: lote.getAllGtins().length
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: `Cannot generate control sheet: ${err.message}`
      };
    }
  }

  /**
   * Reconcilia JSON com Excel
   * Retorna diferenças
   */
  static async reconcile(loteNumero) {
    try {
      const lote = await LoteRepository.load(loteNumero);
      const controlPath = path.join(config.paths.xlsx, `controle-lotes-${lote.numero}.xlsx`);

      const differences = [];

      // Se arquivo não existe, retorna como diferença
      if (!fs.existsSync(controlPath)) {
        return {
          ok: true,
          data: {
            differences: [{ type: 'missing_file', detail: 'Control sheet not generated' }],
            reconciled: false
          }
        };
      }

      // Carrega Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(controlPath);
      const worksheet = workbook.worksheets[0];

      const excelMap = new Map();
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const ean = row.getCell('ean').value;
        if (ean) {
          excelMap.set(String(ean), row);
        }
      });

      // Compara
      for (const [gtin, produto] of Object.entries(lote.itens)) {
        const excelRow = excelMap.get(gtin);

        if (!excelRow) {
          differences.push({
            type: 'json_only',
            gtin,
            detail: 'Item existe em JSON mas não em Excel'
          });
          continue;
        }

        // Valida valores
        if (excelRow.getCell('quantidadeFotos').value !== produto.quantidadeFotos) {
          differences.push({
            type: 'value_mismatch',
            gtin,
            field: 'quantidadeFotos',
            json: produto.quantidadeFotos,
            excel: excelRow.getCell('quantidadeFotos').value
          });
        }

        if (excelRow.getCell('status').value !== produto.status) {
          differences.push({
            type: 'value_mismatch',
            gtin,
            field: 'status',
            json: produto.status,
            excel: excelRow.getCell('status').value
          });
        }
      }

      // Excel-only items
      for (const [ean, row] of excelMap) {
        if (!lote.itens[ean]) {
          differences.push({
            type: 'excel_only',
            ean,
            detail: 'Item existe em Excel mas não em JSON'
          });
        }
      }

      return {
        ok: true,
        data: {
          differences,
          reconciled: differences.length === 0
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: `Cannot reconcile: ${err.message}`
      };
    }
  }
}

export default ExcelService;
