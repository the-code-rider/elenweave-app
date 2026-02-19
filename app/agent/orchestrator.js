import { createExecutionPolicy } from './policy.js';

function parseJsonObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {
    return {};
  }
  return {};
}

function extractOpenAIText(response) {
  if (!response || typeof response !== 'object') return '';
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }
  return '';
}

function extractOpenAIFunctionCalls(response) {
  if (!response || typeof response !== 'object') return [];
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .filter((item) => item?.type === 'function_call' && item?.name)
    .map((item, index) => {
      const callId = String(item.call_id || item.id || `call_${index + 1}`);
      return {
        callId,
        name: String(item.name || '').trim(),
        args: parseJsonObject(item.arguments)
      };
    })
    .filter((call) => call.name);
}

function mergeUsage(acc, usage) {
  if (!usage) return acc;
  const base = acc || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const next = { ...base };
  const inVal = Number(usage.inputTokens);
  const outVal = Number(usage.outputTokens);
  const totalVal = Number(usage.totalTokens);
  if (Number.isFinite(inVal)) next.inputTokens += inVal;
  if (Number.isFinite(outVal)) next.outputTokens += outVal;
  if (Number.isFinite(totalVal)) next.totalTokens += totalVal;
  return next;
}

export function createAiOrchestrator({
  callOpenAIWithTools,
  toolRegistry,
  onStatus = null,
  defaults = {}
} = {}) {
  if (typeof callOpenAIWithTools !== 'function') {
    throw new Error('createAiOrchestrator: callOpenAIWithTools is required.');
  }
  if (!toolRegistry || typeof toolRegistry.getModelTools !== 'function' || typeof toolRegistry.execute !== 'function') {
    throw new Error('createAiOrchestrator: valid toolRegistry is required.');
  }

  const policyDefaults = {
    maxSteps: defaults.maxSteps,
    maxToolCalls: defaults.maxToolCalls,
    maxWallMs: defaults.maxWallMs,
    allowMutatingTools: defaults.allowMutatingTools,
    allowPrivilegedTools: defaults.allowPrivilegedTools
  };

  async function run({
    apiKey,
    proxyBaseUrl = null,
    model,
    prompt,
    instructions = '',
    requestId = '',
    budget = {}
  }) {
    const policy = createExecutionPolicy({
      ...policyDefaults,
      ...budget
    });
    const toolTrace = [];
    const tools = toolRegistry.getModelTools();
    let usage = null;
    let lastText = '';
    let previousResponseId = '';
    let input = prompt;

    while (true) {
      const step = policy.beginStep();
      if (!step.ok) {
        if (typeof onStatus === 'function') {
          onStatus(`AI tool loop stopped: ${step.reason}`, 2200);
        }
        break;
      }
      const snapshot = policy.snapshot();
      if (typeof onStatus === 'function') {
        onStatus(`AI tool loop step ${snapshot.steps}/${snapshot.limits.maxSteps}...`, 0);
      }
      const result = await callOpenAIWithTools({
        apiKey,
        proxyBaseUrl,
        model,
        instructions,
        input,
        tools,
        previousResponseId
      });
      usage = mergeUsage(usage, result?.usage || null);
      previousResponseId = String(result?.response?.id || '').trim();
      const response = result?.response || {};
      const text = extractOpenAIText(response);
      if (text) {
        lastText = text;
      }
      const calls = extractOpenAIFunctionCalls(response);
      if (!calls.length) {
        return { text: lastText, usage, toolTrace, response };
      }

      const outputs = [];
      for (const call of calls) {
        const tool = toolRegistry.getTool(call.name);
        const auth = policy.authorizeTool(tool, { proxyAvailable: proxyBaseUrl != null });
        let execResult = null;
        const startedAt = Date.now();
        if (!auth.allowed) {
          execResult = {
            ok: false,
            error: auth.reason || 'Tool blocked by policy.',
            code: 'PolicyBlocked'
          };
        } else {
          policy.noteToolCall();
          execResult = await toolRegistry.execute(call.name, call.args, {
            proxyBaseUrl,
            requestId,
            budget: policy.snapshot().limits
          });
        }
        const durationMs = Date.now() - startedAt;
        toolTrace.push({
          name: call.name,
          args: call.args,
          status: execResult?.ok ? 'ok' : (execResult?.code === 'PolicyBlocked' ? 'blocked' : 'error'),
          durationMs,
          error: execResult?.ok ? null : String(execResult?.error || 'Tool failed.')
        });
        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output: JSON.stringify({
            ok: Boolean(execResult?.ok),
            data: execResult?.ok ? (execResult?.data ?? null) : null,
            error: execResult?.ok ? null : String(execResult?.error || 'Tool failed.')
          })
        });
      }
      input = outputs;
    }

    return { text: lastText, usage, toolTrace, response: null };
  }

  return { run };
}
