import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createTestEnv } from '../helpers/test-env.js';
import { CameraService } from '../../services/camera-service.js';

test('camera status reports missing executable without blocking', async t => {
  const env = await createTestEnv(t);
  const service = new CameraService({
    config: env.config, processList: async () => '', deviceList: async () => 0
  });

  const status = await service.getStatus();

  assert.equal(status.running, false);
  assert.equal(status.executableExists, false);
  assert.match(status.message, /nao encontrado/i);
});

test('camera status detects executable and running process', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config,
    processList: async () => 'simplusCamera.exe 1234 Console',
    deviceList: async () => 1
  });

  const status = await service.getStatus();

  assert.equal(status.running, true);
  assert.equal(status.executableExists, true);
  assert.equal(status.connected, true);
});

// O simplusCamera.exe nao morre quando a camera e desligada ou o cabo sai. Sem
// cruzar com o dispositivo USB, a tela diria "conectada" para sempre e o
// fotografo so descobriria o problema quando a foto nao chegasse.
test('camera com processo de pe mas sem dispositivo nao conta como conectada', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config,
    processList: async () => 'simplusCamera.exe 1234 Console',
    deviceList: async () => 0
  });

  const status = await service.getStatus();

  assert.equal(status.running, true);
  assert.equal(status.devicePresent, false);
  assert.equal(status.connected, false);
  assert.match(status.message, /desligada|cabo/i);
});

test('camera ligada sem o simplusCamera rodando avisa qual e o problema', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config, processList: async () => '', deviceList: async () => 1
  });

  const status = await service.getStatus();

  assert.equal(status.connected, false);
  assert.match(status.message, /simplusCamera nao esta rodando/i);
});

// Se a checagem do dispositivo falhar (PowerShell bloqueado, maquina nao
// Windows), o status vira desconectado em vez de derrubar a tela de captura.
test('falha ao consultar o dispositivo nao quebra o status', async t => {
  const env = await createTestEnv(t);
  const service = new CameraService({
    config: env.config,
    processList: async () => 'simplusCamera.exe',
    deviceList: async () => { throw new Error('powershell indisponivel'); }
  });

  const status = await service.getStatus();

  assert.equal(status.connected, false);
  assert.equal(status.devicePresent, false);
});

test('camera open starts an available stopped executable without waiting for it', async t => {
  const env = await createTestEnv(t);
  await fs.promises.mkdir(path.dirname(env.config.camera.executable), { recursive: true });
  await fs.promises.writeFile(env.config.camera.executable, 'fake exe');
  const service = new CameraService({
    config: env.config,
    processList: async () => '',
    deviceList: async () => 0,
    starter: async executablePath => {
      assert.equal(executablePath, env.config.camera.executable);
      return 1234;
    }
  });

  const result = await service.open();

  assert.deepEqual(result, {
    started: true,
    pid: 1234,
    executablePath: env.config.camera.executable,
    message: 'simplusCamera.exe started'
  });
});
