import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Configuração da aplicação
 * Valores padrão com fallback para environment variables
 */
export const config = {
  // Servidor
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '127.0.0.1',
    lanEnabled: process.env.LAN_ENABLED === 'true'
  },

  // Caminhos locais
  paths: {
    root: ROOT,
    imagesTemp: path.join(ROOT, 'images', 'temp'),
    captura: path.join(ROOT, 'Captura'),
    finalizadas: path.join(ROOT, 'Finalizadas'),
    entrega: path.join(ROOT, 'Entrega'),
    carros: path.join(ROOT, 'Carros'),
    dados: path.join(ROOT, 'dados'),
    jsons: path.join(ROOT, 'dados', 'jsons'),
    xlsx: path.join(ROOT, 'dados', 'xlsx'),
    envios: path.join(ROOT, 'dados', 'envios'),
    auditoria: path.join(ROOT, 'dados', 'auditoria'),
    backups: path.join(ROOT, 'dados', 'backups'),
    logs: path.join(ROOT, 'logs')
  },

  // Padrões de validação
  validation: {
    // GTIN/EAN pode ser 8, 12, 13 ou 14 dígitos
    gtinLengths: [8, 12, 13, 14],
    // Máximo de arquivos em uma operação
    maxFilesPerOperation: 10000,
    // Máximo de tamanho de planilha (50MB)
    maxSheetSize: 50 * 1024 * 1024,
    // Máximo de linhas em planilha
    maxSheetRows: 100000
  },

  // FTP (valores padrão, carregados de arquivo de config)
  ftp: {
    host: process.env.FTP_HOST,
    port: parseInt(process.env.FTP_PORT || '21', 10),
    username: process.env.FTP_USER,
    password: process.env.FTP_PASS,
    secure: process.env.FTP_SECURE === 'true'
  },

  // ADSET (valores padrão)
  adset: {
    enabled: process.env.ADSET_ENABLED === 'true',
    username: process.env.ADSET_USER,
    password: process.env.ADSET_PASS,
    dryRun: process.env.ADSET_DRY_RUN === 'true'
  },

  // Camera
  camera: {
    executable: process.env.CAMERA_EXE || 'simplusCamera.exe'
  },

  // Timezone
  timezone: 'America/Sao_Paulo'
};

export function applyConfigOverrides(overrides = {}) {
  if (overrides.server) Object.assign(config.server, overrides.server);
  if (overrides.paths) Object.assign(config.paths, overrides.paths);
  if (overrides.camera) Object.assign(config.camera, overrides.camera);
  if (overrides.ftp) Object.assign(config.ftp, overrides.ftp);
  if (overrides.validation) Object.assign(config.validation, overrides.validation);
  if (overrides.timezone) config.timezone = overrides.timezone;
  return config;
}

/**
 * Carrega configuração local de arquivo (se existir)
 */
export async function loadLocalConfig() {
  const configPath = path.join(ROOT, 'caminhos-locais.json');

  try {
    const content = await fs.promises.readFile(configPath, 'utf8');
    const localConfig = JSON.parse(content);

    // Merge com configuração padrão
    if (localConfig.paths) {
      Object.assign(config.paths, localConfig.paths);
    }
    if (localConfig.server) {
      Object.assign(config.server, localConfig.server);
    }

    console.log(`Local config loaded: ${configPath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning loading local config: ${err.message}`);
    }
  }
}

/**
 * Carrega configuração de FTP (se existir)
 */
export async function loadFtpConfig() {
  const configPath = path.join(ROOT, 'ftp-config.json');

  try {
    const content = await fs.promises.readFile(configPath, 'utf8');
    const ftpConfig = JSON.parse(content);

    Object.assign(config.ftp, ftpConfig);
    console.log(`FTP config loaded: ${configPath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning loading FTP config: ${err.message}`);
    }
  }
}

/**
 * Carrega configuração de ADSET (se existir)
 */
export async function loadAdsetConfig() {
  const configPath = path.join(ROOT, 'adset-config.json');

  try {
    const content = await fs.promises.readFile(configPath, 'utf8');
    const adsetConfig = JSON.parse(content);

    Object.assign(config.adset, adsetConfig);
    console.log(`ADSET config loaded: ${configPath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning loading ADSET config: ${err.message}`);
    }
  }
}

/**
 * Inicializa todas as configurações
 */
export async function initConfig() {
  await loadLocalConfig();
  await loadFtpConfig();
  await loadAdsetConfig();

  // Cria diretórios base se não existirem
  for (const [key, dirPath] of Object.entries(config.paths)) {
    if (key !== 'root' && typeof dirPath === 'string') {
      try {
        await fs.promises.mkdir(dirPath, { recursive: true });
      } catch (err) {
        console.warn(`Cannot create directory ${key}: ${err.message}`);
      }
    }
  }
}

/**
 * Cria arquivos de exemplo de configuração
 */
export async function createExampleConfigs() {
  const examples = {
    'caminhos-locais.json.example': {
      paths: {
        imagesTemp: 'D:/Cameras/temp',
        finalizadas: 'D:/Fotos/Finalizadas'
      },
      server: {
        port: 3000,
        host: '127.0.0.1'
      }
    },
    'ftp-config.json.example': {
      host: 'ftp.example.com',
      port: 21,
      username: 'user@example.com',
      password: 'CHANGE_ME',
      secure: true,
      remoteRoot: '/fotos'
    },
    'adset-config.json.example': {
      enabled: false,
      username: 'adset_user',
      password: 'CHANGE_ME',
      dryRun: true
    }
  };

  for (const [filename, content] of Object.entries(examples)) {
    const filePath = path.join(ROOT, filename);

    try {
      await fs.promises.access(filePath);
    } catch {
      try {
        await fs.promises.writeFile(
          filePath,
          JSON.stringify(content, null, 2),
          'utf8'
        );
        console.log(`Created example config: ${filename}`);
      } catch (err) {
        console.warn(`Cannot create example config: ${err.message}`);
      }
    }
  }
}

export default config;
