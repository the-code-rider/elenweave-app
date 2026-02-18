import { app, BrowserWindow, Menu, dialog, shell, clipboard, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const MAX_PORT = 8899;
const START_TIMEOUT_MS = 20_000;
const CHECK_INTERVAL_MS = 250;

app.setName('Elenweave');

let mainWindow = null;
let serverProcess = null;
let serverHost = DEFAULT_HOST;
let serverPort = DEFAULT_PORT;
let desktopConfig = null;
let isShuttingDown = false;

const configFilePath = () => path.join(app.getPath('userData'), 'config.json');
const logFilePath = () => path.join(app.getPath('userData'), 'logs', 'server.log');
const resourceRoot = () => (app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..'));
const cliScriptPath = () => path.join(resourceRoot(), 'server', 'cli.js');

function resolveDefaultDataDir() {
  return path.join(os.homedir(), '.elenweave');
}

function sanitizePort(value, fallback = DEFAULT_PORT) {
  const port = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) return fallback;
  return port;
}

function sanitizePath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return path.resolve(raw);
}

function sanitizeMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'client' ? 'client' : 'server';
}

function sanitizeConfig(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const envOverrides = safe.envOverrides && typeof safe.envOverrides === 'object'
    ? Object.fromEntries(
      Object.entries(safe.envOverrides)
        .filter(([key]) => String(key || '').trim().length > 0)
        .map(([key, value]) => [String(key).trim(), String(value ?? '')])
    )
    : {};
  return {
    host: DEFAULT_HOST,
    port: sanitizePort(safe.port, DEFAULT_PORT),
    maxPort: sanitizePort(safe.maxPort, MAX_PORT),
    mode: sanitizeMode(safe.mode),
    dataDir: sanitizePath(safe.dataDir) || resolveDefaultDataDir(),
    configPath: sanitizePath(safe.configPath),
    aiConfigPath: sanitizePath(safe.aiConfigPath),
    envOverrides
  };
}

async function ensureFileExists(filePath, fallbackData = '') {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fallbackData, 'utf8');
  }
}

async function loadDesktopConfig() {
  const file = configFilePath();
  const defaults = sanitizeConfig({});
  await ensureFileExists(file, `${JSON.stringify(defaults, null, 2)}\n`);
  let parsed = {};
  try {
    const raw = await fs.readFile(file, 'utf8');
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    parsed = {};
  }
  const next = sanitizeConfig(parsed);
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function publicDesktopConfig(config = null) {
  const safe = sanitizeConfig(config || desktopConfig || {});
  return {
    host: safe.host,
    port: safe.port,
    maxPort: safe.maxPort,
    mode: safe.mode,
    dataDir: safe.dataDir,
    configPath: safe.configPath,
    aiConfigPath: safe.aiConfigPath
  };
}

async function writeDesktopConfig(nextRaw) {
  const next = sanitizeConfig(nextRaw);
  await fs.mkdir(path.dirname(configFilePath()), { recursive: true });
  await fs.writeFile(configFilePath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  desktopConfig = next;
  return next;
}

async function updateDesktopConfig(patch = {}) {
  const current = sanitizeConfig(desktopConfig || {});
  const merged = {
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {})
  };
  return writeDesktopConfig(merged);
}

async function appendServerLog(line) {
  const file = logFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

async function canListenOn(host, port) {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, host);
  });
}

async function pickAvailablePort(host, start, max) {
  const min = Math.max(1, sanitizePort(start, DEFAULT_PORT));
  const upper = Math.max(min, sanitizePort(max, MAX_PORT));
  for (let port = min; port <= upper; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await canListenOn(host, port)) return port;
  }
  throw new Error(`No free port available in range ${min}-${upper}.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServerReady(host, port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${host}:${port}/api/projects`, (res) => {
      const status = Number(res.statusCode || 0);
      res.resume();
      if (status >= 200 && status < 500) {
        resolve(status);
        return;
      }
      reject(new Error(`Unexpected status ${status}`));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Health check timeout')));
  });
}

async function waitForServer(host, port, timeoutMs = START_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await checkServerReady(host, port);
      return;
    } catch (err) {
      lastErr = err;
      // eslint-disable-next-line no-await-in-loop
      await sleep(CHECK_INTERVAL_MS);
    }
  }
  throw new Error(`Server did not become ready at http://${host}:${port}. ${lastErr ? String(lastErr.message || lastErr) : ''}`.trim());
}

function runtimeInfo() {
  return {
    host: serverHost,
    port: serverPort,
    mode: desktopConfig?.mode || 'server',
    dataDir: desktopConfig?.dataDir || resolveDefaultDataDir(),
    configPath: desktopConfig?.configPath || '',
    aiConfigPath: desktopConfig?.aiConfigPath || '',
    apiBase: `http://${serverHost}:${serverPort}`,
    configFile: configFilePath(),
    serverPid: serverProcess?.pid || null
  };
}

function buildServerEnv(config, port) {
  const env = {
    ...process.env,
    HOST: config.host,
    PORT: String(port),
    ELENWEAVE_RUNTIME_MODE: config.mode,
    ELENWEAVE_DATA_DIR: config.dataDir
  };
  if (config.configPath) {
    env.ELENWEAVE_CONFIG = config.configPath;
    env.ELENWEAVE_AI_CONFIG = config.configPath;
  }
  if (config.aiConfigPath) {
    env.ELENWEAVE_AI_CONFIG = config.aiConfigPath;
  }
  Object.entries(config.envOverrides || {}).forEach(([key, value]) => {
    env[key] = String(value ?? '');
  });
  return {
    ...env,
    ELECTRON_RUN_AS_NODE: '1'
  };
}

async function stopServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  serverProcess = null;
  await appendServerLog(`[desktop] stopping server pid=${child.pid}`);
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('exit', done);
    try {
      child.kill('SIGTERM');
    } catch {
      done();
      return;
    }
    setTimeout(() => {
      if (settled) return;
      try {
        child.kill('SIGKILL');
      } catch {
        // no-op
      }
      done();
    }, 3000);
  });
}

async function startServer() {
  await fs.access(cliScriptPath());
  const cfg = desktopConfig || sanitizeConfig({});
  const nextPort = await pickAvailablePort(cfg.host, cfg.port, cfg.maxPort);
  serverHost = cfg.host;
  serverPort = nextPort;
  const args = [
    cliScriptPath(),
    '--mode',
    cfg.mode,
    '--host',
    cfg.host,
    '--port',
    String(nextPort),
    '--data-dir',
    cfg.dataDir
  ];
  if (cfg.configPath) {
    args.push('--config', cfg.configPath);
  }
  if (cfg.aiConfigPath) {
    args.push('--ai-config', cfg.aiConfigPath);
  }
  await appendServerLog(`[desktop] starting server ${process.execPath} ${args.join(' ')}`);
  const child = spawn(process.execPath, args, {
    cwd: resourceRoot(),
    env: buildServerEnv(cfg, nextPort),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  serverProcess = child;
  child.stdout?.on('data', (chunk) => {
    const text = String(chunk || '').trimEnd();
    if (!text) return;
    void appendServerLog(`[server:stdout] ${text}`);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk || '').trimEnd();
    if (!text) return;
    void appendServerLog(`[server:stderr] ${text}`);
  });
  child.once('exit', (code, signal) => {
    const wasExpected = !serverProcess || isShuttingDown;
    void appendServerLog(`[desktop] server exited code=${code} signal=${signal}`);
    if (!wasExpected) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Elenweave server stopped',
        message: 'The local server exited unexpectedly.',
        detail: `Exit code: ${code ?? 'null'}, signal: ${signal ?? 'null'}.\nLog: ${logFilePath()}`
      }).catch(() => {});
    }
  });
  await waitForServer(cfg.host, nextPort);
}

function buildMenu() {
  const template = [
    {
      label: 'Elenweave',
      submenu: [
        {
          label: 'Show Runtime Info',
          click: async () => {
            const info = runtimeInfo();
            await dialog.showMessageBox({
              type: 'info',
              title: 'Runtime Info',
              message: 'Elenweave local runtime',
              detail: [
                `API: ${info.apiBase}`,
                `Mode: ${info.mode}`,
                `Data dir: ${info.dataDir}`,
                `Config file: ${info.configFile}`,
                `Server pid: ${info.serverPid ?? 'n/a'}`
              ].join('\n')
            });
          }
        },
        {
          label: 'Open Desktop Config',
          click: async () => {
            await shell.openPath(configFilePath());
          }
        },
        {
          label: 'Open Data Directory',
          click: async () => {
            await fs.mkdir(desktopConfig.dataDir, { recursive: true });
            await shell.openPath(desktopConfig.dataDir);
          }
        },
        {
          label: 'Copy API URL',
          click: () => {
            clipboard.writeText(`http://${serverHost}:${serverPort}`);
          }
        },
        { type: 'separator' },
        {
          label: 'Restart Local Server',
          click: async () => {
            await stopServer();
            await startServer();
            if (mainWindow && !mainWindow.isDestroyed()) {
              await mainWindow.loadURL(`http://${serverHost}:${serverPort}/app/index.html`);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
  });
  const url = `http://${serverHost}:${serverPort}/app/index.html`;
  await mainWindow.loadURL(url);
  mainWindow.setTitle(`Elenweave (${serverHost}:${serverPort})`);
}

function registerIpc() {
  ipcMain.handle('desktop:get-runtime-info', () => runtimeInfo());
  ipcMain.handle('desktop:get-config', () => publicDesktopConfig());
  ipcMain.handle('desktop:update-config', async (_event, patch) => {
    const next = await updateDesktopConfig(patch);
    return publicDesktopConfig(next);
  });
  ipcMain.handle('desktop:restart-server', async () => {
    await stopServer();
    await startServer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://${serverHost}:${serverPort}/app/index.html`);
      mainWindow.setTitle(`Elenweave (${serverHost}:${serverPort})`);
    }
    return runtimeInfo();
  });
  ipcMain.handle('desktop:open-data-dir', async () => {
    await fs.mkdir(desktopConfig.dataDir, { recursive: true });
    await shell.openPath(desktopConfig.dataDir);
    return true;
  });
  ipcMain.handle('desktop:open-desktop-config', async () => {
    await shell.openPath(configFilePath());
    return true;
  });
}

async function bootstrap() {
  desktopConfig = await loadDesktopConfig();
  await startServer();
  buildMenu();
  registerIpc();
  await createWindow();
}

app.whenReady().then(async () => {
  try {
    await bootstrap();
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Failed to start Elenweave desktop',
      message: 'Could not start local runtime.',
      detail: `${err?.message || String(err)}\n\nServer log: ${logFilePath()}`
    });
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length !== 0) return;
  if (!serverProcess) {
    try {
      await startServer();
    } catch {
      // handled by normal startup path
    }
  }
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  if (!serverProcess) return;
  event.preventDefault();
  isShuttingDown = true;
  stopServer()
    .catch(() => {})
    .finally(() => app.quit());
});
