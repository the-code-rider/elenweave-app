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
import {
  callOpenAI,
  callOpenAIMultimodal,
  callOpenAITranscription,
  callGemini,
  callGeminiMultimodal
} from './llm_clients.js';
import { createRealtimeAgent } from './realtime_audio.js';

const { ElenweaveWorkspace, ElenweaveView, ElenweaveNavigator } = window.Elenweave || {};
if (!ElenweaveWorkspace || !ElenweaveView) {
  throw new Error('Elenweave CDN is not loaded.');
}

const els = {
  projectSelect: document.getElementById('projectSelect'),
  projectSelectWrap: document.querySelector('.project-select-wrap'),
  btnNewProject: document.getElementById('btnNewProject'),
  btnRenameProject: document.getElementById('btnRenameProject'),
  boardList: document.getElementById('boardList'),
  // btnRename: document.getElementById('btnRename'),
  // btnPrev: document.getElementById('btnPrev'),
  // btnNext: document.getElementById('btnNext'),
  btnLink: document.getElementById('btnLink'),
  btnExport: document.getElementById('btnExport'),
  btnFooterDownload: document.getElementById('btnFooterDownload'),
  btnImport: document.getElementById('btnImport'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsPanel: document.getElementById('settingsPanel'),
  settingsClose: document.getElementById('settingsClose'),
  deleteBoardModal: document.getElementById('deleteBoardModal'),
  deleteBoardClose: document.getElementById('deleteBoardClose'),
  deleteBoardCancel: document.getElementById('deleteBoardCancel'),
  deleteBoardConfirm: document.getElementById('deleteBoardConfirm'),
  deleteBoardMessage: document.getElementById('deleteBoardMessage'),
  downloadOverlay: document.getElementById('downloadOverlay'),
  downloadClose: document.getElementById('downloadClose'),
  downloadSearch: document.getElementById('downloadSearch'),
  downloadGrid: document.getElementById('downloadGrid'),
  importFile: document.getElementById('importFile'),
  btnNew: document.getElementById('btnNew'),
  btnSortBoards: document.getElementById('btnSortBoards'),
  btnShareBoard: document.getElementById('btnShareBoard'),
  btnShareLink: document.getElementById('btnShareLink'),
  btnDeleteBoard: document.getElementById('btnDeleteBoard'),
  componentPicker: document.getElementById('componentPicker'),
  inputBar: document.getElementById('inputBar'),
  inputFields: document.getElementById('inputFields'),
  nodeFields: document.getElementById('nodeFields'),
  metaGroup: document.getElementById('metaGroup'),
  assetGroup: document.getElementById('assetGroup'),
  assetFields: document.getElementById('assetFields'),
  assetActions: document.querySelector('.asset-actions'),
  edgeFields: document.getElementById('edgeFields'),
  edgeLabelInput: document.getElementById('edgeLabelInput'),
  edgeLabelBtn: document.getElementById('edgeLabelBtn'),
  recordBtn: document.getElementById('recordBtn'),
  sendBtn: document.getElementById('sendBtn'),
  status: document.getElementById('status'),
  themeToggle: document.getElementById('themeToggle'),
  edgeToggle: document.getElementById('edgeToggle'),
  panelToggle: document.getElementById('panelToggle'),
  panelExpand: document.getElementById('panelExpand'),
  hintCenter: document.getElementById('hintCenter'),
  hintToggle: document.getElementById('hintToggle'),
  btnModelMatrix: document.getElementById('btnModelMatrix'),
  modelModal: document.getElementById('modelModal'),
  modelModalClose: document.getElementById('modelModalClose'),
  providerSelect: document.getElementById('providerSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  apiKeySave: document.getElementById('apiKeySave'),
  apiKeyClear: document.getElementById('apiKeyClear'),
  apiKeyNote: document.getElementById('apiKeyNote'),
  modelInput: document.getElementById('modelInput'),
  modelNote: document.getElementById('modelNote'),
  modelInputGeneral: document.getElementById('modelInputGeneral'),
  modelNoteGeneral: document.getElementById('modelNoteGeneral'),
  modelInputAppGen: document.getElementById('modelInputAppGen'),
  modelNoteAppGen: document.getElementById('modelNoteAppGen'),
  modelInputCodeExplain: document.getElementById('modelInputCodeExplain'),
  modelNoteCodeExplain: document.getElementById('modelNoteCodeExplain'),
  btnRealtime: document.getElementById('btnRealtime'),
  desktopSettingsGroup: document.getElementById('desktopSettingsGroup'),
  desktopRuntimeInfo: document.getElementById('desktopRuntimeInfo'),
  desktopPortInput: document.getElementById('desktopPortInput'),
  desktopDataDirInput: document.getElementById('desktopDataDirInput'),
  desktopConfigPathInput: document.getElementById('desktopConfigPathInput'),
  desktopAiConfigPathInput: document.getElementById('desktopAiConfigPathInput'),
  desktopSaveConfig: document.getElementById('desktopSaveConfig'),
  desktopRestartServer: document.getElementById('desktopRestartServer'),
  desktopOpenDataDir: document.getElementById('desktopOpenDataDir'),
  desktopOpenConfigFile: document.getElementById('desktopOpenConfigFile'),
  embedModal: document.getElementById('embedModal'),
  embedClose: document.getElementById('embedClose'),
  embedThemeSelect: document.getElementById('embedThemeSelect'),
  embedLinkInput: document.getElementById('embedLinkInput'),
  embedCopyBtn: document.getElementById('embedCopyBtn'),
  embedNote: document.getElementById('embedNote')
};

const appShell = document.querySelector('.app-shell');
const DESKTOP_BRIDGE = window.elenweaveDesktop && typeof window.elenweaveDesktop === 'object'
  ? window.elenweaveDesktop
  : null;
const THEME_ORDER = ['light', 'dark', 'blueprint'];
const EDGE_STYLE_ORDER = ['straight', 'curved'];
const BOARD_SORT_ORDER = ['desc', 'asc'];
const PANEL_STATE_KEY = 'elenweave_app_panel_collapsed';
const HINT_STATE_KEY = 'elenweave_app_hint_collapsed';
const EDGE_STYLE_KEY = 'elenweave_app_edge_style';
const BOARD_SORT_KEY = 'elenweave_board_sort_order';
const AI_PROVIDER_KEY = 'elenweave_ai_provider';
const AI_KEY_PREFIX = 'elenweave_ai_key_';
const AI_MODEL_PREFIX = 'elenweave_ai_model_';
const AI_TASK_MODEL_PREFIX = 'elenweave_ai_model_';
const AI_TASK_KEYS = ['general', 'appGen', 'codeExplain'];
const AI_DEFAULT_MODELS = {
  openai: 'gpt-5-mini',
  gemini: 'gemini-3-flash-preview'
};
const AI_TRANSCRIBE_MODEL = 'whisper-1';
const AI_ACTIONS_VERSION = 'ew-actions/v1';
const AI_HISTORY_KEY = 'aiHistory';
const AI_HISTORY_LIMIT = 4;
const AI_HISTORY_TEXT_LIMIT = 1200;
const AI_ATTACHMENT_TEXT_LIMIT = 8000;
const LARGE_TEXT_ASSET_BYTES = 200 * 1024;
const TEXT_PREVIEW_BYTES = 12000;
const REALTIME_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const ACTIVE_BOARD_KEY_LEGACY = 'elenweave_active_board';
const ACTIVE_BOARD_KEY_PREFIX = 'elenweave_active_board::';
const ACTIVE_PROJECT_KEY = 'elenweave_active_project';
const LOCAL_FORK_ACTIVE_KEY = 'elenweave_local_fork_active';
const RUNTIME_CONFIG = (() => {
  try {
    const raw = window.__ELENWEAVE_RUNTIME__;
    if (!raw || typeof raw !== 'object') {
      return {
        storageMode: 'client',
        serverBase: '',
        seedReadOnlyMode: 'off',
        seedReadOnlyProjectIds: [],
        readOnlyFork: 'local',
        publicProjectsCatalogUrl: ''
      };
    }
    const storageMode = raw.storageMode === 'server' ? 'server' : 'client';
    const serverBase = storageMode === 'server'
      ? String(raw.serverBase || '').replace(/\/+$/, '')
      : '';
    const seedReadOnlyMode = raw.seedReadOnlyMode === 'all' || raw.seedReadOnlyMode === 'projects'
      ? raw.seedReadOnlyMode
      : 'off';
    const seedReadOnlyProjectIds = Array.isArray(raw.seedReadOnlyProjectIds)
      ? raw.seedReadOnlyProjectIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const readOnlyFork = raw.readOnlyFork === 'off' ? 'off' : 'local';
    const publicProjectsCatalogUrl = typeof raw.publicProjectsCatalogUrl === 'string'
      ? raw.publicProjectsCatalogUrl.trim()
      : '';
    return {
      storageMode,
      serverBase,
      seedReadOnlyMode,
      seedReadOnlyProjectIds,
      readOnlyFork,
      publicProjectsCatalogUrl
    };
  } catch (err) {
    return {
      storageMode: 'client',
      serverBase: '',
      seedReadOnlyMode: 'off',
      seedReadOnlyProjectIds: [],
      readOnlyFork: 'local',
      publicProjectsCatalogUrl: ''
    };
  }
})();
const SERVER_BASE = RUNTIME_CONFIG.serverBase;
const IS_SERVER_MODE = RUNTIME_CONFIG.storageMode === 'server';
const SEED_READ_ONLY_MODE = RUNTIME_CONFIG.seedReadOnlyMode || 'off';
const SEED_READ_ONLY_PROJECTS = new Set(RUNTIME_CONFIG.seedReadOnlyProjectIds || []);
const READ_ONLY_FORK_MODE = RUNTIME_CONFIG.readOnlyFork || 'local';
const PUBLIC_CATALOG_URL = RUNTIME_CONFIG.publicProjectsCatalogUrl || '';

const workspace = new ElenweaveWorkspace();
const view = new ElenweaveView({
  canvas: document.getElementById('ew-canvas'),
  workspace,
  options: {
    gridSize: 0,
    virtualizeEdges: true,
    sanitizeHtml: false,
    sanitizeSvg: true
  }
});
const ewNavigator = new ElenweaveNavigator(view);
ewNavigator.bindKeyboard();
patchNavigatorCenter();

const canvasShell = document.querySelector('.canvas-shell');

function activeBoardKeyForProject(projectId) {
  if (!projectId) return '';
  return `${ACTIVE_BOARD_KEY_PREFIX}${projectId}`;
}

function loadLegacyActiveBoardId() {
  try {
    const value = localStorage.getItem(ACTIVE_BOARD_KEY_LEGACY);
    return value || null;
  } catch (err) {
    return null;
  }
}

function loadActiveBoardIdForProject(projectId) {
  if (!projectId) return null;
  try {
    const scoped = localStorage.getItem(activeBoardKeyForProject(projectId));
    if (scoped) return scoped;
  } catch (err) {
    return null;
  }
  return loadLegacyActiveBoardId();
}

function loadActiveProjectId() {
  try {
    const value = localStorage.getItem(ACTIVE_PROJECT_KEY);
    return value || null;
  } catch (err) {
    return null;
  }
}

function saveActiveBoardIdForProject(projectId, boardId) {
  if (!projectId) return;
  const scopedKey = activeBoardKeyForProject(projectId);
  try {
    if (!boardId) {
      localStorage.removeItem(scopedKey);
      return;
    }
    localStorage.setItem(scopedKey, boardId);
    localStorage.removeItem(ACTIVE_BOARD_KEY_LEGACY);
  } catch (err) {
    return;
  }
}

function saveActiveProjectId(projectId) {
  try {
    if (!projectId) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } catch (err) {
    return;
  }
}

function loadLocalForkMode() {
  try {
    return localStorage.getItem(LOCAL_FORK_ACTIVE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

function saveLocalForkMode(value) {
  try {
    if (!value) {
      localStorage.removeItem(LOCAL_FORK_ACTIVE_KEY);
      return;
    }
    localStorage.setItem(LOCAL_FORK_ACTIVE_KEY, 'true');
  } catch (err) {
    return;
  }
}

function isRuntimeReadOnlyProject(projectId) {
  if (SEED_READ_ONLY_MODE === 'all') return true;
  if (SEED_READ_ONLY_MODE !== 'projects') return false;
  if (!projectId) return false;
  return SEED_READ_ONLY_PROJECTS.has(projectId);
}

function shouldForkLocally(projectId) {
  if (!IS_SERVER_MODE) return false;
  if (READ_ONLY_FORK_MODE !== 'local') return false;
  return isRuntimeReadOnlyProject(projectId || activeProjectId);
}

let forceClientMode = IS_SERVER_MODE && READ_ONLY_FORK_MODE === 'local' && loadLocalForkMode();
let localForkNoticeShown = false;

async function ensureServerMode() {
  if (!IS_SERVER_MODE || forceClientMode) return false;
  if (shouldForkLocally(activeProjectId)) {
    await activateLocalForkMode({
      projectId: activeProjectId,
      reason: 'Read-only hosted data.'
    });
    return false;
  }
  return true;
}

async function apiFetch(path, options = {}) {
  if (!IS_SERVER_MODE || forceClientMode) throw new Error('Server API is disabled in client storage mode.');
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${SERVER_BASE}${path}`, {
    ...options,
    headers,
    body
  });
  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (err) {
      payload = null;
    }
    const error = new Error(
      (payload && typeof payload.message === 'string' && payload.message)
      || rawText
      || `Request failed (${response.status}).`
    );
    error.status = response.status;
    error.code = payload?.error || '';
    error.payload = payload;
    if (error.status === 403 && error.code === 'ReadOnlySeed') {
      const targetProjectId = payload?.projectId || activeProjectId || '';
      if (READ_ONLY_FORK_MODE === 'local') {
        try {
          const switched = await activateLocalForkMode({
            projectId: targetProjectId,
            reason: payload?.message || 'Read-only seed.'
          });
          error.forkedToLocal = Boolean(switched);
        } catch (forkErr) {
          console.warn('Local fork activation failed', forkErr);
        }
      }
    }
    throw error;
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function hasServerAiProvider(provider) {
  if (!provider) return false;
  return serverAiProviders.has(provider);
}

function resolveAiProxyBaseUrl(provider) {
  if (!IS_SERVER_MODE) return null;
  if (!hasServerAiProvider(provider)) return null;
  return SERVER_BASE || '';
}

async function refreshServerAiProviders() {
  serverAiProviders = new Set();
  serverAiDefaultModels = new Map();
  serverAiTaskModels = new Map();
  if (!IS_SERVER_MODE) return;
  try {
    const payload = await apiFetch('/api/ai/providers');
    const providers = Array.isArray(payload?.providers) ? payload.providers : [];
    providers.forEach((provider) => {
      if (provider === 'openai' || provider === 'gemini') {
        serverAiProviders.add(provider);
      }
    });
    const defaultModels = payload?.defaultModels && typeof payload.defaultModels === 'object'
      ? payload.defaultModels
      : {};
    Object.entries(defaultModels).forEach(([provider, value]) => {
      if (provider !== 'openai' && provider !== 'gemini') return;
      const model = String(value || '').trim();
      if (model) {
        serverAiDefaultModels.set(provider, model);
      }
    });
    const taskModels = payload?.taskModels && typeof payload.taskModels === 'object'
      ? payload.taskModels
      : {};
    Object.entries(taskModels).forEach(([provider, value]) => {
      if (provider !== 'openai' && provider !== 'gemini') return;
      if (!value || typeof value !== 'object') return;
      const general = String(value.general || '').trim();
      const appGen = String(value.appGen || '').trim();
      const codeExplain = String(value.codeExplain || '').trim();
      const entry = {};
      if (general) entry.general = general;
      if (appGen) entry.appGen = appGen;
      if (codeExplain) entry.codeExplain = codeExplain;
      if (Object.keys(entry).length) {
        serverAiTaskModels.set(provider, entry);
      }
    });
  } catch (err) {
    serverAiProviders = new Set();
    serverAiDefaultModels = new Map();
    serverAiTaskModels = new Map();
  }
}

let selectedNodeId = null;
let selectedEdgeId = null;
let aiContextNodeIds = new Set();
let statusTimer = null;
let currentForm = null;
let currentComponentKey = null;
let activeBoardEdit = null;
let activeProjectEdit = null;
let resizeSnapshot = null;
let dragSnapshot = null;
let realtimeAgent = null;
let realtimeEnabled = false;
let realtimeState = { listening: false, speaking: false, capturing: false };
let realtimeTurnNodes = new Map();
let realtimeAudioStatusAt = 0;
let aiRequestPending = false;
let navFocusArmed = false;
let navFocusTimer = null;
let serverAiProviders = new Set();
let serverAiDefaultModels = new Map();
let serverAiTaskModels = new Map();
let htmlPreviewResizeSession = null;
let lastSelectedNodeEl = null;
let desktopRuntimeInfo = null;
let desktopSettingsBusy = false;
let pendingDeleteBoard = null;
let nodeContextMenu = {
  el: null,
  nodeId: null,
  open: false
};
let projectPollTimer = null;
const PROJECT_POLL_INTERVAL_MS = 10000;

const AI_FOLLOW_UP_COMPONENTS = new Set(['TextInput', 'OptionPicker']);
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

const COMPONENT_CONFIG = [
  {
    key: 'AI',
    label: 'AI',
    uiOnly: true,
    fields: [
      { key: 'prompt', label: 'Message', type: 'textarea', placeholder: 'Cast your spell.....' },
      { key: 'media', label: 'Upload', type: 'file', accept: 'image/*,audio/*,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.webm,.md,.markdown,.txt,.csv,.js,.ts,.json,.html,.css,.py,.java,.rb,.go,.rs,.c,.cpp,.sh', note: 'ai-asset', assetLabel: 'file', assetMeta: 'Image, audio, or text/code' }
    ]
  },
  {
    key: 'HtmlText',
    label: 'Editable Text',
    nodeType: 'html-text',
    size: { w: 320, h: 160 },
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', placeholder: 'Editable text' }
    ]
  },
  {
    key: 'HtmlPreview',
    label: 'HTML Preview',
    component: 'HtmlPreview',
    size: { w: 480, h: 320 },
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'HTML Preview' },
      { key: 'html', label: 'HTML', type: 'textarea', placeholder: 'Paste HTML here. Use CodeSnippet to store/edit source.' }
    ]
  },
  {
    key: 'OptionPicker',
    label: 'Option Picker',
    component: 'OptionPicker',
    size: { w: 320, h: 160 },
    fields: [
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Select one' },
      { key: 'options', label: 'Options', type: 'text', placeholder: 'Alpha, Beta, Gamma' },
      { key: 'choice', label: 'Selected', type: 'text', placeholder: 'Alpha' }
    ]
  },
  {
    key: 'TextInput',
    label: 'Text Input',
    component: 'TextInput',
    size: { w: 320, h: 160 },
    fields: [
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Enter text' },
      { key: 'value', label: 'Value', type: 'text', placeholder: 'Sample text' }
    ]
  },
  {
    key: 'DateTimeInput',
    label: 'Datetime',
    component: 'DateTimeInput',
    size: { w: 320, h: 160 },
    fields: [
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Select date/time' },
      { key: 'value', label: 'Value', type: 'datetime-local' }
    ]
  },
  {
    key: 'SliderInput',
    label: 'Slider Input',
    component: 'SliderInput',
    size: { w: 320, h: 160 },
    fields: [
      { key: 'label', label: 'Label', type: 'text', placeholder: 'Gain level' },
      { key: 'min', label: 'Min', type: 'number', placeholder: '0' },
      { key: 'max', label: 'Max', type: 'number', placeholder: '10' },
      { key: 'value', label: 'Value', type: 'number', placeholder: '6' }
    ]
  },
  {
    key: 'MultiChoice',
    label: 'Multiple Choice',
    component: 'MultiChoice',
    size: { w: 320, h: 190 },
    fields: [
      { key: 'options', label: 'Options', type: 'text', placeholder: 'Alpha, Beta, Gamma' },
      { key: 'selected', label: 'Selected', type: 'text', placeholder: 'Alpha' }
    ]
  },
  {
    key: 'CodeSnippet',
    label: 'Code Snippet',
    component: 'CodeSnippet',
    size: { w: 360, h: 440 },
    fields: [
      { key: 'files', label: 'Files', type: 'file', accept: '.js,.ts,.json,.html,.css,.py,.txt,.md', multiple: true, note: 'files' },
      { key: 'code', label: 'Code', type: 'textarea', placeholder: '// Paste code here' }
    ]
  },
  {
    key: 'SvgBlock',
    label: 'SVG Diagram',
    component: 'SvgBlock',
    size: { w: 380, h: 260 },
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'SVG Diagram' },
      { key: 'svg', label: 'SVG Markup', type: 'textarea', placeholder: '<svg viewBox=\"0 0 100 100\">...</svg>' },
      { key: 'file', label: 'SVG File', type: 'file', accept: '.svg,image/svg+xml', note: 'asset', assetLabel: 'SVG', assetMeta: 'Optional .svg upload to fill markup' }
    ]
  },
  {
    key: 'MermaidBlock',
    label: 'Mermaid Diagram',
    component: 'MermaidBlock',
    size: { w: 640, h: 420 },
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Mermaid Diagram' },
      { key: 'mermaid', label: 'Mermaid Source', type: 'textarea', placeholder: 'flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| D[Retry]' }
    ]
  },
  {
    key: 'ImageViewer',
    label: 'Image Viewer',
    component: 'ImageViewer',
    size: { w: 320, h: 200 },
    assetType: 'image',
    fields: [
      { key: 'file', label: 'Image', type: 'file', accept: 'image/*', note: 'asset' }
    ]
  },
  {
    key: 'VideoPlayer',
    label: 'Video Player',
    component: 'VideoPlayer',
    size: { w: 320, h: 210 },
    assetType: 'video',
    fields: [
      { key: 'file', label: 'Video', type: 'file', accept: 'video/*', note: 'asset' }
    ]
  },
  {
    key: 'AudioPlayer',
    label: 'Audio Player',
    component: 'AudioPlayer',
    size: { w: 320, h: 160 },
    assetType: 'audio',
    fields: [
      { key: 'file', label: 'Audio', type: 'file', accept: 'audio/*', note: 'asset' }
    ]
  }
];

COMPONENT_CONFIG.sort((a, b) => {
  if (a.key === 'AI') return -1;
  if (b.key === 'AI') return 1;
  const aLabel = String(a.label || a.key || '').toLowerCase();
  const bLabel = String(b.label || b.key || '').toLowerCase();
  return aLabel.localeCompare(bLabel);
});

const COMPONENT_LOOKUP = new Map(COMPONENT_CONFIG.map((entry) => [entry.key, entry]));
const CHART_COMPONENT_SPECS = [
  {
    key: 'LineChart',
    type: 'html',
    component: 'LineChart',
    size: { w: 380, h: 240 },
    props: {
      title: 'string',
      labels: ['string'],
      legend: 'boolean',
      showPoints: 'boolean',
      palette: ['string'],
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    },
    data: {
      series: [{ name: 'string', values: ['number'], points: [{ x: 'number', y: 'number' }], color: 'string' }],
      values: ['number'],
      points: [{ x: 'number', y: 'number' }],
      labels: ['string'],
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    }
  },
  {
    key: 'AreaChart',
    type: 'html',
    component: 'AreaChart',
    size: { w: 380, h: 240 },
    props: {
      title: 'string',
      labels: ['string'],
      legend: 'boolean',
      palette: ['string'],
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    },
    data: {
      series: [{ name: 'string', values: ['number'], points: [{ x: 'number', y: 'number' }], color: 'string' }],
      values: ['number'],
      points: [{ x: 'number', y: 'number' }],
      labels: ['string'],
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    }
  },
  {
    key: 'BarChart',
    type: 'html',
    component: 'BarChart',
    size: { w: 380, h: 240 },
    props: {
      title: 'string',
      labels: ['string'],
      legend: 'boolean',
      palette: ['string'],
      stacked: 'boolean'
    },
    data: {
      series: [{ name: 'string', values: ['number'], color: 'string' }],
      labels: ['string'],
      stacked: 'boolean'
    }
  },
  {
    key: 'ScatterChart',
    type: 'html',
    component: 'ScatterChart',
    size: { w: 380, h: 240 },
    props: {
      title: 'string',
      legend: 'boolean',
      palette: ['string'],
      radius: 'number',
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    },
    data: {
      series: [{ name: 'string', points: [{ x: 'number', y: 'number' }], color: 'string' }],
      radius: 'number',
      minX: 'number',
      maxX: 'number',
      minY: 'number',
      maxY: 'number'
    }
  },
  {
    key: 'HeatmapChart',
    type: 'html',
    component: 'HeatmapChart',
    size: { w: 360, h: 240 },
    props: {
      title: 'string',
      xLabels: ['string'],
      yLabels: ['string'],
      palette: ['string'],
      min: 'number',
      max: 'number'
    },
    data: {
      matrix: [['number']],
      xLabels: ['string'],
      yLabels: ['string'],
      min: 'number',
      max: 'number'
    }
  },
  {
    key: 'RadarChart',
    type: 'html',
    component: 'RadarChart',
    size: { w: 320, h: 280 },
    props: {
      title: 'string',
      axes: ['string'],
      legend: 'boolean',
      palette: ['string'],
      max: 'number'
    },
    data: {
      series: [{ name: 'string', values: ['number'], color: 'string' }],
      axes: ['string'],
      max: 'number'
    }
  },
  {
    key: 'SparklineChart',
    type: 'html',
    component: 'SparklineChart',
    size: { w: 320, h: 180 },
    props: {
      title: 'string',
      label: 'string',
      palette: ['string'],
      color: 'string',
      maxY: 'number'
    },
    data: {
      values: ['number'],
      color: 'string',
      maxY: 'number'
    }
  }
];
const AI_COMPONENT_SIZES = new Map(CHART_COMPONENT_SPECS.map((spec) => [spec.key, spec.size]));
AI_COMPONENT_SIZES.set('MarkdownBlock', { w: 360, h: 240 });
AI_COMPONENT_SIZES.set('SvgBlock', { w: 380, h: 260 });
AI_COMPONENT_SIZES.set('MermaidBlock', { w: 640, h: 420 });
AI_COMPONENT_SIZES.set('HtmlPreview', { w: 480, h: 320 });
const ASSET_URLS = new Map();

const DB_NAME = 'elenweave_assets';
const DB_STORE = 'assets';
const WORKSPACE_STORE = 'workspace';
const WORKSPACE_INDEX_KEY = 'workspace_index';
const WORKSPACE_GRAPH_PREFIX = 'graph_';
const WORKSPACE_LEGACY_KEY = 'current';
const DB_VERSION = 2;

let recorder = null;
let recordStream = null;
let recordChunks = [];
let projectIndex = [];
let activeProjectId = null;
let boardIndex = [];
let boardSortOrder = loadBoardSortOrder();
let activeBoardId = null;
let isBoardSwitching = false;
let isBoardDeleting = false;
let projectSwitchSeq = 0;
let projectSwitchDepth = 0;
let publicCatalogProjects = [];
let publicCatalogStatus = 'idle';
let publicCatalogError = '';
let publicCatalogLoadedAt = 0;

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

initComponentSelect();
applyContextMenuConfig();
initApp();

// els.btnRename.addEventListener('click', () => {
//   const graph = workspace.getGraph(workspace.activeGraphId);
//   if (!graph) return;
//   const btn = els.boardList.querySelector(`[data-board-id="${graph.id}"]`);
//   if (btn) {
//     startBoardEdit(btn, graph);
//   }
// });

// els.btnPrev.addEventListener('click', () => cycleBoard(-1));
// els.btnNext.addEventListener('click', () => cycleBoard(1));

els.btnNew.addEventListener('click', () => {
  createBoard();
});

els.btnSortBoards?.addEventListener('click', () => {
  boardSortOrder = boardSortOrder === 'desc' ? 'asc' : 'desc';
  saveBoardSortOrder(boardSortOrder);
  sortActiveProjectBoardsByTime(boardSortOrder);
  updateBoardSortButton();
  refreshBoardList();
  setStatus(boardSortOrder === 'desc' ? 'Boards sorted by newest updated.' : 'Boards sorted by oldest updated.', 1200);
});

els.btnDeleteBoard?.addEventListener('click', () => {
  requestDeleteActiveBoard();
});

els.btnNewProject?.addEventListener('click', () => {
  const nextIndex = projectIndex.length + 1;
  createProject(`Project ${nextIndex}`);
});

els.btnRenameProject?.addEventListener('click', () => {
  startProjectEdit();
});

els.projectSelect?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const projectId = target.value;
  if (!projectId || projectId === activeProjectId) return;
  activateProject(projectId);
});

els.projectSelect?.addEventListener('dblclick', () => {
  startProjectEdit();
});

els.btnLink.addEventListener('click', () => {
  view.setLinkMode(!view.linkMode);
  updateLinkModeButton();
  setStatus(view.linkMode ? 'Link mode on.' : 'Link mode off.');
});

els.edgeToggle?.addEventListener('click', () => {
  const current = view.edgeStyle || 'straight';
  const next = EDGE_STYLE_ORDER[(EDGE_STYLE_ORDER.indexOf(current) + 1) % EDGE_STYLE_ORDER.length];
  setEdgeStyle(next);
  if (next === 'curved' && typeof view.setEdgeCurvature === 'function') {
    view.setEdgeCurvature(Number.isFinite(view.edgeCurvature) ? view.edgeCurvature : 0.18);
  }
  updateEdgeToggle();
  saveEdgeStyle(next);
  setStatus(`Edges: ${next}.`, 1200);
});

els.btnExport.addEventListener('click', () => exportBoard());
els.btnFooterDownload?.addEventListener('click', () => setDownloadPanelOpen(true));
els.btnImport.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', (e) => handleImportFile(e));
els.btnShareBoard?.addEventListener('click', () => setEmbedModalOpen(true));
els.btnShareLink?.addEventListener('click', () => {
  void copyAppLink();
});
els.deleteBoardClose?.addEventListener('click', () => setDeleteBoardModalOpen(false));
els.deleteBoardCancel?.addEventListener('click', () => setDeleteBoardModalOpen(false));
els.deleteBoardConfirm?.addEventListener('click', () => {
  void confirmDeleteBoard();
});
els.deleteBoardModal?.addEventListener('click', (event) => {
  if (event.target === els.deleteBoardModal) {
    setDeleteBoardModalOpen(false);
  }
});
els.embedClose?.addEventListener('click', () => setEmbedModalOpen(false));
els.embedModal?.addEventListener('click', (event) => {
  if (event.target === els.embedModal) {
    setEmbedModalOpen(false);
  }
});
els.embedThemeSelect?.addEventListener('change', () => updateEmbedPanel());
els.embedCopyBtn?.addEventListener('click', () => copyEmbedLink());
els.downloadClose?.addEventListener('click', () => setDownloadPanelOpen(false));
els.downloadOverlay?.addEventListener('click', (event) => {
  if (!event.target || !(event.target instanceof HTMLElement)) return;
  if (event.target.dataset.downloadClose === 'true') {
    setDownloadPanelOpen(false);
  }
});
els.downloadSearch?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  renderDownloadPanel(target.value);
});

els.componentPicker.addEventListener('change', (e) => {
  const key = e.target.value;
  const prevKey = currentComponentKey;
  const config = COMPONENT_LOOKUP.get(key);
  currentComponentKey = key;
  if (prevKey === 'AI' || key === 'AI') {
    resetAiContext();
  }
  renderForm(config, null);
  updateSendButton();
  updateRecordButton();
});

els.sendBtn.addEventListener('click', () => handleSend());
els.recordBtn.addEventListener('click', () => toggleRecording());
if (els.edgeLabelBtn) {
  els.edgeLabelBtn.addEventListener('click', () => applyEdgeLabel());
}
if (els.edgeLabelInput) {
  els.edgeLabelInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    applyEdgeLabel();
  });
}

els.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const idx = THEME_ORDER.indexOf(current);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  setTheme(next);
  saveTheme(next);
});

els.panelToggle?.addEventListener('click', () => {
  if (!appShell) return;
  const collapsed = appShell.classList.toggle('is-collapsed');
  updatePanelToggleState(collapsed);
  saveCollapseState(PANEL_STATE_KEY, collapsed);
});

els.panelExpand?.addEventListener('click', () => {
  if (!appShell) return;
  appShell.classList.remove('is-collapsed');
  updatePanelToggleState(false);
  saveCollapseState(PANEL_STATE_KEY, false);
});

els.settingsToggle?.addEventListener('click', () => {
  const expanded = els.settingsToggle?.getAttribute('aria-expanded') === 'true';
  setSettingsPanelOpen(!expanded);
});

els.settingsClose?.addEventListener('click', () => {
  setSettingsPanelOpen(false);
});
els.desktopSaveConfig?.addEventListener('click', () => {
  void saveDesktopSettings();
});
els.desktopRestartServer?.addEventListener('click', () => {
  void restartDesktopServerFromPanel();
});
els.desktopOpenDataDir?.addEventListener('click', () => {
  void openDesktopDataDirFromPanel();
});
els.desktopOpenConfigFile?.addEventListener('click', () => {
  void openDesktopConfigFileFromPanel();
});

els.hintToggle?.addEventListener('click', () => {
  if (!els.hintCenter) return;
  const collapsed = els.hintCenter.classList.toggle('is-collapsed');
  saveCollapseState(HINT_STATE_KEY, collapsed);
});

els.btnModelMatrix?.addEventListener('click', () => openModelMatrix());
els.modelModalClose?.addEventListener('click', () => closeModelMatrix());
els.modelModal?.addEventListener('click', (event) => {
  if (event.target === els.modelModal) closeModelMatrix();
});
els.providerSelect?.addEventListener('change', () => syncApiKeyInput());
els.apiKeySave?.addEventListener('click', () => saveApiKey());
els.apiKeyClear?.addEventListener('click', () => clearApiKey());

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.modelModal || els.modelModal.hidden) return;
  closeModelMatrix();
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setSettingsPanelOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setDeleteBoardModalOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setDownloadPanelOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setEmbedModalOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeNodeContextMenu();
});
window.addEventListener('keydown', (event) => {
  if (isEditableElement(event.target)) return;
  if (!NAV_KEYS.has(event.key)) return;
  armNavFocus();
}, true);
document.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!isNodeContextMenuTarget(target)) {
    closeNodeContextMenu();
  }
  const htmlTarget = target instanceof HTMLElement ? target : null;
  if (!htmlTarget?.closest?.('.ew-nav-ui')) return;
  armNavFocus();
}, true);
workspace.on('graph:active', (graph) => {
  closeNodeContextMenu();
  selectedNodeId = null;
  selectedEdgeId = null;
  clearSelectedNodeClass();
  realtimeTurnNodes = new Map();
  resetAiContext();
  view.selectNode(null);
  updateEdgeFields(null);
  if (graph?.id) {
    activeBoardId = graph.id;
    const beforeCount = boardIndex.length;
    ensureBoardIndexEntry(graph.id, graph.name || 'Untitled', activeProjectId || 'local-default');
    if (boardIndex.length !== beforeCount) {
      saveWorkspaceIndex().catch((err) => console.warn('Board index save failed', err));
    }
  }
  refreshProjectList();
  refreshBoardList();
  hydrateMediaNodes();
  syncPreviewToggles();
  collapseNotificationPanel();
  if (els.embedModal && !els.embedModal.hidden) {
    updateEmbedPanel();
  }
  window.requestAnimationFrame(() => fitContentToView());
  setStatus(`Active: ${graph.name}`, 1400);
});

view.on('selection', (node) => {
  closeNodeContextMenu();
  selectedNodeId = node?.id || null;
  selectedEdgeId = null;
  syncSelectedNodeClass(node);
  updateEdgeFields(null);
  if (node) {
    focusSelectionIfNavigating(node);
    if (currentComponentKey === 'AI') {
      toggleAiContextNode(node);
    } else {
      syncFormToNode(node);
      setStatus(`Selected ${node.id}`, 1200);
    }
  } else {
    updateSendButton();
  }
});

view.on('edge:selection', (edge) => {
  closeNodeContextMenu();
  selectedEdgeId = edge?.id || null;
  selectedNodeId = null;
  clearSelectedNodeClass();
  updateEdgeFields(edge);
  updateSendButton();
  if (edge) setStatus(`Selected edge ${edge.id}`, 1200);
});

view.on('node:input', ({ field, value }) => {
  if (field) setStatus(`Input: ${field} = ${value}`, 1400);
});

if (view?.canvas) {
  view.canvas.addEventListener('pointerdown', captureResizeStart);
  view.canvas.addEventListener('pointerdown', captureDragStart);
}
if (view?.overlay) {
  view.overlay.addEventListener('contextmenu', (event) => {
    const nodeId = getNodeIdFromEventTarget(event.target);
    if (!nodeId) {
      closeNodeContextMenu();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openNodeContextMenu({
      nodeId,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, true);
  view.overlay.addEventListener('pointerdown', captureResizeStart, true);
  view.overlay.addEventListener('pointerdown', captureDragStart, true);
}
installHtmlPreviewResizeSupport();
window.addEventListener('pointerup', () => {
  if (!resizeSnapshot && !dragSnapshot) return;
  window.setTimeout(() => {
    commitResizeSnapshot();
    commitDragSnapshot();
  }, 0);
}, true);

if (canvasShell) {
  const isScrollable = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  };
  const findSelectedNodeScrollTarget = (event) => {
    if (!selectedNodeId) return null;
    const nodeEl = getNodeElement(selectedNodeId);
    if (!nodeEl) return null;

    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.length) {
      const nodeIndex = path.indexOf(nodeEl);
      if (nodeIndex === -1) return null;
      for (let i = 0; i < nodeIndex; i += 1) {
        const candidate = path[i];
        if (isScrollable(candidate)) return candidate;
      }
      const body = nodeEl.querySelector('.ew-node-body');
      if (isScrollable(body)) return body;
      if (isScrollable(nodeEl)) return nodeEl;
      return null;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || !nodeEl.contains(target)) return null;

    let current = target;
    while (current && current !== nodeEl) {
      if (isScrollable(current)) return current;
      current = current.parentElement;
    }

    const body = nodeEl.querySelector('.ew-node-body');
    if (isScrollable(body)) return body;
    if (isScrollable(nodeEl)) return nodeEl;
    return null;
  };
  const shouldIgnoreWheel = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('.input-bar, .hint-center, .status, .panel-expand, .modal, .app-panel'));
  };
  canvasShell.addEventListener('wheel', (event) => {
    if (!view?.canvas) return;
    if (event.target === view.canvas) return;
    if (shouldIgnoreWheel(event.target)) return;
    if (findSelectedNodeScrollTarget(event)) {
      event.stopPropagation();
      return;
    }
    if (typeof view._onWheel === 'function') {
      view._onWheel(event);
      event.stopPropagation();
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
    canvasShell.addEventListener(name, (event) => {
      event.preventDefault();
    }, { passive: false });
  });
}

patchWorkspacePersistence();

async function handleSend() {
  if (!currentForm || !currentComponentKey) return;
  const config = COMPONENT_LOOKUP.get(currentComponentKey);
  if (!config) return;

  const values = readFormValues();
  const targetNode = resolveTargetNode(config);
  const followUpNode = getAiFollowUpNode();
  if (followUpNode) {
    await handleAiFollowUp(followUpNode);
    return;
  }

  if (config.key === 'AI') {
    const prompt = String(values.prompt || '').trim();
    const provider = loadProvider();
    const apiKey = readApiKey(provider);
    const proxyBaseUrl = resolveAiProxyBaseUrl(provider);
    if (!apiKey && proxyBaseUrl == null) {
      setStatus('Add an API key in Model Matrix.', 1800);
      return;
    }
    let didSetPending = false;
    try {
      const attachments = collectAiAttachments(values);
      if (attachments.file && !attachments.kind) {
        setStatus('Upload an image, audio, or text/code file.', 1800);
        return;
      }
      const message = resolveAiMessage(prompt, attachments);
      if (!message) {
        setStatus('Enter a message or attach media.', 1600);
        return;
      }
      const task = resolveAiTask(message, attachments);
      const model = resolveAiModelForTask(provider, task);
      setAiRequestState(true);
      didSetPending = true;
      setStatus('Sending to AI...', 0);
      const result = await requestAiPlan({
        provider,
        apiKey,
        proxyBaseUrl,
        model,
        message,
        attachments
      });
      recordAiHistory({ message, response: result.text, provider, model, toolTrace: result?.toolTrace || null });
      const plan = parseAiPlan(result.text);
      if (!plan) {
        console.warn('AI response not understood', result.text);
        setStatus('AI response not understood.', 2000);
        return;
      }
      const filteredPlan = filterAiPlanForAttachments(plan, attachments);
      const outcome = applyAiPlan(filteredPlan, {
        connectContext: currentComponentKey === 'AI' ? Array.from(aiContextNodeIds) : [],
        ignorePosition: true
      });
      layoutNewNodesHierarchy(outcome.addedNodes, { rootId: selectedNodeId });
      const primaryResultId = getPrimaryAiResultId(outcome);
      const mediaNodeId = await addAiAttachmentNode(attachments);
      if (mediaNodeId) {
        outcome.addedNodes.push(mediaNodeId);
        connectAttachmentToResult(mediaNodeId, primaryResultId, outcome);
      }
      addAiNotification(primaryResultId, outcome);
      focusOnAiResult(primaryResultId, outcome);
      const nodeCount = outcome.addedNodes.length + outcome.updatedNodes.length;
      const edgeCount = outcome.addedEdges.length + outcome.updatedEdges.length;
      const summary = `AI applied: ${nodeCount} node${nodeCount === 1 ? '' : 's'}, ${edgeCount} edge${edgeCount === 1 ? '' : 's'}.`;
      clearFormInputs(config);
      updateSendButton();
      setStatus(outcome.errors.length ? `${summary} (with warnings)` : summary, 2200);
    } catch (err) {
      console.warn('AI request failed', err);
      setStatus('AI request failed.', 1800);
    } finally {
      if (didSetPending) setAiRequestState(false);
    }
    return;
  }

  if (config.key === 'CodeSnippet' && Array.isArray(values.files) && values.files.length) {
    await handleCodeSnippetFiles(config, values.files, targetNode);
    clearFormInputs(config);
    updateSendButton();
    updateRecordButton();
    return;
  }

  if (config.nodeType === 'html-text') {
    const text = values.text || (targetNode?.text ?? 'Editable text');
    if (targetNode) {
      view.updateNode(targetNode.id, { text });
      setStatus('Text node updated.');
    } else {
      addNodeAtCenter({
        type: 'html-text',
        text,
        w: config.size?.w || 320,
        h: config.size?.h || 160
      });
      setStatus('Text node added.');
    }
    clearFormInputs(config);
    updateSendButton();
    updateRecordButton();
    return;
  }

  const update = await buildComponentUpdate(config, values, targetNode);
  if (!update) return;

  if (targetNode) {
    view.updateNode(targetNode.id, update.patch);
    if (update.asset) {
      await attachAssetToNode(targetNode.id, update.asset, targetNode, config);
    }
    setStatus('Component updated.');
    clearFormInputs(config);
    updateSendButton();
    updateRecordButton();
    return;
  }

  const id = addNodeAtCenter({
    type: 'html',
    component: config.component,
    props: update.patch.props,
    data: update.patch.data,
    w: config.size?.w || 320,
    h: config.size?.h || 160
  });

  if (id && update.asset) {
    await attachAssetToNode(id, update.asset, null, config);
  }

  setStatus('Component added.');
  clearFormInputs(config);
  updateSendButton();
  updateRecordButton();
}

async function buildComponentUpdate(config, values, node) {
  const props = { ...(node?.props || {}) };
  const data = { ...(node?.data || {}) };

  switch (config.key) {
    case 'OptionPicker': {
      const options = parseOptions(values.options, props.options, ['Alpha', 'Beta', 'Gamma']);
      const choice = values.choice || data.choice || options[0];
      props.label = values.label || props.label || 'Select one';
      props.options = options;
      data.choice = choice;
      break;
    }
    case 'TextInput': {
      props.label = values.label || props.label || 'Enter text';
      data.value = values.value ?? data.value ?? '';
      break;
    }
    case 'DateTimeInput': {
      props.label = values.label || props.label || 'Select date/time';
      data.value = values.value || data.value || '';
      break;
    }
    case 'SliderInput': {
      props.label = values.label || props.label || 'Gain level';
      props.min = toNumber(values.min, props.min, 0);
      props.max = toNumber(values.max, props.max, 10);
      props.step = 1;
      data.value = toNumber(values.value, data.value, props.min);
      break;
    }
    case 'MultiChoice': {
      const options = parseOptions(values.options, props.options, ['Alpha', 'Beta', 'Gamma']);
      const selected = parseOptions(values.selected, data.selected, []);
      props.options = options;
      data.selected = selected.filter((item) => options.includes(item));
      break;
    }
    case 'CodeSnippet': {
      props.filename = values.filename || props.filename || 'snippet.js';
      data.code = values.code ?? data.code ?? '';
      break;
    }
    case 'SvgBlock': {
      props.title = values.title || props.title || 'SVG Diagram';
      data.svg = values.svg ?? data.svg ?? '';
      if (values.file instanceof File) {
        data.svg = await values.file.text();
      }
      break;
    }
    case 'MermaidBlock': {
      props.title = values.title || props.title || 'Mermaid Diagram';
      data.mermaid = values.mermaid ?? data.mermaid ?? '';
      break;
    }
    case 'HtmlPreview': {
      props.title = values.title || props.title || 'HTML Preview';
      data.html = values.html ?? data.html ?? '';
      break;
    }
    case 'ImageViewer':
    case 'VideoPlayer':
    case 'AudioPlayer':
      if (!props.title) {
        props.title = config.label;
      }
      break;
    default:
      break;
  }

  let asset = null;
  if (config.assetType && values.file instanceof File) {
    asset = values.file;
  }

  return { patch: { props, data }, asset };
}

async function attachAssetToNode(nodeId, file, node, config) {
  const asset = await saveAsset(file, config.assetType || file.type);
  const url = asset.url || await getAssetUrl(asset.id);
  const existing = node || view.graph?.getNode(nodeId);
  const nextData = { ...(existing?.data || {}) };
  const nextProps = { ...(existing?.props || {}) };
  nextData.assetId = asset.id;
  nextData.assetName = asset.name;
  nextData.assetType = asset.type;
  if (asset.category) {
    nextData.assetCategory = asset.category;
  }
  nextData.src = url;
  if (config?.assetType === 'audio' || config?.assetType === 'video' || config?.assetType === 'image') {
    nextProps.title = asset.name;
  }
  delete nextData.remoteSrc;
  delete nextData.remoteProjectId;
  view.updateNode(nodeId, { data: nextData, props: nextProps });
  if (currentForm?.inputs?.file) currentForm.inputs.file.value = '';
  if (currentForm?.fileChips?.file) {
    currentForm.fileChips.file.textContent = asset.name;
    currentForm.assetName = asset.name;
  }
  pruneAssetUrls(view.graph);
}

function addNodeAtCenter(partial) {
  const rect = view.canvas.getBoundingClientRect();
  const center = view.screenToWorld(rect.width / 2, rect.height / 2);
  const w = partial.w || 320;
  const h = partial.h || 160;
  const id = view.addNode({
    ...partial,
    x: center.x - w / 2,
    y: center.y - h / 2,
    w,
    h,
    autoPlace: true
  });
  if (id) view.selectNode(id);
  return id;
}

function parseOptions(raw, fallback, defaults) {
  if (Array.isArray(raw)) return raw;
  const list = typeof raw === 'string'
    ? raw.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  if (list.length) return list;
  if (Array.isArray(fallback) && fallback.length) return fallback;
  return defaults || [];
}

function toNumber(value, fallback, defaultValue) {
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  if (Number.isFinite(fallback)) return fallback;
  return defaultValue;
}

function resolveTargetNode(config) {
  if (!selectedNodeId || !view.graph) return null;
  const node = view.graph.getNode(selectedNodeId);
  if (!node) return null;
  if (config.nodeType === 'html-text' && node.type === 'html-text') return node;
  if (node.type === 'html' && node.component === config.component) return node;
  return null;
}

function resetAiContext() {
  aiContextNodeIds.clear();
}

function toggleAiContextNode(node) {
  if (!node) return;
  if (aiContextNodeIds.has(node.id)) {
    aiContextNodeIds.delete(node.id);
    setStatus(`AI context: removed ${node.id} (${aiContextNodeIds.size})`, 1600);
  } else {
    aiContextNodeIds.add(node.id);
    setStatus(`AI context: added ${node.id} (${aiContextNodeIds.size})`, 1600);
  }
  updateSendButton();
}

function syncFormToNode(node) {
  const key = node.type === 'html-text' ? 'HtmlText' : node.component || null;
  const config = key ? COMPONENT_LOOKUP.get(key) : null;
  if (!config) return;
  currentComponentKey = config.key;
  els.componentPicker.value = config.key;
  renderForm(config, node);
  updateSendButton();
  updateRecordButton();
}

function renderForm(config, node) {
  if (!config) return;
  currentForm = {
    config,
    inputs: {},
    fileNotes: {},
    fileChips: {},
    fileButtons: {},
    assetName: node?.data?.assetName || '',
    aiMediaFile: null
  };
  if (els.nodeFields) {
    els.nodeFields.innerHTML = '';
  }
  if (els.assetFields) {
    els.assetFields.innerHTML = '';
  }

  config.fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'input-field';

    const hideFieldLabel = config.key === 'AI' && (field.key === 'prompt' || field.key === 'media');
    if (!hideFieldLabel) {
      const label = document.createElement('label');
      label.textContent = field.label;
      wrap.appendChild(label);
    }

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      if (
        config.key === 'AI'
        || config.key === 'HtmlText'
        || config.key === 'HtmlPreview'
        || (config.key === 'CodeSnippet' && field.key === 'code')
      ) {
        wrap.classList.add('input-field--wide');
      }
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
    }

    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.accept) input.accept = field.accept;
    if (field.multiple) input.multiple = true;
    if (hideFieldLabel && field.label) {
      input.setAttribute('aria-label', field.label);
    }

    input.addEventListener('input', updateSendButton);
    if (config.key === 'HtmlText' && field.key === 'text') {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (event.shiftKey) return;
        event.preventDefault();
        if (input.value.trim()) {
          handleSend();
        }
      });
    }
    if (config.key === 'AI' && field.key === 'prompt') {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (!event.metaKey && !event.ctrlKey) return;
        event.preventDefault();
        if (input.value.trim() || currentForm?.aiMediaFile || currentForm?.inputs?.media?.files?.length) {
          handleSend();
        }
      });
    }

    if (field.type === 'file' && (field.note === 'asset' || field.note === 'ai-asset')) {
      input.className = 'input-file';
      const picker = document.createElement('div');
      picker.className = 'file-picker';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'input-btn secondary';
      if (field.note === 'ai-asset') {
        trigger.classList.add('icon-only');
        trigger.innerHTML = getUploadIconSvg();
        const label = resolveFieldAssetLabel(config, field);
        trigger.setAttribute('aria-label', `Upload ${label}`);
        trigger.title = `Upload ${label}`;
      } else {
        trigger.textContent = `Select ${resolveFieldAssetLabel(config, field)}...`;
      }

      trigger.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        updateSendButton();
        updateFileNote(field, input, node);
      });

      picker.appendChild(trigger);
      const chip = document.createElement('span');
      chip.className = field.note === 'ai-asset' ? 'file-chip file-chip--ai is-empty' : 'file-chip';
      chip.textContent = field.note === 'ai-asset' ? '' : resolveFieldAssetChip(config, field, node);
      picker.appendChild(chip);
      currentForm.fileChips[field.key] = chip;

      wrap.appendChild(picker);
      if (field.note !== 'ai-asset') {
        const meta = resolveFieldAssetMeta(config, field);
        if (meta) {
          const metaLine = document.createElement('div');
          metaLine.className = 'file-meta';
          metaLine.textContent = meta;
          wrap.appendChild(metaLine);
        }
      }
      wrap.appendChild(input);
      currentForm.fileButtons[field.key] = trigger;
      currentForm.inputs[field.key] = input;
      if (els.assetFields) {
        els.assetFields.appendChild(wrap);
      }
      return;
    }

    if (field.type === 'file') {
      const note = document.createElement('div');
      note.className = 'input-note';
      note.textContent = resolveInputNote(field, node);
      wrap.appendChild(note);
      currentForm.fileNotes[field.key] = note;
      input.addEventListener('change', () => {
        updateSendButton();
        updateFileNote(field, input, node);
      });
    }

    wrap.appendChild(input);
    if (els.nodeFields) {
      els.nodeFields.appendChild(wrap);
    }
    currentForm.inputs[field.key] = input;
  });

  hydrateFormValues(config, node);
  updateMetaGroupVisibility();
  updateAssetLayout(config);
}

function hydrateFormValues(config, node) {
  if (!currentForm) return;
  const { inputs } = currentForm;

  if (config.key === 'HtmlText') {
    if (inputs.text) inputs.text.value = node?.text || '';
    return;
  }

  switch (config.key) {
    case 'OptionPicker':
      if (inputs.label) inputs.label.value = node?.props?.label || '';
      if (inputs.options) inputs.options.value = (node?.props?.options || []).join(', ');
      if (inputs.choice) inputs.choice.value = node?.data?.choice || '';
      break;
    case 'TextInput':
      if (inputs.label) inputs.label.value = node?.props?.label || '';
      if (inputs.value) inputs.value.value = node?.data?.value || '';
      break;
    case 'DateTimeInput':
      if (inputs.label) inputs.label.value = node?.props?.label || '';
      if (inputs.value) inputs.value.value = node?.data?.value || '';
      break;
    case 'SliderInput':
      if (inputs.label) inputs.label.value = node?.props?.label || '';
      if (inputs.min) inputs.min.value = node?.props?.min ?? '';
      if (inputs.max) inputs.max.value = node?.props?.max ?? '';
      if (inputs.value) inputs.value.value = node?.data?.value ?? '';
      break;
    case 'MultiChoice':
      if (inputs.options) inputs.options.value = (node?.props?.options || []).join(', ');
      if (inputs.selected) inputs.selected.value = (node?.data?.selected || []).join(', ');
      break;
    case 'CodeSnippet':
      if (inputs.code) inputs.code.value = node?.data?.code || '';
      if (currentForm.fileNotes?.files) {
        currentForm.fileNotes.files.textContent = 'No files selected.';
      }
      break;
    case 'SvgBlock':
      if (inputs.title) inputs.title.value = node?.props?.title || '';
      if (inputs.svg) inputs.svg.value = node?.data?.svg || '';
      if (currentForm?.fileChips?.file) {
        const fileField = config.fields?.find((field) => field.key === 'file');
        currentForm.fileChips.file.textContent = resolveFieldAssetChip(config, fileField, null);
        currentForm.assetName = '';
      }
      break;
    case 'MermaidBlock':
      if (inputs.title) inputs.title.value = node?.props?.title || '';
      if (inputs.mermaid) inputs.mermaid.value = node?.data?.mermaid || '';
      break;
    case 'HtmlPreview':
      if (inputs.title) inputs.title.value = node?.props?.title || '';
      if (inputs.html) inputs.html.value = node?.data?.html || '';
      break;
    case 'ImageViewer':
    case 'VideoPlayer':
    case 'AudioPlayer':
      if (inputs.title) inputs.title.value = node?.props?.title || '';
      if (currentForm?.fileChips?.file) {
        currentForm.fileChips.file.textContent = resolveAssetChip(config, node);
        currentForm.assetName = node?.data?.assetName || '';
      }
      break;
    default:
      break;
  }
}

function resolveAssetLabel(config) {
  const type = config?.assetType;
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  if (type === 'image') return 'image';
  return 'file';
}

function resolveAssetChip(config, node) {
  if (node?.data?.assetName) return node.data.assetName;
  return `No ${resolveAssetLabel(config)} selected`;
}

function resolveAssetMeta(config) {
  if (config?.assetType === 'video') return 'MP4, MOV';
  if (config?.assetType === 'audio') return 'MP3, WAV';
  if (config?.assetType === 'image') return 'PNG, JPG';
  return '';
}

function resolveFieldAssetLabel(config, field) {
  return field?.assetLabel || resolveAssetLabel(config);
}

function resolveFieldAssetChip(config, field, node) {
  if (field?.assetLabel) {
    return `No ${resolveFieldAssetLabel(config, field)} selected`;
  }
  return resolveAssetChip(config, node);
}

function resolveFieldAssetMeta(config, field) {
  return field?.assetMeta || resolveAssetMeta(config);
}

function getUploadIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <path d="M8.5 9.5L12 6l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M5 18h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  `;
}

function resolveInputNote(field, node) {
  if (field.note === 'files') return 'No files selected.';
  return '';
}

function updateFileNote(field, input, node) {
  if (field.note === 'asset' || field.note === 'ai-asset') {
    const file = input.files?.[0];
    if (currentForm?.fileChips?.[field.key]) {
      const chip = currentForm.fileChips[field.key];
      if (field.note === 'ai-asset') {
        chip.textContent = file ? file.name : '';
        chip.classList.toggle('is-empty', !file);
      } else {
        chip.textContent = file ? file.name : resolveFieldAssetChip(currentForm?.config, field, node);
      }
    }
    if (currentForm?.fileButtons?.[field.key] && field.note === 'ai-asset') {
      const label = resolveFieldAssetLabel(currentForm?.config, field);
      const btn = currentForm.fileButtons[field.key];
      btn.title = file ? file.name : `Upload ${label}`;
      btn.classList.toggle('has-file', Boolean(file));
    }
    if (currentForm) {
      currentForm.assetName = file?.name || node?.data?.assetName || '';
    }
    return;
  }
  if (!currentForm?.fileNotes?.[field.key]) return;
  if (field.note === 'files') {
    const count = input.files?.length || 0;
    currentForm.fileNotes[field.key].textContent = count ? `${count} file(s) selected.` : 'No files selected.';
  }
}

function readFormValues() {
  if (!currentForm) return {};
  const values = {};
  Object.entries(currentForm.inputs).forEach(([key, input]) => {
    if (input.type === 'file') {
      values[key] = input.multiple ? Array.from(input.files || []) : input.files?.[0] || null;
    } else {
      values[key] = input.value;
    }
  });
  return values;
}

function requiresAsset(config) {
  return config?.assetType === 'video';
}

function hasAssetSelection() {
  const fileInput = currentForm?.inputs?.file;
  if (fileInput?.files?.length) return true;
  if (currentForm?.assetName) return true;
  return false;
}

function hasAiInput() {
  if (!currentForm?.inputs) return false;
  const prompt = String(currentForm.inputs.prompt?.value || '').trim();
  const hasMedia = currentForm.inputs.media?.files?.length || currentForm.aiMediaFile;
  return Boolean(prompt || hasMedia);
}

function getAiFollowUpNode() {
  if (!view?.graph || !selectedNodeId) return null;
  const node = view.graph.getNode(selectedNodeId);
  if (!node?.data?.aiFollowUp) return null;
  if (!AI_FOLLOW_UP_COMPONENTS.has(node.component)) return null;
  if (node.data.aiFollowUp.status === 'done') return null;
  return node;
}

function getAiFollowUpAnswer(node) {
  if (!node) return '';
  if (node.component === 'OptionPicker') {
    return String(node.data?.choice || node.data?.value || '').trim();
  }
  if (node.component === 'TextInput') {
    return String(node.data?.value || node.data?.text || '').trim();
  }
  return '';
}

function hasAiFollowUpInput(node) {
  return Boolean(getAiFollowUpAnswer(node));
}

function setAiRequestState(active) {
  aiRequestPending = Boolean(active);
  if (els.sendBtn) {
    els.sendBtn.classList.toggle('is-busy', aiRequestPending);
    els.sendBtn.setAttribute('aria-busy', aiRequestPending ? 'true' : 'false');
  }
  if (els.inputBar) {
    els.inputBar.classList.toggle('is-ai-busy', aiRequestPending);
  }
  updateSendButton();
}

function updateSendButton() {
  const config = currentComponentKey ? COMPONENT_LOOKUP.get(currentComponentKey) : null;
  const followUpNode = getAiFollowUpNode();
  if (followUpNode) {
    els.sendBtn.textContent = 'Run';
    els.sendBtn.disabled = aiRequestPending || !hasAiFollowUpInput(followUpNode);
    return;
  }
  if (config?.key === 'AI') {
    els.sendBtn.textContent = 'Send';
    els.sendBtn.disabled = aiRequestPending || !hasAiInput();
    return;
  }
  const targetNode = config ? resolveTargetNode(config) : null;
  els.sendBtn.textContent = targetNode ? 'Update' : 'Add';
  if (requiresAsset(config)) {
    els.sendBtn.disabled = !hasAssetSelection();
  } else {
    els.sendBtn.disabled = false;
  }
}

function updateAssetLayout(config) {
  if (!els.sendBtn || !els.assetFields || !els.assetActions || !els.nodeFields) return;
  const isCodeSnippet = config?.key === 'CodeSnippet';
  if (els.inputBar) {
    els.inputBar.classList.toggle('is-asset-hidden', isCodeSnippet);
  }
  if (els.assetGroup) {
    els.assetGroup.style.display = isCodeSnippet ? 'none' : '';
  }
  if (isCodeSnippet) {
    els.nodeFields.classList.add('is-code-snippet');
    let actionWrap = els.nodeFields.querySelector('.input-field--action');
    if (!actionWrap) {
      actionWrap = document.createElement('div');
      actionWrap.className = 'input-field input-field--action';
    }
    let row = els.nodeFields.querySelector('.code-snippet-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'code-snippet-row';
    }
    const codeField = currentForm?.inputs?.code?.closest('.input-field') || null;
    if (row.parentElement !== els.nodeFields) {
      if (codeField && codeField.parentElement === els.nodeFields) {
        codeField.insertAdjacentElement('beforebegin', row);
      } else {
        els.nodeFields.appendChild(row);
      }
    }
    if (codeField && !row.contains(codeField)) {
      row.appendChild(codeField);
    }
    if (!row.contains(actionWrap)) {
      row.appendChild(actionWrap);
    }
    if (!actionWrap.contains(els.sendBtn)) {
      actionWrap.appendChild(els.sendBtn);
    }
    return;
  }

  els.nodeFields.classList.remove('is-code-snippet');
  const row = els.nodeFields.querySelector('.code-snippet-row');
  if (row) {
    Array.from(row.children).forEach((child) => {
      if (child) els.nodeFields.appendChild(child);
    });
    row.remove();
  }

  const inline = config?.key === 'AI'
    || config?.assetType === 'audio'
    || config?.assetType === 'video'
    || config?.assetType === 'image';
  if (els.assetGroup) {
    els.assetGroup.classList.toggle('asset-group--inline-send', inline);
  }

  const picker = els.assetFields.querySelector('.file-picker');
  if (inline) {
    if (picker && !picker.contains(els.sendBtn)) {
      picker.appendChild(els.sendBtn);
    }
  } else if (!els.assetActions.contains(els.sendBtn)) {
    els.assetActions.appendChild(els.sendBtn);
  }

  const recordVisible = Boolean(els.recordBtn) && els.recordBtn.style.display !== 'none';
  if (config?.assetType === 'audio' && picker && recordVisible) {
    if (!picker.contains(els.recordBtn)) {
      const chip = picker.querySelector('.file-chip');
      if (chip) {
        picker.insertBefore(els.recordBtn, chip);
      } else {
        picker.appendChild(els.recordBtn);
      }
    }
  } else if (els.recordBtn && !els.assetActions.contains(els.recordBtn)) {
    els.assetActions.insertBefore(els.recordBtn, els.assetActions.firstChild);
  }

  els.assetActions.style.display = inline ? 'none' : '';

  const actionWrap = els.nodeFields.querySelector('.input-field--action');
  if (actionWrap && !actionWrap.contains(els.sendBtn)) {
    actionWrap.remove();
  }
}

function updateEdgeFields(edge) {
  if (!els.edgeFields || !els.edgeLabelInput || !els.edgeLabelBtn) return;
  const hasEdge = Boolean(edge);
  els.edgeFields.classList.toggle('is-visible', hasEdge);
  els.edgeFields.setAttribute('aria-hidden', String(!hasEdge));
  els.edgeLabelBtn.disabled = !hasEdge;
  els.edgeLabelInput.value = hasEdge ? edge.label || '' : '';
  updateMetaGroupVisibility();
}

function updateMetaGroupVisibility() {
  if (!els.metaGroup || !els.inputBar || !els.nodeFields || !els.edgeFields) return;
  const hasNodeFields = els.nodeFields.children.length > 0;
  const edgeVisible = els.edgeFields.classList.contains('is-visible');
  const shouldShow = hasNodeFields || edgeVisible;
  els.metaGroup.style.display = shouldShow ? '' : 'none';
  els.inputBar.classList.toggle('is-meta-hidden', !shouldShow);
}

function applyEdgeLabel() {
  if (!selectedEdgeId || !view.graph) return;
  const edge = view.graph.edges.find((entry) => entry.id === selectedEdgeId);
  if (!edge) return;
  const value = els.edgeLabelInput?.value?.trim() || '';
  view.updateEdge(selectedEdgeId, { label: value || null });
  setStatus(value ? 'Edge label updated.' : 'Edge label cleared.', 1400);
}

async function handleCodeSnippetFiles(config, files, targetNode) {
  const entries = await Promise.all(
    files.map(async (file) => ({ file, text: await file.text() }))
  );
  if (!entries.length) return;

  const [first, ...rest] = entries;
  if (targetNode) {
    view.updateNode(targetNode.id, {
      props: { ...(targetNode.props || {}), filename: first.file.name },
      data: { ...(targetNode.data || {}), code: first.text }
    });
  } else {
    addSnippetNode(config, first, 0);
  }

  rest.forEach((entry, idx) => addSnippetNode(config, entry, idx + 1));

  if (currentForm?.inputs?.files) currentForm.inputs.files.value = '';
  if (currentForm?.fileNotes?.files) currentForm.fileNotes.files.textContent = 'No files selected.';

  if (rest.length) {
    setStatus(`Added ${entries.length} code files.`, 2000);
  } else {
    setStatus(targetNode ? 'Code file updated.' : 'Code file added.', 2000);
  }
}

function addSnippetNode(config, entry, index) {
  const rect = view.canvas.getBoundingClientRect();
  const center = view.screenToWorld(rect.width / 2, rect.height / 2);
  const w = config.size?.w || 360;
  const h = config.size?.h || 220;
  const offset = 28 * index;
  const id = view.addNode({
    type: 'html',
    component: config.component,
    x: center.x - w / 2 + offset,
    y: center.y - h / 2 + offset,
    w,
    h,
    autoPlace: true,
    props: { filename: entry.file.name },
    data: { code: entry.text }
  });
  if (id) view.selectNode(id);
  return id;
}

function updateRecordButton() {
  if (!els.recordBtn) return;
  const config = currentComponentKey ? COMPONENT_LOOKUP.get(currentComponentKey) : null;
  const show = config?.assetType === 'audio';
  els.recordBtn.style.display = show ? 'inline-flex' : 'none';
  if (!show) {
    updateAssetLayout(config);
    return;
  }
  els.recordBtn.disabled = false;
  els.recordBtn.title = 'Record audio';
  updateAssetLayout(config);
  if (recorder?.state === 'recording') {
    els.recordBtn.textContent = 'Stop';
  } else {
    els.recordBtn.textContent = '● Record';
  }
}

function updateRealtimeButton() {
  if (!els.btnRealtime) return;
  els.btnRealtime.textContent = 'Realtime';
  els.btnRealtime.setAttribute('aria-pressed', realtimeEnabled ? 'true' : 'false');
  els.btnRealtime.classList.toggle('active', realtimeEnabled);
  const modeLabel = realtimeEnabled
    ? (realtimeState.speaking ? 'responding' : 'listening')
    : 'off';
  els.btnRealtime.title = `Realtime ${modeLabel}`;
}

function initRealtime() {
  if (!els.btnRealtime) return;
  realtimeAgent = createRealtimeAgent({
    view,
    onStatus: (label) => setStatus(label, 1400),
    onError: (err) => {
      console.warn('Realtime error', err);
      setStatus('Realtime error.', 1800);
    },
    onUserTurnStart: ({ turnId }) => {
      upsertRealtimeTranscriptNode(turnId, 'Listening...', false);
      setStatus('Realtime listening...', 0);
    },
    onUserTranscriptDelta: ({ turnId, text, isFinal }) => {
      upsertRealtimeTranscriptNode(turnId, text || 'Listening...', Boolean(isFinal));
      setStatus(isFinal ? 'Voice input captured.' : 'Transcribing...', 1200);
    },
    onUserTurnEnd: ({ turnId }) => {
      const entry = realtimeTurnNodes.get(turnId);
      if (!entry?.userTranscriptNodeId || !view?.graph) return;
      const node = view.graph.getNode(entry.userTranscriptNodeId);
      if (!node) return;
      const content = String(node.text || '').trim() || 'Voice request';
      const data = {
        ...(node.data || {}),
        realtime: true,
        realtimeTurnId: turnId,
        realtimeRole: 'user_transcript',
        realtimeStatus: 'final'
      };
      view.updateNode(node.id, { text: content, data });
    },
    onAiAudioChunk: () => {
      const now = Date.now();
      if (now - realtimeAudioStatusAt < 800) return;
      realtimeAudioStatusAt = now;
      setStatus('Streaming AI audio...', 1000);
    },
    onAiTurnComplete: async (payload) => {
      await finalizeRealtimeTurn(payload);
    },
    onIntent: async (intent) => handleRealtimeIntent(intent),
    onState: (state) => {
      realtimeState = { ...realtimeState, ...state };
      updateRealtimeButton();
    }
  });

  updateRealtimeButton();
  els.btnRealtime.addEventListener('click', async () => {
    if (!realtimeAgent) return;
    if (realtimeEnabled) {
      await realtimeAgent.stop();
      realtimeEnabled = false;
      realtimeAudioStatusAt = 0;
      updateRealtimeButton();
      return;
    }
    const apiKey = readApiKey('gemini');
    if (!apiKey) {
      setStatus('Add a Gemini API key in Model Matrix.', 2000);
      return;
    }
    try {
      await realtimeAgent.start({ apiKey, model: REALTIME_MODEL });
      realtimeEnabled = true;
      realtimeAudioStatusAt = 0;
      updateRealtimeButton();
    } catch (err) {
      console.warn('Realtime start failed', err);
      setStatus('Realtime start failed.', 2000);
      realtimeEnabled = false;
      updateRealtimeButton();
    }
  });
}

function captureResizeStart() {
  if (!view?.state?.resizingId || !view.graph) return;
  const node = view.graph.getNode(view.state.resizingId);
  if (!node) return;
  resizeSnapshot = {
    id: node.id,
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h
  };
}

function commitResizeSnapshot() {
  if (!resizeSnapshot || !view.graph) return;
  const node = view.graph.getNode(resizeSnapshot.id);
  if (!node) {
    resizeSnapshot = null;
    return;
  }
  const changed = node.x !== resizeSnapshot.x
    || node.y !== resizeSnapshot.y
    || node.w !== resizeSnapshot.w
    || node.h !== resizeSnapshot.h;
  if (changed) {
    view.updateNode(node.id, { x: node.x, y: node.y, w: node.w, h: node.h });
  }
  resizeSnapshot = null;
}

function captureDragStart() {
  if (!view?.state?.dragId || !view.graph) return;
  const node = view.graph.getNode(view.state.dragId);
  if (!node) return;
  dragSnapshot = {
    id: node.id,
    x: node.x,
    y: node.y
  };
}

function parseHtmlPreviewResizeEdges(edgeEl) {
  if (!edgeEl) return [];
  if (edgeEl.classList.contains('is-ne')) return ['top', 'right'];
  if (edgeEl.classList.contains('is-nw')) return ['top', 'left'];
  if (edgeEl.classList.contains('is-se')) return ['bottom', 'right'];
  if (edgeEl.classList.contains('is-sw')) return ['bottom', 'left'];
  if (edgeEl.classList.contains('is-top')) return ['top'];
  if (edgeEl.classList.contains('is-right')) return ['right'];
  if (edgeEl.classList.contains('is-bottom')) return ['bottom'];
  if (edgeEl.classList.contains('is-left')) return ['left'];
  return [];
}

function updateHtmlPreviewResize(clientX, clientY) {
  const session = htmlPreviewResizeSession;
  if (!session || !view?.graph) return;
  const node = view.graph.getNode(session.nodeId);
  if (!node) return;
  const dx = clientX - session.startX;
  const dy = clientY - session.startY;
  let nextX = session.startNode.x;
  let nextY = session.startNode.y;
  let nextW = session.startNode.w;
  let nextH = session.startNode.h;
  if (session.edges.includes('right')) {
    nextW = Math.max(session.minW, session.startNode.w + dx);
  }
  if (session.edges.includes('left')) {
    nextW = Math.max(session.minW, session.startNode.w - dx);
    nextX = session.startNode.x + (session.startNode.w - nextW);
  }
  if (session.edges.includes('bottom')) {
    nextH = Math.max(session.minH, session.startNode.h + dy);
  }
  if (session.edges.includes('top')) {
    nextH = Math.max(session.minH, session.startNode.h - dy);
    nextY = session.startNode.y + (session.startNode.h - nextH);
  }
  view.updateNode(session.nodeId, { x: nextX, y: nextY, w: nextW, h: nextH });
}

function handleHtmlPreviewResizePointerDown(event) {
  if (event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const edgeEl = target.closest('.ew-html-preview-edge');
  if (!(edgeEl instanceof HTMLElement)) return;
  const nodeEl = edgeEl.closest('[data-ew-node-id]');
  const nodeId = String(nodeEl?.getAttribute('data-ew-node-id') || '').trim();
  if (!nodeId || !view?.graph) return;
  const node = view.graph.getNode(nodeId);
  if (!node) return;
  const edges = parseHtmlPreviewResizeEdges(edgeEl);
  if (!edges.length) return;
  htmlPreviewResizeSession = {
    nodeId,
    edges,
    startX: event.clientX,
    startY: event.clientY,
    startNode: {
      x: Number(node.x) || 0,
      y: Number(node.y) || 0,
      w: Number(node.w) || 320,
      h: Number(node.h) || 240
    },
    minW: 240,
    minH: 160
  };
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
}

function handleHtmlPreviewResizePointerMove(event) {
  if (!htmlPreviewResizeSession) return;
  updateHtmlPreviewResize(event.clientX, event.clientY);
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
}

function handleHtmlPreviewResizePointerUp(event) {
  if (!htmlPreviewResizeSession) return;
  updateHtmlPreviewResize(event.clientX, event.clientY);
  htmlPreviewResizeSession = null;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
}

function installHtmlPreviewResizeSupport() {
  window.addEventListener('pointerdown', handleHtmlPreviewResizePointerDown, true);
  window.addEventListener('pointermove', handleHtmlPreviewResizePointerMove, true);
  window.addEventListener('pointerup', handleHtmlPreviewResizePointerUp, true);
}

function commitDragSnapshot() {
  if (!dragSnapshot || !view.graph) return;
  const node = view.graph.getNode(dragSnapshot.id);
  if (!node) {
    dragSnapshot = null;
    return;
  }
  const changed = node.x !== dragSnapshot.x || node.y !== dragSnapshot.y;
  if (changed) {
    view.updateNode(node.id, { x: node.x, y: node.y });
  }
  dragSnapshot = null;
}

function clearFormInputs(config) {
  if (!currentForm) return;
  Object.entries(currentForm.inputs).forEach(([key, input]) => {
    if (input.type === 'file') {
      input.value = '';
    } else {
      input.value = '';
    }
  });
  if (config?.key === 'CodeSnippet' && currentForm.fileNotes?.files) {
    currentForm.fileNotes.files.textContent = 'No files selected.';
  }
  if ((config?.key === 'ImageViewer' || config?.key === 'VideoPlayer' || config?.key === 'AudioPlayer') && currentForm?.fileChips?.file) {
    currentForm.fileChips.file.textContent = resolveAssetChip(config, null);
    currentForm.assetName = '';
  }
  if (config?.key === 'SvgBlock' && currentForm?.fileChips?.file) {
    const fileField = config.fields?.find((field) => field.key === 'file');
    currentForm.fileChips.file.textContent = resolveFieldAssetChip(config, fileField, null);
    currentForm.assetName = '';
  }
  if (config?.key === 'AI' && currentForm?.fileChips) {
    Object.entries(currentForm.fileChips).forEach(([key, chip]) => {
      const field = config.fields?.find((entry) => entry.key === key);
      if (!field) return;
      if (field.note === 'ai-asset') {
        chip.textContent = '';
        chip.classList.add('is-empty');
      } else {
        chip.textContent = resolveFieldAssetChip(config, field, null);
      }
    });
    if (currentForm?.fileButtons) {
      Object.entries(currentForm.fileButtons).forEach(([key, btn]) => {
        const field = config.fields?.find((entry) => entry.key === key);
        if (!field || field.note !== 'ai-asset') return;
        const label = resolveFieldAssetLabel(config, field);
        btn.title = `Upload ${label}`;
        btn.classList.remove('has-file');
      });
    }
    currentForm.aiMediaFile = null;
  }
}

function initComponentSelect() {
  els.componentPicker.innerHTML = '';
  COMPONENT_CONFIG.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.key;
    option.textContent = entry.label;
    els.componentPicker.appendChild(option);
  });
  currentComponentKey = COMPONENT_CONFIG[0]?.key || null;
}

function getNodeIdFromEventTarget(target) {
  if (!(target instanceof Element)) return null;
  const nodeEl = target.closest('[data-ew-node-id]');
  if (!nodeEl) return null;
  const nodeId = String(nodeEl.getAttribute('data-ew-node-id') || '').trim();
  if (!nodeId) return null;
  if (!view?.graph?.getNode(nodeId)) return null;
  return nodeId;
}

function isNodeContextMenuTarget(target) {
  return Boolean(target instanceof Element && target.closest('.ew-node-context-menu'));
}

function ensureNodeContextMenu() {
  if (nodeContextMenu.el) return nodeContextMenu.el;

  const menu = document.createElement('div');
  menu.className = 'ew-node-context-menu is-hidden';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-hidden', 'true');
  menu.setAttribute('aria-label', 'Node actions');

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ew-node-context-menu__item';
  copyBtn.dataset.action = 'copy';
  copyBtn.textContent = 'Copy';

  const focusBtn = document.createElement('button');
  focusBtn.type = 'button';
  focusBtn.className = 'ew-node-context-menu__item';
  focusBtn.dataset.action = 'focus';
  focusBtn.textContent = 'Focus';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'ew-node-context-menu__item';
  editBtn.dataset.action = 'edit';
  editBtn.textContent = 'Edit';

  menu.append(copyBtn, focusBtn, editBtn);
  menu.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  menu.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  menu.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = target.dataset.action;
    if (action === 'copy') {
      copyNodeContextTarget();
      return;
    }
    if (action === 'focus') {
      focusNodeContextTarget();
      return;
    }
    if (action === 'edit') {
      editNodeContextTarget();
    }
  });

  document.body.appendChild(menu);
  nodeContextMenu.el = menu;
  return menu;
}

function openNodeContextMenu(options = {}) {
  const nodeId = String(options.nodeId || '').trim();
  if (!nodeId) return;
  const menu = ensureNodeContextMenu();
  const margin = 8;

  nodeContextMenu.nodeId = nodeId;
  nodeContextMenu.open = true;

  menu.classList.remove('is-hidden');
  menu.setAttribute('aria-hidden', 'false');
  menu.style.left = '0px';
  menu.style.top = '0px';

  const width = menu.offsetWidth || 140;
  const height = menu.offsetHeight || 116;
  const x = Math.min(
    window.innerWidth - width - margin,
    Math.max(margin, Math.round(options.clientX || 0))
  );
  const y = Math.min(
    window.innerHeight - height - margin,
    Math.max(margin, Math.round(options.clientY || 0))
  );
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

window.elenweaveOpenNodeContextMenu = (options = {}) => {
  openNodeContextMenu(options);
};

function closeNodeContextMenu() {
  if (!nodeContextMenu.el) return;
  nodeContextMenu.nodeId = null;
  nodeContextMenu.open = false;
  nodeContextMenu.el.classList.add('is-hidden');
  nodeContextMenu.el.setAttribute('aria-hidden', 'true');
}

function toCopyText(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const text = toCopyText(value);
    if (text) return text;
  }
  return '';
}

function extractNodeVisibleText(node) {
  if (!node) return '';
  const data = node.data || {};
  const props = node.props || {};

  if (node.type === 'html-text') {
    return firstNonEmptyText(node.text, props.title, node.id);
  }

  switch (node.component) {
    case 'OptionPicker': {
      const label = toCopyText(props.label);
      const choice = toCopyText(data.choice);
      if (label && choice) return `${label}: ${choice}`;
      return firstNonEmptyText(choice, label, props.title, node.id);
    }
    case 'TextInput': {
      const label = toCopyText(props.label);
      const value = toCopyText(data.value);
      if (label && value) return `${label}: ${value}`;
      return firstNonEmptyText(value, label, props.title, node.id);
    }
    case 'DateTimeInput': {
      const label = toCopyText(props.label);
      const value = toCopyText(data.value);
      if (label && value) return `${label}: ${value}`;
      return firstNonEmptyText(value, label, props.title, node.id);
    }
    case 'SliderInput': {
      const label = toCopyText(props.label);
      const value = toCopyText(data.value);
      if (label && value) return `${label}: ${value}`;
      return firstNonEmptyText(value, label, props.title, node.id);
    }
    case 'MultiChoice': {
      const selected = toCopyText(data.selected);
      return firstNonEmptyText(selected, props.label, props.title, node.id);
    }
    case 'CodeSnippet':
      return firstNonEmptyText(data.code, props.filename, props.title, node.id);
    case 'MarkdownBlock':
      return firstNonEmptyText(data.markdown, props.title, node.id);
    case 'MermaidBlock':
      return firstNonEmptyText(data.mermaid, props.title, node.id);
    case 'SvgBlock':
      return firstNonEmptyText(data.svg, props.title, node.id);
    case 'ImageViewer':
    case 'VideoPlayer':
    case 'AudioPlayer':
      return firstNonEmptyText(props.title, data.assetName, data.src, node.id);
    default:
      return firstNonEmptyText(
        node.text,
        props.title,
        props.label,
        data.value,
        data.assetName,
        node.id
      );
  }
}

async function writeClipboardText(text) {
  const value = String(text ?? '');
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      // Fallback below.
    }
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.focus();
  input.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    copied = false;
  }
  document.body.removeChild(input);
  return copied;
}

async function copyNodeContentToClipboard(nodeId) {
  if (!nodeId || !view?.graph) return false;
  const node = view.graph.getNode(nodeId);
  if (!node) return false;
  const content = extractNodeVisibleText(node);
  return writeClipboardText(content);
}

async function copyNodeContextTarget() {
  const nodeId = nodeContextMenu.nodeId;
  closeNodeContextMenu();
  if (!nodeId) return;
  const copied = await copyNodeContentToClipboard(nodeId);
  if (copied) {
    setStatus('Copied node content.', 1400);
    return;
  }
  setStatus('Copy failed.', 1600);
}

function focusNodeContextTarget() {
  const nodeId = nodeContextMenu.nodeId;
  closeNodeContextMenu();
  if (!nodeId || !view?.graph) return;
  const node = view.graph.getNode(nodeId);
  if (!node) {
    setStatus('Node not found.', 1400);
    return;
  }
  if (typeof view.selectNode === 'function') {
    view.selectNode(nodeId);
  }
  if (view.canvas && view.camera) {
    const minZoom = view.minZoom || 0.3;
    const maxZoom = view.maxZoom || 2.5;
    const padding = 72;
    const width = Math.max(1, node.w || 1);
    const height = Math.max(1, node.h || 1);
    const availableW = Math.max(1, view.canvas.clientWidth - padding * 2);
    const availableH = Math.max(1, view.canvas.clientHeight - padding * 2);
    const scale = Math.min(availableW / width, availableH / height);
    view.camera.s = Math.min(maxZoom, Math.max(minZoom, scale));
    view.camera.x = -(node.x + node.w / 2) * view.camera.s + view.canvas.clientWidth / 2;
    view.camera.y = -(node.y + node.h / 2) * view.camera.s + view.canvas.clientHeight / 2;
    if (typeof view._invalidate === 'function') view._invalidate();
    setStatus('Focused on node.', 1200);
    return;
  }
  if (typeof view.moveTo === 'function') {
    view.moveTo(nodeId);
    setStatus('Focused on node.', 1200);
    return;
  }
  if (typeof view.focusNode === 'function') {
    view.focusNode(nodeId);
    setStatus('Focused on node.', 1200);
  }
}

function findLinkedCodeSnippet(previewNodeId) {
  if (!previewNodeId || !view?.graph) return null;
  const incoming = view.graph.edges.filter((edge) => edge.to === previewNodeId);
  for (let i = 0; i < incoming.length; i += 1) {
    const edge = incoming[i];
    const source = view.graph.getNode(edge.from);
    if (source?.component === 'CodeSnippet') return source;
  }
  return null;
}

function getCodeSnippetSource(node) {
  if (!node) return '';
  const data = node.data || {};
  if (data.code !== undefined && data.code !== null) return String(data.code);
  if (node.text !== undefined && node.text !== null) return String(node.text);
  if (node.props?.code !== undefined && node.props?.code !== null) return String(node.props.code);
  return '';
}

function syncHtmlPreviewFromLinkedCode(previewNodeId) {
  if (!previewNodeId || !view?.graph) return;
  const preview = view.graph.getNode(previewNodeId);
  if (!preview) return;
  const source = findLinkedCodeSnippet(previewNodeId);
  if (!source) {
    setStatus('Link a CodeSnippet node to sync.', 1600);
    return;
  }
  const html = getCodeSnippetSource(source);
  const nextData = { ...(preview.data || {}), html };
  view.updateNode(previewNodeId, { data: nextData });
  if (String(html || '').trim()) {
    setStatus('HTML preview updated.', 1200);
  } else {
    setStatus('No HTML found in linked CodeSnippet.', 1600);
  }
}

window.elenweaveSyncHtmlPreview = syncHtmlPreviewFromLinkedCode;

window.elenweaveResizeNode = ({ id, x, y, w, h } = {}) => {
  if (!id || !view?.graph) return;
  const node = view.graph.getNode(id);
  if (!node) return;
  const next = {};
  if (Number.isFinite(x)) next.x = x;
  if (Number.isFinite(y)) next.y = y;
  if (Number.isFinite(w)) next.w = w;
  if (Number.isFinite(h)) next.h = h;
  if (!Object.keys(next).length) return;
  view.updateNode(id, next);
};

function editNodeContextTarget() {
  const nodeId = nodeContextMenu.nodeId;
  closeNodeContextMenu();
  if (!nodeId || !view?.graph) return;
  const node = view.graph.getNode(nodeId);
  if (!node) {
    setStatus('Node not found.', 1400);
    return;
  }
  const configKey = node.type === 'html-text' ? 'HtmlText' : node.component || null;
  if (!configKey || !COMPONENT_LOOKUP.get(configKey)) {
    setStatus('Selected node is not editable from form.', 1800);
    return;
  }
  view.selectNode(nodeId);
  syncFormToNode(node);
  setStatus('Node ready to edit.', 1400);
}

function applyContextMenuConfig() {
  const addItems = COMPONENT_CONFIG.filter((entry) => !entry.uiOnly).map((entry) => ({
    id: `add-${entry.key}`,
    label: entry.label,
    nodeType: entry.nodeType || 'html',
    component: entry.nodeType === 'html-text' ? null : entry.component,
    size: entry.size,
    props: entry.component ? {} : null,
    data: entry.component ? {} : null,
    text: entry.nodeType === 'html-text' ? 'Editable text' : null
  }));
  view.setContextMenuConfig({ addItems });
}

function openModelMatrix() {
  if (!els.modelModal) return;
  els.modelModal.hidden = false;
  syncApiKeyInput();
  window.setTimeout(() => els.apiKeyInput?.focus(), 0);
}

function closeModelMatrix() {
  if (!els.modelModal) return;
  els.modelModal.hidden = true;
}

function getSelectedProvider() {
  const provider = els.providerSelect?.value || 'openai';
  return provider === 'gemini' ? 'gemini' : 'openai';
}

function formatProviderLabel(provider) {
  return provider === 'gemini' ? 'Gemini' : 'OpenAI';
}

function buildDefaultModelNote(provider) {
  const providerLabel = formatProviderLabel(provider);
  const localDefault = readModel(provider);
  const serverDefault = serverAiDefaultModels.get(provider);
  const fallback = AI_DEFAULT_MODELS[provider] || AI_DEFAULT_MODELS.openai;
  if (serverDefault) {
    return localDefault && localDefault !== serverDefault
      ? `Using server default: ${serverDefault}. Local override ignored.`
      : `Using server default: ${serverDefault}.`;
  }
  if (localDefault) {
    return `Saved locally for ${providerLabel}.`;
  }
  return `Using default: ${fallback}.`;
}

function buildTaskModelNote(provider, taskKey) {
  const providerLabel = formatProviderLabel(provider);
  const serverTask = serverAiTaskModels.get(provider)?.[taskKey];
  const localTask = readTaskModel(provider, taskKey);
  const serverDefault = serverAiDefaultModels.get(provider);
  const localDefault = readModel(provider);
  const fallback = AI_DEFAULT_MODELS[provider] || AI_DEFAULT_MODELS.openai;
  if (serverTask) {
    return localTask && localTask !== serverTask
      ? `Using server config: ${serverTask}. Local override ignored.`
      : `Using server config: ${serverTask}.`;
  }
  if (localTask) {
    return `Saved locally for ${providerLabel}.`;
  }
  if (serverDefault) {
    return localDefault && localDefault !== serverDefault
      ? `Using server default: ${serverDefault}. Local default ignored.`
      : `Using server default: ${serverDefault}.`;
  }
  if (localDefault) {
    return `Using local default: ${localDefault}.`;
  }
  return `Using default: ${fallback}.`;
}

function syncApiKeyInput() {
  if (!els.apiKeyInput || !els.providerSelect) return;
  const provider = getSelectedProvider();
  const key = readApiKey(provider);
  const model = readModel(provider);
  const serverProviderEnabled = hasServerAiProvider(provider);
  els.apiKeyInput.value = key || '';
  if (els.modelInput) {
    els.modelInput.value = model || '';
  }
  if (els.modelInputGeneral) {
    els.modelInputGeneral.value = readTaskModel(provider, 'general');
  }
  if (els.modelInputAppGen) {
    els.modelInputAppGen.value = readTaskModel(provider, 'appGen');
  }
  if (els.modelInputCodeExplain) {
    els.modelInputCodeExplain.value = readTaskModel(provider, 'codeExplain');
  }
  if (els.apiKeyNote) {
    if (serverProviderEnabled) {
      els.apiKeyNote.textContent = 'Server-side AI key detected from local config/env. Browser key is optional.';
    } else {
      els.apiKeyNote.textContent = key
        ? `Saved locally for ${provider === 'openai' ? 'OpenAI' : 'Gemini'}.`
        : 'Stored locally in this browser.';
    }
  }
  if (els.modelNote) {
    els.modelNote.textContent = buildDefaultModelNote(provider);
  }
  if (els.modelNoteGeneral) {
    els.modelNoteGeneral.textContent = buildTaskModelNote(provider, 'general');
  }
  if (els.modelNoteAppGen) {
    els.modelNoteAppGen.textContent = buildTaskModelNote(provider, 'appGen');
  }
  if (els.modelNoteCodeExplain) {
    els.modelNoteCodeExplain.textContent = buildTaskModelNote(provider, 'codeExplain');
  }
  saveProvider(provider);
}

function saveApiKey() {
  if (!els.apiKeyInput) return;
  const provider = getSelectedProvider();
  const key = String(els.apiKeyInput.value || '').trim();
  const model = String(els.modelInput?.value || '').trim();
  const generalModel = String(els.modelInputGeneral?.value || '').trim();
  const appGenModel = String(els.modelInputAppGen?.value || '').trim();
  const codeExplainModel = String(els.modelInputCodeExplain?.value || '').trim();
  if (!key) {
    setStatus('API key is empty.', 1400);
    return;
  }
  try {
    localStorage.setItem(`${AI_KEY_PREFIX}${provider}`, key);
    if (model) {
      localStorage.setItem(`${AI_MODEL_PREFIX}${provider}`, model);
    } else {
      localStorage.removeItem(`${AI_MODEL_PREFIX}${provider}`);
    }
    writeTaskModel(provider, 'general', generalModel);
    writeTaskModel(provider, 'appGen', appGenModel);
    writeTaskModel(provider, 'codeExplain', codeExplainModel);
  } catch (err) {
    setStatus('Unable to save API key.', 1600);
    return;
  }
  syncApiKeyInput();
  setStatus('API key saved locally.', 1600);
}

function clearApiKey() {
  const provider = getSelectedProvider();
  try {
    localStorage.removeItem(`${AI_KEY_PREFIX}${provider}`);
    localStorage.removeItem(`${AI_MODEL_PREFIX}${provider}`);
    localStorage.removeItem(taskModelStorageKey(provider, 'general'));
    localStorage.removeItem(taskModelStorageKey(provider, 'appGen'));
    localStorage.removeItem(taskModelStorageKey(provider, 'codeExplain'));
  } catch (err) {
    setStatus('Unable to clear API key.', 1600);
    return;
  }
  syncApiKeyInput();
  setStatus('API key cleared.', 1600);
}

function readApiKey(provider) {
  try {
    return localStorage.getItem(`${AI_KEY_PREFIX}${provider}`) || '';
  } catch (err) {
    return '';
  }
}

function readModel(provider) {
  try {
    return localStorage.getItem(`${AI_MODEL_PREFIX}${provider}`) || '';
  } catch (err) {
    return '';
  }
}

function taskModelStorageKey(provider, taskKey) {
  return `${AI_TASK_MODEL_PREFIX}${taskKey}_${provider}`;
}

function readTaskModel(provider, taskKey) {
  try {
    return localStorage.getItem(taskModelStorageKey(provider, taskKey)) || '';
  } catch (err) {
    return '';
  }
}

function writeTaskModel(provider, taskKey, value) {
  try {
    const key = taskModelStorageKey(provider, taskKey);
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    return;
  }
}

function resolveAiTask(message, attachments) {
  const text = String(message || '').toLowerCase();
  const hasTextAttachment = Boolean(attachments?.file && attachments?.kind === 'text');
  const appKeywords = [
    /\bapps?\b/,
    /\bgames?\b/,
    /\bcanvas\b/,
    /\binteractive\b/,
    /\bdemos?\b/,
    /\bprototypes?\b/
  ];
  const appVerbs = ['build', 'create', 'make', 'generate', 'design', 'produce'];
  const hasAppKeyword = appKeywords.some((pattern) => pattern.test(text));
  const hasHtmlGen = text.includes('html')
    && appVerbs.some((verb) => text.includes(verb));
  if (hasAppKeyword || hasHtmlGen) return 'appGen';
  if (hasTextAttachment) return 'codeExplain';
  if (text.includes('explain') && (text.includes('code') || text.includes('file') || text.includes('snippet'))) {
    return 'codeExplain';
  }
  return 'general';
}

function resolveAiModelForTask(provider, taskKey) {
  const normalizedTask = AI_TASK_KEYS.includes(taskKey) ? taskKey : 'general';
  const serverTask = serverAiTaskModels.get(provider)?.[normalizedTask];
  if (serverTask) return serverTask;
  const localTask = readTaskModel(provider, normalizedTask);
  if (localTask) return localTask;
  const serverDefault = serverAiDefaultModels.get(provider);
  if (serverDefault) return serverDefault;
  const localDefault = readModel(provider);
  if (localDefault) return localDefault;
  return AI_DEFAULT_MODELS[provider] || AI_DEFAULT_MODELS.openai;
}

function resolveAiModel(provider) {
  return resolveAiModelForTask(provider, 'general');
}

function loadProvider() {
  try {
    const saved = localStorage.getItem(AI_PROVIDER_KEY);
    return saved === 'gemini' ? 'gemini' : 'openai';
  } catch (err) {
    return 'openai';
  }
}

function saveProvider(provider) {
  try {
    localStorage.setItem(AI_PROVIDER_KEY, provider);
  } catch (err) {
    return;
  }
}

function setStatus(message, timeout = 2000) {
  if (!els.status) return;
  els.status.textContent = message;
  if (statusTimer) window.clearTimeout(statusTimer);
  if (timeout > 0) {
    statusTimer = window.setTimeout(() => {
      els.status.textContent = 'Ready.';
    }, timeout);
  }
}

function patchNavigatorCenter() {
  if (!ewNavigator || typeof ewNavigator.centerOnSelection !== 'function') return;
  const original = ewNavigator.centerOnSelection.bind(ewNavigator);
  ewNavigator.centerOnSelection = () => {
    const node = typeof ewNavigator._getSelectedNode === 'function'
      ? ewNavigator._getSelectedNode()
      : null;
    if (node) {
      original();
      return;
    }
    fitContentToView();
  };
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

function boardScopeProjectId(projectId) {
  return projectId || activeProjectId || 'local-default';
}

function boardCompositeKey(projectId, boardId) {
  return `${projectId}::${boardId}`;
}

function getBoardIndexEntry(boardId, projectId = boardScopeProjectId()) {
  return boardIndex.find((entry) => entry.id === boardId && (entry.projectId || null) === (projectId || null)) || null;
}

function getBoardIndexEntriesById(boardId) {
  return boardIndex.filter((entry) => entry.id === boardId);
}

function getBoardsForProject(projectId) {
  return boardIndex.filter((entry) => (entry.projectId || null) === (projectId || null));
}

function removeBoardsForProject(projectId) {
  boardIndex = boardIndex.filter((entry) => (entry.projectId || null) !== (projectId || null));
}

function upsertBoardIndexEntry(entry) {
  const projectId = boardScopeProjectId(entry?.projectId);
  const boardId = String(entry?.id || '');
  if (!projectId || !boardId) return null;
  const conflict = getBoardIndexEntriesById(boardId).find((item) => (item.projectId || null) !== (projectId || null));
  if (conflict) {
    console.warn('Refusing to link board id across multiple projects', {
      boardId,
      incomingProjectId: projectId,
      existingProjectId: conflict.projectId
    });
    return null;
  }
  const existing = getBoardIndexEntry(boardId, projectId);
  if (existing) {
    Object.assign(existing, {
      name: entry?.name || existing.name || 'Untitled',
      updatedAt: entry?.updatedAt || existing.updatedAt || Date.now(),
      projectId
    });
    return existing;
  }
  const row = {
    id: boardId,
    projectId,
    name: entry?.name || 'Untitled',
    updatedAt: entry?.updatedAt || Date.now()
  };
  boardIndex.push(row);
  return row;
}

function ensureBoardIndexEntry(id, name, projectId = boardScopeProjectId()) {
  if (!id) return null;
  const existing = getBoardIndexEntry(id, projectId);
  if (existing) {
    if (name && existing.name !== name) existing.name = name;
    return existing;
  }
  const conflicts = getBoardIndexEntriesById(id).filter((entry) => (entry.projectId || null) !== (projectId || null));
  if (conflicts.length) {
    console.warn('Board id collision across projects', { boardId: id, projectId, conflicts: conflicts.map((entry) => entry.projectId) });
  }
  return upsertBoardIndexEntry({
    id,
    projectId,
    name: name || 'Untitled',
    updatedAt: Date.now()
  });
}

function updateBoardIndexEntry(id, patch = {}) {
  if (!id) return null;
  const projectId = boardScopeProjectId(patch.projectId);
  const entry = ensureBoardIndexEntry(id, patch.name, projectId);
  if (!entry) return null;
  if ((entry.projectId || null) !== (projectId || null)) {
    console.warn('Skipped board index update due project ownership mismatch', {
      boardId: id,
      expectedProjectId: projectId,
      actualProjectId: entry.projectId
    });
    return null;
  }
  Object.assign(entry, { ...patch, projectId });
  return entry;
}

function ensureProjectIndexEntry(id, name) {
  if (!id) return null;
  const existing = projectIndex.find((entry) => entry.id === id);
  if (existing) {
    if (name && existing.name !== name) existing.name = name;
    return existing;
  }
  const entry = {
    id,
    name: name || 'Untitled Project',
    updatedAt: Date.now()
  };
  projectIndex.push(entry);
  return entry;
}

function updateProjectIndexEntry(id, patch = {}) {
  if (!id) return null;
  const entry = ensureProjectIndexEntry(id, patch.name);
  if (!entry) return null;
  Object.assign(entry, patch);
  return entry;
}

function getActiveProjectBoards() {
  return getBoardsForProject(activeProjectId);
}

function validateBoardIndexInvariants() {
  const seen = new Set();
  for (const entry of boardIndex) {
    if (!entry?.id || !entry?.projectId) {
      console.warn('Invalid board index entry', entry);
      continue;
    }
    const key = boardCompositeKey(entry.projectId, entry.id);
    if (seen.has(key)) {
      console.warn('Duplicate board index entry', entry);
      continue;
    }
    seen.add(key);
  }
}

function refreshProjectList() {
  if (!els.projectSelect) return;
  if (activeProjectEdit?.projectId && !projectIndex.some((entry) => entry.id === activeProjectEdit.projectId)) {
    cancelProjectEdit({ force: true });
  }
  const current = activeProjectId;
  els.projectSelect.innerHTML = '';
  projectIndex.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    els.projectSelect.appendChild(option);
  });
  if (current && projectIndex.some((entry) => entry.id === current)) {
    els.projectSelect.value = current;
  } else if (projectIndex.length) {
    els.projectSelect.value = projectIndex[0].id;
  }
}

async function refreshProjectsFromServer() {
  if (!IS_SERVER_MODE || forceClientMode) return;
  try {
    const payload = await apiFetch('/api/projects');
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    projectIndex = projects.map((entry) => mapProjectEntry(entry)).filter((entry) => entry.id);
    refreshProjectList();
  } catch (err) {
    console.warn('Project refresh failed', err);
  }
}

function generateProjectId() {
  let id = '';
  do {
    const seed = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
    id = `p_${seed.replace(/[^a-z0-9]/gi, '').slice(0, 10)}`;
  } while (projectIndex.some((entry) => entry.id === id));
  return id;
}

function generateBoardId() {
  let id = '';
  do {
    const seed = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
    id = `g_${seed.replace(/[^a-z0-9]/gi, '').slice(0, 10)}`;
  } while (boardIndex.some((entry) => entry.id === id));
  return id;
}

function cloneBoardForLocalFork(payload, sourceProjectId, localBoardId) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  clone.id = localBoardId;
  clone.name = clone.name || 'Untitled';
  if (!Array.isArray(clone.nodes)) clone.nodes = [];
  clone.nodes = clone.nodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    if (!node.data || typeof node.data !== 'object' || !node.data.assetId) return node;
    const remoteSrc = buildServerAssetUrl(sourceProjectId, node.data.assetId, node.data.src || '');
    return {
      ...node,
      data: {
        ...node.data,
        remoteSrc,
        remoteProjectId: sourceProjectId,
        src: remoteSrc
      }
    };
  });
  return clone;
}

async function fetchServerJson(path) {
  const response = await fetch(`${SERVER_BASE}${path}`, { method: 'GET' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status}).`);
  }
  return response.json().catch(() => null);
}

function setLocalForkMode(value) {
  forceClientMode = Boolean(value);
  saveLocalForkMode(forceClientMode);
  if (forceClientMode) {
    stopProjectPolling();
  } else {
    startProjectPolling();
  }
}

async function activateLocalForkMode(options = {}) {
  if (!IS_SERVER_MODE || READ_ONLY_FORK_MODE !== 'local') return false;
  if (forceClientMode) {
    if (!localForkNoticeShown) {
      setStatus('Read-only hosted data. Editing local fork.', 0);
      localForkNoticeShown = true;
    }
    return true;
  }

  const sourceProjectId = String(options.projectId || activeProjectId || '').trim();
  let sourceProjectName = 'Hosted Project';
  let sourceBoards = [];
  let sourceActiveBoardId = activeBoardId;

  if (sourceProjectId) {
    try {
      const projectPayload = await fetchServerJson(`/api/projects/${encodeURIComponent(sourceProjectId)}`);
      const project = projectPayload?.project || null;
      if (project?.name) sourceProjectName = String(project.name);
    } catch (err) {
      sourceProjectName = 'Hosted Project';
    }
    try {
      const boardsPayload = await fetchServerJson(`/api/projects/${encodeURIComponent(sourceProjectId)}/boards`);
      const boardRows = Array.isArray(boardsPayload?.boards) ? boardsPayload.boards : [];
      for (const entry of boardRows) {
        const boardId = String(entry?.id || '').trim();
        if (!boardId) continue;
        const payload = await fetchServerJson(`/api/projects/${encodeURIComponent(sourceProjectId)}/boards/${encodeURIComponent(boardId)}`);
        if (!payload?.board?.id) continue;
        sourceBoards.push(payload.board);
      }
    } catch (err) {
      console.warn('Local fork bootstrap: board fetch failed', err);
    }
  }

  setLocalForkMode(true);

  const forkProjectId = generateProjectId();
  const forkProjectName = `${sourceProjectName} (Local Fork)`;
  ensureProjectIndexEntry(forkProjectId, forkProjectName);
  updateProjectIndexEntry(forkProjectId, { name: forkProjectName, updatedAt: Date.now() });
  activeProjectId = forkProjectId;

  let nextActiveBoardId = null;
  for (const sourceBoard of sourceBoards) {
    const localBoardId = generateBoardId();
    const localPayload = cloneBoardForLocalFork(sourceBoard, sourceProjectId, localBoardId);
    boardIndex.push({
      id: localBoardId,
      projectId: forkProjectId,
      name: String(localPayload.name || sourceBoard?.name || 'Untitled'),
      updatedAt: Number(localPayload.updatedAt || Date.now())
    });
    await saveGraphPayload(localBoardId, scrubExportPayload(localPayload));
    if (!nextActiveBoardId || sourceBoard.id === sourceActiveBoardId) {
      nextActiveBoardId = localBoardId;
    }
  }

  if (!nextActiveBoardId) {
    const created = await createLocalBoard('', {
      activate: false,
      queueEdit: false
    });
    nextActiveBoardId = created?.id || null;
  }

  await saveWorkspaceIndex();
  refreshProjectList();
  refreshBoardList();
  if (nextActiveBoardId) {
    await activateBoard(nextActiveBoardId, { skipSave: true, projectId: forkProjectId });
  }
  const reasonText = String(options.reason || '').trim();
  setStatus(
    reasonText
      ? `Read-only hosted data (${reasonText}). Editing local fork.`
      : 'Read-only hosted data. Editing local fork.',
    0
  );
  localForkNoticeShown = true;
  return true;
}

function createEmptyGraphPayload(id, name) {
  return {
    id,
    name,
    meta: null,
    nodeOrder: [],
    nodes: [],
    edges: [],
    notifications: []
  };
}

function formatBoardTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds())
  ].join('');
}

function resolveBoardName(name) {
  const trimmed = String(name || '').trim();
  return trimmed || formatBoardTimestamp();
}

async function saveActiveGraph() {
  if (!view?.graph) return;
  const payload = view.exportGraph();
  if (!payload?.id) return;
  const boardId = payload.id;
  const fallbackProjectId = activeProjectId || 'local-default';
  const scopedEntry = getBoardIndexEntry(boardId, fallbackProjectId);
  const ownerEntries = getBoardIndexEntriesById(boardId);
  if (!scopedEntry && ownerEntries.length) {
    console.warn('Skipping board save due ownership mismatch', {
      boardId,
      activeProjectId: fallbackProjectId,
      owners: ownerEntries.map((entry) => entry.projectId)
    });
    return;
  }
  const ownerProjectId = scopedEntry?.projectId || fallbackProjectId;
  const cleaned = scrubExportPayload(payload);
  await saveGraphPayload(boardId, cleaned, ownerProjectId);
  updateBoardIndexEntry(boardId, {
    projectId: ownerProjectId,
    name: cleaned.name || 'Untitled',
    updatedAt: Date.now()
  });
  await saveWorkspaceIndex();
}

async function createLocalBoard(name, options = {}) {
  const projectId = activeProjectId || 'local-default';
  const resolvedName = resolveBoardName(name);
  ensureProjectIndexEntry(projectId, projectId === 'local-default' ? 'Local Project' : undefined);
  const id = generateBoardId();
  const entry = {
    id,
    projectId,
    name: resolvedName,
    updatedAt: Date.now()
  };
  boardIndex.push(entry);
  await saveGraphPayload(id, createEmptyGraphPayload(id, entry.name));
  if (options.activate !== false) {
    await activateBoard(id, {
      skipSave: Boolean(options.skipSaveOnActivate),
      projectId
    });
  }
  if (options.queueEdit) {
    queueBoardEdit(id);
  }
  return entry;
}

async function createProject(name) {
  if (await ensureServerMode()) {
    try {
      const response = await apiFetch('/api/projects', {
        method: 'POST',
        body: { name: name || 'Untitled Project' }
      });
      const project = response?.project;
      if (!project?.id) throw new Error('Project create failed');
      ensureProjectIndexEntry(project.id, project.name || name || 'Untitled Project');
      await activateProject(project.id, { skipSave: true, createBoardIfEmpty: false });
      setStatus('Project created.');
      return;
    } catch (err) {
      console.warn('Project create failed', err);
      if (!err?.forkedToLocal) {
        setStatus('Project create failed.');
        return;
      }
    }
  }
  const id = generateProjectId();
  const entry = {
    id,
    name: name || 'Untitled Project',
    updatedAt: Date.now()
  };
  projectIndex.push(entry);
  await activateProject(id, { force: true, createBoardIfEmpty: false });
  setStatus('Project created.');
}

async function renameProject(projectId, name) {
  const id = String(projectId || '').trim();
  const nextName = String(name || '').trim();
  if (!id) return false;
  if (!nextName) {
    setStatus('Project name is empty.', 1600);
    return false;
  }
  const existing = projectIndex.find((entry) => entry.id === id);
  if (!existing) return false;
  if (nextName === existing.name) return true;

  if (await ensureServerMode()) {
    try {
      const response = await apiFetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { name: nextName }
      });
      const project = response?.project;
      updateProjectIndexEntry(id, {
        name: project?.name || nextName,
        updatedAt: project?.updatedAt || Date.now()
      });
      refreshProjectList();
      setStatus('Project renamed.');
      return true;
    } catch (err) {
      console.warn('Project rename failed', err);
      if (!err?.forkedToLocal) {
        setStatus('Project rename failed.', 1800);
        return false;
      }
    }
  }

  updateProjectIndexEntry(id, {
    name: nextName,
    updatedAt: Date.now()
  });
  await saveWorkspaceIndex();
  refreshProjectList();
  setStatus('Project renamed.');
  return true;
}

function startProjectEdit(projectId = activeProjectId) {
  if (!projectId) {
    setStatus('Select a project first.', 1500);
    return;
  }
  const project = projectIndex.find((entry) => entry.id === projectId);
  if (!project || !els.projectSelect || !els.projectSelectWrap) return;

  if (activeProjectEdit?.projectId === projectId) {
    activeProjectEdit.input?.focus();
    activeProjectEdit.input?.select();
    return;
  }
  if (activeProjectEdit) {
    cancelProjectEdit({ force: true });
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'project-rename-input';
  input.value = project.name || 'Untitled Project';
  input.setAttribute('aria-label', 'Rename project');

  els.projectSelectWrap.classList.add('is-editing');
  els.projectSelectWrap.appendChild(input);
  els.projectSelect.disabled = true;
  els.projectSelect.setAttribute('aria-hidden', 'true');
  els.btnRenameProject?.setAttribute('aria-pressed', 'true');
  if (els.btnRenameProject) {
    els.btnRenameProject.disabled = true;
  }

  activeProjectEdit = {
    projectId,
    originalName: project.name || 'Untitled Project',
    input,
    committing: false
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitProjectEdit(input.value);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelProjectEdit({ restoreFocus: true, force: true });
    }
  });
  input.addEventListener('blur', () => {
    commitProjectEdit(input.value);
  });

  input.focus();
  input.select();
}

async function commitProjectEdit(value) {
  const session = activeProjectEdit;
  if (!session?.projectId || session.committing) return;
  const nextName = String(value || '').trim();
  if (!nextName) {
    setStatus('Project name is empty.', 1600);
    session.input?.focus();
    session.input?.select();
    return;
  }
  if (nextName === session.originalName) {
    cancelProjectEdit({ force: true });
    return;
  }
  session.committing = true;
  const ok = await renameProject(session.projectId, nextName);
  if (activeProjectEdit !== session) return;
  if (ok) {
    cancelProjectEdit({ force: true });
    return;
  }
  session.committing = false;
  session.input?.focus();
  session.input?.select();
}

function cancelProjectEdit(options = {}) {
  const session = activeProjectEdit;
  if (!session) return;
  if (session.committing && !options.force) return;
  session.input?.remove();
  els.projectSelectWrap?.classList.remove('is-editing');
  if (els.projectSelect) {
    els.projectSelect.disabled = false;
    els.projectSelect.removeAttribute('aria-hidden');
  }
  if (els.btnRenameProject) {
    els.btnRenameProject.disabled = false;
    els.btnRenameProject.removeAttribute('aria-pressed');
  }
  activeProjectEdit = null;
  if (options.restoreFocus && els.projectSelect) {
    els.projectSelect.focus();
  }
}

async function activateProject(projectId, options = {}) {
  if (!projectId) return;
  if (!projectIndex.some((entry) => entry.id === projectId)) return;
  if (activeProjectId === projectId && !options.force) return;
  cancelProjectEdit({ force: true });
  stopProjectPolling();
  const switchSeq = ++projectSwitchSeq;
  projectSwitchDepth += 1;

  try {
    if (!options.skipSave) {
      await saveActiveGraph();
      if (switchSeq !== projectSwitchSeq) return;
    }

    activeProjectId = projectId;
    activeBoardId = null;
    refreshProjectList();
    refreshBoardList();

    if (await ensureServerMode()) {
      const boardsPayload = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/boards`);
      if (switchSeq !== projectSwitchSeq) return;
      const fetchedBoards = Array.isArray(boardsPayload?.boards)
        ? boardsPayload.boards.map((entry) => ({
          id: entry.id,
          projectId,
          name: entry.name || 'Untitled',
          updatedAt: entry.updatedAt || Date.now()
        }))
        : [];
      removeBoardsForProject(projectId);
      fetchedBoards.forEach((entry) => upsertBoardIndexEntry(entry));

      let nextBoardId = loadActiveBoardIdForProject(projectId);
      const projectBoards = getBoardsForProject(projectId);
      if (!projectBoards.some((entry) => entry.id === nextBoardId)) {
        nextBoardId = projectBoards[0]?.id || null;
      }

      if (!nextBoardId && options.createBoardIfEmpty === true) {
        const fallbackName = resolveBoardName('');
        const created = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/boards`, {
          method: 'POST',
          body: { name: fallbackName }
        });
        if (switchSeq !== projectSwitchSeq) return;
        const board = created?.board;
        if (board?.id) {
          upsertBoardIndexEntry({
            id: board.id,
            projectId,
            name: board.name || fallbackName,
            updatedAt: board.updatedAt || Date.now()
          });
          nextBoardId = board.id;
        }
      }

      if (switchSeq !== projectSwitchSeq) return;
      activeBoardId = nextBoardId;
      await saveWorkspaceIndex();
      if (switchSeq !== projectSwitchSeq) return;
      refreshProjectList();
      refreshBoardList();
      if (nextBoardId) {
        await activateBoard(nextBoardId, { skipSave: true, projectId });
      } else {
        clearBoardViewForEmptyProject();
      }
      validateBoardIndexInvariants();
      return;
    }

    const localProjectId = forceClientMode && activeProjectId ? activeProjectId : projectId;
    activeProjectId = localProjectId;
    let nextBoardId = loadActiveBoardIdForProject(localProjectId);
    const boards = getBoardsForProject(localProjectId);
    if (!boards.some((entry) => entry.id === nextBoardId)) {
      nextBoardId = boards[0]?.id || null;
    }
    if (!nextBoardId && options.createBoardIfEmpty === true) {
      const created = await createLocalBoard('', {
        activate: false,
        queueEdit: false
      });
      if (switchSeq !== projectSwitchSeq) return;
      nextBoardId = created.id;
    }
    if (switchSeq !== projectSwitchSeq) return;
    activeBoardId = nextBoardId;
    await saveWorkspaceIndex();
    if (switchSeq !== projectSwitchSeq) return;
    refreshProjectList();
    refreshBoardList();
    if (nextBoardId) {
      await activateBoard(nextBoardId, { skipSave: true, projectId: localProjectId });
    } else {
      clearBoardViewForEmptyProject();
    }
    validateBoardIndexInvariants();
  } catch (err) {
    console.warn('Project activation failed', err);
    setStatus('Project load failed.', 1800);
  } finally {
    projectSwitchDepth = Math.max(0, projectSwitchDepth - 1);
    startProjectPolling();
  }
}

async function activateBoard(boardId, options = {}) {
  const projectId = boardScopeProjectId(options.projectId);
  if (!boardId || isBoardSwitching) return;
  if (activeBoardId === boardId && view?.graph && activeProjectId === projectId) return;
  isBoardSwitching = true;
  try {
    if (!options.skipSave) {
      await saveActiveGraph();
    }
    activeProjectId = projectId;
    const scopedEntry = getBoardIndexEntry(boardId, projectId);
    if (!scopedEntry) {
      const conflicts = getBoardIndexEntriesById(boardId).filter((entry) => (entry.projectId || null) !== (projectId || null));
      if (conflicts.length) {
        console.warn('Board ownership conflict during activateBoard', { boardId, projectId, conflicts: conflicts.map((entry) => entry.projectId) });
        return;
      }
    }
    let payload = await loadGraphPayload(boardId);
    const entry = ensureBoardIndexEntry(boardId, payload?.name || scopedEntry?.name || 'Untitled', projectId);
    if (!payload) {
      payload = createEmptyGraphPayload(boardId, entry?.name || 'Untitled');
      await saveGraphPayload(boardId, payload);
    }
    workspace.clear();
    view.importGraph(payload, { makeActive: true });
    activeBoardId = boardId;
    await saveWorkspaceIndex();
    validateBoardIndexInvariants();
    syncAppUrl();
  } catch (err) {
    console.warn('Board activation failed', err);
  } finally {
    isBoardSwitching = false;
  }
}

async function createBoard(name) {
  const resolvedName = resolveBoardName(name);
  if (await ensureServerMode()) {
    try {
      if (!activeProjectId) {
        setStatus('Select a project first.', 1800);
        return;
      }
      const response = await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/boards`, {
        method: 'POST',
        body: { name: resolvedName }
      });
      const board = response?.board;
      if (!board?.id) throw new Error('Board create failed');
      const entry = {
        id: board.id,
        projectId: activeProjectId,
        name: board.name || resolvedName,
        updatedAt: board.updatedAt || Date.now()
      };
      boardIndex.push(entry);
      await activateBoard(board.id, { projectId: activeProjectId });
      setStatus('Board created.');
      queueBoardEdit(board.id);
      return;
    } catch (err) {
      console.warn('Board create failed', err);
      if (!err?.forkedToLocal) {
        setStatus('Board create failed.');
        return;
      }
    }
  }
  await createLocalBoard(resolvedName, {
    activate: true,
    queueEdit: true
  });
  setStatus('Board created.');
}

function clearBoardViewForEmptyProject() {
  closeNodeContextMenu();
  selectedNodeId = null;
  selectedEdgeId = null;
  clearSelectedNodeClass();
  realtimeTurnNodes = new Map();
  resetAiContext();
  updateEdgeFields(null);
  workspace.clear();
  collapseNotificationPanel();
  syncAppUrl();
  updateShareLinkButton();
}

function setDeleteBoardModalOpen(open) {
  if (!els.deleteBoardModal) return;
  const isOpen = Boolean(open);
  els.deleteBoardModal.hidden = !isOpen;
  if (!isOpen) {
    pendingDeleteBoard = null;
    return;
  }
  if (els.deleteBoardConfirm) {
    els.deleteBoardConfirm.focus();
  }
}

function requestDeleteActiveBoard() {
  if (isBoardDeleting) return;
  const projectId = activeProjectId || 'local-default';
  const boards = getBoardsForProject(projectId);
  if (!activeBoardId || !boards.length) {
    setStatus('No active board to delete.', 1500);
    updateDeleteBoardButton();
    return;
  }
  const activeEntry = boards.find((entry) => entry.id === activeBoardId) || null;
  if (!activeEntry) {
    setStatus('No active board to delete.', 1500);
    updateDeleteBoardButton();
    return;
  }
  pendingDeleteBoard = {
    id: activeEntry.id,
    projectId,
    name: activeEntry.name || 'Untitled'
  };
  if (els.deleteBoardMessage) {
    els.deleteBoardMessage.textContent = `Delete board "${pendingDeleteBoard.name}"? This cannot be undone.`;
  }
  setDeleteBoardModalOpen(true);
}

async function confirmDeleteBoard() {
  if (!pendingDeleteBoard) {
    setDeleteBoardModalOpen(false);
    return;
  }
  const target = pendingDeleteBoard;
  setDeleteBoardModalOpen(false);
  await deleteBoardById(target.id, target.projectId);
}

async function deleteBoardById(boardId, projectId) {
  if (isBoardDeleting) return;
  const scopedProjectId = projectId || activeProjectId || 'local-default';
  const boards = getBoardsForProject(scopedProjectId);
  const entryIndex = boards.findIndex((entry) => entry.id === boardId);
  const entry = entryIndex >= 0 ? boards[entryIndex] : null;
  if (!entry) {
    setStatus('Board not found.', 1500);
    updateDeleteBoardButton();
    return;
  }

  isBoardDeleting = true;
  updateDeleteBoardButton();
  try {
    cancelBoardEdit();
    await deleteGraphPayload(boardId);
    boardIndex = boardIndex.filter((row) => !(
      row.id === boardId
      && (row.projectId || null) === (scopedProjectId || null)
    ));
    const remainingBoards = getBoardsForProject(scopedProjectId);
    validateBoardIndexInvariants();

    if (boardId === activeBoardId && (activeProjectId || 'local-default') === scopedProjectId) {
      if (remainingBoards.length) {
        const nextIndex = Math.max(0, Math.min(entryIndex, remainingBoards.length - 1));
        const nextBoardId = remainingBoards[nextIndex]?.id || remainingBoards[0].id;
        await activateBoard(nextBoardId, { skipSave: true, projectId: scopedProjectId });
      } else {
        activeBoardId = null;
        clearBoardViewForEmptyProject();
      }
    }

    await saveWorkspaceIndex();
    refreshBoardList();
    setStatus(remainingBoards.length ? 'Board deleted.' : 'Board deleted. Project is now empty.', 1700);
  } catch (err) {
    console.warn('Board delete failed', err);
    setStatus('Board delete failed.', 2000);
  } finally {
    isBoardDeleting = false;
    updateDeleteBoardButton();
  }
}

async function importBoardPayload(payload) {
  if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return null;
  if (!activeProjectId) {
    activeProjectId = 'local-default';
    ensureProjectIndexEntry(activeProjectId, 'Local Project');
  }
  const desiredId = payload.id || generateBoardId();
  const id = boardIndex.some((entry) => entry.id === desiredId) ? generateBoardId() : desiredId;
  const name = payload.name || 'Imported board';
  const entry = {
    id,
    projectId: activeProjectId || 'local-default',
    name,
    updatedAt: Date.now()
  };
  boardIndex.push(entry);
  const cleanPayload = {
    ...payload,
    id,
    name
  };
  await saveGraphPayload(id, scrubExportPayload(cleanPayload));
  await activateBoard(id, { projectId: activeProjectId || 'local-default' });
  return id;
}

function refreshBoardList() {
  if (!els.boardList) return;
  els.boardList.innerHTML = '';
  getActiveProjectBoards().forEach((board) => {
    const btn = document.createElement('button');
    btn.className = `board-item${board.id === activeBoardId ? ' active' : ''}`;
    btn.type = 'button';
    btn.dataset.boardId = board.id;
    const label = document.createElement('span');
    label.textContent = board.name;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      if (activeBoardEdit) return;
      activateBoard(board.id, { projectId: board.projectId || activeProjectId || 'local-default' });
    });
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      startBoardEdit(btn, board);
    });
    els.boardList.appendChild(btn);
  });
  flushQueuedBoardEdit();
  updateDeleteBoardButton();
}

function queueBoardEdit(graphId) {
  activeBoardEdit = { pendingId: graphId, el: null, input: null };
  flushQueuedBoardEdit();
}

function flushQueuedBoardEdit() {
  if (!activeBoardEdit?.pendingId) return;
  const btn = els.boardList.querySelector(`[data-board-id="${activeBoardEdit.pendingId}"]`);
  const board = getActiveProjectBoards().find((entry) => entry.id === activeBoardEdit.pendingId);
  if (btn && board) startBoardEdit(btn, board);
}

function startBoardEdit(btn, board) {
  if (!btn || !board) return;
  if (activeBoardEdit?.input) {
    commitBoardEdit(activeBoardEdit.input.value);
  }
  btn.classList.add('editing');
  btn.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = board.name;
  btn.appendChild(input);
  input.focus();
  input.select();
  activeBoardEdit = { id: board.id, el: btn, input, pendingId: null };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitBoardEdit(input.value);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelBoardEdit();
    }
  };

  const onBlur = () => commitBoardEdit(input.value);

  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
}

function commitBoardEdit(value) {
  if (!activeBoardEdit?.id) return;
  const edit = activeBoardEdit;
  const boardId = edit.id;
  const name = String(value || '').trim();
  const preferredProjectId = activeProjectId || 'local-default';
  const boardProjectId = getBoardIndexEntry(boardId, preferredProjectId)?.projectId
    || getBoardIndexEntriesById(boardId)[0]?.projectId
    || preferredProjectId;
  if (name) {
    updateBoardIndexEntry(boardId, {
      projectId: boardProjectId,
      name,
      updatedAt: Date.now()
    });
    if (view.graph && view.graph.id === boardId) {
      workspace.renameGraph(boardId, name);
    }
    ensureServerMode()
      .then((useServer) => {
        if (useServer) {
          if (!boardProjectId || boardProjectId === 'local-default') return null;
          return apiFetch(`/api/projects/${encodeURIComponent(boardProjectId)}/boards/${encodeURIComponent(boardId)}`, {
            method: 'PATCH',
            body: { name }
          });
        }
        return saveWorkspaceIndex();
      })
      .catch((err) => {
        console.warn('Board rename save failed', err);
        if (err?.forkedToLocal) {
          saveWorkspaceIndex().catch((saveErr) => {
            console.warn('Board rename local save failed', saveErr);
          });
        }
      });
    setStatus('Board renamed.');
  }
  activeBoardEdit = null;
  refreshBoardList();
}

function cancelBoardEdit() {
  activeBoardEdit = null;
  refreshBoardList();
}

function cycleBoard(direction) {
  const boards = getActiveProjectBoards();
  if (!boards.length) return;
  const idx = boards.findIndex((b) => b.id === activeBoardId);
  const next = (idx + direction + boards.length) % boards.length;
  activateBoard(boards[next].id, { projectId: boards[next].projectId || activeProjectId || 'local-default' });
}

function exportBoard() {
  const payload = view.exportGraph();
  if (!payload) {
    setStatus('No active board to export.');
    return;
  }
  const cleaned = scrubExportPayload(payload);
  const filename = `${(payload.name || 'board').replace(/\s+/g, '-').toLowerCase()}.json`;
  downloadJson(filename, cleaned);
  setStatus('Board exported.');
}

function scrubExportPayload(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  if (!Array.isArray(clone.nodes)) return clone;
  clone.nodes.forEach((node) => {
    if (node.data && node.data.assetId && !node.data.remoteSrc) {
      delete node.data.src;
    }
  });
  return clone;
}

function ensureGraphMeta(graph) {
  if (!graph) return null;
  if (!graph.meta || typeof graph.meta !== 'object') {
    graph.meta = {};
  }
  return graph.meta;
}

function truncateAiHistoryText(value, limit = AI_HISTORY_TEXT_LIMIT) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function truncateAttachmentText(value, limit = AI_ATTACHMENT_TEXT_LIMIT) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function getAiHistoryEntries() {
  const meta = ensureGraphMeta(view?.graph);
  if (!meta) return [];
  const history = Array.isArray(meta[AI_HISTORY_KEY]) ? meta[AI_HISTORY_KEY] : [];
  return history.slice(-AI_HISTORY_LIMIT);
}

function recordAiHistory({ message, response, provider, model, toolTrace = null }) {
  const graph = view?.graph;
  const meta = ensureGraphMeta(graph);
  if (!meta) return;
  const history = Array.isArray(meta[AI_HISTORY_KEY]) ? meta[AI_HISTORY_KEY] : [];
  const trace = Array.isArray(toolTrace)
    ? toolTrace.slice(-8).map((entry) => ({
      name: String(entry?.name || ''),
      status: String(entry?.status || ''),
      durationMs: Number.isFinite(entry?.durationMs) ? entry.durationMs : null
    }))
    : null;
  history.push({
    ts: Date.now(),
    user: truncateAiHistoryText(message),
    assistant: truncateAiHistoryText(response),
    provider: provider || null,
    model: model || null,
    toolTrace: trace
  });
  meta[AI_HISTORY_KEY] = history.slice(-AI_HISTORY_LIMIT);
  graph.meta = meta;
  if (typeof scheduleWorkspaceSave === 'function') {
    scheduleWorkspaceSave();
  }
}

function getAiHistorySnapshot() {
  return getAiHistoryEntries().map((entry) => ({
    time: entry?.ts ? new Date(entry.ts).toISOString() : null,
    user: entry?.user || '',
    assistant: entry?.assistant || ''
  }));
}

function shouldIncludeBoardContext(context) {
  const hasFiles = (context?.images?.length || 0) > 0
    || (context?.audio?.length || 0) > 0
    || (context?.documents?.length || 0) > 0;
  const hasNodes = Boolean(selectedNodeId) || (aiContextNodeIds && aiContextNodeIds.size > 0);
  return !hasFiles && !hasNodes;
}

function buildAiPrompt(message, context = {}) {
  const includeBoardContext = shouldIncludeBoardContext(context);
  const snapshot = includeBoardContext ? view.exportGraph() : null;
  const boardPayload = snapshot ? scrubExportPayload(snapshot) : null;
  if (boardPayload && boardPayload.meta) {
    boardPayload.meta = null;
  }
  const boardJson = boardPayload ? JSON.stringify(boardPayload, null, 2) : null;
  const selectedNode = selectedNodeId && view.graph ? scrubNodePayload(view.graph.getNode(selectedNodeId)) : null;
  const selectedEdge = selectedEdgeId && view.graph
    ? view.graph.edges.find((edge) => edge.id === selectedEdgeId) || null
    : null;
  const contextNodes = view.graph
    ? Array.from(aiContextNodeIds).map((id) => scrubNodePayload(view.graph.getNode(id))).filter(Boolean)
    : [];

  const componentSpecs = getAiComponentSpecs();
  const componentGuidance = getAiComponentGuidance();
  const componentJson = JSON.stringify(componentSpecs, null, 2);

  const attachments = {
    images: (context.images || []).map((img) => ({
      name: img.name || '',
      type: img.type || '',
      size: Number.isFinite(img.size) ? img.size : null
    })),
    audio: (context.audio || []).map((clip) => ({
      name: clip.name || '',
      type: clip.type || '',
      size: Number.isFinite(clip.size) ? clip.size : null,
      transcript: clip.transcript || null
    })),
    documents: (context.documents || []).map((doc) => ({
      name: doc.name || '',
      type: doc.type || '',
      size: Number.isFinite(doc.size) ? doc.size : null
    }))
  };
  const attachmentJson = JSON.stringify(attachments, null, 2);
  const transcripts = (context.audio || []).filter((clip) => clip.transcript).map((clip) => ({
    name: clip.name || '',
    transcript: clip.transcript
  }));
  const transcriptJson = JSON.stringify(transcripts, null, 2);
  const documentPayloads = (context.documents || []).map((doc) => ({
    name: doc.name || '',
    content: doc.content || ''
  }));
  const documentJson = JSON.stringify(documentPayloads, null, 2);
  const historyJson = includeBoardContext ? JSON.stringify(getAiHistorySnapshot(), null, 2) : null;

  const instructions = [
    'You are an AI planner embedded inside the Elenweave canvas app.',
    'You can read the current board state and use predefined components to add information on the canvas.',
    'Use chart components for data visualization whenever numeric data or comparisons are involved.',
    'When asked to explain code, mix short relevant code snippets with explanation (split into small nodes).',
    'Your output is parsed by the client to modify the board.',
    'You must return a single JSON object and nothing else.',
    '',
    `Output schema (JSON only):`,
    `{`,
    `  "version": "${AI_ACTIONS_VERSION}",`,
    `  "nodes": [`,
    `    {`,
    `      "action": "add" | "update",`,
    `      "tempId": "n1",`,
    `      "id": "existing-node-id",`,
    `      "type": "html-text" | "html" | "text",`,
    `      "component": "OptionPicker",`,
    `      "text": "string",`,
    `      "w": 320, "h": 160,`,
    `      "props": { "title": "...", "label": "...", "options": ["A","B"] },`,
    `      "data": { "choice": "A", "value": 5 }`,
    `    }`,
    `  ],`,
    `  "edges": [`,
    `    { "from": "node-id-or-tempId", "to": "node-id-or-tempId", "label": "optional" }`,
    `  ]`,
    `}`,
    '',
    'Rules:',
    '- Read Current board JSON and reuse existing nodes when possible.',
    '- For new nodes, use tempId and reference it in edges.',
    '- For updates, use the existing node id from the board JSON.',
    '- Only include fields you intend to set; omit unknown fields.',
    '- If no changes are needed, return nodes/edges as empty arrays.',
    '- If attachments are provided and the user asks for description/transcription, add HtmlText nodes with the results.',
    '- If audio is attached and no transcript is provided, transcribe it before planning.',
    '- If an attachment is provided, do not add new ImageViewer/AudioPlayer nodes; the app will add the media node.',
    '- If a document/code file is attached, read it and use it as context for the plan.',
    '- If the request lacks key details required to produce a quality result, ask a focused follow-up question first using TextInput or OptionPicker with data.aiFollowUp.',
    '- If you need user input before proceeding, add a TextInput or OptionPicker node with data.aiFollowUp { question, status: "open" }.',
    '- Do not set x/y coordinates; omit them so the app can auto-place nodes.',
    '- Prefer multiple small, single-idea nodes instead of one large text block.',
    '- Add edges to existing nodes only when the relationship is relevant.',
    '- When you add multiple new nodes, connect them with directional edges (from first to next).',
    '- Return JSON only; do not add prose outside the JSON.',
    '- If you need formatted text or code fences, use MarkdownBlock with data.markdown.',
    '- When the user asks for an interactive app, game, or demo, build a runnable HTML+JS canvas experience.',
    '- For interactive apps/games, always provide a CodeSnippet node (data.code = full HTML) plus an HtmlPreview node (data.html = same HTML), and connect CodeSnippet -> HtmlPreview.',
    '- Include a <canvas> element and JavaScript that renders via requestAnimationFrame; add basic input handling when it improves the experience.',
    '- Keep the HTML self-contained; use CDN libraries only if they materially simplify the request.',
    '- Avoid eval, infinite loops, or unbounded particle counts; keep animation complexity bounded.',
    '- Simple network fetches are allowed only when explicitly required by the user request.',
    '- When generating HTML (snippets, mini pages, embeds), add both a CodeSnippet node (data.code = HTML) and an HtmlPreview node (data.html = same HTML), and connect CodeSnippet -> HtmlPreview with an edge.',
    '- Ensure markdown strings are valid JSON (escape quotes and newlines).',
    '',
    'Component guidance (when to use each):',
    ...componentGuidance,
    '',
    'Environment:',
    '- 2D canvas with x/y world coordinates in pixels.',
    '- Nodes have types: text, html-text, html.',
    '- html-text renders editable text using node.text.',
    '- html nodes require a component name and use props/data.',
    '- Media components can be created without src; user will attach assets later.',
    '',
    'Available components and expected fields (JSON):',
    componentJson,
    '',
    'Attachments (metadata):',
    attachmentJson,
    '',
    'Document contents (if provided):',
    documentJson,
    '',
    'Audio transcripts (if available):',
    transcriptJson,
    '',
    'AI context nodes (selected for context):',
    JSON.stringify(contextNodes, null, 2),
    '',
    'Selected node (if any):',
    JSON.stringify(selectedNode, null, 2),
    '',
    'Selected edge (if any):',
    JSON.stringify(selectedEdge, null, 2),
    '',
    'User message:',
    message
  ];

  if (includeBoardContext) {
    instructions.splice(
      instructions.length - 2,
      0,
      '',
      'History (last 4):',
      historyJson,
      '',
      'Current board JSON:',
      boardJson || '{}'
    );
  }

  return instructions.join('\n');
}

function collectAiAttachments(values) {
  const file = values.media instanceof File ? values.media : currentForm?.aiMediaFile || null;
  const kind = file ? classifyAiFile(file) : null;
  return { file, kind };
}

function resolveAiMessage(message, attachments) {
  if (message) return message;
  if (attachments.kind === 'image') {
    return 'Describe the attached image. Add a node with the description.';
  }
  if (attachments.kind === 'audio') {
    return 'Transcribe the attached audio. Add a node with the transcript.';
  }
  if (attachments.kind === 'text') {
    return 'Read the attached document/code. Summarize or extract key points as small nodes.';
  }
  return '';
}

function resolveAiFollowUpMessage(node) {
  if (!node) return '';
  const meta = node.data?.aiFollowUp || {};
  const question = String(meta.question || meta.prompt || node.props?.label || node.props?.title || 'Follow-up question').trim();
  const answer = getAiFollowUpAnswer(node);
  return [
    'Follow-up input received from the user.',
    `Question: ${question}`,
    `Answer: ${answer || '(empty)'}`
  ].join('\n');
}

function buildAiAttachmentContext(attachments) {
  const context = { images: [], audio: [], documents: [] };
  if (attachments.kind === 'image' && attachments.file) {
    context.images.push({
      name: attachments.file.name || 'image',
      type: attachments.file.type || 'image/*',
      size: attachments.file.size
    });
  }
  if (attachments.kind === 'audio' && attachments.file) {
    context.audio.push({
      name: attachments.file.name || 'audio',
      type: attachments.file.type || 'audio/*',
      size: attachments.file.size
    });
  }
  if (attachments.kind === 'text' && attachments.file) {
    context.documents.push({
      name: attachments.file.name || 'document',
      type: attachments.file.type || 'text/plain',
      size: attachments.file.size
    });
  }
  return context;
}

async function requestAiPlan({ provider, apiKey, proxyBaseUrl = null, model, message, attachments }) {
  if (attachments.file && !attachments.kind) {
    throw new Error('Unsupported file type. Please upload an image, audio, or text/code file.');
  }
  const context = buildAiAttachmentContext(attachments);
  if (attachments.kind === 'text' && attachments.file) {
    const content = await attachments.file.text();
    if (context.documents[0]) {
      context.documents[0].content = truncateAttachmentText(content);
    }
  }

  if (provider === 'openai') {
    if (attachments.kind === 'audio' && attachments.file) {
      setStatus('Transcribing audio...', 0);
      const transcript = await callOpenAITranscription({
        apiKey,
        proxyBaseUrl,
        file: attachments.file,
        model: AI_TRANSCRIBE_MODEL
      });
      if (context.audio[0]) {
        context.audio[0].transcript = transcript.text;
      }
    }
    const aiPrompt = buildAiPrompt(message, context);
    setStatus('Sending to AI...', 0);
    if (attachments.kind === 'image' && attachments.file) {
      const dataUrl = await readFileAsDataUrl(attachments.file);
      return callOpenAIMultimodal({
        apiKey,
        proxyBaseUrl,
        model,
        prompt: aiPrompt,
        images: [{ dataUrl }]
      });
    }
    return callOpenAI({ apiKey, proxyBaseUrl, model, instructions: '', input: aiPrompt });
  }

  const aiPrompt = buildAiPrompt(message, context);
  if (attachments.kind === 'image' || attachments.kind === 'audio') {
    const images = attachments.kind === 'image' ? [await fileToInlineData(attachments.file)] : [];
    const audio = attachments.kind === 'audio' ? [await fileToInlineData(attachments.file)] : [];
    return callGeminiMultimodal({ apiKey, proxyBaseUrl, model, prompt: aiPrompt, images, audio });
  }
  return callGemini({ apiKey, proxyBaseUrl, model, text: aiPrompt });
}

async function handleAiFollowUp(node) {
  const provider = loadProvider();
  const apiKey = readApiKey(provider);
  const proxyBaseUrl = resolveAiProxyBaseUrl(provider);
  if (!apiKey && proxyBaseUrl == null) {
    setStatus('Add an API key in Model Matrix.', 1800);
    return;
  }
  const answer = getAiFollowUpAnswer(node);
  if (!answer) {
    setStatus('Provide an answer before running AI.', 1600);
    return;
  }
  let didSetPending = false;
  try {
    const message = resolveAiFollowUpMessage(node);
    const attachments = { file: null, kind: null };
    const task = resolveAiTask(message, attachments);
    const model = resolveAiModelForTask(provider, task);
    setAiRequestState(true);
    didSetPending = true;
    setStatus('Sending follow-up to AI...', 0);
    const result = await requestAiPlan({
      provider,
      apiKey,
      proxyBaseUrl,
      model,
      message,
      attachments
    });
    recordAiHistory({ message, response: result.text, provider, model, toolTrace: result?.toolTrace || null });
    const plan = parseAiPlan(result.text);
    if (!plan) {
      console.warn('AI response not understood', result.text);
      setStatus('AI response not understood.', 2000);
      return;
    }
    const filteredPlan = filterAiPlanForAttachments(plan, attachments);
    const outcome = applyAiPlan(filteredPlan, {
      connectContext: [node.id],
      ignorePosition: true
    });
    layoutNewNodesHierarchy(outcome.addedNodes, { rootId: node.id });
    const meta = node.data?.aiFollowUp || {};
    const patch = {
      ...node.data,
      aiFollowUp: {
        ...meta,
        status: 'done',
        answeredAt: Date.now()
      }
    };
    view.updateNode(node.id, { data: patch });
    const primaryResultId = getPrimaryAiResultId(outcome);
    addAiNotification(primaryResultId, outcome);
    focusOnAiResult(primaryResultId, outcome);
    const nodeCount = outcome.addedNodes.length + outcome.updatedNodes.length;
    const edgeCount = outcome.addedEdges.length + outcome.updatedEdges.length;
    const summary = `AI applied: ${nodeCount} node${nodeCount === 1 ? '' : 's'}, ${edgeCount} edge${edgeCount === 1 ? '' : 's'}.`;
    updateSendButton();
    setStatus(outcome.errors.length ? `${summary} (with warnings)` : summary, 2200);
  } catch (err) {
    console.warn('AI follow-up failed', err);
    setStatus('AI follow-up failed.', 1800);
  } finally {
    if (didSetPending) setAiRequestState(false);
  }
}

async function handleRealtimeIntent(intent) {
  const trimmed = String(intent || '').trim();
  if (!trimmed) return { result: 'empty_intent' };
  const provider = 'gemini';
  const apiKey = readApiKey(provider);
  const proxyBaseUrl = resolveAiProxyBaseUrl(provider);
  if (!apiKey && proxyBaseUrl == null) return { result: 'missing_api_key' };
  const attachments = { file: null, kind: null };
  const task = resolveAiTask(trimmed, attachments);
  const model = resolveAiModelForTask(provider, task);
  const result = await requestAiPlan({
    provider,
    apiKey,
    proxyBaseUrl,
    model,
    message: trimmed,
    attachments
  });
  const plan = parseAiPlan(result.text);
  if (!plan) return { result: 'invalid_plan' };
  const addOnly = filterPlanAddOnly(plan);
  const outcome = applyAiPlan(addOnly, { ignorePosition: true, connectContext: [] });
  layoutNewNodesHierarchy(outcome.addedNodes, { rootId: selectedNodeId });
  const primaryResultId = getPrimaryAiResultId(outcome);
  addAiNotification(primaryResultId, outcome);
  focusOnAiResult(primaryResultId, outcome);
  const nodesAdded = outcome.addedNodes.length;
  const edgesAdded = outcome.addedEdges.length;
  return {
    result: 'ok',
    nodesAdded,
    edgesAdded,
    summary: `Applied realtime board plan (${nodesAdded} nodes, ${edgesAdded} edges).`
  };
}

function classifyAiFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('text/')) return 'text';
  if (type === 'application/json' || type === 'application/javascript' || type === 'application/xml') {
    return 'text';
  }
  const name = String(file?.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);
  const audioExts = new Set(['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac']);
  const textExts = new Set(['md', 'markdown', 'txt', 'csv', 'js', 'ts', 'json', 'html', 'css', 'py', 'java', 'rb', 'go', 'rs', 'c', 'cpp', 'sh']);
  if (imageExts.has(ext)) return 'image';
  if (audioExts.has(ext)) return 'audio';
  if (textExts.has(ext)) return 'text';
  return null;
}

function resolveTextAttachmentType(file) {
  const name = String(file?.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const markdownExts = new Set(['md', 'markdown']);
  const jsonExts = new Set(['json']);
  const csvExts = new Set(['csv']);
  const codeExts = new Set(['js', 'ts', 'html', 'css', 'py', 'java', 'rb', 'go', 'rs', 'c', 'cpp', 'sh']);
  if (markdownExts.has(ext)) return 'markdown';
  if (jsonExts.has(ext)) return 'json';
  if (csvExts.has(ext)) return 'csv';
  if (codeExts.has(ext)) return 'code';
  return 'text';
}

function shouldStoreTextAsAsset(file) {
  if (!file || !Number.isFinite(file.size)) return false;
  return file.size > LARGE_TEXT_ASSET_BYTES;
}

async function readTextPreview(file, maxBytes) {
  if (!file) return '';
  const slice = file.slice(0, Math.max(0, maxBytes || TEXT_PREVIEW_BYTES));
  return slice.text();
}

function buildPreviewSuffix() {
  return '\n\n[Preview truncated. Full file stored as asset.]';
}

async function readBlobPreview(blob, maxBytes) {
  if (!blob) return '';
  const slice = blob.slice(0, Math.max(0, maxBytes || TEXT_PREVIEW_BYTES));
  return slice.text();
}

async function addAiAttachmentNode(attachments) {
  if (!attachments?.file || !attachments?.kind) return null;
  if (attachments.kind === 'text') {
    const textType = resolveTextAttachmentType(attachments.file);
    const storeAsAsset = shouldStoreTextAsAsset(attachments.file);
    const content = storeAsAsset
      ? await readTextPreview(attachments.file, TEXT_PREVIEW_BYTES)
      : await attachments.file.text();
    const hasPreviewNotice = storeAsAsset && content.length;
    const previewText = hasPreviewNotice ? `${content}${buildPreviewSuffix()}` : content;
    let asset = null;
    if (storeAsAsset) {
      asset = await saveAsset(attachments.file, 'text');
    }
    if (textType === 'markdown') {
      const config = COMPONENT_LOOKUP.get('MarkdownBlock');
      if (!config) return null;
      const id = addNodeAtCenter({
        type: 'html',
        component: config.component,
        props: { title: attachments.file.name || 'Markdown' },
        data: {
          markdown: previewText,
          assetId: asset?.id || null,
          assetName: asset?.name || attachments.file.name || null,
          assetType: asset?.type || attachments.file.type || 'text/plain',
          assetCategory: asset?.category || 'text',
          preview: Boolean(storeAsAsset),
          previewContent: storeAsAsset ? previewText : null
        },
        w: config.size?.w || 360,
        h: config.size?.h || 240
      });
      if (id) window.requestAnimationFrame(() => syncPreviewToggleForNode(id));
      return id;
    }
    if (textType === 'code' || textType === 'json' || textType === 'csv') {
      const config = COMPONENT_LOOKUP.get('CodeSnippet');
      if (!config) return null;
      let code = previewText;
      if (textType === 'json' && !storeAsAsset) {
        try {
          code = JSON.stringify(JSON.parse(content), null, 2);
        } catch (err) {
          code = previewText;
        }
      }
      const id = addNodeAtCenter({
        type: 'html',
        component: config.component,
        props: { filename: attachments.file.name || 'document.txt' },
        data: {
          code,
          assetId: asset?.id || null,
          assetName: asset?.name || attachments.file.name || null,
          assetType: asset?.type || attachments.file.type || 'text/plain',
          assetCategory: asset?.category || 'text',
          preview: Boolean(storeAsAsset),
          previewContent: storeAsAsset ? previewText : null
        },
        w: config.size?.w || 360,
        h: config.size?.h || 220
      });
      if (id) window.requestAnimationFrame(() => syncPreviewToggleForNode(id));
      return id;
    }
    const config = COMPONENT_LOOKUP.get('HtmlText');
    if (!config) return null;
    const id = addNodeAtCenter({
      type: 'html-text',
      text: previewText,
      data: {
        assetId: asset?.id || null,
        assetName: asset?.name || attachments.file.name || null,
        assetType: asset?.type || attachments.file.type || 'text/plain',
        assetCategory: asset?.category || 'text',
        preview: Boolean(storeAsAsset),
        previewContent: storeAsAsset ? previewText : null
      },
      w: config.size?.w || 320,
      h: config.size?.h || 160
    });
    if (id) window.requestAnimationFrame(() => syncPreviewToggleForNode(id));
    return id;
  }
  const configKey = attachments.kind === 'image' ? 'ImageViewer' : 'AudioPlayer';
  const config = COMPONENT_LOOKUP.get(configKey);
  if (!config) return null;
  const id = addNodeAtCenter({
    type: 'html',
    component: config.component,
    props: { title: config.label },
    data: {},
    w: config.size?.w || 320,
    h: config.size?.h || 160
  });
  if (id) {
    await attachAssetToNode(id, attachments.file, null, config);
  }
  return id;
}

function getNodeElement(nodeId) {
  if (!nodeId) return null;
  const record = view?._htmlNodes?.get(nodeId);
  if (record?.el) return record.el;
  return view?.overlay?.querySelector(`[data-ew-node-id="${nodeId}"]`) || null;
}

function clearSelectedNodeClass() {
  if (!lastSelectedNodeEl) return;
  lastSelectedNodeEl.classList.remove('ew-node-selected');
  lastSelectedNodeEl = null;
}

function syncSelectedNodeClass(node) {
  clearSelectedNodeClass();
  if (!node?.id) return;
  const el = getNodeElement(node.id);
  if (!el) return;
  el.classList.add('ew-node-selected');
  lastSelectedNodeEl = el;
}

function isPreviewEligibleNode(node) {
  if (!node) return false;
  const isTextNode = node.type === 'html-text'
    || node.component === 'CodeSnippet'
    || node.component === 'MarkdownBlock';
  if (!isTextNode) return false;
  const data = node.data || {};
  if (!data.assetId) return false;
  if (data.assetCategory && data.assetCategory !== 'text') return false;
  return true;
}

function applyTextNodePatch(node, content, previewFlag, previewContent) {
  const data = { ...(node.data || {}), preview: Boolean(previewFlag) };
  if (previewContent !== undefined) data.previewContent = previewContent;
  if (node.component === 'CodeSnippet') {
    data.code = content;
    view.updateNode(node.id, { data });
    return;
  }
  if (node.component === 'MarkdownBlock') {
    data.markdown = content;
    view.updateNode(node.id, { data });
    return;
  }
  if (node.type === 'html-text') {
    view.updateNode(node.id, { text: content, data });
  }
}

async function togglePreviewForNode(nodeId) {
  if (!view?.graph) return;
  const node = view.graph.getNode(nodeId);
  if (!isPreviewEligibleNode(node)) return;
  const asset = await getAsset(node.data.assetId);
  if (!asset?.blob) return;
  const isPreview = Boolean(node.data?.preview);
  if (isPreview) {
    const fullText = await asset.blob.text();
    applyTextNodePatch(node, fullText, false, node.data?.previewContent ?? null);
  } else {
    let preview = node.data?.previewContent;
    if (!preview) {
      const raw = await readBlobPreview(asset.blob, TEXT_PREVIEW_BYTES);
      preview = raw ? `${raw}${buildPreviewSuffix()}` : raw;
    }
    applyTextNodePatch(node, preview, true, preview);
  }
  syncPreviewToggleForNode(nodeId);
}

function syncPreviewToggleForNode(nodeId) {
  if (!view?.graph) return;
  const node = view.graph.getNode(nodeId);
  const el = getNodeElement(nodeId);
  if (!node || !el) return;
  const existing = el.querySelector('.ew-preview-pill');
  if (!isPreviewEligibleNode(node)) {
    if (existing?.parentElement) existing.parentElement.removeChild(existing);
    return;
  }
  const header = el.querySelector('.ew-node-header');
  const host = header || el;
  let pill = existing;
  if (!pill) {
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'ew-preview-pill';
    pill.addEventListener('pointerdown', (event) => event.stopPropagation());
    pill.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePreviewForNode(nodeId);
    });
  }
  pill.textContent = node.data?.preview ? 'Load full file' : 'Show preview';
  pill.setAttribute('aria-pressed', node.data?.preview ? 'false' : 'true');
  pill.dataset.ewNodeId = nodeId;
  if (!host.contains(pill)) {
    if (header) {
      const anchor = header.querySelector('.ew-link-anchor');
      if (anchor && anchor.parentElement === header) {
        header.insertBefore(pill, anchor);
      } else {
        header.appendChild(pill);
      }
    } else {
      host.appendChild(pill);
    }
  }
}

function syncPreviewToggles() {
  if (!view?.graph) return;
  view.graph.nodes.forEach((node) => {
    syncPreviewToggleForNode(node.id);
  });
}

function buildRealtimeAudioName(role) {
  const safeRole = role === 'AI' ? 'ai' : 'user';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeRole}-audio-${stamp}.wav`;
}

function ensureRealtimeTurnEntry(turnId) {
  const key = String(turnId || '').trim();
  if (!key) return null;
  if (!realtimeTurnNodes.has(key)) {
    realtimeTurnNodes.set(key, {
      userTranscriptNodeId: null,
      aiAudioNodeId: null,
      aiTextNodeId: null
    });
  }
  return realtimeTurnNodes.get(key);
}

function upsertRealtimeTranscriptNode(turnId, text, isFinal) {
  if (!view?.graph) return null;
  const entry = ensureRealtimeTurnEntry(turnId);
  if (!entry) return null;

  const nextText = String(text || '').trim() || (isFinal ? 'Voice request' : 'Listening...');
  if (!entry.userTranscriptNodeId) {
    const id = addNodeAtCenter({
      type: 'html-text',
      text: nextText,
      data: {
        realtime: true,
        realtimeTurnId: turnId,
        realtimeRole: 'user_transcript',
        realtimeStatus: isFinal ? 'final' : 'live'
      },
      w: 340,
      h: 170
    });
    entry.userTranscriptNodeId = id;
    return id;
  }

  const node = view.graph.getNode(entry.userTranscriptNodeId);
  if (!node) return entry.userTranscriptNodeId;
  const data = {
    ...(node.data || {}),
    realtime: true,
    realtimeTurnId: turnId,
    realtimeRole: 'user_transcript',
    realtimeStatus: isFinal ? 'final' : 'live'
  };
  view.updateNode(node.id, { text: nextText, data });
  return node.id;
}

function connectNodesIfMissing(from, to) {
  if (!from || !to || from === to || !view?.graph) return null;
  const exists = view.graph.edges.some((edge) => edge.from === from && edge.to === to);
  if (exists) return null;
  return view.addEdge(from, to, {});
}

function buildRealtimeResponseMarkdown(payload) {
  const modelText = String(payload?.text || '').trim();
  if (modelText) return modelText;
  const toolSummary = String(payload?.toolSummary || '').trim();
  if (toolSummary) return `### Realtime Summary\n\n${toolSummary}`;
  return 'Audio response streamed.';
}

function addRealtimeTextNode(turnId, markdown) {
  const config = COMPONENT_LOOKUP.get('MarkdownBlock');
  if (!config) return null;
  return addNodeAtCenter({
    type: 'html',
    component: config.component,
    props: { title: 'AI Response' },
    data: {
      markdown,
      realtime: true,
      realtimeTurnId: turnId,
      realtimeRole: 'ai_text',
      realtimeStatus: 'final'
    },
    w: config.size?.w || 360,
    h: config.size?.h || 240
  });
}

async function addRealtimeAudioNode(blob, role, options = {}) {
  if (!blob) return null;
  const config = COMPONENT_LOOKUP.get('AudioPlayer');
  if (!config) return null;
  const filename = buildRealtimeAudioName(role);
  const file = new File([blob], filename, { type: 'audio/wav' });
  const title = options?.title || (role === 'AI' ? 'AI Audio' : 'User Audio');
  const turnId = options?.turnId || null;
  const id = addNodeAtCenter({
    type: 'html',
    component: config.component,
    props: { title },
    data: {
      realtime: Boolean(turnId),
      realtimeTurnId: turnId,
      realtimeRole: role === 'AI' ? 'ai_audio' : 'user_audio',
      realtimeStatus: 'final'
    },
    w: config.size?.w || 320,
    h: config.size?.h || 160
  });
  if (id) {
    await attachAssetToNode(id, file, null, config);
  }
  return id;
}

async function finalizeRealtimeTurn(payload) {
  const turnId = String(payload?.turnId || '').trim();
  if (!turnId) return null;
  const entry = ensureRealtimeTurnEntry(turnId);
  if (!entry) return null;

  if (!entry.userTranscriptNodeId) {
    upsertRealtimeTranscriptNode(turnId, payload?.userTranscript || 'Voice request', true);
  }
  if (entry.userTranscriptNodeId && view?.graph) {
    const userNode = view.graph.getNode(entry.userTranscriptNodeId);
    if (userNode) {
      const text = String(userNode.text || payload?.userTranscript || '').trim() || 'Voice request';
      view.updateNode(userNode.id, {
        text,
        data: {
          ...(userNode.data || {}),
          realtime: true,
          realtimeTurnId: turnId,
          realtimeRole: 'user_transcript',
          realtimeStatus: 'final'
        }
      });
    }
  }

  const createdIds = [];
  if (!entry.aiAudioNodeId && payload?.audioBlob) {
    const audioId = await addRealtimeAudioNode(payload.audioBlob, 'AI', { turnId, title: 'AI Audio' });
    if (audioId) {
      entry.aiAudioNodeId = audioId;
      createdIds.push(audioId);
    }
  }

  const responseMarkdown = buildRealtimeResponseMarkdown(payload);
  if (!entry.aiTextNodeId) {
    const textId = addRealtimeTextNode(turnId, responseMarkdown);
    if (textId) {
      entry.aiTextNodeId = textId;
      createdIds.push(textId);
    }
  } else if (view?.graph) {
    const existingTextNode = view.graph.getNode(entry.aiTextNodeId);
    if (existingTextNode) {
      view.updateNode(existingTextNode.id, {
        data: {
          ...(existingTextNode.data || {}),
          markdown: responseMarkdown,
          realtime: true,
          realtimeTurnId: turnId,
          realtimeRole: 'ai_text',
          realtimeStatus: 'final'
        }
      });
    }
  }

  if (entry.userTranscriptNodeId && entry.aiAudioNodeId) {
    connectNodesIfMissing(entry.userTranscriptNodeId, entry.aiAudioNodeId);
  }
  if (entry.aiAudioNodeId && entry.aiTextNodeId) {
    connectNodesIfMissing(entry.aiAudioNodeId, entry.aiTextNodeId);
  } else if (entry.userTranscriptNodeId && entry.aiTextNodeId) {
    connectNodesIfMissing(entry.userTranscriptNodeId, entry.aiTextNodeId);
  }

  if (createdIds.length) {
    layoutNewNodesHierarchy(createdIds, { rootId: entry.userTranscriptNodeId || selectedNodeId });
  }
  if (entry.aiTextNodeId) {
    focusOnAiResult(entry.aiTextNodeId, {
      addedNodes: [entry.aiTextNodeId],
      updatedNodes: [],
      addedEdges: [],
      updatedEdges: []
    });
  } else if (entry.aiAudioNodeId) {
    focusOnAiResult(entry.aiAudioNodeId, {
      addedNodes: [entry.aiAudioNodeId],
      updatedNodes: [],
      addedEdges: [],
      updatedEdges: []
    });
  }

  setStatus('Realtime turn saved.', 1600);
  return entry;
}

function getPrimaryAiResultId(outcome) {
  if (!outcome) return null;
  return outcome.addedNodes[0] || outcome.updatedNodes[0] || null;
}

function addAiNotification(targetId, outcome) {
  if (!targetId || !view?.addNotification) return;
  const nodeCount = outcome?.addedNodes?.length || outcome?.updatedNodes?.length ? (outcome.addedNodes.length + outcome.updatedNodes.length) : 0;
  const label = nodeCount > 1 ? `AI response ready (${nodeCount} nodes)` : 'AI response ready';
  view.addNotification({ nodeId: targetId, label });
}

function collapseNotificationPanel() {
  const root = view?._notifRoot || document.querySelector('.ew-notif-cluster');
  const icon = view?._notifIcon || root?.querySelector('.ew-notif-icon');
  if (view && Object.prototype.hasOwnProperty.call(view, '_notifCollapsed')) {
    view._notifCollapsed = true;
  }
  if (root) root.classList.add('is-collapsed');
  if (icon) icon.setAttribute('aria-expanded', 'false');
}

function fitContentToView() {
  if (!view?.graph || !view.graph.nodes.length || !view.canvas) return;
  if (ewNavigator?.fitToNodes) {
    ewNavigator.fitToNodes();
    return;
  }
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

function connectAttachmentToResult(attachmentId, targetId, outcome) {
  if (!attachmentId || !view.graph) return;
  const fallbackTarget = getPrimaryAiResultId(outcome);
  const resolvedTarget = targetId || fallbackTarget;
  if (!resolvedTarget || resolvedTarget === attachmentId) return;
  const exists = view.graph.edges.some((edge) => edge.from === attachmentId && edge.to === resolvedTarget);
  if (exists) return;
  const edgeId = view.addEdge(attachmentId, resolvedTarget, {});
  if (edgeId) outcome.addedEdges.push(edgeId);
}

function focusOnAiResult(targetId, outcome) {
  if (!view?.graph) return;
  const resolvedTarget = targetId || getPrimaryAiResultId(outcome);
  if (!resolvedTarget) return;
  if (typeof view.moveTo === 'function') {
    view.moveTo(resolvedTarget);
    return;
  }
  if (typeof view.focusNode === 'function') {
    view.focusNode(resolvedTarget);
    return;
  }
  const node = view.graph.getNode(resolvedTarget);
  if (!node || !view.canvas || !view.camera) return;
  view.camera.x = -(node.x + node.w / 2) * view.camera.s + view.canvas.clientWidth / 2;
  view.camera.y = -(node.y + node.h / 2) * view.camera.s + view.canvas.clientHeight / 2;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

async function fileToInlineData(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const base64 = dataUrl.split(',')[1] || '';
  return { mimeType: file.type || 'application/octet-stream', base64 };
}

function getAiComponentSpecs() {
  const specs = [
    {
      key: 'HtmlText',
      type: 'html-text',
      size: COMPONENT_LOOKUP.get('HtmlText')?.size || { w: 320, h: 160 },
      fields: { text: 'string' }
    }
  ];
  specs.push({
    key: 'MarkdownBlock',
    type: 'html',
    component: 'MarkdownBlock',
    size: AI_COMPONENT_SIZES.get('MarkdownBlock') || { w: 360, h: 240 },
    props: { title: 'string' },
    data: { markdown: 'string' }
  });

  COMPONENT_CONFIG.forEach((config) => {
    if (!config || config.key === 'AI') return;
    if (config.nodeType === 'html-text') return;
    const spec = {
      key: config.key,
      type: 'html',
      component: config.component || config.key,
      size: config.size || { w: 320, h: 160 },
      props: {},
      data: {}
    };
    switch (config.key) {
      case 'OptionPicker':
        spec.props = { title: 'string', label: 'string', options: ['string'] };
        spec.data = { choice: 'string', aiFollowUp: { question: 'string', status: 'string' } };
        break;
      case 'TextInput':
        spec.props = { title: 'string', label: 'string', placeholder: 'string' };
        spec.data = { value: 'string', aiFollowUp: { question: 'string', status: 'string' } };
        break;
      case 'DateTimeInput':
        spec.props = { title: 'string', label: 'string', min: 'string', max: 'string', step: 'number' };
        spec.data = { value: 'string' };
        break;
      case 'SliderInput':
        spec.props = { title: 'string', label: 'string', min: 'number', max: 'number', step: 'number', unit: 'string' };
        spec.data = { value: 'number' };
        break;
      case 'MultiChoice':
        spec.props = { title: 'string', options: ['string'] };
        spec.data = { selected: ['string'] };
        break;
      case 'CodeSnippet':
        spec.props = { title: 'string', label: 'string', filename: 'string', language: 'string' };
        spec.data = { code: 'string' };
        break;
      case 'SvgBlock':
        spec.props = { title: 'string' };
        spec.data = { svg: 'string' };
        break;
      case 'MermaidBlock':
        spec.props = { title: 'string' };
        spec.data = { mermaid: 'string' };
        break;
      case 'HtmlPreview':
        spec.props = { title: 'string' };
        spec.data = { html: 'string' };
        break;
      case 'ImageViewer':
        spec.props = { title: 'string', label: 'string', alt: 'string' };
        spec.data = { src: 'string', assetId: 'string' };
        break;
      case 'VideoPlayer':
        spec.props = { title: 'string', label: 'string' };
        spec.data = { src: 'string' };
        break;
      case 'AudioPlayer':
        spec.props = { title: 'string', label: 'string' };
        spec.data = { src: 'string' };
        break;
      default:
        break;
    }
    specs.push(spec);
  });

  CHART_COMPONENT_SPECS.forEach((spec) => {
    specs.push(spec);
  });

  return specs;
}

function getAiComponentGuidance() {
  return [
    '- HtmlText: short paragraphs, summaries, or bullets.',
    '- MarkdownBlock: formatted text (headings, lists, code fences).',
    '- HtmlPreview: render raw HTML in a sandboxed preview (data.html). Link a CodeSnippet -> HtmlPreview when providing HTML source.',
    '- OptionPicker: single choice; MultiChoice: multiple selections.',
    '- TextInput: freeform text; DateTimeInput: date/time; SliderInput: numeric range.',
    '- Use OptionPicker/TextInput with data.aiFollowUp to ask the user a question and wait for their reply.',
    '- CodeSnippet: code or structured snippets.',
    '- For interactive apps/games, pair CodeSnippet + HtmlPreview and include full HTML canvas + JS in both.',
    '- MermaidBlock: flowcharts or other Mermaid diagrams with valid Mermaid syntax in data.mermaid.',
    '- SvgBlock: raw SVG markup diagrams in data.svg; include a full <svg>...</svg> payload.',
    '- ImageViewer/VideoPlayer/AudioPlayer: when user references media or attachments.',
    '- Charts require numeric data (series/values/points); otherwise use HtmlText.',
    '- LineChart: trends over ordered labels/time with one or more series.',
    '- AreaChart: cumulative/stacked-looking trends over time.',
    '- BarChart: compare categories; use stacked for composition.',
    '- ScatterChart: correlation or clustered (x,y) points.',
    '- HeatmapChart: matrix/grid intensity values.',
    '- RadarChart: multi-metric profile across axes.',
    '- SparklineChart: compact single-series trend.'
  ];
}

function scrubNodePayload(node) {
  if (!node || typeof node !== 'object') return null;
  const clone = JSON.parse(JSON.stringify(node));
  if (clone?.data?.assetId) delete clone.data.src;
  return clone;
}

function parseAiPlan(text) {
  const json = extractJsonPayload(text);
  if (!json || typeof json !== 'object') return null;
  const plan = { ...json };
  plan.nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
  plan.edges = Array.isArray(plan.edges) ? plan.edges : [];
  return plan;
}

function extractJsonPayload(text) {
  if (!text) return null;
  let raw = String(text).trim();
  if (raw.startsWith('```')) {
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fenced && fenced[1]) raw = fenced[1].trim();
  }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    raw = raw.slice(first, last + 1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function filterAiPlanForAttachments(plan, attachments) {
  if (!plan || !attachments?.file || !attachments?.kind) return plan;
  const blockedComponents = new Set();
  if (attachments.kind === 'image') blockedComponents.add('ImageViewer');
  if (attachments.kind === 'audio') blockedComponents.add('AudioPlayer');
  if (!blockedComponents.size) return plan;

  const removedIds = new Set();
  const nodes = Array.isArray(plan.nodes) ? plan.nodes.filter((entry, index) => {
    if (!entry || typeof entry !== 'object') return false;
    const action = entry.action || (entry.id ? 'update' : 'add');
    const component = entry.component || entry.key;
    const nodeType = entry.type || entry.nodeType || (entry.component ? 'html' : entry.text ? 'html-text' : 'text');
    const isAdd = action === 'add' || (!entry.id && !entry.action);
    if (isAdd && nodeType === 'html' && blockedComponents.has(component)) {
      const tempId = entry.tempId || entry.id || `node-${index + 1}`;
      removedIds.add(tempId);
      if (entry.id) removedIds.add(entry.id);
      return false;
    }
    return true;
  }) : [];

  const edges = Array.isArray(plan.edges) ? plan.edges.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const from = entry.from ?? entry.source ?? entry.a ?? null;
    const to = entry.to ?? entry.target ?? entry.b ?? null;
    if (removedIds.has(from) || removedIds.has(to)) return false;
    return true;
  }) : [];

  return { ...plan, nodes, edges };
}

function filterPlanAddOnly(plan) {
  if (!plan || !view?.graph) return plan;
  const existingIds = new Set(view.graph.nodes.map((node) => node.id));
  const removedIds = new Set();
  const nodes = Array.isArray(plan.nodes) ? plan.nodes.filter((entry, index) => {
    if (!entry || typeof entry !== 'object') return false;
    const id = entry.id || null;
    const action = entry.action || (id && existingIds.has(id) ? 'update' : 'add');
    if (action !== 'add') {
      const tempId = entry.tempId || id || `node-${index + 1}`;
      removedIds.add(tempId);
      if (id) removedIds.add(id);
      return false;
    }
    return true;
  }) : [];

  const edges = Array.isArray(plan.edges) ? plan.edges.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const from = entry.from ?? entry.source ?? entry.a ?? null;
    const to = entry.to ?? entry.target ?? entry.b ?? null;
    if (removedIds.has(from) || removedIds.has(to)) return false;
    return true;
  }) : [];

  return { ...plan, nodes, edges };
}

function applyAiPlan(plan, options = {}) {
  const outcome = {
    addedNodes: [],
    updatedNodes: [],
    addedEdges: [],
    updatedEdges: [],
    errors: []
  };

  if (!view.graph) {
    outcome.errors.push('No active graph.');
    return outcome;
  }

  const existingIds = new Set(view.graph.nodes.map((node) => node.id));
  const tempMap = new Map();
  const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];

  nodes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const nodeEntry = options?.ignorePosition ? stripAiNodePosition(entry) : entry;
    const action = nodeEntry.action || (nodeEntry.id && existingIds.has(nodeEntry.id) ? 'update' : 'add');
    if (action === 'update') {
      const id = nodeEntry.id;
      if (!id || !existingIds.has(id)) {
        outcome.errors.push(`Unknown node id: ${id || 'missing'}`);
        return;
      }
      const existing = view.graph.getNode(id);
      const patch = buildNodePatch(nodeEntry, existing);
      view.updateNode(id, patch);
      outcome.updatedNodes.push(id);
      return;
    }

    const tempId = nodeEntry.tempId || nodeEntry.id || `node-${index + 1}`;
    const partial = buildNodePartial(nodeEntry);
    if (!Number.isFinite(partial.x) || !Number.isFinite(partial.y)) {
      partial.autoPlace = true;
    }
    if (nodeEntry.id && !existingIds.has(nodeEntry.id)) {
      partial.id = nodeEntry.id;
    }
    const newId = view.addNode(partial);
    if (newId) {
      tempMap.set(tempId, newId);
      if (nodeEntry.id && nodeEntry.id !== tempId) tempMap.set(nodeEntry.id, newId);
      outcome.addedNodes.push(newId);
    }
  });

  const nodeIds = new Set(view.graph.nodes.map((node) => node.id));
  const edges = Array.isArray(plan.edges) ? plan.edges : [];
  edges.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    let from = entry.from ?? entry.source ?? entry.a ?? null;
    let to = entry.to ?? entry.target ?? entry.b ?? null;
    if (tempMap.has(from)) from = tempMap.get(from);
    if (tempMap.has(to)) to = tempMap.get(to);
    if (!from || !to) {
      outcome.errors.push('Edge missing from/to.');
      return;
    }
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      outcome.errors.push(`Edge references missing node(s): ${from} -> ${to}`);
      return;
    }
    const existing = view.graph.edges.find((edge) => edge.from === from && edge.to === to);
    const patch = {};
    if (entry.label !== undefined) patch.label = entry.label;
    if (entry.color !== undefined) patch.color = entry.color;
    if (entry.pulse !== undefined) patch.pulse = Boolean(entry.pulse);
    if (existing) {
      if (Object.keys(patch).length) {
        view.updateEdge(existing.id, patch);
        outcome.updatedEdges.push(existing.id);
      }
      return;
    }
    const id = view.addEdge(from, to, patch);
    if (id) outcome.addedEdges.push(id);
  });

  connectContextNodes(options, outcome);
  return outcome;
}

function getNodeCenter(node) {
  const w = Number.isFinite(node.w) ? node.w : 0;
  const h = Number.isFinite(node.h) ? node.h : 0;
  return {
    x: (Number.isFinite(node.x) ? node.x : 0) + w / 2,
    y: (Number.isFinite(node.y) ? node.y : 0) + h / 2
  };
}

function getNodeBounds(node) {
  const w = Number.isFinite(node.w) ? node.w : 0;
  const h = Number.isFinite(node.h) ? node.h : 0;
  return {
    x: Number.isFinite(node.x) ? node.x : 0,
    y: Number.isFinite(node.y) ? node.y : 0,
    w,
    h
  };
}

function getBounds(nodes) {
  if (!nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    const x = Number.isFinite(node.x) ? node.x : 0;
    const y = Number.isFinite(node.y) ? node.y : 0;
    const w = Number.isFinite(node.w) ? node.w : 0;
    const h = Number.isFinite(node.h) ? node.h : 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  return { minX, minY, maxX, maxY };
}

function rectsOverlap(a, b, padding = 12) {
  return !(
    a.x + a.w + padding < b.x ||
    b.x + b.w + padding < a.x ||
    a.y + a.h + padding < b.y ||
    b.y + b.h + padding < a.y
  );
}

function buildAdjacency(graph) {
  const map = new Map();
  graph.nodes.forEach((node) => {
    map.set(node.id, new Set());
  });
  graph.edges.forEach((edge) => {
    const a = edge.from;
    const b = edge.to;
    if (!map.has(a) || !map.has(b)) return;
    map.get(a).add(b);
    map.get(b).add(a);
  });
  return map;
}

function collectComponent(startId, adjacency, visited) {
  const ids = new Set();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    if (visited) visited.add(id);
    const neighbors = adjacency.get(id);
    if (!neighbors) continue;
    neighbors.forEach((next) => {
      if (!ids.has(next)) stack.push(next);
    });
  }
  return ids;
}

function estimateHierarchySpacing(nodes) {
  if (!nodes.length) return { gapX: 180, gapY: 140 };
  const totals = nodes.reduce((acc, node) => {
    acc.w += Number.isFinite(node.w) ? node.w : 0;
    acc.h += Number.isFinite(node.h) ? node.h : 0;
    acc.count += 1;
    return acc;
  }, { w: 0, h: 0, count: 0 });
  const avgW = totals.count ? totals.w / totals.count : 0;
  const avgH = totals.count ? totals.h / totals.count : 0;
  return {
    gapX: Math.max(180, avgW + 60),
    gapY: Math.max(140, avgH + 50)
  };
}

function buildLevels(rootId, adjacency, componentIds) {
  const levels = [];
  if (!rootId) return levels;
  const queue = [{ id: rootId, depth: 0 }];
  const visited = new Set([rootId]);
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (!componentIds.has(id)) continue;
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(id);
    const neighbors = adjacency.get(id) || [];
    neighbors.forEach((next) => {
      if (!componentIds.has(next) || visited.has(next)) return;
      visited.add(next);
      queue.push({ id: next, depth: depth + 1 });
    });
  }
  componentIds.forEach((id) => {
    if (!visited.has(id)) {
      if (!levels.length) levels.push([]);
      levels[levels.length - 1].push(id);
    }
  });
  return levels;
}

function chooseHierarchyDirection(levels) {
  if (!levels.length) return 'top-down';
  const depth = levels.length;
  const breadth = Math.max(...levels.map((level) => level.length));
  return breadth >= depth * 1.2 ? 'top-down' : 'left-right';
}

function estimateLayoutSize(levels, nodeMap, spacing, direction, newSet) {
  if (!levels.length) return { width: 0, height: 0 };
  let maxCount = 0;
  let maxWidth = 0;
  let maxHeight = 0;

  levels.forEach((level) => {
    const nodes = level.map((id) => nodeMap.get(id)).filter(Boolean);
    const filtered = nodes.filter((node) => newSet.has(node.id));
    if (!filtered.length) return;
    maxCount = Math.max(maxCount, filtered.length);
    const totalWidth = filtered.reduce((sum, node) => sum + (Number.isFinite(node.w) ? node.w : 0), 0)
      + spacing.gapX * Math.max(0, filtered.length - 1);
    const totalHeight = filtered.reduce((sum, node) => sum + (Number.isFinite(node.h) ? node.h : 0), 0)
      + spacing.gapY * Math.max(0, filtered.length - 1);
    maxWidth = Math.max(maxWidth, totalWidth);
    maxHeight = Math.max(maxHeight, totalHeight);
  });

  if (direction === 'top-down') {
    const height = levels.length * spacing.gapY + maxHeight;
    return { width: Math.max(maxWidth, maxCount * spacing.gapX), height };
  }
  const width = levels.length * spacing.gapX + maxWidth;
  return { width, height: Math.max(maxHeight, maxCount * spacing.gapY) };
}

function resolveCollision(bounds, placedBounds) {
  const step = 24;
  const rings = 6;
  for (let ring = 0; ring <= rings; ring += 1) {
    const d = ring * step;
    const offsets = [
      [0, 0],
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
      [d, d],
      [-d, d],
      [d, -d],
      [-d, -d]
    ];
    for (let i = 0; i < offsets.length; i += 1) {
      const [ox, oy] = offsets[i];
      const candidate = { x: bounds.x + ox, y: bounds.y + oy, w: bounds.w, h: bounds.h };
      const collision = placedBounds.some((box) => rectsOverlap(candidate, box, 12));
      if (!collision) return candidate;
    }
  }
  return bounds;
}

function centroid(nodes) {
  if (!nodes.length) return null;
  const sum = nodes.reduce((acc, node) => {
    const c = getNodeCenter(node);
    acc.x += c.x;
    acc.y += c.y;
    acc.count += 1;
    return acc;
  }, { x: 0, y: 0, count: 0 });
  return {
    x: sum.x / sum.count,
    y: sum.y / sum.count
  };
}

function layoutHierarchyComponent({
  graph,
  componentIds,
  newNodeIds,
  rootId,
  center,
  adjacency,
  direction,
  spacing,
  placedBounds
}) {
  const newSet = new Set(newNodeIds);
  const componentNodes = Array.from(componentIds)
    .map((id) => graph.getNode(id))
    .filter(Boolean);
  const newNodes = componentNodes.filter((node) => newSet.has(node.id));
  if (!newNodes.length) return new Map();
  const existingNodes = componentNodes.filter((node) => !newSet.has(node.id));
  const rootNode = graph.getNode(rootId) || newNodes[0];
  let anchor = center || getNodeCenter(rootNode);
  if (rootNode && !newSet.has(rootNode.id) && Number.isFinite(rootNode.x) && Number.isFinite(rootNode.y)) {
    anchor = getNodeCenter(rootNode);
  } else if (existingNodes.length) {
    const centerPoint = centroid(existingNodes);
    if (centerPoint) anchor = centerPoint;
  }

  const levels = buildLevels(rootNode?.id, adjacency, componentIds);
  const positions = new Map();
  const gapX = spacing.gapX;
  const gapY = spacing.gapY;

  levels.forEach((level, levelIndex) => {
    const nodes = level
      .map((id) => graph.getNode(id))
      .filter((node) => node && newSet.has(node.id));
    if (!nodes.length) return;

    if (direction === 'top-down') {
      const totalWidth = nodes.reduce((sum, node) => sum + (Number.isFinite(node.w) ? node.w : 0), 0)
        + gapX * Math.max(0, nodes.length - 1);
      let cursorX = anchor.x - totalWidth / 2;
      const y = anchor.y + levelIndex * gapY;
      nodes.forEach((node) => {
        const w = Number.isFinite(node.w) ? node.w : 0;
        const h = Number.isFinite(node.h) ? node.h : 0;
        const bounds = { x: cursorX, y: y - h / 2, w, h };
        const resolved = resolveCollision(bounds, placedBounds);
        positions.set(node.id, { x: resolved.x, y: resolved.y });
        placedBounds.push(resolved);
        cursorX += w + gapX;
      });
    } else {
      const totalHeight = nodes.reduce((sum, node) => sum + (Number.isFinite(node.h) ? node.h : 0), 0)
        + gapY * Math.max(0, nodes.length - 1);
      let cursorY = anchor.y - totalHeight / 2;
      const x = anchor.x + levelIndex * gapX;
      nodes.forEach((node) => {
        const w = Number.isFinite(node.w) ? node.w : 0;
        const h = Number.isFinite(node.h) ? node.h : 0;
        const bounds = { x: x - w / 2, y: cursorY, w, h };
        const resolved = resolveCollision(bounds, placedBounds);
        positions.set(node.id, { x: resolved.x, y: resolved.y });
        placedBounds.push(resolved);
        cursorY += h + gapY;
      });
    }
  });

  return positions;
}

function layoutNewNodesHierarchy(nodeIds, options = {}) {
  if (!view?.graph || !Array.isArray(nodeIds) || !nodeIds.length) return;
  const graph = view.graph;
  const newSet = new Set(nodeIds.filter((id) => graph.getNode(id)));
  if (!newSet.size) return;

  const adjacency = buildAdjacency(graph);
  const visited = new Set();
  const components = [];
  nodeIds.forEach((id) => {
    if (!newSet.has(id) || visited.has(id)) return;
    const comp = collectComponent(id, adjacency, visited);
    components.push(comp);
  });

  const existingNodes = graph.nodes.filter((node) => !newSet.has(node.id));
  const existingBounds = getBounds(existingNodes);
  const canvasRect = view.canvas?.getBoundingClientRect();
  const fallbackCenter = canvasRect
    ? view.screenToWorld(canvasRect.width / 2, canvasRect.height / 2)
    : { x: 0, y: 0 };
  const baseY = existingBounds ? (existingBounds.minY + existingBounds.maxY) / 2 : fallbackCenter.y;
  let offsetX = existingBounds ? existingBounds.maxX + 200 : fallbackCenter.x;
  const placedBounds = existingNodes.map(getNodeBounds);

  components.forEach((componentIds) => {
    const compNodes = Array.from(componentIds)
      .map((id) => graph.getNode(id))
      .filter(Boolean);
    const newNodes = compNodes.filter((node) => newSet.has(node.id));
    if (!newNodes.length) return;
    const existingInComponent = compNodes.filter((node) => !newSet.has(node.id));
    const isNewComponent = existingInComponent.length === 0;
    const rootCandidate = options.rootId;
    let rootId = rootCandidate && componentIds.has(rootCandidate)
      ? rootCandidate
      : null;

    if (!rootId) {
      let best = null;
      let bestDegree = -1;
      componentIds.forEach((id) => {
        const degree = adjacency.get(id)?.size || 0;
        if (degree > bestDegree) {
          bestDegree = degree;
          best = id;
        }
      });
      rootId = best || newNodes[0]?.id;
    }

    const levels = buildLevels(rootId, adjacency, componentIds);
    const direction = chooseHierarchyDirection(levels);
    const spacing = estimateHierarchySpacing(compNodes);
    let center = null;

    if (isNewComponent) {
      const nodeMap = new Map(compNodes.map((node) => [node.id, node]));
      const size = estimateLayoutSize(levels, nodeMap, spacing, direction, newSet);
      center = {
        x: offsetX + size.width / 2,
        y: baseY
      };
      offsetX += size.width + 200;
    }

    const positions = layoutHierarchyComponent({
      graph,
      componentIds,
      newNodeIds: Array.from(newSet),
      rootId,
      center,
      adjacency,
      direction,
      spacing,
      placedBounds
    });

    positions.forEach((pos, id) => {
      view.updateNode(id, { x: pos.x, y: pos.y, autoPlace: false });
    });
  });
}

function stripAiNodePosition(entry) {
  const next = { ...entry };
  delete next.x;
  delete next.y;
  return next;
}

function connectContextNodes(options, outcome) {
  const contextIds = Array.isArray(options?.connectContext) ? options.connectContext : [];
  if (!contextIds.length || !view.graph) return;
  const targetIds = outcome.addedNodes.length ? outcome.addedNodes : outcome.updatedNodes;
  if (!targetIds.length) return;
  const primaryTarget = targetIds[0];

  const existingEdgeSet = new Set(
    view.graph.edges.map((edge) => `${edge.from}::${edge.to}`)
  );

  contextIds.forEach((contextId) => {
    const targetId = primaryTarget;
    if (!contextId || !targetId || contextId === targetId) return;
    const key = `${contextId}::${targetId}`;
    if (existingEdgeSet.has(key)) return;
    const edgeId = view.addEdge(contextId, targetId, {});
    if (edgeId) {
      existingEdgeSet.add(key);
      outcome.addedEdges.push(edgeId);
    }
  });
}

function buildNodePartial(entry) {
  const partial = {};
  const type = entry.type || entry.nodeType || (entry.component ? 'html' : entry.text ? 'html-text' : 'text');
  partial.type = type;
  if (type === 'html') {
    partial.component = entry.component || null;
  }
  if (entry.text !== undefined) partial.text = entry.text;
  if (Number.isFinite(entry.x)) partial.x = Number(entry.x);
  if (Number.isFinite(entry.y)) partial.y = Number(entry.y);
  if (Number.isFinite(entry.w)) partial.w = Number(entry.w);
  if (Number.isFinite(entry.h)) partial.h = Number(entry.h);
  if (entry.color !== undefined) partial.color = entry.color;
  if (entry.pulse !== undefined) partial.pulse = Boolean(entry.pulse);
  if (entry.fixed !== undefined) partial.fixed = Boolean(entry.fixed);

  if (entry.props && typeof entry.props === 'object') {
    partial.props = entry.props;
  }
  if (entry.data && typeof entry.data === 'object') {
    partial.data = entry.data;
  }

  const size = resolveComponentSize(entry, type);
  if (!Number.isFinite(partial.w) && size?.w) partial.w = size.w;
  if (!Number.isFinite(partial.h) && size?.h) partial.h = size.h;

  return partial;
}

function buildNodePatch(entry, existing) {
  const patch = {};
  if (entry.type) patch.type = entry.type;
  if (entry.component) patch.component = entry.component;
  if (entry.text !== undefined) patch.text = entry.text;
  if (Number.isFinite(entry.x)) patch.x = Number(entry.x);
  if (Number.isFinite(entry.y)) patch.y = Number(entry.y);
  if (Number.isFinite(entry.w)) patch.w = Number(entry.w);
  if (Number.isFinite(entry.h)) patch.h = Number(entry.h);
  if (entry.color !== undefined) patch.color = entry.color;
  if (entry.pulse !== undefined) patch.pulse = Boolean(entry.pulse);
  if (entry.fixed !== undefined) patch.fixed = Boolean(entry.fixed);

  if (entry.props && typeof entry.props === 'object') {
    patch.props = { ...(existing?.props || {}), ...entry.props };
  }
  if (entry.data && typeof entry.data === 'object') {
    patch.data = { ...(existing?.data || {}), ...entry.data };
  }

  return patch;
}

function resolveComponentSize(entry, type) {
  if (type === 'html-text') {
    return COMPONENT_LOOKUP.get('HtmlText')?.size || null;
  }
  const key = entry.component || entry.key;
  if (key && COMPONENT_LOOKUP.has(key)) {
    return COMPONENT_LOOKUP.get(key)?.size || null;
  }
  if (key && AI_COMPONENT_SIZES.has(key)) {
    return AI_COMPONENT_SIZES.get(key) || null;
  }
  return null;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const id = await importBoardPayload(payload);
    if (!id) {
      setStatus('Board import failed.');
      return;
    }
    refreshBoardList();
    hydrateMediaNodes();
    setStatus('Board imported.');
  } catch (err) {
    console.warn('Board import failed', err);
    setStatus('Board import failed.');
  }
  e.target.value = '';
}


async function seedBoards() {
  projectIndex = [{ id: 'local-default', name: 'Local Project', updatedAt: Date.now() }];
  activeProjectId = projectIndex[0].id;
  const firstId = generateBoardId();
  const secondId = generateBoardId();
  const seedStamp = formatBoardTimestamp();
  const firstSeedName = `${seedStamp} A`;
  const secondSeedName = `${seedStamp} B`;
  const firstPayload = {
    id: firstId,
    name: firstSeedName,
    meta: null,
    nodeOrder: [],
    nodes: [
      { type: 'html-text', text: 'Drop a component to start', x: 120, y: 120, w: 260, h: 90 },
      {
        type: 'html',
        component: 'OptionPicker',
        x: 460,
        y: 180,
        w: 320,
        h: 160,
        props: { label: 'Pick a mode', options: ['Nova', 'Ion', 'Delta'] },
        data: { choice: 'Nova' }
      },
      {
        type: 'html',
        component: 'AudioPlayer',
        x: 120,
        y: 320,
        w: 320,
        h: 160,
        props: { title: 'Audio Capture' },
        data: {}
      }
    ],
    edges: [],
    notifications: []
  };
  const secondPayload = {
    id: secondId,
    name: secondSeedName,
    meta: null,
    nodeOrder: [],
    nodes: [
      { type: 'html-text', text: 'New board ready', x: 120, y: 160, w: 240, h: 80 }
    ],
    edges: [],
    notifications: []
  };
  boardIndex = [
    { id: firstId, projectId: activeProjectId, name: firstSeedName, updatedAt: Date.now() },
    { id: secondId, projectId: activeProjectId, name: secondSeedName, updatedAt: Date.now() }
  ];
  activeBoardId = firstId;
  await saveGraphPayload(firstId, scrubExportPayload(firstPayload));
  await saveGraphPayload(secondId, scrubExportPayload(secondPayload));
  await saveWorkspaceIndex();
  await activateBoard(firstId, { skipSave: true, projectId: activeProjectId });
}

async function toggleRecording() {
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
    return;
  }

  try {
    recordStream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.warn('Recording failed', err);
    setStatus('Microphone access denied.', 2400);
    return;
  }

  recordChunks = [];
  recorder = new MediaRecorder(recordStream);
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) recordChunks.push(event.data);
  });
  recorder.addEventListener('stop', async () => {
    const blob = new Blob(recordChunks, { type: recorder.mimeType || 'audio/webm' });
    recordStream?.getTracks().forEach((track) => track.stop());
    recordStream = null;
    els.recordBtn.classList.remove('is-recording');
    els.recordBtn.textContent = '● Record';
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
    await handleRecordedAudio(file);
  });

  recorder.start();
  els.recordBtn.classList.add('is-recording');
  els.recordBtn.textContent = 'Stop';
  setStatus('Recording audio...');
}

async function handleRecordedAudio(file) {
  const aiConfig = COMPONENT_LOOKUP.get('AI');
  if (currentComponentKey === 'AI' && aiConfig) {
    attachRecordedAudioToAi(file, aiConfig);
    return;
  }
  const config = COMPONENT_LOOKUP.get('AudioPlayer');
  if (!config) return;
  const targetNode = resolveTargetNode(config);
  if (targetNode) {
    await attachAssetToNode(targetNode.id, file, targetNode, config);
    setStatus('Recorded audio attached.');
    return;
  }
  const id = addNodeAtCenter({
    type: 'html',
    component: config.component,
    props: { title: 'Recorded Audio' },
    data: {},
    w: config.size?.w || 320,
    h: config.size?.h || 160
  });
  if (id) await attachAssetToNode(id, file, null, config);
  setStatus('Recorded audio added.');
}

function attachRecordedAudioToAi(file, config) {
  const input = currentForm?.inputs?.media;
  if (!input) {
    setStatus('Open the AI panel to attach the recording.', 1800);
    return;
  }
  if (currentForm) {
    currentForm.aiMediaFile = file;
  }
  const field = config.fields?.find((entry) => entry.key === 'media') || null;
  let assigned = false;
  if (typeof DataTransfer !== 'undefined') {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    assigned = input.files?.length > 0;
  }
  if (assigned) {
    updateFileNote(field || { key: 'media', note: 'ai-asset', assetLabel: 'file' }, input, null);
  } else if (currentForm?.fileButtons?.media) {
    const btn = currentForm.fileButtons.media;
    btn.title = file.name;
    btn.classList.add('has-file');
  }
  updateSendButton();
  setStatus('Recorded audio ready for AI.', 1600);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function buildWorkspaceIndexPayload() {
  return {
    id: WORKSPACE_INDEX_KEY,
    activeProjectId,
    activeGraphId: activeBoardId,
    projects: projectIndex.map((project) => ({ ...project })),
    boards: boardIndex.map((board) => ({ ...board })),
    updatedAt: Date.now()
  };
}

async function saveWorkspaceIndex() {
  if (await ensureServerMode()) {
    saveActiveProjectId(activeProjectId);
    saveActiveBoardIdForProject(activeProjectId, activeBoardId);
    return;
  }
  const db = await openDb();
  const payload = buildWorkspaceIndexPayload();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadWorkspaceIndex() {
  if (await ensureServerMode()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const request = tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_INDEX_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function loadLegacyWorkspacePayload() {
  if (await ensureServerMode()) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const request = tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_LEGACY_KEY);
    request.onsuccess = () => resolve(request.result?.payload || null);
    request.onerror = () => reject(request.error);
  });
}

async function clearLegacyWorkspacePayload() {
  if (await ensureServerMode()) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).delete(WORKSPACE_LEGACY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function graphPayloadKey(projectId, graphId) {
  const scope = projectId || 'local-default';
  return `${WORKSPACE_GRAPH_PREFIX}${scope}_${graphId}`;
}

async function saveGraphPayload(graphId, payload, projectIdOverride = null) {
  if (!graphId || !payload) return;
  const targetProjectId = projectIdOverride || activeProjectId || 'local-default';
  if (await ensureServerMode()) {
    try {
      if (!targetProjectId || targetProjectId === 'local-default') throw new Error('No active project.');
      await apiFetch(`/api/projects/${encodeURIComponent(targetProjectId)}/boards/${encodeURIComponent(graphId)}`, {
        method: 'PUT',
        body: { board: payload }
      });
      return;
    } catch (err) {
      if (!err?.forkedToLocal) throw err;
    }
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).put({
      id: graphPayloadKey(targetProjectId, graphId),
      graphId,
      projectId: targetProjectId,
      payload,
      updatedAt: Date.now()
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadGraphPayload(graphId) {
  if (!graphId) return null;
  if (await ensureServerMode()) {
    try {
      if (!activeProjectId) return null;
      const payload = await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/boards/${encodeURIComponent(graphId)}`);
      return payload?.board || null;
    } catch (err) {
      return null;
    }
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const request = tx.objectStore(WORKSPACE_STORE).get(graphPayloadKey(activeProjectId || 'local-default', graphId));
    request.onsuccess = () => resolve(request.result?.payload || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteGraphPayload(graphId) {
  if (!graphId) return;
  if (await ensureServerMode()) {
    try {
      if (!activeProjectId) return;
      await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/boards/${encodeURIComponent(graphId)}`, { method: 'DELETE' });
    } catch (err) {
      if (!err?.forkedToLocal) throw err;
    }
    if (!forceClientMode) return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).delete(graphPayloadKey(activeProjectId || 'local-default', graphId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function buildServerAssetUrl(projectId, assetId, providedUrl = '') {
  if (!projectId || !assetId) return '';
  if (providedUrl) {
    if (/^https?:\/\//i.test(providedUrl)) return providedUrl;
    return `${SERVER_BASE}${providedUrl}`;
  }
  return `${SERVER_BASE}/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function saveAsset(file, category) {
  if (await ensureServerMode()) {
    try {
      if (!activeProjectId) throw new Error('No active project.');
      const response = await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/assets`, {
        method: 'POST',
        body: {
          filename: file.name || `${category}-${Date.now()}`,
          mimeType: file.type || 'application/octet-stream',
          category: category || null,
          base64: await fileToBase64(file)
        }
      });
      const asset = response?.asset;
      if (!asset?.id) throw new Error('Asset save failed.');
      return {
        id: asset.id,
        name: asset.name || file.name || `${category}-${Date.now()}`,
        type: asset.type || file.type || 'application/octet-stream',
        category: asset.category || category || null,
        createdAt: Number(asset.createdAt || Date.now()),
        url: buildServerAssetUrl(activeProjectId, asset.id, asset.url || '')
      };
    } catch (err) {
      if (!err?.forkedToLocal) throw err;
    }
  }
  const asset = {
    id: crypto.randomUUID(),
    name: file.name || `${category}-${Date.now()}`,
    type: file.type || category,
    category,
    createdAt: Date.now(),
    blob: file
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return asset;
}

async function getAsset(assetId) {
  if (await ensureServerMode()) {
    if (!activeProjectId || !assetId) return null;
    try {
      const response = await fetch(buildServerAssetUrl(activeProjectId, assetId), { method: 'GET' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return {
        id: assetId,
        name: response.headers.get('X-Elenweave-Asset-Name') || null,
        type: response.headers.get('Content-Type') || blob.type || '',
        category: response.headers.get('X-Elenweave-Asset-Category') || null,
        blob
      };
    } catch (err) {
      return null;
    }
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(assetId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAssetUrl(assetId) {
  if (!assetId) return '';
  if (await ensureServerMode()) {
    return buildServerAssetUrl(activeProjectId, assetId);
  }
  if (ASSET_URLS.has(assetId)) return ASSET_URLS.get(assetId);
  const asset = await getAsset(assetId);
  if (!asset?.blob) return '';
  const url = URL.createObjectURL(asset.blob);
  ASSET_URLS.set(assetId, url);
  return url;
}

function collectGraphAssetIds(graph) {
  const ids = new Set();
  if (!graph?.nodes) return ids;
  graph.nodes.forEach((node) => {
    const assetId = node?.data?.assetId;
    if (assetId) ids.add(assetId);
  });
  return ids;
}

function revokeUnusedAssetUrls(activeIds) {
  const keep = activeIds || new Set();
  for (const [assetId, url] of ASSET_URLS) {
    if (!keep.has(assetId)) {
      URL.revokeObjectURL(url);
      ASSET_URLS.delete(assetId);
    }
  }
}

function pruneAssetUrls(graph) {
  const ids = collectGraphAssetIds(graph);
  revokeUnusedAssetUrls(ids);
}

async function hydrateMediaNodes() {
  if (!view.graph) return;
  const updates = [];
  for (const node of view.graph.nodes) {
    if (!node?.data?.assetId) continue;
    const url = await getAssetUrl(node.data.assetId);
    if (!url || node.data.src === url) continue;
    updates.push({
      id: node.id,
      data: { ...node.data, src: url }
    });
  }
  if (updates.length) {
    updates.forEach((entry) => view.updateNode(entry.id, { data: entry.data }));
  }
  pruneAssetUrls(view.graph);
}

function loadTheme() {
  try {
    const saved = localStorage.getItem('elenweave_theme');
    return THEME_ORDER.includes(saved) ? saved : 'blueprint';
  } catch (err) {
    return 'blueprint';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem('elenweave_theme', theme);
  } catch (err) {
    return;
  }
}

function loadEdgeStyle() {
  try {
    const saved = localStorage.getItem(EDGE_STYLE_KEY);
    return EDGE_STYLE_ORDER.includes(saved) ? saved : 'straight';
  } catch (err) {
    return 'straight';
  }
}

function saveEdgeStyle(style) {
  try {
    localStorage.setItem(EDGE_STYLE_KEY, style);
  } catch (err) {
    return;
  }
}

function loadBoardSortOrder() {
  try {
    const saved = localStorage.getItem(BOARD_SORT_KEY);
    return BOARD_SORT_ORDER.includes(saved) ? saved : 'desc';
  } catch (err) {
    return 'desc';
  }
}

function saveBoardSortOrder(order) {
  try {
    localStorage.setItem(BOARD_SORT_KEY, order);
  } catch (err) {
    return;
  }
}

function sortBoardsByTime(boards) {
  const rows = Array.isArray(boards) ? [...boards] : [];
  const factor = boardSortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const aTs = Number(a?.updatedAt || 0);
    const bTs = Number(b?.updatedAt || 0);
    if (aTs !== bTs) return (aTs - bTs) * factor;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
  return rows;
}

function sortActiveProjectBoardsByTime(order = boardSortOrder) {
  const projectId = boardScopeProjectId(activeProjectId);
  const rows = getBoardsForProject(projectId);
  if (rows.length < 2) return;
  const factor = order === 'asc' ? 1 : -1;
  const sortedRows = [...rows].sort((a, b) => {
    const aTs = Number(a?.updatedAt || 0);
    const bTs = Number(b?.updatedAt || 0);
    if (aTs !== bTs) return (aTs - bTs) * factor;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
  const queue = [...sortedRows];
  boardIndex = boardIndex.map((entry) => (
    (entry?.projectId || null) === (projectId || null)
      ? queue.shift()
      : entry
  ));
}

function setEdgeStyle(style) {
  const next = EDGE_STYLE_ORDER.includes(style) ? style : 'straight';
  if (typeof view.setEdgeStyle === 'function') {
    view.setEdgeStyle(next);
  } else {
    view.edgeStyle = next;
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  view.setTheme(theme === 'blueprint' ? 'blueprint' : theme === 'dark' ? 'dark' : 'light');
  if (els.themeToggle) {
    const label = theme.charAt(0).toUpperCase() + theme.slice(1);
    els.themeToggle.textContent = `Theme: ${label}`;
  }
}

function updateEdgeToggle() {
  if (!els.edgeToggle) return;
  const style = view.edgeStyle || 'straight';
  const label = style === 'curved' ? 'Curved' : 'Straight';
  els.edgeToggle.textContent = `Edges: ${label}`;
  els.edgeToggle.classList.toggle('active', style === 'curved');
}

function updateLinkModeButton() {
  if (!els.btnLink) return;
  const enabled = Boolean(view.linkMode);
  els.btnLink.textContent = 'Link Mode';
  els.btnLink.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  els.btnLink.classList.toggle('active', enabled);
  els.btnLink.title = enabled ? 'Link mode on' : 'Link mode off';
}

function setSettingsPanelOpen(open) {
  const isOpen = Boolean(open);
  if (els.settingsPanel) {
    els.settingsPanel.hidden = !isOpen;
    els.settingsPanel.classList.toggle('is-open', isOpen);
  }
  if (els.settingsToggle) {
    els.settingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    els.settingsToggle.classList.toggle('active', isOpen);
  }
}

function restoreUiState() {
  const panelCollapsed = readCollapseState(PANEL_STATE_KEY);
  if (appShell && panelCollapsed) {
    appShell.classList.add('is-collapsed');
  }
  updatePanelToggleState(panelCollapsed);
  updateBoardSortButton();
  updateDeleteBoardButton();
  const hintCollapsed = readCollapseState(HINT_STATE_KEY);
  if (els.hintCenter && hintCollapsed) {
    els.hintCenter.classList.add('is-collapsed');
  }
  setSettingsPanelOpen(false);
}

function updatePanelToggleState(collapsed) {
  if (!els.panelToggle) return;
  const nextCollapsed = Boolean(collapsed);
  els.panelToggle.setAttribute('aria-label', nextCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
  els.panelToggle.setAttribute('title', nextCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
  els.panelToggle.setAttribute('aria-pressed', nextCollapsed ? 'true' : 'false');
}

function updateBoardSortButton() {
  if (!els.btnSortBoards) return;
  const nextLabel = boardSortOrder === 'desc'
    ? 'Sort boards by oldest updated time'
    : 'Sort boards by newest updated time';
  els.btnSortBoards.setAttribute('aria-label', nextLabel);
  els.btnSortBoards.setAttribute('title', nextLabel);
  els.btnSortBoards.setAttribute('data-order', boardSortOrder);
}

function updateDeleteBoardButton() {
  if (!els.btnDeleteBoard) return;
  const hasActiveBoard = Boolean(activeBoardId && getBoardIndexEntry(activeBoardId, activeProjectId || 'local-default'));
  const disabled = isBoardDeleting || !hasActiveBoard;
  els.btnDeleteBoard.disabled = disabled;
  const title = isBoardDeleting
    ? 'Deleting active board...'
    : hasActiveBoard
      ? 'Delete active board'
      : 'No active board to delete';
  els.btnDeleteBoard.setAttribute('title', title);
  els.btnDeleteBoard.setAttribute('aria-label', title);
  updateShareLinkButton();
}

function updateShareLinkButton() {
  if (!els.btnShareLink) return;
  const hasActiveBoard = Boolean(activeBoardId && activeProjectId && getBoardIndexEntry(activeBoardId, activeProjectId || 'local-default'));
  els.btnShareLink.disabled = !hasActiveBoard;
  const title = hasActiveBoard ? 'Copy app link' : 'Select a board to copy a link';
  els.btnShareLink.setAttribute('title', title);
  els.btnShareLink.setAttribute('aria-label', title);
}

function formatShortDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function parseDateValue(value) {
  if (!value) return 0;
  const date = new Date(value);
  const ts = date.getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function resolveCatalogId(entry) {
  const raw = entry?.catalogId || entry?.id || '';
  return String(raw || '').trim();
}

function getLocalProjectForCatalog(catalogId) {
  if (!catalogId) return null;
  let best = null;
  let bestTs = -1;
  projectIndex.forEach((entry) => {
    if (!entry?.remote || entry.remote.catalogId !== catalogId) return;
    const ts = parseDateValue(entry.remote.updatedAt || entry.remote.publishedAt) || Number(entry.updatedAt || 0);
    if (ts > bestTs) {
      bestTs = ts;
      best = entry;
    }
  });
  return best;
}

function isCatalogUpdateAvailable(catalogMeta, localProject) {
  if (!localProject?.remote) return false;
  const remoteUpdated = parseDateValue(catalogMeta.updatedAt || catalogMeta.publishedAt);
  const localUpdated = parseDateValue(localProject.remote.updatedAt || localProject.remote.publishedAt);
  if (remoteUpdated && localUpdated) return remoteUpdated > localUpdated;
  if (catalogMeta.version && localProject.remote.version) {
    return catalogMeta.version !== localProject.remote.version;
  }
  if (catalogMeta.updatedAt && !localProject.remote.updatedAt) return true;
  return false;
}

async function loadPublicCatalog(force = false) {
  if (!PUBLIC_CATALOG_URL) {
    publicCatalogStatus = 'disabled';
    publicCatalogError = 'Public projects not configured.';
    publicCatalogProjects = [];
    renderDownloadPanel(els.downloadSearch?.value || '');
    return;
  }
  const now = Date.now();
  if (!force && publicCatalogLoadedAt && now - publicCatalogLoadedAt < 5 * 60 * 1000) {
    return;
  }
  if (publicCatalogStatus === 'loading') return;
  publicCatalogStatus = 'loading';
  publicCatalogError = '';
  renderDownloadPanel(els.downloadSearch?.value || '');
  try {
    const response = await fetch(PUBLIC_CATALOG_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status}).`);
    }
    const payload = await response.json().catch(() => null);
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    publicCatalogProjects = projects;
    publicCatalogStatus = 'ready';
    publicCatalogLoadedAt = Date.now();
  } catch (err) {
    publicCatalogStatus = 'error';
    publicCatalogError = err?.message || 'Failed to load public projects.';
    publicCatalogProjects = [];
  } finally {
    renderDownloadPanel(els.downloadSearch?.value || '');
  }
}

async function downloadPublicProject(meta, options = {}) {
  if (!IS_SERVER_MODE || forceClientMode) {
    setStatus('Public project downloads require server mode.', 2000);
    return;
  }
  const manifestUrl = String(meta?.manifestUrl || '').trim();
  if (!manifestUrl) {
    setStatus('Project manifest URL is missing.', 2000);
    return;
  }
  const catalogId = String(options.catalogId || '').trim();
  const baseProjectId = String(options.baseProjectId || '').trim();
  try {
    setStatus('Downloading project...', 0);
    const response = await apiFetch('/api/public-projects/import', {
      method: 'POST',
      body: {
        manifestUrl,
        catalogId: catalogId || undefined,
        rename: String(meta?.name || '').trim() || undefined,
        baseProjectId: baseProjectId || undefined
      }
    });
    await refreshProjectsFromServer();
    const newProjectId = response?.project?.id || '';
    if (newProjectId) {
      await activateProject(newProjectId, { force: true, createBoardIfEmpty: false });
    }
    renderDownloadPanel(els.downloadSearch?.value || '');
    setStatus(baseProjectId ? 'Project update downloaded.' : 'Project downloaded.', 2000);
  } catch (err) {
    console.warn('Public project download failed', err);
    setStatus(`Project download failed: ${err?.message || 'unknown error'}.`, 2400);
  }
}

function normalizeProjectMeta(entry) {
  const tags = Array.isArray(entry?.tags) ? entry.tags.filter(Boolean) : [];
  return {
    id: String(entry?.id || ''),
    name: String(entry?.name || 'Untitled Project'),
    description: String(entry?.description || 'No description provided.'),
    publisher: String(entry?.publisher || 'Unknown publisher'),
    publishedAt: entry?.publishedAt || null,
    updatedAt: entry?.updatedAt || null,
    version: String(entry?.version || ''),
    manifestUrl: String(entry?.manifestUrl || ''),
    coverUrl: String(entry?.coverUrl || ''),
    tags
  };
}

function mapProjectEntry(entry) {
  const tags = Array.isArray(entry?.tags) ? entry.tags.filter(Boolean) : [];
  const remote = entry?.remote && typeof entry.remote === 'object'
    ? { ...entry.remote }
    : null;
  return {
    id: String(entry?.id || ''),
    name: String(entry?.name || 'Untitled Project'),
    updatedAt: Number(entry?.updatedAt || Date.now()),
    description: String(entry?.description || ''),
    publisher: String(entry?.publisher || ''),
    publishedAt: entry?.publishedAt || null,
    version: String(entry?.version || ''),
    coverUrl: String(entry?.coverUrl || ''),
    tags,
    remote
  };
}

async function exportProjectById(projectId) {
  const targetProjectId = boardScopeProjectId(projectId);
  if (!targetProjectId) {
    setStatus('No project selected.', 1600);
    return;
  }
  const boards = getBoardsForProject(targetProjectId);
  if (!boards.length) {
    setStatus('No boards in this project to export.', 1800);
    return;
  }
  try {
    if ((activeProjectId || 'local-default') === targetProjectId) {
      await saveActiveGraph();
    }
    const projectEntry = projectIndex.find((entry) => entry.id === targetProjectId) || { id: targetProjectId };
    const meta = normalizeProjectMeta(projectEntry);
    const boardPayloads = await Promise.all(boards.map(async (board) => {
      const payload = await loadGraphPayloadForProject(board.id, targetProjectId);
      return {
        id: board.id,
        name: board.name || 'Untitled',
        updatedAt: board.updatedAt || null,
        payload: payload ? scrubExportPayload(payload) : null
      };
    }));
    const exportedBoards = boardPayloads.filter((entry) => entry.payload);
    if (!exportedBoards.length) {
      setStatus('Unable to export project boards.', 1800);
      return;
    }
    const payload = {
      project: meta,
      boards: exportedBoards
    };
    const filename = `${meta.name.replace(/\s+/g, '-').toLowerCase() || 'project'}.json`;
    downloadJson(filename, payload);
    setStatus('Project exported.');
  } catch (err) {
    console.warn('Project export failed', err);
    setStatus('Project export failed.', 1800);
  }
}

async function loadGraphPayloadForProject(graphId, projectId) {
  if (!graphId) return null;
  const targetProjectId = boardScopeProjectId(projectId);
  if (await ensureServerMode()) {
    try {
      if (!targetProjectId) return null;
      const payload = await apiFetch(`/api/projects/${encodeURIComponent(targetProjectId)}/boards/${encodeURIComponent(graphId)}`);
      return payload?.board || null;
    } catch (err) {
      return null;
    }
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const request = tx.objectStore(WORKSPACE_STORE).get(graphPayloadKey(targetProjectId, graphId));
    request.onsuccess = () => resolve(request.result?.payload || null);
    request.onerror = () => reject(request.error);
  });
}

function buildDownloadCard(entry) {
  const meta = normalizeProjectMeta(entry);
  const catalogId = resolveCatalogId(entry);
  const localProject = getLocalProjectForCatalog(catalogId);
  const isDownloaded = Boolean(localProject);
  const updateAvailable = isDownloaded && isCatalogUpdateAvailable(meta, localProject);
  const serverEnabled = IS_SERVER_MODE && !forceClientMode;
  const card = document.createElement('div');
  card.className = 'download-card';

  const title = document.createElement('div');
  title.className = 'download-card-title';
  title.textContent = meta.name || 'Untitled Project';

  const desc = document.createElement('div');
  desc.className = 'download-card-desc';
  desc.textContent = meta.description;

  const publisher = document.createElement('div');
  publisher.className = 'download-card-publisher';
  publisher.textContent = `Publisher: ${meta.publisher}`;

  const metaLine = document.createElement('div');
  metaLine.className = 'download-card-meta-line';
  const metaParts = [];
  if (meta.version) metaParts.push(`v${meta.version}`);
  if (meta.tags.length) metaParts.push(meta.tags.slice(0, 3).join(', '));
  if (metaParts.length) {
    metaLine.textContent = metaParts.join(' • ');
  }

  const status = document.createElement('div');
  status.className = 'download-card-status';
  if (isDownloaded) {
    status.textContent = updateAvailable ? 'Update available' : 'Up to date';
    if (updateAvailable) status.classList.add('is-update');
  } else {
    status.textContent = 'Not downloaded';
  }

  const actions = document.createElement('div');
  actions.className = 'download-card-actions';
  const button = document.createElement('button');
  button.className = 'btn download-card-btn';
  button.type = 'button';
  if (!serverEnabled) {
    button.textContent = 'Server mode required';
    button.disabled = true;
  } else if (!meta.manifestUrl) {
    button.textContent = 'Unavailable';
    button.disabled = true;
  } else if (!isDownloaded) {
    button.textContent = 'Download';
  } else if (updateAvailable) {
    button.textContent = 'Download update';
  } else {
    button.textContent = 'Up to date';
    button.disabled = true;
  }
  button.addEventListener('click', () => {
    const baseProjectId = isDownloaded ? localProject?.id || '' : '';
    void downloadPublicProject(meta, { catalogId, baseProjectId });
  });
  actions.appendChild(button);

  const publishDay = document.createElement('div');
  publishDay.className = 'download-card-date';
  const primaryDate = meta.publishedAt || meta.updatedAt;
  publishDay.textContent = `Publish Day: ${formatShortDate(primaryDate)}`;

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(publisher);
  if (metaLine.textContent) {
    card.appendChild(metaLine);
  }
  card.appendChild(status);
  card.appendChild(actions);
  card.appendChild(publishDay);
  return card;
}

function renderDownloadPanel(filter = '') {
  if (!els.downloadGrid) return;
  const normalized = String(filter || '').trim().toLowerCase();
  if (!PUBLIC_CATALOG_URL) {
    els.downloadGrid.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'download-empty';
    empty.textContent = 'Public projects are not configured for this app.';
    els.downloadGrid.appendChild(empty);
    return;
  }
  if (publicCatalogStatus === 'loading') {
    els.downloadGrid.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'download-empty';
    empty.textContent = 'Loading public projects...';
    els.downloadGrid.appendChild(empty);
    return;
  }
  if (publicCatalogStatus === 'error') {
    els.downloadGrid.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'download-empty';
    empty.textContent = publicCatalogError || 'Unable to load public projects.';
    els.downloadGrid.appendChild(empty);
    return;
  }
  const projects = publicCatalogProjects
    .filter((entry) => {
      if (!normalized) return true;
      const meta = normalizeProjectMeta(entry);
      const haystack = [
        meta.name,
        meta.description,
        meta.publisher,
        meta.version,
        ...(meta.tags || [])
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => (new Date(b?.updatedAt || 0).getTime()) - (new Date(a?.updatedAt || 0).getTime()));
  els.downloadGrid.innerHTML = '';
  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'download-empty';
    empty.textContent = normalized ? 'No projects match your search.' : 'No projects available.';
    els.downloadGrid.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  projects.forEach((entry) => frag.appendChild(buildDownloadCard(entry)));
  els.downloadGrid.appendChild(frag);
}

function setDownloadPanelOpen(open) {
  if (!els.downloadOverlay) return;
  const isOpen = Boolean(open);
  els.downloadOverlay.hidden = !isOpen;
  if (isOpen) {
    if (els.downloadSearch) {
      els.downloadSearch.value = '';
      els.downloadSearch.focus();
    }
    void loadPublicCatalog(true);
    renderDownloadPanel('');
  }
}

function shouldPollServerProjects() {
  if (!IS_SERVER_MODE || forceClientMode) return false;
  if (SEED_READ_ONLY_MODE !== 'off') return false;
  if (READ_ONLY_FORK_MODE === 'local' && shouldForkLocally(activeProjectId)) return false;
  return true;
}

function stopProjectPolling() {
  if (projectPollTimer) {
    window.clearInterval(projectPollTimer);
    projectPollTimer = null;
  }
}

function startProjectPolling() {
  stopProjectPolling();
  if (!shouldPollServerProjects()) return;
  projectPollTimer = window.setInterval(() => {
    void pollServerProjects();
  }, PROJECT_POLL_INTERVAL_MS);
}

function areProjectListsEqual(next, prev) {
  if (!Array.isArray(next) || !Array.isArray(prev)) return false;
  if (next.length !== prev.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i];
    const b = prev[i];
    if (!b) return false;
    if (String(a.id || '') !== String(b.id || '')) return false;
    if (Number(a.updatedAt || 0) !== Number(b.updatedAt || 0)) return false;
  }
  return true;
}

function areBoardListsEqual(next, prev) {
  if (!Array.isArray(next) || !Array.isArray(prev)) return false;
  if (next.length !== prev.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i];
    const b = prev[i];
    if (!b) return false;
    if (String(a.id || '') !== String(b.id || '')) return false;
    if (Number(a.updatedAt || 0) !== Number(b.updatedAt || 0)) return false;
  }
  return true;
}

async function pollServerProjects() {
  if (!shouldPollServerProjects()) {
    stopProjectPolling();
    return;
  }
  try {
    const payload = await apiFetch('/api/projects');
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    const nextProjects = projects.map((entry) => mapProjectEntry(entry)).filter((entry) => entry.id);
    const sortedNext = [...nextProjects].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const sortedPrev = [...projectIndex].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const projectsChanged = !areProjectListsEqual(sortedNext, sortedPrev);
    if (projectsChanged) {
      projectIndex = nextProjects;
      refreshProjectList();
      if (activeProjectId && !projectIndex.some((entry) => entry.id === activeProjectId)) {
        activeProjectId = projectIndex[0]?.id || null;
      }
    }
    if (activeProjectId) {
      const boardsPayload = await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/boards`);
      const boards = Array.isArray(boardsPayload?.boards) ? boardsPayload.boards : [];
      const nextBoards = boards.map((entry) => ({
        id: entry.id,
        projectId: activeProjectId,
        name: entry.name || 'Untitled',
        updatedAt: entry.updatedAt || Date.now()
      }));
      const prevBoards = getBoardsForProject(activeProjectId);
      const sortedNextBoards = [...nextBoards].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const sortedPrevBoards = [...prevBoards].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const boardsChanged = !areBoardListsEqual(sortedNextBoards, sortedPrevBoards);
      if (boardsChanged) {
        removeBoardsForProject(activeProjectId);
        boardIndex.push(...nextBoards);
        refreshBoardList();
      }
    }
  } catch (err) {
    // Silent retry on next tick.
  }
}

function buildEmbedBaseUrl() {
  const origin = window.location.origin;
  if (!SERVER_BASE) return origin;
  if (SERVER_BASE.startsWith('http://') || SERVER_BASE.startsWith('https://')) {
    return SERVER_BASE.replace(/\/+$/, '');
  }
  return `${origin}${SERVER_BASE}`.replace(/\/+$/, '');
}

function buildAppBaseUrl() {
  const origin = window.location.origin;
  if (!SERVER_BASE) return origin;
  if (SERVER_BASE.startsWith('http://') || SERVER_BASE.startsWith('https://')) {
    return SERVER_BASE.replace(/\/+$/, '');
  }
  return `${origin}${SERVER_BASE}`.replace(/\/+$/, '');
}

function buildAppLink(projectId, boardId) {
  const base = buildAppBaseUrl();
  const url = new URL('/', base);
  const resolvedProjectId = String(projectId || '').trim();
  const resolvedBoardId = String(boardId || '').trim();
  if (resolvedProjectId) {
    url.searchParams.set('projectId', resolvedProjectId);
  }
  if (resolvedBoardId) {
    url.searchParams.set('boardId', resolvedBoardId);
  }
  return url.toString();
}

function syncAppUrl() {
  if (!window.history || typeof window.history.replaceState !== 'function') return;
  const next = buildAppLink(activeProjectId, activeBoardId);
  window.history.replaceState(
    { projectId: activeProjectId || null, boardId: activeBoardId || null },
    '',
    next
  );
}

function parseAppLinkParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    projectId: String(params.get('projectId') || '').trim(),
    boardId: String(params.get('boardId') || '').trim()
  };
}

async function applyAppLinkSelection() {
  const { projectId, boardId } = parseAppLinkParams();
  if (!projectId && !boardId) return false;
  let resolvedProjectId = projectId;
  const resolvedBoardId = boardId;

  if (!resolvedProjectId && resolvedBoardId) {
    const matches = getBoardIndexEntriesById(resolvedBoardId);
    if (matches.length === 1) {
      resolvedProjectId = matches[0].projectId;
    } else if (matches.length > 1) {
      setStatus('Board link matches multiple projects.', 2200);
      return false;
    }
  }

  if (resolvedProjectId && !projectIndex.some((entry) => entry.id === resolvedProjectId)) {
    setStatus('Project link not found in this workspace.', 2200);
    return false;
  }

  if (resolvedProjectId && (resolvedProjectId !== activeProjectId || !activeProjectId)) {
    await activateProject(resolvedProjectId, { skipSave: true, force: true, createBoardIfEmpty: false });
  }

  if (resolvedBoardId) {
    const scopedProjectId = resolvedProjectId || activeProjectId || 'local-default';
    const boardEntry = getBoardIndexEntry(resolvedBoardId, scopedProjectId)
      || getBoardIndexEntriesById(resolvedBoardId)[0];
    if (!boardEntry) {
      setStatus('Board link not found in this workspace.', 2200);
      syncAppUrl();
      return false;
    }
    await activateBoard(boardEntry.id, { skipSave: true, projectId: boardEntry.projectId || scopedProjectId });
  }

  syncAppUrl();
  return true;
}

function updateEmbedPanel() {
  if (!els.embedLinkInput || !els.embedCopyBtn || !els.embedNote) return;
  const serverEnabled = IS_SERVER_MODE && !forceClientMode;
  if (!serverEnabled) {
    els.embedLinkInput.value = '';
    els.embedCopyBtn.disabled = true;
    els.embedNote.textContent = 'Embeds require server runtime mode.';
    return;
  }
  if (!activeProjectId || !activeBoardId) {
    els.embedLinkInput.value = '';
    els.embedCopyBtn.disabled = true;
    els.embedNote.textContent = 'Select a board to generate a link.';
    return;
  }
  const theme = String(els.embedThemeSelect?.value || '').trim();
  const base = buildEmbedBaseUrl();
  const url = new URL('/embed', base);
  url.searchParams.set('projectId', activeProjectId);
  url.searchParams.set('boardId', activeBoardId);
  if (theme) {
    url.searchParams.set('theme', theme);
  }
  els.embedLinkInput.value = url.toString();
  els.embedCopyBtn.disabled = false;
  els.embedNote.textContent = 'Anyone with the link can view.';
}

function setEmbedModalOpen(open) {
  if (!els.embedModal) return;
  const isOpen = Boolean(open);
  els.embedModal.hidden = !isOpen;
  if (isOpen) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || loadTheme();
    if (els.embedThemeSelect && THEME_ORDER.includes(currentTheme)) {
      els.embedThemeSelect.value = currentTheme;
    }
    updateEmbedPanel();
    window.setTimeout(() => els.embedLinkInput?.focus(), 0);
  }
}

async function copyEmbedLink() {
  const link = String(els.embedLinkInput?.value || '').trim();
  if (!link) {
    setStatus('Embed link unavailable.', 1600);
    return;
  }
  const ok = await writeClipboardText(link);
  setStatus(ok ? 'Embed link copied.' : 'Copy failed.', 1400);
}

async function copyAppLink() {
  if (!activeProjectId || !activeBoardId) {
    setStatus('Select a board to copy a link.', 1600);
    return;
  }
  const link = buildAppLink(activeProjectId, activeBoardId);
  if (!link) {
    setStatus('Link unavailable.', 1600);
    return;
  }
  const ok = await writeClipboardText(link);
  setStatus(ok ? 'Link copied.' : 'Copy failed.', 1400);
}

function isDesktopBridgeAvailable() {
  return Boolean(DESKTOP_BRIDGE && typeof DESKTOP_BRIDGE.getRuntimeInfo === 'function');
}

function setDesktopPanelStatus(text) {
  if (!els.desktopRuntimeInfo) return;
  els.desktopRuntimeInfo.textContent = String(text || 'Desktop runtime unavailable.');
}

function setDesktopSettingsBusy(busy) {
  desktopSettingsBusy = Boolean(busy);
  const disabled = desktopSettingsBusy || !isDesktopBridgeAvailable();
  [
    els.desktopPortInput,
    els.desktopDataDirInput,
    els.desktopConfigPathInput,
    els.desktopAiConfigPathInput,
    els.desktopSaveConfig,
    els.desktopRestartServer,
    els.desktopOpenDataDir,
    els.desktopOpenConfigFile
  ].forEach((el) => {
    if (!el) return;
    el.disabled = disabled;
  });
}

function updateDesktopSettingsFields(config = {}, runtime = {}) {
  if (els.desktopPortInput) {
    const port = Number(config?.port || runtime?.port || 8787);
    els.desktopPortInput.value = Number.isFinite(port) ? String(port) : '';
  }
  if (els.desktopDataDirInput) {
    els.desktopDataDirInput.value = String(config?.dataDir || runtime?.dataDir || '');
  }
  if (els.desktopConfigPathInput) {
    els.desktopConfigPathInput.value = String(config?.configPath || '');
  }
  if (els.desktopAiConfigPathInput) {
    els.desktopAiConfigPathInput.value = String(config?.aiConfigPath || '');
  }
}

function formatDesktopRuntimeText(runtime = {}) {
  const apiBase = String(runtime?.apiBase || '');
  const mode = String(runtime?.mode || 'server');
  const dataDir = String(runtime?.dataDir || '');
  const pid = runtime?.serverPid;
  const parts = [];
  if (apiBase) parts.push(`API: ${apiBase}`);
  parts.push(`Mode: ${mode}`);
  if (dataDir) parts.push(`Data: ${dataDir}`);
  parts.push(`PID: ${pid || 'n/a'}`);
  return parts.join(' | ');
}

async function loadDesktopSettingsSnapshot() {
  if (!isDesktopBridgeAvailable()) return null;
  const runtime = await DESKTOP_BRIDGE.getRuntimeInfo();
  const config = typeof DESKTOP_BRIDGE.getConfig === 'function'
    ? await DESKTOP_BRIDGE.getConfig()
    : {};
  return { runtime, config };
}

async function refreshDesktopSettingsPanel() {
  if (!isDesktopBridgeAvailable()) return;
  const snapshot = await loadDesktopSettingsSnapshot();
  if (!snapshot) return;
  desktopRuntimeInfo = snapshot.runtime || null;
  updateDesktopSettingsFields(snapshot.config, snapshot.runtime);
  setDesktopPanelStatus(formatDesktopRuntimeText(snapshot.runtime));
}

async function initDesktopSettingsPanel() {
  if (!els.desktopSettingsGroup) return;
  if (!isDesktopBridgeAvailable()) {
    els.desktopSettingsGroup.hidden = true;
    setDesktopPanelStatus('Desktop runtime unavailable.');
    return;
  }
  els.desktopSettingsGroup.hidden = false;
  setDesktopSettingsBusy(true);
  try {
    await refreshDesktopSettingsPanel();
  } catch (err) {
    setDesktopPanelStatus(`Desktop settings unavailable: ${err?.message || 'unknown error'}.`);
  } finally {
    setDesktopSettingsBusy(false);
  }
}

function readDesktopPanelInputValues() {
  const values = {};
  const rawPort = String(els.desktopPortInput?.value || '').trim();
  if (rawPort) {
    const port = Number.parseInt(rawPort, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      throw new Error('Port must be between 1 and 65535.');
    }
    values.port = port;
  }
  values.dataDir = String(els.desktopDataDirInput?.value || '').trim();
  values.configPath = String(els.desktopConfigPathInput?.value || '').trim();
  values.aiConfigPath = String(els.desktopAiConfigPathInput?.value || '').trim();
  return values;
}

async function saveDesktopSettings() {
  if (!isDesktopBridgeAvailable()) return;
  if (typeof DESKTOP_BRIDGE.updateConfig !== 'function') {
    setStatus('Desktop settings update is not available in this runtime.', 1800);
    return;
  }
  if (desktopSettingsBusy) return;
  setDesktopSettingsBusy(true);
  try {
    const payload = readDesktopPanelInputValues();
    await DESKTOP_BRIDGE.updateConfig(payload);
    await refreshDesktopSettingsPanel();
    setStatus('Desktop config saved. Restart server to apply changes.', 1800);
  } catch (err) {
    setStatus(`Failed to save desktop config: ${err?.message || 'unknown error'}.`, 2400);
  } finally {
    setDesktopSettingsBusy(false);
  }
}

async function restartDesktopServerFromPanel() {
  if (!isDesktopBridgeAvailable()) return;
  if (desktopSettingsBusy) return;
  setDesktopSettingsBusy(true);
  try {
    if (typeof DESKTOP_BRIDGE.restartServer !== 'function') {
      throw new Error('Restart API unavailable.');
    }
    const runtime = await DESKTOP_BRIDGE.restartServer();
    desktopRuntimeInfo = runtime || null;
    setDesktopPanelStatus(formatDesktopRuntimeText(runtime));
    setStatus('Desktop server restarted.', 1500);
  } catch (err) {
    setStatus(`Failed to restart desktop server: ${err?.message || 'unknown error'}.`, 2400);
  } finally {
    setDesktopSettingsBusy(false);
  }
}

async function openDesktopDataDirFromPanel() {
  if (!isDesktopBridgeAvailable()) return;
  try {
    await DESKTOP_BRIDGE.openDataDir?.();
  } catch (err) {
    setStatus(`Failed to open data directory: ${err?.message || 'unknown error'}.`, 2200);
  }
}

async function openDesktopConfigFileFromPanel() {
  if (!isDesktopBridgeAvailable()) return;
  try {
    if (typeof DESKTOP_BRIDGE.openDesktopConfig === 'function') {
      await DESKTOP_BRIDGE.openDesktopConfig();
      return;
    }
    await DESKTOP_BRIDGE.openConfigFile?.();
  } catch (err) {
    setStatus(`Failed to open desktop config: ${err?.message || 'unknown error'}.`, 2200);
  }
}

async function initApp() {
  const useServer = await ensureServerMode();
  const restored = await restoreWorkspace();
  await refreshServerAiProviders();
  if (!restored && !useServer) {
    await seedBoards();
  }
  refreshProjectList();
  refreshBoardList();
  await applyAppLinkSelection();
  setTheme(loadTheme());
  setEdgeStyle(loadEdgeStyle());
  updateEdgeToggle();
  renderForm(COMPONENT_CONFIG[0], null);
  updateSendButton();
  updateRecordButton();
  if (els.providerSelect) {
    els.providerSelect.value = loadProvider();
  }
  syncApiKeyInput();
  initRealtime();
  restoreUiState();
  await initDesktopSettingsPanel();
  if (!restored && useServer) {
    setStatus('Server storage mode requires a live API. Could not load /api/projects.', 0);
    return;
  }
  await hydrateMediaNodes();
  collapseNotificationPanel();
  window.requestAnimationFrame(() => fitContentToView());
  if (forceClientMode && READ_ONLY_FORK_MODE === 'local') {
    setStatus('Read-only hosted data. Editing local fork.', 0);
    localForkNoticeShown = true;
    return;
  }
  startProjectPolling();
  setStatus('Demo workspace ready.');
}

async function restoreServerWorkspace() {
  try {
    const projectsPayload = await apiFetch('/api/projects');
    let projects = Array.isArray(projectsPayload?.projects) ? projectsPayload.projects : [];
    if (!projects.length) {
      const created = await apiFetch('/api/projects', {
        method: 'POST',
        body: { name: 'Default Project' }
      });
      if (created?.project?.id) {
        projects = [created.project];
      }
    }
    if (!projects.length) return false;

    projectIndex = projects.map((entry) => mapProjectEntry(entry)).filter((entry) => entry.id);

    let projectId = loadActiveProjectId();
    if (!projectIndex.some((entry) => entry.id === projectId)) {
      projectId = projectIndex[0]?.id || null;
    }
    if (!projectId) return false;
    activeProjectId = projectId;
    saveActiveProjectId(activeProjectId);

    const boardsPayload = await apiFetch(`/api/projects/${encodeURIComponent(activeProjectId)}/boards`);
    boardIndex = Array.isArray(boardsPayload?.boards)
      ? boardsPayload.boards.map((entry) => ({
        id: entry.id,
        projectId: activeProjectId,
        name: entry.name || 'Untitled',
        updatedAt: entry.updatedAt || Date.now()
      }))
      : [];

    let boardId = loadActiveBoardIdForProject(activeProjectId);
    if (!boardIndex.some((entry) => entry.id === boardId)) {
      boardId = boardIndex[0]?.id || null;
    }
    validateBoardIndexInvariants();
    activeBoardId = boardId;
    if (activeBoardId) {
      await activateBoard(activeBoardId, { skipSave: true, projectId: activeProjectId });
    } else {
      clearBoardViewForEmptyProject();
      await saveWorkspaceIndex();
    }
    return true;
  } catch (err) {
    console.warn('Server workspace restore failed', err);
    return false;
  }
}

async function restoreWorkspace() {
  try {
    if (await ensureServerMode()) {
      return restoreServerWorkspace();
    }
    const index = await loadWorkspaceIndex();
    if (!index || !Array.isArray(index.boards)) {
      const legacy = await loadLegacyWorkspacePayload();
      if (!legacy || !Array.isArray(legacy.graphs) || !legacy.graphs.length) return false;
      boardIndex = legacy.graphs.map((graph) => ({
        id: graph.id || generateBoardId(),
        projectId: 'local-default',
        name: graph.name || 'Untitled',
        updatedAt: Date.now()
      }));
      const legacyIdMap = new Map();
      for (let i = 0; i < legacy.graphs.length; i += 1) {
        const graph = legacy.graphs[i];
        const entry = boardIndex[i];
        const payload = { ...graph, id: entry.id, name: entry.name };
        legacyIdMap.set(graph.id, entry.id);
        await saveGraphPayload(entry.id, scrubExportPayload(payload));
      }
      activeBoardId = legacy.activeGraphId ? legacyIdMap.get(legacy.activeGraphId) : boardIndex[0]?.id || null;
      projectIndex = [{ id: 'local-default', name: 'Local Project', updatedAt: Date.now() }];
      activeProjectId = projectIndex[0].id;
      await saveWorkspaceIndex();
      await clearLegacyWorkspacePayload();
      if (!activeBoardId) {
        clearBoardViewForEmptyProject();
        return true;
      }
      await activateBoard(activeBoardId, { skipSave: true, projectId: activeProjectId });
      return true;
    }
    projectIndex = Array.isArray(index.projects) && index.projects.length
      ? index.projects.map((entry) => mapProjectEntry(entry)).filter((entry) => entry.id)
      : [{ id: 'local-default', name: 'Local Project', updatedAt: Date.now() }];
    activeProjectId = index.activeProjectId || projectIndex[0]?.id || null;
    if (!projectIndex.some((entry) => entry.id === activeProjectId)) {
      activeProjectId = projectIndex[0]?.id || null;
    }
    const fallbackProjectId = activeProjectId || projectIndex[0]?.id || 'local-default';
    const storedBoards = Array.isArray(index.boards) ? index.boards : [];
    boardIndex = storedBoards.map((entry) => ({
      id: entry.id,
      projectId: entry.projectId || fallbackProjectId,
      name: entry.name || 'Untitled',
      updatedAt: entry.updatedAt || Date.now()
    }));
    boardIndex.forEach((entry) => ensureProjectIndexEntry(entry.projectId, entry.projectId === 'local-default' ? 'Local Project' : 'Untitled Project'));
    validateBoardIndexInvariants();
    const activeBoards = getBoardsForProject(activeProjectId);
    const scopedActiveBoardId = loadActiveBoardIdForProject(activeProjectId);
    activeBoardId = activeBoards.some((entry) => entry.id === scopedActiveBoardId)
      ? scopedActiveBoardId
      : activeBoards.some((entry) => entry.id === index.activeGraphId)
      ? index.activeGraphId
      : activeBoards[0]?.id || null;
    if (!activeBoardId) {
      clearBoardViewForEmptyProject();
      await saveWorkspaceIndex();
      return true;
    }
    await activateBoard(activeBoardId, { skipSave: true, projectId: activeProjectId });
    return true;
  } catch (err) {
    console.warn('Workspace restore failed', err);
    return false;
  }
}

let workspaceSaveTimer = null;
function scheduleWorkspaceSave() {
  if (projectSwitchDepth > 0) return;
  if (workspaceSaveTimer) window.clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = window.setTimeout(async () => {
    workspaceSaveTimer = null;
    if (projectSwitchDepth > 0) return;
    try {
      await saveActiveGraph();
    } catch (err) {
      console.warn('Workspace save failed', err);
    }
  }, 450);
}

function patchWorkspacePersistence() {
  const methods = [
    'addNode',
    'addNodes',
    'updateNode',
    'updateNodes',
    'removeNode',
    'addEdge',
    'addEdges',
    'updateEdge',
    'updateEdges',
    'removeEdge',
    'importGraph',
    'importWorkspace',
    'setActiveGraph'
  ];

  methods.forEach((method) => {
    if (typeof view[method] !== 'function') return;
    const original = view[method].bind(view);
    view[method] = (...args) => {
      const result = original(...args);
      scheduleWorkspaceSave();
      return result;
    };
  });

  if (workspace?.on) {
    [
      'graph:created',
      'graph:renamed',
      'graph:deleted',
      'edges:added',
      'edges:updated',
      'nodes:added',
      'nodes:updated'
    ].forEach((evt) => {
      workspace.on(evt, scheduleWorkspaceSave);
    });
  }
}

function readCollapseState(key) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch (err) {
    return false;
  }
}

function saveCollapseState(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch (err) {
    return;
  }
}
