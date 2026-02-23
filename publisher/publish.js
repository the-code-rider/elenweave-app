#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const argv = process.argv.slice(2);
const args = parseArgs(argv);

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const projectId = requireArg(args, 'project-id');
const catalogId = requireArg(args, 'catalog-id');
const dataDir = resolveDataDir(args['data-dir']);
const publicBaseUrl = String(args['public-base-url'] || process.env.R2_PUBLIC_BASE_URL || '').trim();
const catalogKey = String(args['catalog-key'] || 'public/catalog.json').trim();
const dryRun = Boolean(args['dry-run']);

if (!publicBaseUrl) {
  console.error('Missing public base URL. Set --public-base-url or R2_PUBLIC_BASE_URL.');
  process.exit(1);
}

const projectDir = path.join(dataDir, 'projects', projectId);
const metaPath = path.join(projectDir, 'project.json');
const assetsPath = path.join(projectDir, 'assets.json');
const boardsDir = path.join(projectDir, 'boards');
const assetsDir = path.join(projectDir, 'assets');

const projectMeta = await readJson(metaPath);
if (!projectMeta) {
  console.error(`Project metadata not found: ${metaPath}`);
  process.exit(1);
}

const assetsMeta = await readJson(assetsPath) || { assets: [] };
const boards = Array.isArray(projectMeta.boards) ? projectMeta.boards : [];
const assets = Array.isArray(assetsMeta.assets) ? assetsMeta.assets : [];

const name = String(args.name || projectMeta.name || 'Untitled Project');
const description = String(args.description || projectMeta.description || '');
const publisher = String(args.publisher || projectMeta.publisher || '');
const version = String(args.version || projectMeta.version || '');
const tags = parseTags(args.tags) || (Array.isArray(projectMeta.tags) ? projectMeta.tags : []);

const nowIso = new Date().toISOString();
const publishedAt = normalizeIso(projectMeta.publishedAt) || nowIso;
const updatedAt = normalizeIso(projectMeta.updatedAt) || nowIso;

const basePrefix = `public/projects/${catalogId}`;
const manifestKey = `${basePrefix}/manifest.json`;
const manifestUrl = joinUrl(publicBaseUrl, manifestKey);

const coverInput = String(args.cover || projectMeta.coverUrl || '').trim();
const coverInfo = await resolveCover(coverInput, basePrefix, publicBaseUrl, dryRun);

const boardUploads = await buildBoardUploads(boards, boardsDir, basePrefix);
const assetUploads = await buildAssetUploads(assets, assetsDir, basePrefix);

const manifest = {
  id: catalogId,
  name,
  description,
  publisher,
  publishedAt,
  updatedAt,
  version,
  coverUrl: coverInfo.url || '',
  tags,
  assets: assetUploads.map((entry) => ({
    id: entry.id,
    name: entry.name,
    mimeType: entry.mimeType,
    category: entry.category,
    file: entry.file
  })),
  boards: boardUploads.map((entry) => ({
    name: entry.name,
    file: entry.file,
    updatedAt: entry.updatedAt
  }))
};

const catalogEntry = {
  id: catalogId,
  name,
  description,
  publisher,
  publishedAt,
  updatedAt,
  version,
  coverUrl: coverInfo.url || '',
  tags,
  manifestUrl
};

const plan = {
  bucket: process.env.R2_BUCKET || '',
  catalogKey,
  manifestKey,
  boardCount: boardUploads.length,
  assetCount: assetUploads.length,
  coverKey: coverInfo.key || null
};

console.log('Publish plan:');
console.log(JSON.stringify(plan, null, 2));

if (dryRun) {
  console.log('Dry run enabled. No uploads performed.');
  process.exit(0);
}

const s3 = createS3Client();
const bucket = requireEnv('R2_BUCKET');

await uploadJson(s3, bucket, manifestKey, manifest);
for (const board of boardUploads) {
  await uploadFile(s3, bucket, board.key, board.path, 'application/json; charset=utf-8');
}
for (const asset of assetUploads) {
  await uploadFile(s3, bucket, asset.key, asset.path, asset.mimeType);
}
if (coverInfo.path && coverInfo.key) {
  await uploadFile(s3, bucket, coverInfo.key, coverInfo.path, coverInfo.mimeType);
}

const catalog = await fetchCatalog(s3, bucket, catalogKey);
const nextCatalog = updateCatalog(catalog, catalogEntry);
await uploadJson(s3, bucket, catalogKey, nextCatalog);

console.log('Publish complete.');

function parseArgs(argvList) {
  const parsed = {};
  for (let i = 0; i < argvList.length; i += 1) {
    const raw = argvList[i];
    if (!raw.startsWith('--')) {
      parsed._ = parsed._ || [];
      parsed._.push(raw);
      continue;
    }
    const [flag, inline] = raw.slice(2).split('=');
    if (inline !== undefined) {
      parsed[flag] = inline;
      continue;
    }
    const next = argvList[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[flag] = true;
    } else {
      parsed[flag] = next;
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node publish.js --project-id <id> --catalog-id <id> [options]

Options:
  --data-dir <path>         Override local data root (default: ~/.elenweave)
  --name <string>           Override project display name
  --description <string>    Override description
  --publisher <string>      Override publisher
  --version <string>        Override version
  --tags <a,b,c>            Comma-separated tags
  --cover <path|url>        Cover image path or URL
  --public-base-url <url>   Public base URL for R2 objects (or R2_PUBLIC_BASE_URL)
  --catalog-key <key>       Catalog key (default: public/catalog.json)
  --dry-run                 Print plan only
  --help                    Show help
`);
}

function requireArg(parsed, key) {
  const value = parsed[key];
  if (!value || value === true) {
    console.error(`Missing required flag: --${key}`);
    printHelp();
    process.exit(1);
  }
  return String(value);
}

function resolveDataDir(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return path.join(os.homedir(), '.elenweave');
  }
  if (raw.startsWith('~')) {
    return path.join(os.homedir(), raw.slice(1));
  }
  return path.resolve(raw);
}

function normalizeIso(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function parseTags(value) {
  if (!value) return null;
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function joinUrl(base, part) {
  const trimmedBase = String(base || '').replace(/\/+$/, '');
  const trimmedPart = String(part || '').replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPart}`;
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

async function buildBoardUploads(entries, dir, prefix) {
  const uploads = [];
  for (const entry of entries) {
    const boardId = String(entry?.id || '').trim();
    if (!boardId) continue;
    const boardPath = path.join(dir, `${boardId}.json`);
    const raw = await fs.readFile(boardPath, 'utf8');
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`Invalid board JSON: ${boardPath}`);
    }
    const file = `boards/${boardId}.json`;
    uploads.push({
      id: boardId,
      name: String(entry?.name || 'Untitled'),
      updatedAt: normalizeIso(entry?.updatedAt) || '',
      file,
      key: `${prefix}/${file}`,
      path: boardPath
    });
  }
  return uploads;
}

async function buildAssetUploads(entries, dir, prefix) {
  const uploads = [];
  for (const entry of entries) {
    const assetId = String(entry?.id || '').trim();
    const fileName = String(entry?.fileName || '').trim();
    if (!assetId || !fileName) continue;
    const src = path.join(dir, fileName);
    try {
      await fs.access(src);
    } catch {
      console.warn(`Missing asset file, skipping: ${src}`);
      continue;
    }
    const ext = String(entry?.ext || path.extname(fileName).slice(1) || 'bin');
    const file = `assets/${assetId}.${ext}`;
    uploads.push({
      id: assetId,
      name: String(entry?.name || 'asset'),
      mimeType: String(entry?.type || mimeFromExt(ext)),
      category: entry?.category ? String(entry.category) : null,
      file,
      key: `${prefix}/${file}`,
      path: src
    });
  }
  return uploads;
}

async function resolveCover(input, prefix, publicBaseUrl, dry) {
  if (!input) return { url: '', key: '', path: '', mimeType: '' };
  if (/^https?:\/\//i.test(input)) {
    return { url: input, key: '', path: '', mimeType: '' };
  }
  const localPath = path.resolve(input);
  try {
    await fs.access(localPath);
  } catch {
    console.warn(`Cover file not found, skipping: ${localPath}`);
    return { url: '', key: '', path: '', mimeType: '' };
  }
  const ext = path.extname(localPath).slice(1) || 'png';
  const key = `${prefix}/cover.${ext}`;
  const url = joinUrl(publicBaseUrl, key);
  if (dry) {
    return { url, key, path: localPath, mimeType: mimeFromExt(ext) };
  }
  return { url, key, path: localPath, mimeType: mimeFromExt(ext) };
}

function mimeFromExt(ext) {
  switch (String(ext || '').toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'webm': return 'video/webm';
    case 'json': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function createS3Client() {
  const endpoint = requireEnv('AWS_ENDPOINT_URL');
  const region = String(process.env.AWS_REGION || 'auto');
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY')
    }
  });
}

function requireEnv(key) {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

async function uploadFile(client, bucket, key, filePath, contentType) {
  console.log(`Uploading ${key}...`);
  const body = createReadStream(filePath);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'no-store'
  }));
}

async function uploadJson(client, bucket, key, payload) {
  console.log(`Uploading ${key}...`);
  const body = JSON.stringify(payload, null, 2);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store'
  }));
}

async function fetchCatalog(client, bucket, key) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await streamToString(response.Body);
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? parsed : { projects: [] };
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return { projects: [] };
    }
    throw err;
  }
}

function updateCatalog(catalog, entry) {
  const projects = Array.isArray(catalog?.projects) ? [...catalog.projects] : [];
  const idx = projects.findIndex((item) => item?.id === entry.id);
  if (idx >= 0) {
    projects[idx] = entry;
  } else {
    projects.push(entry);
  }
  return { ...catalog, projects };
}

async function streamToString(stream) {
  if (!stream) return '';
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
