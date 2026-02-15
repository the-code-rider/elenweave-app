import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = APP_DIR;
const DATA_ROOT = resolveDataRoot();
const PROJECTS_DIR = path.join(DATA_ROOT, 'projects');
const LOCKS_DIR = path.join(DATA_ROOT, 'locks');
const INDEX_FILE = path.join(DATA_ROOT, 'index.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const LOCK_TIMEOUT_MS = Number.parseInt(process.env.ELENWEAVE_LOCK_TIMEOUT_MS || '5000', 10);
const LOCK_RETRY_MS = Number.parseInt(process.env.ELENWEAVE_LOCK_RETRY_MS || '50', 10);
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const NANOID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.webm', 'video/webm']
]);
const MIME_TO_EXT = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
  ['audio/mpeg', 'mp3'],
  ['audio/wav', 'wav'],
  ['audio/mp4', 'm4a'],
  ['audio/webm', 'webm'],
  ['video/webm', 'webm'],
  ['application/json', 'json'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
  ['text/html', 'html'],
  ['text/css', 'css'],
  ['application/javascript', 'js']
]);
const RUNTIME_CONFIG_SCRIPT_PATTERN = /<script id="elenweave-runtime-config">[\s\S]*?<\/script>/;
const AI_CONFIG_PATHS = (() => {
  const explicit = String(process.env.ELENWEAVE_AI_CONFIG || '').trim();
  if (explicit) {
    return [path.resolve(explicit)];
  }
  return [
    path.join(APP_DIR, 'config.json'),
    path.join(APP_DIR, 'server', 'config.json')
  ];
})();

function resolveDataRoot() {
  const fromEnv = String(process.env.ELENWEAVE_DATA_DIR || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), '.elenweave');
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

async function loadAiConfig() {
  for (const file of AI_CONFIG_PATHS) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return {};
}

async function resolveAiProviderKey(provider) {
  const config = await loadAiConfig();
  if (provider === 'openai') {
    return firstNonEmptyString(
      process.env.ELENWEAVE_OPENAI_API_KEY,
      process.env.OPENAI_API_KEY,
      config.openaiApiKey,
      config.openai?.apiKey,
      config.providers?.openai?.apiKey
    );
  }
  if (provider === 'gemini') {
    return firstNonEmptyString(
      process.env.ELENWEAVE_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_API_KEY,
      config.geminiApiKey,
      config.googleApiKey,
      config.gemini?.apiKey,
      config.providers?.gemini?.apiKey
    );
  }
  return '';
}

async function listAvailableAiProviders() {
  const providers = [];
  if (await resolveAiProviderKey('openai')) providers.push('openai');
  if (await resolveAiProviderKey('gemini')) providers.push('gemini');
  return providers;
}

function nowTs() {
  return Date.now();
}

function nanoid(size = 16) {
  const bytes = randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i += 1) {
    id += NANOID_ALPHABET[bytes[i] % NANOID_ALPHABET.length];
  }
  return id;
}

function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function lockFilePath(lockKey) {
  const safe = String(lockKey || 'lock').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return path.join(LOCKS_DIR, `${safe}.lock`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLock(lockKey, fn) {
  const file = lockFilePath(lockKey);
  const start = Date.now();

  while (true) {
    let handle = null;
    try {
      handle = await fs.open(file, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, ts: nowTs() }));
      await handle.close();
      handle = null;
      break;
    } catch (err) {
      if (handle) {
        await handle.close().catch(() => {});
      }
      if (err?.code !== 'EEXIST') throw err;
      if (Date.now() - start >= LOCK_TIMEOUT_MS) {
        const timeoutError = new Error(`Lock timeout for ${lockKey}`);
        timeoutError.code = 'LockTimeout';
        throw timeoutError;
      }
      await sleep(LOCK_RETRY_MS);
    }
  }

  try {
    return await fn();
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

async function withLocks(lockKeys, fn) {
  const keys = Array.from(new Set((lockKeys || []).filter(Boolean))).sort();
  const run = async (idx) => {
    if (idx >= keys.length) return fn();
    return withLock(keys[idx], () => run(idx + 1));
  };
  return run(0);
}

function sanitizeProjectList(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map((entry) => ({
    id: String(entry?.id || ''),
    name: String(entry?.name || 'Untitled Project'),
    createdAt: Number(entry?.createdAt || nowTs()),
    updatedAt: Number(entry?.updatedAt || nowTs())
  })).filter((entry) => isValidId(entry.id));
}

function sanitizeBoardList(boards) {
  if (!Array.isArray(boards)) return [];
  return boards.map((entry) => ({
    id: String(entry?.id || ''),
    name: String(entry?.name || 'Untitled'),
    createdAt: Number(entry?.createdAt || nowTs()),
    updatedAt: Number(entry?.updatedAt || nowTs())
  })).filter((entry) => isValidId(entry.id));
}

function normalizeAssetExt(value) {
  const ext = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!ext) return 'bin';
  return /^[a-z0-9]{1,12}$/.test(ext) ? ext : 'bin';
}

function sanitizeAssetName(value) {
  const text = String(value || '').trim();
  if (!text) return 'asset';
  return text.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 240) || 'asset';
}

function extFromFilename(filename) {
  const base = path.basename(String(filename || ''));
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx >= base.length - 1) return '';
  return normalizeAssetExt(base.slice(idx + 1));
}

function extFromMimeType(mimeType) {
  const normalized = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT.get(normalized) || '';
}

function resolveAssetExt(filename, mimeType) {
  return extFromFilename(filename) || extFromMimeType(mimeType) || 'bin';
}

function sanitizeAssetList(assets) {
  if (!Array.isArray(assets)) return [];
  return assets.map((entry) => ({
    id: String(entry?.id || ''),
    name: sanitizeAssetName(entry?.name || 'asset'),
    type: String(entry?.type || 'application/octet-stream'),
    category: entry?.category ? String(entry.category) : null,
    ext: normalizeAssetExt(entry?.ext || 'bin'),
    fileName: String(entry?.fileName || ''),
    size: Number(entry?.size || 0),
    createdAt: Number(entry?.createdAt || nowTs()),
    updatedAt: Number(entry?.updatedAt || nowTs())
  })).filter((entry) => isValidId(entry.id) && entry.fileName && entry.size >= 0);
}

function projectDir(projectId) {
  return path.join(PROJECTS_DIR, projectId);
}

function projectMetaPath(projectId) {
  return path.join(projectDir(projectId), 'project.json');
}

function boardsDir(projectId) {
  return path.join(projectDir(projectId), 'boards');
}

function boardPath(projectId, boardId) {
  return path.join(boardsDir(projectId), `${boardId}.json`);
}

function assetsDir(projectId) {
  return path.join(projectDir(projectId), 'assets');
}

function projectAssetsPath(projectId) {
  return path.join(projectDir(projectId), 'assets.json');
}

function assetUrl(projectId, assetId) {
  return `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
}

function assetFileName(assetId, ext) {
  return `${assetId}.${normalizeAssetExt(ext)}`;
}

function assetPath(projectId, fileName) {
  return path.join(assetsDir(projectId), fileName);
}

async function writeJsonAtomic(filePath, payload) {
  const body = JSON.stringify(payload, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, body, 'utf8');
  await fs.rename(tmp, filePath);
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function ensureStore() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(LOCKS_DIR, { recursive: true });
  try {
    await fs.access(INDEX_FILE);
  } catch {
    await writeJsonAtomic(INDEX_FILE, { projects: [] });
  }
}

async function readIndex() {
  const parsed = await readJson(INDEX_FILE, { projects: [] });
  return { projects: sanitizeProjectList(parsed?.projects) };
}

async function writeIndex(index) {
  await writeJsonAtomic(INDEX_FILE, {
    projects: sanitizeProjectList(index?.projects)
  });
}

async function loadProjectMeta(projectId) {
  if (!isValidId(projectId)) return null;
  const parsed = await readJson(projectMetaPath(projectId), null);
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    id: String(parsed.id || projectId),
    name: String(parsed.name || 'Untitled Project'),
    createdAt: Number(parsed.createdAt || nowTs()),
    updatedAt: Number(parsed.updatedAt || nowTs()),
    boards: sanitizeBoardList(parsed.boards)
  };
}

async function saveProjectMeta(projectId, meta) {
  const payload = {
    id: String(meta?.id || projectId),
    name: String(meta?.name || 'Untitled Project'),
    createdAt: Number(meta?.createdAt || nowTs()),
    updatedAt: Number(meta?.updatedAt || nowTs()),
    boards: sanitizeBoardList(meta?.boards)
  };
  await writeJsonAtomic(projectMetaPath(projectId), payload);
  return payload;
}

async function loadProjectAssets(projectId) {
  if (!isValidId(projectId)) return { assets: [] };
  const parsed = await readJson(projectAssetsPath(projectId), { assets: [] });
  return { assets: sanitizeAssetList(parsed?.assets) };
}

async function saveProjectAssets(projectId, payload) {
  await writeJsonAtomic(projectAssetsPath(projectId), {
    assets: sanitizeAssetList(payload?.assets)
  });
}

function createEmptyBoard(id, name) {
  return {
    id,
    name: name || 'Untitled',
    createdAt: nowTs(),
    updatedAt: nowTs(),
    meta: null,
    nodeOrder: [],
    nodes: [],
    edges: [],
    notifications: []
  };
}

function normalizeBoardPayload(boardId, payload) {
  const next = {
    ...(payload || {}),
    id: boardId
  };
  if (!next.name) next.name = 'Untitled';
  if (!Array.isArray(next.nodes)) next.nodes = [];
  if (!Array.isArray(next.edges)) next.edges = [];
  if (!Array.isArray(next.notifications)) next.notifications = [];
  if (!Array.isArray(next.nodeOrder)) next.nodeOrder = [];
  if (typeof next.meta !== 'object') next.meta = next.meta || null;
  if (!next.createdAt) next.createdAt = nowTs();
  next.updatedAt = nowTs();
  return next;
}

async function loadBoard(projectId, boardId) {
  if (!isValidId(projectId) || !isValidId(boardId)) return null;
  const parsed = await readJson(boardPath(projectId, boardId), null);
  if (!parsed || typeof parsed !== 'object') return null;
  return normalizeBoardPayload(boardId, parsed);
}

async function saveBoardPayload(projectId, boardId, payload) {
  const next = normalizeBoardPayload(boardId, payload);
  await writeJsonAtomic(boardPath(projectId, boardId), next);
  return next;
}

async function touchProjectIndex(projectId, patch = {}) {
  await withLocks(['index'], async () => {
    const index = await readIndex();
    const existing = index.projects.find((entry) => entry.id === projectId);
    if (!existing) return;
    if (patch.name) existing.name = String(patch.name);
    if (patch.createdAt) existing.createdAt = Number(patch.createdAt);
    existing.updatedAt = Number(patch.updatedAt || nowTs());
    await writeIndex(index);
  });
}

async function createProject(name) {
  return withLocks(['index'], async () => {
    const index = await readIndex();
    let id = nanoid(16);
    while (index.projects.some((entry) => entry.id === id)) {
      id = nanoid(16);
    }

    const createdAt = nowTs();
    const projectMeta = {
      id,
      name: String(name || 'Untitled Project'),
      createdAt,
      updatedAt: createdAt,
      boards: []
    };

    await fs.mkdir(boardsDir(id), { recursive: true });
    await fs.mkdir(assetsDir(id), { recursive: true });
    await saveProjectMeta(id, projectMeta);
    await saveProjectAssets(id, { assets: [] });

    index.projects.push({
      id,
      name: projectMeta.name,
      createdAt,
      updatedAt: createdAt
    });
    await writeIndex(index);
    return projectMeta;
  });
}

async function renameProject(projectId, name) {
  return withLocks([`project-${projectId}`, 'index'], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;
    meta.name = String(name || meta.name || 'Untitled Project');
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    const index = await readIndex();
    const existing = index.projects.find((entry) => entry.id === projectId);
    if (!existing) return null;
    existing.name = meta.name;
    existing.updatedAt = meta.updatedAt;
    await writeIndex(index);
    return meta;
  });
}

async function deleteProject(projectId) {
  return withLocks([`project-${projectId}`, 'index'], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return false;

    const index = await readIndex();
    index.projects = index.projects.filter((entry) => entry.id !== projectId);
    await writeIndex(index);

    await fs.rm(projectDir(projectId), { recursive: true, force: true });
    return true;
  });
}

function parseInitialBoardPayload(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.board && typeof body.board === 'object') return body.board;
  if (
    Array.isArray(body.nodes)
    || Array.isArray(body.edges)
    || Array.isArray(body.nodeOrder)
    || Array.isArray(body.notifications)
    || Object.prototype.hasOwnProperty.call(body, 'meta')
  ) {
    return body;
  }
  return null;
}

async function createBoard(projectId, name, initialPayload = null) {
  return withLocks([`project-${projectId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;

    let boardId = nanoid(16);
    while (meta.boards.some((entry) => entry.id === boardId)) {
      boardId = nanoid(16);
    }

    const payload = initialPayload && typeof initialPayload === 'object'
      ? { ...initialPayload, id: boardId, name: initialPayload.name || name || 'Untitled' }
      : createEmptyBoard(boardId, name || 'Untitled');

    const saved = await saveBoardPayload(projectId, boardId, payload);

    const existing = meta.boards.find((entry) => entry.id === boardId);
    const summary = {
      id: boardId,
      name: saved.name,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    };
    if (existing) {
      Object.assign(existing, summary);
    } else {
      meta.boards.push(summary);
    }
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return saved;
  });
}

async function renameBoard(projectId, boardId, name) {
  return withLocks([`project-${projectId}`, `board-${projectId}-${boardId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;

    const board = await loadBoard(projectId, boardId);
    if (!board) return null;

    board.name = String(name || board.name || 'Untitled');
    board.updatedAt = nowTs();
    await saveBoardPayload(projectId, boardId, board);

    const existing = meta.boards.find((entry) => entry.id === boardId);
    if (existing) {
      existing.name = board.name;
      existing.updatedAt = board.updatedAt;
    } else {
      meta.boards.push({
        id: boardId,
        name: board.name,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      });
    }
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return board;
  });
}

async function saveBoardForProject(projectId, boardId, payload) {
  return withLocks([`project-${projectId}`, `board-${projectId}-${boardId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;

    const saved = await saveBoardPayload(projectId, boardId, payload);
    const existing = meta.boards.find((entry) => entry.id === boardId);
    if (existing) {
      existing.name = saved.name;
      existing.updatedAt = saved.updatedAt;
      if (!existing.createdAt) existing.createdAt = saved.createdAt;
    } else {
      meta.boards.push({
        id: boardId,
        name: saved.name,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt
      });
    }
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return saved;
  });
}

async function addNodesToBoard(projectId, boardId, nodes = [], edges = []) {
  return withLocks([`project-${projectId}`, `board-${projectId}-${boardId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;

    const board = await loadBoard(projectId, boardId);
    if (!board) return null;

    const nodeIds = new Set(board.nodes.map((node) => node.id));
    const edgeIds = new Set(board.edges.map((edge) => edge.id));

    nodes.forEach((node) => {
      if (!node || !node.id || nodeIds.has(node.id)) return;
      board.nodes.push(node);
      nodeIds.add(node.id);
    });

    edges.forEach((edge) => {
      if (!edge || !edge.id || edgeIds.has(edge.id)) return;
      board.edges.push(edge);
      edgeIds.add(edge.id);
    });

    board.updatedAt = nowTs();
    await saveBoardPayload(projectId, boardId, board);

    const existing = meta.boards.find((entry) => entry.id === boardId);
    if (existing) {
      existing.name = board.name;
      existing.updatedAt = board.updatedAt;
    } else {
      meta.boards.push({
        id: boardId,
        name: board.name,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      });
    }
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return board;
  });
}

async function deleteBoard(projectId, boardId) {
  return withLocks([`project-${projectId}`, `board-${projectId}-${boardId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return false;

    const existing = await loadBoard(projectId, boardId);
    if (!existing) return false;

    meta.boards = meta.boards.filter((entry) => entry.id !== boardId);
    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);

    await fs.unlink(boardPath(projectId, boardId)).catch(() => {});

    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return true;
  });
}

function normalizeBase64Payload(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
}

function isValidBase64Payload(value) {
  if (!value) return false;
  if (value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

async function createProjectAsset(projectId, input = {}) {
  return withLocks([`project-${projectId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return null;

    const assetsDoc = await loadProjectAssets(projectId);
    let assetId = nanoid(16);
    const taken = new Set(assetsDoc.assets.map((entry) => entry.id));
    while (taken.has(assetId)) {
      assetId = nanoid(16);
    }

    const mimeType = String(input.mimeType || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase() || 'application/octet-stream';
    const ext = resolveAssetExt(input.filename, mimeType);
    const ts = nowTs();
    const fileName = assetFileName(assetId, ext);
    const body = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.alloc(0);

    await fs.mkdir(assetsDir(projectId), { recursive: true });
    await fs.writeFile(assetPath(projectId, fileName), body);

    const assetMeta = {
      id: assetId,
      name: sanitizeAssetName(input.filename || `asset.${ext}`),
      type: mimeType,
      category: input.category ? String(input.category) : null,
      ext,
      fileName,
      size: body.length,
      createdAt: ts,
      updatedAt: ts
    };
    assetsDoc.assets.push(assetMeta);
    await saveProjectAssets(projectId, assetsDoc);

    meta.updatedAt = ts;
    await saveProjectMeta(projectId, meta);
    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return assetMeta;
  });
}

async function readProjectAsset(projectId, assetId) {
  const meta = await loadProjectMeta(projectId);
  if (!meta) return null;
  const assetsDoc = await loadProjectAssets(projectId);
  const assetMeta = assetsDoc.assets.find((entry) => entry.id === assetId);
  if (!assetMeta) return null;
  const file = assetPath(projectId, assetMeta.fileName);
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return null;
    return { ...assetMeta, file, size: stat.size };
  } catch {
    return null;
  }
}

async function deleteProjectAsset(projectId, assetId) {
  return withLocks([`project-${projectId}`], async () => {
    const meta = await loadProjectMeta(projectId);
    if (!meta) return false;

    const assetsDoc = await loadProjectAssets(projectId);
    const assetMeta = assetsDoc.assets.find((entry) => entry.id === assetId);
    if (!assetMeta) return false;

    assetsDoc.assets = assetsDoc.assets.filter((entry) => entry.id !== assetId);
    await saveProjectAssets(projectId, assetsDoc);
    await fs.unlink(assetPath(projectId, assetMeta.fileName)).catch(() => {});

    meta.updatedAt = nowTs();
    await saveProjectMeta(projectId, meta);
    await touchProjectIndex(projectId, {
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });

    return true;
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload || {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendText(res, status, message) {
  const body = message || '';
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendStream(res, status, stream, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  stream.pipe(res);
}

async function sendUpstreamResponse(res, upstream) {
  const body = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  res.writeHead(upstream.status, {
    'Content-Type': contentType,
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function sendLockError(res, err) {
  if (err?.code === 'LockTimeout') {
    sendJson(res, 409, { error: 'Conflict', message: err.message || 'Resource lock timeout.' });
    return true;
  }
  return false;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function decodeId(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return String(raw || '');
  }
}

function validateIds(res, projectId, boardId = null) {
  if (!isValidId(projectId)) {
    sendJson(res, 400, { error: 'InvalidRequest', message: 'Invalid project id.' });
    return false;
  }
  if (boardId !== null && !isValidId(boardId)) {
    sendJson(res, 400, { error: 'InvalidRequest', message: 'Invalid board id.' });
    return false;
  }
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/ai/providers') {
    const providers = await listAvailableAiProviders();
    sendJson(res, 200, { providers });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/openai/responses') {
    try {
      const apiKey = await resolveAiProviderKey('openai');
      if (!apiKey) {
        sendJson(res, 503, { error: 'MissingKey', message: 'OpenAI key not configured on server.' });
        return;
      }
      const rawBody = await readRawBody(req);
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: rawBody.length ? rawBody : undefined
      });
      await sendUpstreamResponse(res, upstream);
    } catch (err) {
      sendJson(res, 502, { error: 'UpstreamError', message: err.message || 'OpenAI request failed.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/openai/transcriptions') {
    try {
      const apiKey = await resolveAiProviderKey('openai');
      if (!apiKey) {
        sendJson(res, 503, { error: 'MissingKey', message: 'OpenAI key not configured on server.' });
        return;
      }
      const rawBody = await readRawBody(req);
      const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/octet-stream',
          'Authorization': `Bearer ${apiKey}`
        },
        body: rawBody.length ? rawBody : undefined
      });
      await sendUpstreamResponse(res, upstream);
    } catch (err) {
      sendJson(res, 502, { error: 'UpstreamError', message: err.message || 'OpenAI transcription failed.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/gemini/generateContent') {
    try {
      const apiKey = await resolveAiProviderKey('gemini');
      if (!apiKey) {
        sendJson(res, 503, { error: 'MissingKey', message: 'Gemini key not configured on server.' });
        return;
      }
      const body = await readJsonBody(req);
      const model = String(body?.model || '').trim();
      if (!model) {
        sendJson(res, 400, { error: 'InvalidRequest', message: 'Missing model for Gemini request.' });
        return;
      }
      const payload = { ...body };
      delete payload.model;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });
      await sendUpstreamResponse(res, upstream);
    } catch (err) {
      sendJson(res, 502, { error: 'UpstreamError', message: err.message || 'Gemini request failed.' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    const index = await readIndex();
    sendJson(res, 200, { projects: index.projects });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    try {
      const body = await readJsonBody(req);
      const project = await createProject(body?.name);
      sendJson(res, 201, {
        project: {
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }
      });
    } catch (err) {
      if (sendLockError(res, err)) return;
      sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
    }
    return;
  }

  const projectBoardNodesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/boards\/([^/]+)\/nodes$/);
  if (projectBoardNodesMatch) {
    const projectId = decodeId(projectBoardNodesMatch[1]);
    const boardId = decodeId(projectBoardNodesMatch[2]);
    if (!validateIds(res, projectId, boardId)) return;

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const nodes = Array.isArray(body?.nodes) ? body.nodes : [];
        const edges = Array.isArray(body?.edges) ? body.edges : [];
        const board = await addNodesToBoard(projectId, boardId, nodes, edges);
        if (!board) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { ok: true, updatedAt: board.updatedAt });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  const projectBoardMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/boards\/([^/]+)$/);
  if (projectBoardMatch) {
    const projectId = decodeId(projectBoardMatch[1]);
    const boardId = decodeId(projectBoardMatch[2]);
    if (!validateIds(res, projectId, boardId)) return;

    if (req.method === 'GET') {
      const board = await loadBoard(projectId, boardId);
      if (!board) {
        sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
        return;
      }
      sendJson(res, 200, { board });
      return;
    }

    if (req.method === 'PATCH') {
      try {
        const body = await readJsonBody(req);
        const board = await renameBoard(projectId, boardId, body?.name);
        if (!board) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { board: { id: board.id, name: board.name, updatedAt: board.updatedAt } });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }

    if (req.method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        const payload = body?.board || body;
        const saved = await saveBoardForProject(projectId, boardId, payload);
        if (!saved) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { board: saved });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }

    if (req.method === 'DELETE') {
      try {
        const removed = await deleteBoard(projectId, boardId);
        if (!removed) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  const projectBoardsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/boards$/);
  if (projectBoardsMatch) {
    const projectId = decodeId(projectBoardsMatch[1]);
    if (!validateIds(res, projectId)) return;

    if (req.method === 'GET') {
      const project = await loadProjectMeta(projectId);
      if (!project) {
        sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
        return;
      }
      sendJson(res, 200, { boards: sanitizeBoardList(project.boards) });
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const payload = parseInitialBoardPayload(body);
        const board = await createBoard(projectId, body?.name, payload);
        if (!board) {
          sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
          return;
        }
        sendJson(res, 201, {
          board: {
            id: board.id,
            name: board.name,
            createdAt: board.createdAt,
            updatedAt: board.updatedAt
          }
        });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  const projectAssetsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets$/);
  if (projectAssetsMatch) {
    const projectId = decodeId(projectAssetsMatch[1]);
    if (!validateIds(res, projectId)) return;

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const payload = normalizeBase64Payload(body?.base64);
        if (!isValidBase64Payload(payload)) {
          sendJson(res, 400, { error: 'InvalidRequest', message: 'Invalid base64 payload.' });
          return;
        }
        const binary = Buffer.from(payload, 'base64');
        if (!binary.length) {
          sendJson(res, 400, { error: 'InvalidRequest', message: 'Asset payload is empty.' });
          return;
        }
        const saved = await createProjectAsset(projectId, {
          filename: body?.filename,
          mimeType: body?.mimeType,
          category: body?.category,
          buffer: binary
        });
        if (!saved) {
          sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
          return;
        }
        sendJson(res, 201, {
          asset: {
            id: saved.id,
            name: saved.name,
            type: saved.type,
            category: saved.category,
            size: saved.size,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            url: assetUrl(projectId, saved.id)
          }
        });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  const projectAssetMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/);
  if (projectAssetMatch) {
    const projectId = decodeId(projectAssetMatch[1]);
    const assetId = decodeId(projectAssetMatch[2]);
    if (!validateIds(res, projectId)) return;
    if (!isValidId(assetId)) {
      sendJson(res, 400, { error: 'InvalidRequest', message: 'Invalid asset id.' });
      return;
    }

    if (req.method === 'GET') {
      const asset = await readProjectAsset(projectId, assetId);
      if (!asset) {
        sendJson(res, 404, { error: 'AssetNotFound', message: 'Asset not found.' });
        return;
      }
      const stream = createReadStream(asset.file);
      const safeName = sanitizeAssetName(asset.name || `${asset.id}.${asset.ext || 'bin'}`);
      const headers = {
        'Content-Type': asset.type || 'application/octet-stream',
        'Content-Length': Number(asset.size || 0),
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'X-Elenweave-Asset-Name': safeName
      };
      if (asset.category) {
        headers['X-Elenweave-Asset-Category'] = String(asset.category);
      }
      sendStream(res, 200, stream, headers);
      return;
    }

    if (req.method === 'DELETE') {
      try {
        const removed = await deleteProjectAsset(projectId, assetId);
        if (!removed) {
          sendJson(res, 404, { error: 'AssetNotFound', message: 'Asset not found.' });
          return;
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = decodeId(projectMatch[1]);
    if (!validateIds(res, projectId)) return;

    if (req.method === 'GET') {
      const project = await loadProjectMeta(projectId);
      if (!project) {
        sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
        return;
      }
      sendJson(res, 200, {
        project: {
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        boards: sanitizeBoardList(project.boards)
      });
      return;
    }

    if (req.method === 'PATCH') {
      try {
        const body = await readJsonBody(req);
        const project = await renameProject(projectId, body?.name);
        if (!project) {
          sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
          return;
        }
        sendJson(res, 200, {
          project: {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          }
        });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }

    if (req.method === 'DELETE') {
      try {
        const removed = await deleteProject(projectId);
        if (!removed) {
          sendJson(res, 404, { error: 'ProjectNotFound', message: 'Project not found.' });
          return;
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        if (sendLockError(res, err)) return;
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
  }

  sendJson(res, 404, { error: 'NotFound', message: 'Route not found.' });
}

async function serveStatic(req, res, url) {
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/app/index.html' });
    res.end();
    return;
  }
  if (url.pathname === '/app') {
    res.writeHead(302, { Location: '/app/index.html' });
    res.end();
    return;
  }
  const requestPath = url.pathname;
  const normalized = path.normalize(decodeURIComponent(requestPath));
  const filePath = path.resolve(PAGES_DIR, `.${normalized}`);
  const relativePath = path.relative(PAGES_DIR, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    sendText(res, 404, 'Not found');
    return;
  }
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    try {
      await fs.access(indexPath);
      await sendFile(res, indexPath);
    } catch {
      sendText(res, 404, 'Not found');
    }
    return;
  }
  await sendFile(res, filePath);
}

function isAppIndexFile(filePath) {
  const rel = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
  return rel === 'app/index.html';
}

function buildRuntimeScript(config) {
  const body = JSON.stringify(config, null, 2);
  return `<script id="elenweave-runtime-config">\n      window.__ELENWEAVE_RUNTIME__ = ${body};\n    </script>`;
}

async function sendIndexHtmlWithRuntimeConfig(res, filePath, config) {
  const source = await fs.readFile(filePath, 'utf8');
  const script = buildRuntimeScript(config);
  const body = RUNTIME_CONFIG_SCRIPT_PATTERN.test(source)
    ? source.replace(RUNTIME_CONFIG_SCRIPT_PATTERN, script)
    : source.replace('</head>', `    ${script}\n  </head>`);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function sendFile(res, filePath) {
  if (isAppIndexFile(filePath)) {
    await sendIndexHtmlWithRuntimeConfig(res, filePath, {
      storageMode: 'server',
      serverBase: ''
    });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES.get(ext) || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(res);
}

async function start() {
  await ensureStore();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  });
  server.listen(PORT, HOST, () => {
    console.log(`Elenweave server running at http://${HOST}:${PORT}`);
    console.log(`Data root: ${DATA_ROOT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exitCode = 1;
});
