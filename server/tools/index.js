import { validateServerToolRequest } from './policy.js';

const DEFAULT_IMAGE_MODEL = 'gpt-image-1';

function jsonError(status, code, message) {
  return {
    ok: false,
    status,
    error: {
      code,
      message
    }
  };
}

function sleep(ms) {
  const delay = Math.max(0, Number(ms) || 0);
  if (!delay) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

async function executeImageGeneration(args, deps) {
  const apiKey = await deps.resolveAiProviderKey('openai');
  if (!apiKey) {
    return jsonError(503, 'MissingKey', 'OpenAI key not configured on server for media_generate_image.');
  }

  const fallbackModel = await deps.resolveAiProviderDefaultModel('openai');
  const model = String(args.model || fallbackModel || DEFAULT_IMAGE_MODEL).trim();
  if (!model) {
    return jsonError(400, 'InvalidRequest', 'No image model available for media_generate_image.');
  }

  const payload = {
    model,
    prompt: args.prompt,
    size: args.size || '1024x1024',
    n: 1
  };
  const upstream = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => '');
    const parsed = parseJsonSafe(raw);
    const message = parsed?.error?.message || raw || 'OpenAI image generation failed.';
    return jsonError(502, 'UpstreamError', message);
  }

  const json = await upstream.json().catch(() => ({}));
  const item = Array.isArray(json.data) ? (json.data[0] || {}) : {};
  const inlineBase64 = String(item.b64_json || '').trim();
  const inlineDataUrl = inlineBase64 && inlineBase64.length <= 8192
    ? `data:image/png;base64,${inlineBase64}`
    : '';
  return {
    ok: true,
    status: 200,
    data: {
      prompt: args.prompt,
      model,
      size: args.size || '1024x1024',
      revisedPrompt: String(item.revised_prompt || '').trim() || null,
      imageUrl: String(item.url || '').trim() || null,
      inlineDataUrl: inlineDataUrl || null,
      inlineDataTruncated: Boolean(inlineBase64 && !inlineDataUrl)
    }
  };
}

async function executeLoopTask(args, budget = {}) {
  const startedAt = Date.now();
  const maxWallMs = Number.isFinite(Number(budget.maxWallMs)) ? Number(budget.maxWallMs) : 30000;
  const results = [];
  if (args.task === 'count') {
    let value = Number(args.start) || 0;
    const step = Number(args.step) || 1;
    for (let i = 0; i < args.iterations; i += 1) {
      if (Date.now() - startedAt >= maxWallMs) {
        return jsonError(408, 'BudgetExceeded', 'Loop task exceeded wall time budget.');
      }
      results.push(value);
      value += step;
      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  } else if (args.task === 'append_index') {
    const text = String(args.text || 'item');
    for (let i = 0; i < args.iterations; i += 1) {
      if (Date.now() - startedAt >= maxWallMs) {
        return jsonError(408, 'BudgetExceeded', 'Loop task exceeded wall time budget.');
      }
      results.push(`${text} ${i + 1}`);
      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  } else {
    const text = String(args.text || '');
    for (let i = 0; i < args.iterations; i += 1) {
      if (Date.now() - startedAt >= maxWallMs) {
        return jsonError(408, 'BudgetExceeded', 'Loop task exceeded wall time budget.');
      }
      results.push(text);
      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  }

  return {
    ok: true,
    status: 200,
    data: {
      task: args.task,
      iterations: args.iterations,
      delayMs: args.delayMs,
      results,
      summary: `Loop task ${args.task} completed with ${args.iterations} iterations.`
    }
  };
}

export async function executeServerTool({ toolName, args = {}, budget = {} }, deps) {
  const validated = validateServerToolRequest({ toolName, args, budget });
  if (!validated.ok) return validated;
  if (toolName === 'media_generate_image') {
    return executeImageGeneration(validated.args, deps);
  }
  if (toolName === 'task_run_loop') {
    return executeLoopTask(validated.args, budget);
  }
  return jsonError(404, 'UnknownTool', `Tool not found: ${toolName || 'missing'}.`);
}
