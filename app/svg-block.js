function createPanelFrame(node, fallbackTitle) {
  const root = document.createElement('div');
  root.className = 'ew-panel ew-svg';

  const header = document.createElement('div');
  header.className = 'ew-node-header';
  header.dataset.ewDrag = 'true';
  header.dataset.ewSelect = 'true';
  header.dataset.ewLink = 'true';

  const title = document.createElement('span');
  title.textContent = resolveTitle(node, fallbackTitle);

  const meta = document.createElement('span');
  meta.className = 'ew-header-meta';

  const anchor = document.createElement('span');
  anchor.className = 'ew-link-anchor';
  anchor.dataset.ewLink = 'true';
  anchor.title = 'Link';

  header.append(title, meta, anchor);

  const body = document.createElement('div');
  body.className = 'ew-node-body ew-svg-body';

  root.append(header, body);
  return { root, body, titleEl: title };
}

function resolveTitle(node, fallbackTitle) {
  return node?.props?.title || node?.data?.title || fallbackTitle || 'SVG Diagram';
}

const SVG_SANITIZE_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Many exported SVGs rely on embedded styles and foreignObject text.
  ADD_TAGS: ['style', 'foreignObject'],
  ADD_ATTR: [
    'style',
    'class',
    'xmlns',
    'xmlns:xlink',
    'xlink:href',
    'href',
    'viewBox',
    'preserveAspectRatio',
    'clip-path',
    'mask'
  ]
};

const RENDERABLE_SELECTOR = [
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'image',
  'use',
  'foreignObject'
].join(',');

function normalizeSvgElement(svgEl) {
  if (!(svgEl instanceof SVGElement)) return;
  const hasViewBox = String(svgEl.getAttribute('viewBox') || '').trim().length > 0;
  const hasWidth = String(svgEl.getAttribute('width') || '').trim().length > 0;
  const hasHeight = String(svgEl.getAttribute('height') || '').trim().length > 0;

  if (hasViewBox && !hasWidth) {
    svgEl.setAttribute('width', '100%');
  }
  if (hasViewBox && !hasHeight) {
    svgEl.setAttribute('height', '100%');
  }
}

function sanitizeSvgMarkup(raw) {
  const text = String(raw || '').trim();
  if (!text) return { type: 'empty', message: 'Paste SVG markup or upload an .svg file.' };

  const purify = window?.DOMPurify;
  if (!purify || typeof purify.sanitize !== 'function') {
    return { type: 'error', message: 'DOMPurify is unavailable. SVG rendering is disabled.' };
  }

  const safeSvg = purify.sanitize(text, SVG_SANITIZE_OPTIONS);
  if (!safeSvg || !safeSvg.trim()) {
    return { type: 'error', message: 'SVG content was blocked by sanitizer.' };
  }

  const holder = document.createElement('div');
  holder.innerHTML = safeSvg;
  const svgEl = holder.querySelector('svg');
  if (!(svgEl instanceof SVGElement)) {
    return { type: 'error', message: 'SVG root element is missing after sanitization.' };
  }

  normalizeSvgElement(svgEl);

  if (!svgEl.querySelector(RENDERABLE_SELECTOR)) {
    return {
      type: 'error',
      message: 'SVG appears empty after sanitization. Check unsupported tags or blocked styling.'
    };
  }
  return { type: 'ok', html: holder.innerHTML };
}

export function render({ node }) {
  const { root, body, titleEl } = createPanelFrame(node, 'SVG Diagram');

  const update = (next) => {
    titleEl.textContent = resolveTitle(next, 'SVG Diagram');
    body.classList.remove('is-error');
    const svg = next?.data?.svg ?? next?.props?.svg ?? next?.text ?? '';
    const rendered = sanitizeSvgMarkup(svg);

    if (rendered.type === 'ok') {
      body.innerHTML = rendered.html;
      return;
    }

    body.textContent = rendered.message;
    if (rendered.type === 'error') {
      body.classList.add('is-error');
    }
  };

  update(node);
  return { el: root, update };
}
