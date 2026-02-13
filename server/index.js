import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = APP_DIR;
const DATA_DIR = path.join(APP_DIR, 'data');
const BOARDS_DIR = path.join(DATA_DIR, 'boards');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const MAX_BODY_BYTES = 12 * 1024 * 1024;

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

async function ensureStore() {
  await fs.mkdir(BOARDS_DIR, { recursive: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  try {
    await fs.access(INDEX_FILE);
  } catch {
    await writeIndex({ boards: [] });
  }
}

function sanitizeBoardList(boards) {
  if (!Array.isArray(boards)) return [];
  return boards.map((entry) => ({
    id: String(entry.id || ''),
    name: String(entry.name || 'Untitled'),
    createdAt: Number(entry.createdAt || Date.now()),
    updatedAt: Number(entry.updatedAt || Date.now())
  })).filter((entry) => entry.id);
}

async function readIndex() {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { boards: sanitizeBoardList(parsed.boards) };
  } catch {
    return { boards: [] };
  }
}

async function writeIndex(index) {
  const payload = JSON.stringify({ boards: sanitizeBoardList(index.boards) }, null, 2);
  const temp = `${INDEX_FILE}.tmp`;
  await fs.writeFile(temp, payload, 'utf8');
  await fs.rename(temp, INDEX_FILE);
}

function boardPath(id) {
  return path.join(BOARDS_DIR, `${id}.json`);
}

function createEmptyBoard(id, name) {
  return {
    id,
    name: name || 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta: null,
    nodeOrder: [],
    nodes: [],
    edges: [],
    notifications: []
  };
}

async function loadBoard(id) {
  const file = boardPath(id);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveBoardPayload(id, payload) {
  const next = {
    ...(payload || {}),
    id
  };
  if (!next.name) next.name = 'Untitled';
  if (!Array.isArray(next.nodes)) next.nodes = [];
  if (!Array.isArray(next.edges)) next.edges = [];
  if (!Array.isArray(next.notifications)) next.notifications = [];
  if (!Array.isArray(next.nodeOrder)) next.nodeOrder = [];
  if (typeof next.meta !== 'object') next.meta = next.meta || null;
  if (!next.createdAt) next.createdAt = Date.now();
  next.updatedAt = Date.now();
  await fs.writeFile(boardPath(id), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function upsertIndexEntry(id, name, timestamps = {}) {
  const index = await readIndex();
  const existing = index.boards.find((board) => board.id === id);
  const updatedAt = timestamps.updatedAt || Date.now();
  if (existing) {
    existing.name = name || existing.name || 'Untitled';
    existing.updatedAt = updatedAt;
    if (!existing.createdAt) existing.createdAt = timestamps.createdAt || Date.now();
  } else {
    index.boards.push({
      id,
      name: name || 'Untitled',
      createdAt: timestamps.createdAt || Date.now(),
      updatedAt
    });
  }
  await writeIndex(index);
  return index;
}

async function createBoard(name) {
  const id = `board_${randomUUID()}`;
  const payload = createEmptyBoard(id, name);
  await saveBoardPayload(id, payload);
  await upsertIndexEntry(id, payload.name, payload);
  return payload;
}

async function renameBoard(id, name) {
  const board = await loadBoard(id);
  if (!board) return null;
  board.name = name || board.name || 'Untitled';
  board.updatedAt = Date.now();
  await saveBoardPayload(id, board);
  await upsertIndexEntry(id, board.name, board);
  return board;
}

async function addNodesToBoard(id, nodes = [], edges = []) {
  const board = await loadBoard(id);
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
  board.updatedAt = Date.now();
  await saveBoardPayload(id, board);
  await upsertIndexEntry(id, board.name, board);
  return board;
}

async function deleteBoard(id) {
  const index = await readIndex();
  const nextBoards = index.boards.filter((entry) => entry.id !== id);
  if (nextBoards.length !== index.boards.length) {
    await writeIndex({ boards: nextBoards });
  }
  try {
    await fs.unlink(boardPath(id));
  } catch {
    return false;
  }
  return true;
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

  if (req.method === 'GET' && url.pathname === '/api/boards') {
    const index = await readIndex();
    sendJson(res, 200, { boards: index.boards });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/boards') {
    try {
      const body = await readJsonBody(req);
      const board = await createBoard(body?.name);
      sendJson(res, 201, { board: { id: board.id, name: board.name, createdAt: board.createdAt, updatedAt: board.updatedAt } });
    } catch (err) {
      sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
    }
    return;
  }

  const boardMatch = url.pathname.match(/^\/api\/boards\/([^/]+)$/);
  if (boardMatch) {
    const id = decodeURIComponent(boardMatch[1]);
    if (req.method === 'GET') {
      const board = await loadBoard(id);
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
        const board = await renameBoard(id, body?.name);
        if (!board) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { board: { id: board.id, name: board.name, updatedAt: board.updatedAt } });
      } catch (err) {
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
    if (req.method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        const payload = body?.board || body;
        const saved = await saveBoardPayload(id, payload);
        await upsertIndexEntry(id, saved.name, saved);
        sendJson(res, 200, { board: saved });
      } catch (err) {
        sendJson(res, 400, { error: 'InvalidRequest', message: err.message });
      }
      return;
    }
    if (req.method === 'DELETE') {
      const removed = await deleteBoard(id);
      if (!removed) {
        sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  const nodesMatch = url.pathname.match(/^\/api\/boards\/([^/]+)\/nodes$/);
  if (nodesMatch) {
    const id = decodeURIComponent(nodesMatch[1]);
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const nodes = Array.isArray(body?.nodes) ? body.nodes : [];
        const edges = Array.isArray(body?.edges) ? body.edges : [];
        const board = await addNodesToBoard(id, nodes, edges);
        if (!board) {
          sendJson(res, 404, { error: 'BoardNotFound', message: 'Board not found.' });
          return;
        }
        sendJson(res, 200, { ok: true, updatedAt: board.updatedAt });
      } catch (err) {
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
      sendFile(res, indexPath);
    } catch {
      sendText(res, 404, 'Not found');
    }
    return;
  }
  sendFile(res, filePath);
}

function sendFile(res, filePath) {
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
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exitCode = 1;
});
