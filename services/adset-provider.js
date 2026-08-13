/**
 * Contrato para integração ADSET
 * Implementações: Mock (dev) e Real (Playwright + scraping)
 */
export class AdsetProvider {
  /**
   * Login na plataforma ADSET
   * @returns {Promise<{ok: boolean, sessionId?: string, error?: string}>}
   */
  async login(email, password) {
    throw new Error('Not implemented');
  }

  /**
   * Busca veículos já publicados
   * @param {string} sessionId
   * @returns {Promise<{ok: boolean, published: Array, error?: string}>}
   */
  async fetchPublished(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Busca veículos não publicados (rascunhos)
   * @param {string} sessionId
   * @returns {Promise<{ok: boolean, unpublished: Array, error?: string}>}
   */
  async fetchUnpublished(sessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Valida unicidade de placa
   * @param {string} sessionId
   * @param {string} placa
   * @returns {Promise<{ok: boolean, unique: boolean, existing?: string, error?: string}>}
   */
  async validatePlateUnique(sessionId, placa) {
    throw new Error('Not implemented');
  }

  /**
   * Submete veículo para publicação (com fotos)
   * @param {string} sessionId
   * @param {Object} vehicle - {placa, fotos: [{path, filename}]}
   * @returns {Promise<{ok: boolean, vehicleId?: string, message?: string, error?: string}>}
   */
  async submitVehicle(sessionId, vehicle) {
    throw new Error('Not implemented');
  }

  /**
   * Logout
   */
  async logout(sessionId) {
    throw new Error('Not implemented');
  }
}

/**
 * Mock ADSET Provider para desenvolvimento
 * Simula respostas sem conectar de verdade
 */
export class MockAdsetProvider extends AdsetProvider {
  constructor() {
    super();
    this.sessions = new Map();
    this.published = new Map();
    this.unpublished = new Map();
  }

  async login(email, password) {
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 200));

    // Valida credenciais fake (qualquer email/senha funciona no mock)
    if (!email || !password) {
      return { ok: false, error: 'Invalid credentials' };
    }

    const sessionId = `MOCK_SESSION_${Date.now()}`;
    this.sessions.set(sessionId, { email, loginTime: new Date() });

    console.log(`🔓 Mock ADSET: Login successful - ${email}`);

    return {
      ok: true,
      sessionId,
      message: 'Mock login successful'
    };
  }

  async fetchPublished(sessionId) {
    await new Promise(resolve => setTimeout(resolve, 150));

    if (!this.sessions.has(sessionId)) {
      return { ok: false, error: 'Invalid session' };
    }

    const published = Array.from(this.published.values());
    console.log(`📋 Mock ADSET: Fetched ${published.length} published vehicles`);

    return {
      ok: true,
      published: published.map(v => ({
        placa: v.placa,
        fotos: v.fotos.length,
        status: 'Publicado',
        publicadoEm: v.publishedAt
      }))
    };
  }

  async fetchUnpublished(sessionId) {
    await new Promise(resolve => setTimeout(resolve, 150));

    if (!this.sessions.has(sessionId)) {
      return { ok: false, error: 'Invalid session' };
    }

    const unpublished = Array.from(this.unpublished.values());
    console.log(`📝 Mock ADSET: Fetched ${unpublished.length} unpublished vehicles`);

    return {
      ok: true,
      unpublished: unpublished.map(v => ({
        placa: v.placa,
        fotos: v.fotos.length,
        status: 'Rascunho',
        criadoEm: v.createdAt
      }))
    };
  }

  async validatePlateUnique(sessionId, placa) {
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!this.sessions.has(sessionId)) {
      return { ok: false, error: 'Invalid session' };
    }

    const normalized = String(placa).toUpperCase().trim();
    const exists = this.published.has(normalized) || this.unpublished.has(normalized);

    console.log(`🔍 Mock ADSET: Plate ${normalized} unique=${!exists}`);

    return {
      ok: true,
      unique: !exists,
      existing: exists ? this.published.get(normalized)?.publishedAt || 'Rascunho' : null
    };
  }

  async submitVehicle(sessionId, vehicle) {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!this.sessions.has(sessionId)) {
      return { ok: false, error: 'Invalid session' };
    }

    const normalized = String(vehicle.placa).toUpperCase().trim();

    // Valida se placa já existe
    if (this.published.has(normalized) || this.unpublished.has(normalized)) {
      return { ok: false, error: `Plate ${normalized} already exists` };
    }

    // Simula que vai para rascunho (unpublished)
    const vehicleId = `MOCK_VEH_${Date.now()}`;
    this.unpublished.set(normalized, {
      id: vehicleId,
      placa: normalized,
      fotos: vehicle.fotos || [],
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Mock ADSET: Vehicle ${normalized} submitted (draft)`);

    return {
      ok: true,
      vehicleId,
      message: `Vehicle ${normalized} submitted as draft`,
      status: 'Rascunho'
    };
  }

  async logout(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      console.log(`🔒 Mock ADSET: Logout successful`);
      return { ok: true };
    }
    return { ok: false, error: 'Invalid session' };
  }
}

/**
 * Real ADSET Provider usando Playwright
 * ⚠️ Requer Playwright e acesso à conta ADSET
 */
export class RealAdsetProvider extends AdsetProvider {
  constructor(options = {}) {
    super();
    this.baseUrl = options.baseUrl || 'https://www.adset.com.br';
    this.browser = null;
    this.page = null;
    this.email = options.email;
    this.password = options.password;
    this.timeout = options.timeout || 30000;
  }

  async login(email, password) {
    try {
      // Dynamic import para não bloquear se Playwright não estiver instalado
      const { chromium } = await import('playwright');

      this.browser = await chromium.launch({ headless: true });
      this.page = await this.browser.newPage();

      console.log(`🌐 Real ADSET: Navigating to ${this.baseUrl}`);
      await this.page.goto(`${this.baseUrl}/Integrador/Home/Principal`, {
        waitUntil: 'networkidle'
      });

      // Tenta encontrar form de login (estrutura pode variar)
      const loginForm = await this.page.$('[name="email"], [name="usuario"]');
      if (!loginForm) {
        return { ok: false, error: 'Login form not found - page structure may have changed' };
      }

      // Preenchimento de credenciais
      await this.page.fill('[name="email"], [name="usuario"]', email);
      await this.page.fill('[name="password"], [name="senha"]', password);

      // Submit
      await this.page.click('[type="submit"]');
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: this.timeout });

      // Valida se login foi bem-sucedido
      const isLoggedIn = await this.page.$('[class*="logout"], [class*="user-menu"]');
      if (!isLoggedIn) {
        return { ok: false, error: 'Login failed - invalid credentials or page structure' };
      }

      const sessionId = `REAL_SESSION_${Date.now()}`;
      console.log(`✅ Real ADSET: Login successful`);

      return {
        ok: true,
        sessionId,
        message: 'Real ADSET login successful'
      };
    } catch (err) {
      return { ok: false, error: `Login error: ${err.message}` };
    }
  }

  async fetchPublished(sessionId) {
    if (!this.page) {
      return { ok: false, error: 'Not logged in' };
    }

    try {
      // Navega para lista de publicados
      await this.page.goto(`${this.baseUrl}/Integrador/Veiculo/ListarPublicados`, {
        waitUntil: 'networkidle'
      });

      // Tenta extrair tabela (estrutura pode variar)
      const vehicles = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        return rows
          .slice(1) // Skip header
          .map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            return {
              placa: cells[0]?.textContent?.trim() || '',
              fotos: parseInt(cells[1]?.textContent || '0'),
              status: 'Publicado',
              publicadoEm: cells[2]?.textContent?.trim() || ''
            };
          })
          .filter(v => v.placa);
      });

      console.log(`📋 Real ADSET: Fetched ${vehicles.length} published vehicles`);

      return {
        ok: true,
        published: vehicles
      };
    } catch (err) {
      return { ok: false, error: `Fetch error: ${err.message}` };
    }
  }

  async fetchUnpublished(sessionId) {
    if (!this.page) {
      return { ok: false, error: 'Not logged in' };
    }

    try {
      await this.page.goto(`${this.baseUrl}/Integrador/Veiculo/ListarRascunhos`, {
        waitUntil: 'networkidle'
      });

      const vehicles = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        return rows
          .slice(1)
          .map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            return {
              placa: cells[0]?.textContent?.trim() || '',
              fotos: parseInt(cells[1]?.textContent || '0'),
              status: 'Rascunho',
              criadoEm: cells[2]?.textContent?.trim() || ''
            };
          })
          .filter(v => v.placa);
      });

      console.log(`📝 Real ADSET: Fetched ${vehicles.length} unpublished vehicles`);

      return {
        ok: true,
        unpublished: vehicles
      };
    } catch (err) {
      return { ok: false, error: `Fetch error: ${err.message}` };
    }
  }

  async validatePlateUnique(sessionId, placa) {
    try {
      const published = await this.fetchPublished(sessionId);
      const unpublished = await this.fetchUnpublished(sessionId);

      if (!published.ok || !unpublished.ok) {
        return { ok: false, error: 'Failed to fetch vehicle lists' };
      }

      const normalized = String(placa).toUpperCase().trim();
      const allVehicles = [...(published.published || []), ...(unpublished.unpublished || [])];
      const existing = allVehicles.find(v => v.placa === normalized);

      return {
        ok: true,
        unique: !existing,
        existing: existing ? existing.status : null
      };
    } catch (err) {
      return { ok: false, error: `Validation error: ${err.message}` };
    }
  }

  async submitVehicle(sessionId, vehicle) {
    if (!this.page) {
      return { ok: false, error: 'Not logged in' };
    }

    try {
      // Navega para novo veículo
      await this.page.goto(`${this.baseUrl}/Integrador/Veiculo/Novo`, {
        waitUntil: 'networkidle'
      });

      // Preenche placa
      await this.page.fill('[name="placa"]', vehicle.placa);

      // Upload de fotos (simplificado - estrutura pode variar)
      for (const foto of (vehicle.fotos || []).slice(0, 10)) {
        try {
          const fileInput = await this.page.$('[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(foto.path);
            await this.page.waitForTimeout(500); // Pequeno delay entre uploads
          }
        } catch (err) {
          console.warn(`Failed to upload ${foto.filename}: ${err.message}`);
        }
      }

      // Salva como rascunho
      await this.page.click('button[name="salvar"], [title="Salvar"]');
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: this.timeout });

      const vehicleId = `REAL_VEH_${Date.now()}`;
      console.log(`✅ Real ADSET: Vehicle ${vehicle.placa} submitted`);

      return {
        ok: true,
        vehicleId,
        message: `Vehicle ${vehicle.placa} submitted successfully`,
        status: 'Rascunho'
      };
    } catch (err) {
      return { ok: false, error: `Submit error: ${err.message}` };
    }
  }

  async logout(sessionId) {
    try {
      if (this.page) {
        await this.page.click('[class*="logout"], [href*="logout"]');
        await this.page.waitForNavigation({ timeout: 5000 }).catch(() => {});
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.page = null;
      this.browser = null;
      console.log(`🔒 Real ADSET: Logout successful`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Logout error: ${err.message}` };
    }
  }
}

export default {
  AdsetProvider,
  MockAdsetProvider,
  RealAdsetProvider
};
