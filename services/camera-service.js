import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { config as defaultConfig } from '../server/config.js';

const execFileAsync = promisify(execFile);

// Nome da camera no Windows. A EOS aparece como dispositivo WPD (Windows
// Portable Devices) quando ligada por USB.
const PADRAO_CAMERA_USB = 'EOS';

export class CameraService {
  constructor({ config = defaultConfig, processList = null, starter = null, deviceList = null } = {}) {
    this.config = config;
    this.processList = processList || this.defaultProcessList;
    this.starter = starter || this.defaultStarter;
    this.deviceList = deviceList || this.defaultDeviceList;
  }

  async defaultProcessList() {
    const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq simplusCamera*']);
    return stdout;
  }

  /**
   * Quantas cameras estao FISICAMENTE ligadas agora.
   *
   * O @(...) forca contexto de array: no Windows PowerShell 5.1, quando o
   * Where-Object devolve exatamente um resultado, ele vem como objeto solto e o
   * ".Count" some - nao da erro, so volta vazio, e o numero vira NaN. Ou seja,
   * uma camera ligada seria lida como nenhuma.
   */
  async defaultDeviceList() {
    const comando = '(@(Get-PnpDevice | Where-Object { $_.Class -eq \'WPD\' '
      + `-and $_.FriendlyName -match '${PADRAO_CAMERA_USB}' -and $_.Present -eq $true })).Count`;

    const { stdout } = await execFileAsync(
      'powershell', ['-NoProfile', '-Command', comando], { timeout: 8000 }
    );
    return parseInt((stdout || '').trim(), 10) || 0;
  }

  async defaultStarter(executablePath) {
    const child = spawn(executablePath, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return child.pid;
  }

  /**
   * Estado da camera.
   *
   * Nao basta ver se o simplusCamera.exe esta de pe: ele NAO morre quando a
   * camera e desligada ou tem o cabo puxado. Olhando so o processo, a tela
   * ficaria dizendo "conectada" para sempre depois da primeira conexao, e o
   * fotografo so descobriria o problema quando a foto nao chegasse. Por isso o
   * dispositivo USB e conferido junto.
   */
  async getStatus() {
    const executablePath = this.config.camera.executable;
    const executableExists = fs.existsSync(executablePath);

    const output = await this.processList().catch(() => '');
    const running = /simplusCamera/i.test(output);

    const dispositivos = await this.deviceList().catch(() => 0);
    const devicePresent = dispositivos > 0;

    return {
      connected: running && devicePresent,
      running,
      devicePresent,
      executableExists,
      executablePath,
      message: this.descrever({ running, devicePresent, executableExists })
    };
  }

  descrever({ running, devicePresent, executableExists }) {
    if (running && devicePresent) return 'Camera conectada';
    if (running && !devicePresent) return 'Camera desligada ou cabo solto';
    if (!running && devicePresent) return 'Camera ligada, mas o simplusCamera nao esta rodando';
    if (!executableExists) return 'simplusCamera.exe nao encontrado';
    return 'Camera desconectada';
  }

  async open() {
    const status = await this.getStatus();
    if (!status.executableExists) return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe not found' };
    if (status.running) return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe already running' };
    const pid = await this.starter(status.executablePath);
    return { started: true, pid, executablePath: status.executablePath, message: 'simplusCamera.exe started' };
  }
}
