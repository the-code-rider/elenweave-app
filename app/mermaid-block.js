let mermaidInitialized = false;
let mermaidRenderCounter = 0;
const MERMAID_ZOOM_STEP = 0.2;
const MERMAID_MIN_ZOOM = 0.4;
const MERMAID_MAX_ZOOM = 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stopEventPropagation(event) {
  event.stopPropagation();
}

function createControlButton(label, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ew-mermaid-control';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('pointerdown', stopEventPropagation);
  button.addEventListener('mousedown', stopEventPropagation);
  button.addEventListener('click', stopEventPropagation);
  button.addEventListener('dblclick', stopEventPropagation);
  return button;
}

function createPanelFrame(node, fallbackTitle) {
  const root = document.createElement('div');
  root.className = 'ew-panel ew-mermaid';

  const header = document.createElement('div');
  header.className = 'ew-node-header';
  header.dataset.ewDrag = 'true';
  header.dataset.ewSelect = 'true';
  header.dataset.ewLink = 'true';

  const title = document.createElement('span');
  title.textContent = resolveTitle(node, fallbackTitle);

  const meta = document.createElement('span');
  meta.className = 'ew-header-meta';

  const controls = document.createElement('div');
  controls.className = 'ew-mermaid-controls';
  controls.addEventListener('pointerdown', stopEventPropagation);
  controls.addEventListener('mousedown', stopEventPropagation);
  controls.addEventListener('click', stopEventPropagation);
  controls.addEventListener('dblclick', stopEventPropagation);

  const zoomOut = createControlButton('-', 'Zoom out');
  const zoomIn = createControlButton('+', 'Zoom in');
  const zoomReset = createControlButton('100%', 'Reset zoom');
  const zoomFit = createControlButton('Fit', 'Fit diagram width');

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'ew-mermaid-zoom-label';
  zoomLabel.textContent = '100%';

  controls.append(zoomOut, zoomIn, zoomReset, zoomFit, zoomLabel);

  const anchor = document.createElement('span');
  anchor.className = 'ew-link-anchor';
  anchor.dataset.ewLink = 'true';
  anchor.title = 'Link';

  header.append(title, meta, controls, anchor);

  const body = document.createElement('div');
  body.className = 'ew-node-body ew-mermaid-body';

  root.append(header, body);
  return {
    root,
    body,
    titleEl: title,
    controls: {
      zoomOut,
      zoomIn,
      zoomReset,
      zoomFit,
      zoomLabel
    }
  };
}

function resolveTitle(node, fallbackTitle) {
  return node?.props?.title || node?.data?.title || fallbackTitle || 'Mermaid Diagram';
}

function sanitizeSvgMarkup(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, message: 'Rendered output is empty.' };

  const purify = window?.DOMPurify;
  if (!purify || typeof purify.sanitize !== 'function') {
    return { ok: false, message: 'DOMPurify is unavailable. Mermaid rendering is disabled.' };
  }

  const safeSvg = purify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true }
  });
  if (!safeSvg || !safeSvg.trim()) {
    return { ok: false, message: 'Rendered Mermaid SVG was blocked by sanitizer.' };
  }
  return { ok: true, html: safeSvg };
}

function normalizeRenderedSvgSize(svg) {
  if (!(svg instanceof SVGElement)) return null;
  svg.style.maxWidth = 'none';
  svg.style.height = 'auto';
  const viewBox = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/);
  if (viewBox.length === 4) {
    const viewBoxWidth = Number(viewBox[2]);
    if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
      const width = Math.round(viewBoxWidth);
      svg.dataset.ewBaseWidth = String(width);
      svg.style.width = `${width}px`;
      return width;
    }
  }
  try {
    const bbox = svg.getBBox();
    if (Number.isFinite(bbox.width) && bbox.width > 0) {
      const width = Math.round(bbox.width);
      svg.dataset.ewBaseWidth = String(width);
      svg.style.width = `${width}px`;
      return width;
    }
  } catch (err) {
    // Some SVGs cannot resolve bbox before paint; fallback to auto width.
  }
  svg.dataset.ewBaseWidth = '';
  svg.style.width = 'auto';
  return null;
}

function applyZoom(svg, zoom) {
  if (!(svg instanceof SVGElement)) return null;
  const baseWidth = Number(svg.dataset.ewBaseWidth);
  if (!Number.isFinite(baseWidth) || baseWidth <= 0) return null;
  const clampedZoom = clamp(zoom, MERMAID_MIN_ZOOM, MERMAID_MAX_ZOOM);
  svg.style.width = `${Math.round(baseWidth * clampedZoom)}px`;
  svg.dataset.ewZoom = String(clampedZoom);
  return clampedZoom;
}

function fitZoomToWidth(svg, viewportWidth) {
  if (!(svg instanceof SVGElement)) return null;
  const baseWidth = Number(svg.dataset.ewBaseWidth);
  if (!Number.isFinite(baseWidth) || baseWidth <= 0) return null;
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return null;
  return clamp(viewportWidth / baseWidth, MERMAID_MIN_ZOOM, MERMAID_MAX_ZOOM);
}

function formatZoomLabel(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) return '--';
  return `${Math.round(zoom * 100)}%`;
}

function getMermaidApi() {
  const mermaid = window?.mermaid;
  if (!mermaid || typeof mermaid.render !== 'function') return null;

  if (!mermaidInitialized) {
    if (typeof mermaid.initialize === 'function') {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        flowchart: {
          htmlLabels: false
        }
      });
    }
    mermaidInitialized = true;
  }

  return mermaid;
}

async function renderMermaid(source) {
  const text = String(source || '').trim();
  if (!text) return { type: 'empty', message: 'Enter Mermaid syntax to render a diagram.' };

  const mermaid = getMermaidApi();
  if (!mermaid) {
    return { type: 'error', message: 'Mermaid runtime is unavailable.' };
  }

  const renderId = `ew-mermaid-${Date.now()}-${++mermaidRenderCounter}`;
  try {
    const result = await mermaid.render(renderId, text);
    const rawSvg = typeof result === 'string' ? result : (result?.svg || '');
    const sanitized = sanitizeSvgMarkup(rawSvg);
    if (!sanitized.ok) {
      return { type: 'error', message: sanitized.message };
    }
    return { type: 'ok', html: sanitized.html };
  } catch (err) {
    const message = err?.message ? `Mermaid error: ${err.message}` : 'Failed to render Mermaid diagram.';
    return { type: 'error', message };
  }
}

export function render({ node }) {
  const { root, body, titleEl, controls } = createPanelFrame(node, 'Mermaid Diagram');
  let renderToken = 0;
  let currentZoom = 1;

  function updateZoomUi(zoom, hasSvg) {
    if (!controls) return;
    controls.zoomLabel.textContent = hasSvg ? formatZoomLabel(zoom) : '--';
    controls.zoomOut.disabled = !hasSvg;
    controls.zoomIn.disabled = !hasSvg;
    controls.zoomReset.disabled = !hasSvg;
    controls.zoomFit.disabled = !hasSvg;
  }

  function getRenderedSvg() {
    return body.querySelector('svg');
  }

  function isZoomableSvg(svg) {
    if (!(svg instanceof SVGElement)) return false;
    const baseWidth = Number(svg.dataset.ewBaseWidth);
    return Number.isFinite(baseWidth) && baseWidth > 0;
  }

  function setZoom(zoom) {
    const svg = getRenderedSvg();
    if (!isZoomableSvg(svg)) return;
    const applied = applyZoom(svg, zoom);
    if (!Number.isFinite(applied)) return;
    currentZoom = applied;
    updateZoomUi(currentZoom, true);
  }

  function zoomBy(delta) {
    setZoom(currentZoom + delta);
  }

  function resetZoom() {
    setZoom(1);
  }

  function fitZoom() {
    const svg = getRenderedSvg();
    if (!isZoomableSvg(svg)) return;
    const fitZoomValue = fitZoomToWidth(svg, body.clientWidth - 8);
    if (!Number.isFinite(fitZoomValue)) return;
    setZoom(fitZoomValue);
    body.scrollLeft = 0;
    body.scrollTop = 0;
  }

  controls.zoomOut.addEventListener('click', () => zoomBy(-MERMAID_ZOOM_STEP));
  controls.zoomIn.addEventListener('click', () => zoomBy(MERMAID_ZOOM_STEP));
  controls.zoomReset.addEventListener('click', () => resetZoom());
  controls.zoomFit.addEventListener('click', () => fitZoom());
  updateZoomUi(currentZoom, false);

  const update = (next) => {
    titleEl.textContent = resolveTitle(next, 'Mermaid Diagram');
    const mermaidSource = next?.data?.mermaid ?? next?.props?.mermaid ?? next?.text ?? '';
    const token = ++renderToken;
    currentZoom = 1;

    body.classList.remove('is-error');
    body.classList.add('is-loading');
    body.textContent = 'Rendering Mermaid diagram...';
    updateZoomUi(currentZoom, false);

    renderMermaid(mermaidSource).then((rendered) => {
      if (token !== renderToken) return;
      body.classList.remove('is-loading');
      body.classList.remove('is-error');

      if (rendered.type === 'ok') {
        body.innerHTML = rendered.html;
        const svg = body.querySelector('svg');
        normalizeRenderedSvgSize(svg);
        const applied = applyZoom(svg, currentZoom);
        const zoomable = isZoomableSvg(svg);
        if (Number.isFinite(applied) && zoomable) {
          currentZoom = applied;
        }
        updateZoomUi(currentZoom, zoomable);
        return;
      }

      body.textContent = rendered.message;
      updateZoomUi(currentZoom, false);
      if (rendered.type === 'error') {
        body.classList.add('is-error');
      }
    });
  };

  update(node);
  return { el: root, update };
}
