import fs from 'fs';
import os from 'os';
import path from 'path';

export async function createTestEnv(t, options = {}) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'agfoto-test-'));
  const paths = {
    root,
    imagesTemp: path.join(root, 'images', 'temp'),
    captura: path.join(root, 'Captura'),
    finalizadas: path.join(root, 'Finalizadas'),
    entrega: path.join(root, 'Entrega'),
    carros: path.join(root, 'Carros'),
    dados: path.join(root, 'dados'),
    jsons: path.join(root, 'dados', 'jsons'),
    xlsx: path.join(root, 'dados', 'xlsx'),
    envios: path.join(root, 'dados', 'envios'),
    auditoria: path.join(root, 'dados', 'auditoria'),
    backups: path.join(root, 'dados', 'backups'),
    logs: path.join(root, 'logs'),
    cameraExe: path.join(root, 'simplusCameraLib', 'simplusCamera.exe')
  };

  await Promise.all(
    Object.values(paths)
      .filter(value => path.extname(value) === '')
      .map(value => fs.promises.mkdir(value, { recursive: true }))
  );

  const config = {
    server: { host: '127.0.0.1', port: 0, lanEnabled: false },
    paths,
    camera: { executable: paths.cameraExe },
    ftp: { remoteRoot: path.join(root, 'remote-ftp') },
    timezone: 'America/Sao_Paulo',
    validation: {
      maxFilesPerOperation: 10000,
      maxSheetSize: 50 * 1024 * 1024,
      maxSheetRows: 100000
    },
    ...options.config
  };

  const cleanup = () => fs.promises.rm(root, { recursive: true, force: true });
  t.after(cleanup);

  return { root, config, paths, cleanup };
}
