/**
 * API Client para comunicação com backend
 */
export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Faz requisição HTTP
   */
  async request(endpoint, options = {}) {
    const { method = 'GET', data = null, query = null } = options;

    let url = `${this.baseUrl}${endpoint}`;

    // Adiciona query string
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      return json;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  /**
   * GET /api/captura/temp
   */
  async getTempImages() {
    return this.request('/api/captura/temp');
  }

  /**
   * POST /api/captura/salvar
   */
  async saveCaptureCapture(lote, gtin, codigo = null, descricao = null) {
    const operationId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return this.request('/api/captura/salvar', {
      method: 'POST',
      data: { lote, gtin, codigo, descricao, operationId }
    });
  }

  /**
   * DELETE /api/captura/temp
   */
  async clearTemp(filenames) {
    return this.request('/api/captura/temp', {
      method: 'DELETE',
      data: { filenames }
    });
  }

  /**
   * GET /api/lotes
   */
  async listLotes() {
    return this.request('/api/lotes');
  }

  /**
   * GET /api/lotes/:numero
   */
  async getLote(numero) {
    return this.request(`/api/lotes/${encodeURIComponent(numero)}`);
  }

  /**
   * GET /api/imagens/anterior
   */
  async getPreviousImages(lote, gtin, subfolder = null) {
    const query = { lote, gtin };
    if (subfolder) query.subfolder = subfolder;
    return this.request('/api/imagens/anterior', { query });
  }

  /**
   * GET /api/health
   */
  async health() {
    return this.request('/api/health');
  }

  /**
   * GET /api/version
   */
  async getVersion() {
    return this.request('/api/version');
  }
}

/**
 * Factory function
 */
export function createApiClient(baseUrl) {
  return new ApiClient(baseUrl);
}

export default ApiClient;
