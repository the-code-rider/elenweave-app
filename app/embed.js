import {
  OptionPicker,
  TextInput,
  DateTimeInput,
  SliderInput,
  MultiChoice,
  CodeSnippet,
  ImageViewer,
  VideoPlayer,
  AudioPlayer,
  LineChart,
  AreaChart,
  BarChart,
  ScatterChart,
  HeatmapChart,
  RadarChart,
  SparklineChart
} from 'https://cdn.jsdelivr.net/npm/elenweave@0.1.0/dist/components.js';
import { render as MarkdownBlock } from './markdown-block.js';
import { render as SvgBlock } from './svg-block.js';
import { render as MermaidBlock } from './mermaid-block.js';
import { render as HtmlPreview } from './html-preview.js';

const { ElenweaveWorkspace, ElenweaveView, ElenweaveNavigator } = window.Elenweave || {};
if (!ElenweaveWorkspace || !ElenweaveView) {
  throw new Error('Elenweave CDN is not loaded.');
}

const statusEl = document.getElementById('embedStatus');
const canvas = document.getElementById('ew-canvas');
const embedZoomIn = document.getElementById('embedZoomIn');
const embedZoomOut = document.getElementById('embedZoomOut');
const embedFit = document.getElementById('embedFit');
const embedThemeToggle = document.getElementById('embedThemeToggle');
const embedPanUp = document.getElementById('embedPanUp');
const embedPanDown = document.getElementById('embedPanDown');
const embedPanLeft = document.getElementById('embedPanLeft');
const embedPanRight = document.getElementById('embedPanRight');
const embedCenter = document.getElementById('embedCenter');
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
let selectedNodeId = null;
let navFocusArmed = false;
let navFocusTimer = null;
const params = new URLSearchParams(window.location.search);
const projectId = String(params.get('projectId') || '').trim();
const boardId = String(params.get('boardId') || '').trim();
const themeParam = String(params.get('theme') || '').trim();
const bgParam = String(params.get('bg') || '').trim();

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text || '';
  statusEl.classList.toggle('is-hidden', !text);
  statusEl.classList.toggle('is-error', Boolean(isError));
}

const THEME_ORDER = ['light', 'dark', 'blueprint'];

function getCurrentTheme() {
  const current = document.documentElement.getAttribute('data-theme') || '';
  return THEME_ORDER.includes(current) ? current : 'blueprint';
}

function setTheme(theme) {
  const next = THEME_ORDER.includes(theme) ? theme : 'blueprint';
  document.documentElement.setAttribute('data-theme', next);
  document.body.setAttribute('data-theme', next);
  if (typeof view?.setTheme === 'function') {
    view.setTheme(next === 'blueprint' ? 'blueprint' : next === 'dark' ? 'dark' : 'light');
  }
}

function toggleTheme() {
  const current = getCurrentTheme();
  const idx = THEME_ORDER.indexOf(current);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  setTheme(next);
}

function applyBackgroundParam() {
  if (bgParam === 'transparent') {
    document.body.classList.add('embed-transparent');
  }
}

const RUNTIME_CONFIG = (() => {
  try {
    const raw = window.__ELENWEAVE_RUNTIME__;
    if (!raw || typeof raw !== 'object') {
      return { storageMode: 'client', serverBase: '' };
    }
    return {
      storageMode: raw.storageMode === 'server' ? 'server' : 'client',
      serverBase: String(raw.serverBase || '').replace(/\/+$/, '')
    };
  } catch (err) {
    return { storageMode: 'client', serverBase: '' };
  }
})();

function isServerMode() {
  return RUNTIME_CONFIG.storageMode === 'server';
}

function buildServerAssetUrl(projectIdValue, assetId) {
  if (!projectIdValue || !assetId) return '';
  const base = RUNTIME_CONFIG.serverBase || '';
  return `${base}/api/projects/${encodeURIComponent(projectIdValue)}/assets/${encodeURIComponent(assetId)}`;
}

async function hydrateMediaNodes(activeProjectId) {
  if (!view?.graph) return;
  const updates = [];
  view.graph.nodes.forEach((node) => {
    if (!node?.data?.assetId) return;
    const src = buildServerAssetUrl(activeProjectId, node.data.assetId);
    if (!src || node.data.src === src) return;
    updates.push({
      id: node.id,
      data: { ...node.data, src }
    });
  });
  if (updates.length) {
    updates.forEach((entry) => view.updateNode(entry.id, { data: entry.data }));
  }
}

function fitContentToView() {
  if (!view?.graph || !view.graph.nodes.length || !view.canvas) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  view.graph.nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  });
  const rect = view.canvas.getBoundingClientRect();
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padding = 64;
  const scale = Math.min(
    (rect.width - padding * 2) / width,
    (rect.height - padding * 2) / height
  );
  view.camera.s = Math.min(view.maxZoom || 2.5, Math.max(view.minZoom || 0.3, scale));
  view.camera.x = rect.width / 2 - (minX + width / 2) * view.camera.s;
  view.camera.y = rect.height / 2 - (minY + height / 2) * view.camera.s;
  if (typeof view._invalidate === 'function') view._invalidate();
}

function setReadOnly() {
  if (!view) return;
  if (typeof view.setReadOnly === 'function') {
    view.setReadOnly(true);
    return;
  }
  if (typeof view.setEditMode === 'function') {
    view.setEditMode(false);
    return;
  }
  if (view.options && typeof view.options === 'object') {
    view.options.readOnly = true;
  }
}

function clampZoom(value) {
  const min = Number.isFinite(view?.minZoom) ? view.minZoom : 0.3;
  const max = Number.isFinite(view?.maxZoom) ? view.maxZoom : 2.5;
  return Math.min(max, Math.max(min, value));
}

function zoomBy(factor) {
  if (!view?.canvas) return;
  const rect = view.canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const currentScale = Number.isFinite(view.camera?.s) ? view.camera.s : 1;
  const worldX = (centerX - view.camera.x) / currentScale;
  const worldY = (centerY - view.camera.y) / currentScale;
  const nextScale = clampZoom(currentScale * factor);
  view.camera.s = nextScale;
  view.camera.x = centerX - worldX * nextScale;
  view.camera.y = centerY - worldY * nextScale;
  if (typeof view._invalidate === 'function') view._invalidate();
}

function panBy(dx, dy) {
  if (!view?.camera) return;
  view.camera.x += dx;
  view.camera.y += dy;
  if (typeof view._invalidate === 'function') view._invalidate();
}

function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

function armNavFocus() {
  navFocusArmed = true;
  if (navFocusTimer) window.clearTimeout(navFocusTimer);
  navFocusTimer = window.setTimeout(() => {
    navFocusArmed = false;
    navFocusTimer = null;
  }, 350);
}

function focusSelectionIfNavigating(node) {
  if (!node || !navFocusArmed) return;
  navFocusArmed = false;
  if (typeof view.moveTo === 'function') {
    view.moveTo(node.id);
    return;
  }
  if (typeof view.focusNode === 'function') {
    view.focusNode(node.id);
  }
}

function registerComponents() {
  view.registerComponent('OptionPicker', { render: OptionPicker });
  view.registerComponent('TextInput', { render: TextInput });
  view.registerComponent('DateTimeInput', { render: DateTimeInput });
  view.registerComponent('SliderInput', { render: SliderInput });
  view.registerComponent('MultiChoice', { render: MultiChoice });
  view.registerComponent('CodeSnippet', { render: CodeSnippet });
  view.registerComponent('ImageViewer', { render: ImageViewer });
  view.registerComponent('VideoPlayer', { render: VideoPlayer });
  view.registerComponent('AudioPlayer', { render: AudioPlayer });
  view.registerComponent('LineChart', { render: LineChart });
  view.registerComponent('AreaChart', { render: AreaChart });
  view.registerComponent('BarChart', { render: BarChart });
  view.registerComponent('ScatterChart', { render: ScatterChart });
  view.registerComponent('HeatmapChart', { render: HeatmapChart });
  view.registerComponent('RadarChart', { render: RadarChart });
  view.registerComponent('SparklineChart', { render: SparklineChart });
  view.registerComponent('MarkdownBlock', { render: MarkdownBlock });
  view.registerComponent('SvgBlock', { render: SvgBlock });
  view.registerComponent('MermaidBlock', { render: MermaidBlock });
  view.registerComponent('HtmlPreview', { render: HtmlPreview });
}

async function loadBoard() {
  if (!projectId || !boardId) {
    setStatus('Missing projectId or boardId in URL.', true);
    return;
  }
  if (!isServerMode()) {
    setStatus('Embeds require server runtime mode.', true);
    return;
  }
  setStatus('Loading board...');
  const base = RUNTIME_CONFIG.serverBase || '';
  const url = `${base}/api/projects/${encodeURIComponent(projectId)}/boards/${encodeURIComponent(boardId)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      setStatus('Board not found.', true);
      return;
    }
    const payload = await response.json();
    const board = payload?.board;
    if (!board) {
      setStatus('Board not found.', true);
      return;
    }
    workspace.clear();
    view.importGraph(board, { makeActive: true });
    await hydrateMediaNodes(projectId);
    window.requestAnimationFrame(() => fitContentToView());
    setStatus('');
  } catch (err) {
    setStatus('Failed to load board.', true);
  }
}

applyBackgroundParam();

const workspace = new ElenweaveWorkspace();
const view = new ElenweaveView({
  canvas,
  workspace,
  options: {
    gridSize: 0,
    virtualizeEdges: true,
    sanitizeHtml: false,
    sanitizeSvg: true
  }
});

const ewNavigator = ElenweaveNavigator ? new ElenweaveNavigator(view) : null;
if (ewNavigator?.bindKeyboard) {
  ewNavigator.bindKeyboard();
}

registerComponents();
setReadOnly();
setTheme(getCurrentTheme());
void loadBoard();

view.on('selection', (node) => {
  selectedNodeId = node?.id || null;
  if (node) {
    focusSelectionIfNavigating(node);
  }
});

window.addEventListener('keydown', (event) => {
  if (isEditableElement(event.target)) return;
  if (!NAV_KEYS.has(event.key)) return;
  if (selectedNodeId) {
    event.preventDefault();
  }
  armNavFocus();
}, true);

const panStep = 80;
embedZoomIn?.addEventListener('click', () => zoomBy(1.2));
embedZoomOut?.addEventListener('click', () => zoomBy(1 / 1.2));
embedFit?.addEventListener('click', () => fitContentToView());
embedThemeToggle?.addEventListener('click', () => toggleTheme());
embedCenter?.addEventListener('click', () => fitContentToView());
embedPanUp?.addEventListener('click', () => panBy(0, panStep));
embedPanDown?.addEventListener('click', () => panBy(0, -panStep));
embedPanLeft?.addEventListener('click', () => panBy(panStep, 0));
embedPanRight?.addEventListener('click', () => panBy(-panStep, 0));
