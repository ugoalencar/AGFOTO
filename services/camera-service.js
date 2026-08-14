import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { config as defaultConfig } from '../server/config.js';

const execFileAsync = promisify(execFile);

export class CameraService {
  constructor({ config = defaultConfig, processList = null, starter = null } = {}) {
    this.config = config;
    this.processList = processList || this.defaultProcessList;
    this.starter = starter || this.defaultStarter;
  }

  async defaultProcessList() {
    const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq simplusCamera*']);
    return stdout;
  }

  async defaultStarter(executablePath) {
    const child = spawn(executablePath, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return child.pid;
  }

  async getStatus() {
    const executablePath = this.config.camera.executable;
    const executableExists = fs.existsSync(executablePath);
    const output = await this.processList().catch(() => '');
    const running = /simplusCamera/i.test(output);
    return {
      running,
      executableExists,
      executablePath,
      message: running ? 'simplusCamera.exe is running' : executableExists ? 'Camera executable available' : 'simplusCamera.exe not found'
    };
  }

  async open() {
    const status = await this.getStatus();
    if (!status.executableExists) return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe not found' };
    if (status.running) return { started: false, executablePath: status.executablePath, message: 'simplusCamera.exe already running' };
    const pid = await this.starter(status.executablePath);
    return { started: true, pid, executablePath: status.executablePath, message: 'simplusCamera.exe started' };
  }
}
