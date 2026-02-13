let mermaidInitialized = false;
let mermaidRenderCounter = 0;

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

  const anchor = document.createElement('span');
  anchor.className = 'ew-link-anchor';
  anchor.dataset.ewLink = 'true';
  anchor.title = 'Link';

  header.append(title, meta, anchor);

  const body = document.createElement('div');
  body.className = 'ew-node-body ew-mermaid-body';

  root.append(header, body);
  return { root, body, titleEl: title };
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

function getMermaidApi() {
  const mermaid = window?.mermaid;
  if (!mermaid || typeof mermaid.render !== 'function') return null;

  if (!mermaidInitialized) {
    if (typeof mermaid.initialize === 'function') {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral'
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
  const { root, body, titleEl } = createPanelFrame(node, 'Mermaid Diagram');
  let renderToken = 0;

  const update = (next) => {
    titleEl.textContent = resolveTitle(next, 'Mermaid Diagram');
    const mermaidSource = next?.data?.mermaid ?? next?.props?.mermaid ?? next?.text ?? '';
    const token = ++renderToken;

    body.classList.remove('is-error');
    body.classList.add('is-loading');
    body.textContent = 'Rendering Mermaid diagram...';

    renderMermaid(mermaidSource).then((rendered) => {
      if (token !== renderToken) return;
      body.classList.remove('is-loading');
      body.classList.remove('is-error');

      if (rendered.type === 'ok') {
        body.innerHTML = rendered.html;
        return;
      }

      body.textContent = rendered.message;
      if (rendered.type === 'error') {
        body.classList.add('is-error');
      }
    });
  };

  update(node);
  return { el: root, update };
}
