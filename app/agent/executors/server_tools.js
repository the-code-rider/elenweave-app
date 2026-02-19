function normalizeProxyBaseUrl(proxyBaseUrl) {
  if (proxyBaseUrl == null) return null;
  return String(proxyBaseUrl || '').replace(/\/+$/, '');
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

export function createServerToolExecutor({ timeoutMs = 30000 } = {}) {
  return async function executeServerTool(tool, args, context = {}) {
    const base = normalizeProxyBaseUrl(context.proxyBaseUrl);
    if (base == null) {
      return { ok: false, error: 'Server tools require local proxy/server mode.', code: 'ProxyUnavailable' };
    }
    const endpoint = `${base}/api/ai/tools/execute`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: tool.name,
          args: args && typeof args === 'object' ? args : {},
          requestId: String(context.requestId || ''),
          budget: context.budget && typeof context.budget === 'object' ? context.budget : {}
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        const parsed = parseMaybeJson(raw);
        const message = parsed?.message || raw || `Server tool failed (${res.status}).`;
        return { ok: false, error: message, code: parsed?.error || 'ToolError' };
      }
      const payload = await res.json().catch(() => ({}));
      if (payload?.ok === false) {
        return { ok: false, error: payload?.message || 'Server tool failed.', code: payload?.error || 'ToolError' };
      }
      return { ok: true, data: payload?.data ?? payload ?? null };
    } catch (err) {
      const message = err?.name === 'AbortError'
        ? `Server tool timed out after ${timeoutMs}ms.`
        : (err?.message || 'Server tool request failed.');
      return { ok: false, error: message, code: err?.name || 'ToolError' };
    } finally {
      window.clearTimeout(timer);
    }
  };
}
