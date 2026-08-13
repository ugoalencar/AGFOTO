import LoteRepository from '../repositories/lote-repository.js';
import { ProductStatus } from '../domain/status.js';

/**
 * Serviço de Relatórios
 * Gera reports com filtros, estatísticas e exportação
 */
export class ReportService {
  /**
   * Gera relatório de produtos com filtros
   */
  static async generateProductReport(filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        lote = null,
        status = null,
        gtin = null,
        codigo = null,
        descricao = null,
        deliveryType = null
      } = filters;

      const lotes = await LoteRepository.listAll();
      const items = [];

      for (const loteObj of lotes) {
        // Filtra por lote
        if (lote && loteObj.numero !== lote) continue;

        for (const [ean, produto] of Object.entries(loteObj.itens)) {
          // Filtra por GTIN/EAN
          if (gtin && ean !== gtin) continue;

          // Filtra por código
          if (codigo && produto.codigo !== codigo) continue;

          // Filtra por descrição (contains)
          if (descricao && !produto.descricao?.includes(descricao)) continue;

          // Filtra por status
          if (status && produto.status !== status) continue;

          // Filtra por data
          if (startDate && produto.dataFotografia < startDate) continue;
          if (endDate && produto.dataFotografia > endDate) continue;

          items.push({
            lote: loteObj.numero,
            gtin: ean,
            codigo: produto.codigo,
            descricao: produto.descricao,
            status: produto.status,
            dataFotografia: produto.dataFotografia,
            quantidadeFotos: produto.quantidadeFotos,
            ultimaEntrega: produto.ultimaEntregaEm,
            ultimoErro: produto.ultimoErro
          });
        }
      }

      // Calcula estatísticas
      const stats = {
        totalLotes: new Set(items.map(i => i.lote)).size,
        totalItens: items.length,
        fotografados: items.filter(i => i.quantidadeFotos > 0).length,
        pendentes: items.filter(i => i.status === ProductStatus.PENDENTE_QA).length,
        prontos: items.filter(i => i.status === ProductStatus.PRONTO_PARA_ENTREGA).length,
        entregues: items.filter(i => i.status === ProductStatus.ENTREGUE).length,
        retrabalho: items.filter(i => i.status === ProductStatus.RETRABALHO).length,
        erros: items.filter(i => i.status === ProductStatus.ERRO_ENTREGA).length,
        totalFotos: items.reduce((sum, i) => sum + i.quantidadeFotos, 0)
      };

      return {
        ok: true,
        data: {
          items,
          stats,
          count: items.length
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Gera relatório de lotes
   */
  static async generateBatchReport() {
    try {
      const lotes = await LoteRepository.listAll();

      const batchReports = lotes.map(lote => {
        const items = Object.values(lote.itens);

        return {
          lote: lote.numero,
          criadoEm: lote.criadoEm,
          atualizadoEm: lote.atualizadoEm,
          totalItens: items.length,
          totalFotos: lote.getTotalPhotos(),
          emCaptura: lote.countByStatus(ProductStatus.EM_CAPTURA),
          pendenteQa: lote.countByStatus(ProductStatus.PENDENTE_QA),
          prontoEntrega: lote.countByStatus(ProductStatus.PRONTO_PARA_ENTREGA),
          entregando: lote.countByStatus(ProductStatus.ENTREGANDO),
          entregue: lote.countByStatus(ProductStatus.ENTREGUE),
          erroEntrega: lote.countByStatus(ProductStatus.ERRO_ENTREGA),
          retrabalho: lote.countByStatus(ProductStatus.RETRABALHO)
        };
      });

      const totalStats = {
        totalBatches: batchReports.length,
        totalItems: batchReports.reduce((sum, b) => sum + b.totalItens, 0),
        totalPhotos: batchReports.reduce((sum, b) => sum + b.totalFotos, 0),
        totalDelivered: batchReports.reduce((sum, b) => sum + b.entregue, 0)
      };

      return {
        ok: true,
        data: {
          batches: batchReports,
          stats: totalStats
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Gera resumo por status
   */
  static async generateStatusSummary() {
    try {
      const lotes = await LoteRepository.listAll();
      const summary = {};

      for (const status of Object.values(ProductStatus)) {
        summary[status] = 0;
      }

      for (const lote of lotes) {
        for (const produto of Object.values(lote.itens)) {
          summary[produto.status] = (summary[produto.status] || 0) + 1;
        }
      }

      return {
        ok: true,
        data: summary
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Gera dados para exportação XLSX
   */
  static async generateExportData(filters = {}) {
    try {
      const reportResult = await this.generateProductReport(filters);
      if (!reportResult.ok) {
        throw new Error(reportResult.error);
      }

      // Converte para formato exportável
      const data = reportResult.data.items.map(item => ({
        'Lote': item.lote,
        'GTIN/EAN': item.gtin,
        'Código': item.codigo,
        'Descrição': item.descricao,
        'Status': item.status,
        'Data Foto': item.dataFotografia,
        'Qtd Fotos': item.quantidadeFotos,
        'Última Entrega': item.ultimaEntrega,
        'Último Erro': item.ultimoErro
      }));

      return {
        ok: true,
        data: {
          rows: data,
          stats: reportResult.data.stats,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Gera dados para exportação CSV
   */
  static async generateCsvData(filters = {}) {
    try {
      const exportResult = await this.generateExportData(filters);
      if (!exportResult.ok) {
        throw new Error(exportResult.error);
      }

      const rows = exportResult.data.rows;

      // Headers
      const headers = Object.keys(rows[0] || {});
      const lines = [headers.join(',')];

      // Rows (com escape de quotes)
      for (const row of rows) {
        const values = headers.map(h => {
          const val = row[h] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        lines.push(values.join(','));
      }

      const csv = lines.join('\n');

      return {
        ok: true,
        data: {
          csv,
          filename: `report_${new Date().toISOString().split('T')[0]}.csv`
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Valida e retorna insights sobre divergências
   */
  static async validateConsistency(lote) {
    try {
      const loteObj = await LoteRepository.load(lote);
      const issues = [];

      // Verificar se produto tem JSON mas sem pastas físicas
      for (const [gtin, produto] of Object.entries(loteObj.itens)) {
        // TODO: Validar pasta Finalizadas existe
        // TODO: Validar contagem de fotos

        if (produto.quantidadeFotos === 0 && produto.status === ProductStatus.PENDENTE_QA) {
          issues.push({
            type: 'zero_photos',
            gtin,
            message: `Product ${gtin} marked with photos but none found`
          });
        }
      }

      return {
        ok: true,
        data: {
          lote,
          issues,
          consistent: issues.length === 0
        }
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default ReportService;
