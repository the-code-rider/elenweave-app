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

function sanitizeSvgMarkup(raw) {
  const text = String(raw || '').trim();
  if (!text) return { type: 'empty', message: 'Paste SVG markup or upload an .svg file.' };

  const purify = window?.DOMPurify;
  if (!purify || typeof purify.sanitize !== 'function') {
    return { type: 'error', message: 'DOMPurify is unavailable. SVG rendering is disabled.' };
  }

  const safeSvg = purify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true }
  });
  if (!safeSvg || !safeSvg.trim()) {
    return { type: 'error', message: 'SVG content was blocked by sanitizer.' };
  }
  return { type: 'ok', html: safeSvg };
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
