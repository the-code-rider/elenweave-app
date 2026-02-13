function createPanelFrame(node, fallbackTitle) {
  const root = document.createElement('div');
  root.className = 'ew-panel ew-markdown';

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
  body.className = 'ew-node-body ew-markdown-body';

  root.append(header, body);
  return { root, header, body, titleEl: title };
}

function resolveTitle(node, fallbackTitle) {
  return node?.props?.title || node?.data?.title || fallbackTitle || 'Markdown';
}

function renderMarkdown(raw) {
  const text = String(raw || '');
  const markedLib = window?.marked;
  const purify = window?.DOMPurify;
  const parse = typeof markedLib?.parse === 'function'
    ? markedLib.parse.bind(markedLib)
    : (typeof markedLib === 'function' ? markedLib : null);
  const canParse = typeof parse === 'function';
  const canSanitize = purify && typeof purify.sanitize === 'function';

  if (!canParse || !canSanitize) {
    return { html: '', safe: false, text };
  }

  const html = parse(text, { breaks: true, gfm: true });
  const safeHtml = purify.sanitize(html, { USE_PROFILES: { html: true } });
  return { html: safeHtml, safe: true, text };
}

export function render({ node }) {
  const { root, body, titleEl } = createPanelFrame(node, 'Markdown');

  const update = (next) => {
    titleEl.textContent = resolveTitle(next, 'Markdown');
    const markdown = next?.data?.markdown ?? next?.props?.markdown ?? next?.text ?? '';
    const rendered = renderMarkdown(markdown);

    if (rendered.safe) {
      body.innerHTML = rendered.html;
    } else {
      body.textContent = rendered.text;
    }
  };

  update(node);
  return { el: root, update };
}
