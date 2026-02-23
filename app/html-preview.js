function createPanelFrame(node, fallbackTitle) {
  const root = document.createElement('div');
  root.className = 'ew-panel ew-html-preview';

  const header = document.createElement('div');
  header.className = 'ew-node-header';
  header.dataset.ewDrag = 'true';
  header.dataset.ewSelect = 'true';
  header.dataset.ewLink = 'true';

  const title = document.createElement('span');
  title.textContent = resolveTitle(node, fallbackTitle);

  const meta = document.createElement('span');
  meta.className = 'ew-header-meta';

  const syncBtn = document.createElement('button');
  syncBtn.className = 'ew-preview-pill';
  syncBtn.type = 'button';
  syncBtn.textContent = 'Sync HTML';
  syncBtn.title = 'Sync HTML from linked CodeSnippet';

  const anchor = document.createElement('span');
  anchor.className = 'ew-link-anchor';
  anchor.dataset.ewLink = 'true';
  anchor.title = 'Link';

  header.append(title, meta, syncBtn, anchor);

  const body = document.createElement('div');
  body.className = 'ew-node-body ew-html-preview-body';

  root.append(header, body);
  return { root, body, titleEl: title, syncBtn };
}

function resolveTitle(node, fallbackTitle) {
  return node?.props?.title || node?.data?.title || fallbackTitle || 'HTML Preview';
}

function buildPreviewDocument(html) {
  const safeHtml = String(html || '');
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>',
    'html,body{margin:0;padding:0;font-family:ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;}',
    'body{background:transparent;color:#111;line-height:1.5;}',
    'img,video,svg{max-width:100%;height:auto;}',
    '</style>',
    '</head>',
    '<body>',
    safeHtml,
    '</body>',
    '</html>'
  ].join('');
}

export function render({ node }) {
  const { root, body, titleEl, syncBtn } = createPanelFrame(node, 'HTML Preview');

  const placeholder = document.createElement('div');
  placeholder.className = 'ew-html-preview-placeholder';
  placeholder.textContent = 'Paste HTML to preview.';

  const frame = document.createElement('iframe');
  frame.className = 'ew-html-preview-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');

  body.append(placeholder, frame);
  let frameContextMenuHandler = null;

  const bindFrameContextMenu = (nodeId) => {
    const doc = frame.contentDocument;
    if (!doc) return;
    if (frameContextMenuHandler) {
      doc.removeEventListener('contextmenu', frameContextMenuHandler, true);
    }
    frameContextMenuHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = frame.getBoundingClientRect();
      const clientX = rect.left + event.clientX;
      const clientY = rect.top + event.clientY;
      if (typeof window.elenweaveOpenNodeContextMenu === 'function') {
        window.elenweaveOpenNodeContextMenu({ nodeId, clientX, clientY });
      }
    };
    doc.addEventListener('contextmenu', frameContextMenuHandler, true);
  };

  frame.addEventListener('load', () => bindFrameContextMenu(node?.id || ''));

  syncBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof window.elenweaveSyncHtmlPreview === 'function') {
      window.elenweaveSyncHtmlPreview(node?.id || '');
    }
  });

  const update = (next) => {
    titleEl.textContent = resolveTitle(next, 'HTML Preview');
    const html = next?.data?.html ?? next?.props?.html ?? next?.text ?? '';
    const hasHtml = String(html || '').trim().length > 0;
    placeholder.hidden = hasHtml;
    frame.hidden = !hasHtml;
    frame.srcdoc = hasHtml ? buildPreviewDocument(html) : '';
    if (hasHtml) {
      bindFrameContextMenu(next?.id || node?.id || '');
    }
  };

  update(node);
  return { el: root, update };
}
