const ALLOWED_TOOLS = new Set([
  'media_generate_image',
  'task_run_loop'
]);

const LOOP_TASKS = new Set([
  'repeat_text',
  'count',
  'append_index'
]);

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeGenerateImageArgs(rawArgs) {
  const args = asObject(rawArgs);
  const prompt = String(args.prompt || '').trim();
  if (!prompt) {
    return { ok: false, status: 400, error: { code: 'InvalidRequest', message: 'media_generate_image requires a non-empty prompt.' } };
  }
  const model = String(args.model || '').trim();
  const sizeRaw = String(args.size || '1024x1024').trim();
  const allowedSizes = new Set(['1024x1024', '1536x1024', '1024x1536', 'auto']);
  const size = allowedSizes.has(sizeRaw) ? sizeRaw : '1024x1024';
  return {
    ok: true,
    args: {
      prompt: prompt.slice(0, 3000),
      model,
      size
    }
  };
}

function normalizeRunLoopArgs(rawArgs, budget = {}) {
  const args = asObject(rawArgs);
  const taskRaw = String(args.task || 'repeat_text').trim();
  const task = LOOP_TASKS.has(taskRaw) ? taskRaw : 'repeat_text';
  const budgetMaxIterations = clampInt(budget.maxIterations, 20, 1, 100);
  const iterations = clampInt(args.iterations, 3, 1, Math.min(20, budgetMaxIterations));
  const delayMs = clampInt(args.delayMs, 0, 0, 1000);
  const text = String(args.text || '').slice(0, 3000);
  const start = clampNumber(args.start, 0, -1e9, 1e9);
  const step = clampNumber(args.step, 1, -1e6, 1e6);
  return {
    ok: true,
    args: { task, iterations, delayMs, text, start, step }
  };
}

export function validateServerToolRequest({ toolName, args, budget }) {
  const name = String(toolName || '').trim();
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, status: 404, error: { code: 'UnknownTool', message: `Tool not found: ${name || 'missing'}.` } };
  }
  if (name === 'media_generate_image') {
    return normalizeGenerateImageArgs(args);
  }
  if (name === 'task_run_loop') {
    return normalizeRunLoopArgs(args, asObject(budget));
  }
  return { ok: false, status: 404, error: { code: 'UnknownTool', message: `Tool not found: ${name}.` } };
}
