const DEFAULT_POLICY = {
  maxSteps: 8,
  maxToolCalls: 16,
  maxWallMs: 30000,
  allowMutatingTools: true,
  allowPrivilegedTools: true
};

function toFiniteInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function createExecutionPolicy(options = {}) {
  const config = {
    maxSteps: Math.max(1, toFiniteInt(options.maxSteps, DEFAULT_POLICY.maxSteps)),
    maxToolCalls: Math.max(1, toFiniteInt(options.maxToolCalls, DEFAULT_POLICY.maxToolCalls)),
    maxWallMs: Math.max(1000, toFiniteInt(options.maxWallMs, DEFAULT_POLICY.maxWallMs)),
    allowMutatingTools: options.allowMutatingTools !== false,
    allowPrivilegedTools: options.allowPrivilegedTools !== false
  };
  const state = {
    startedAt: Date.now(),
    steps: 0,
    toolCalls: 0
  };

  function elapsedMs() {
    return Date.now() - state.startedAt;
  }

  function canContinue() {
    if (state.steps >= config.maxSteps) {
      return { ok: false, reason: `Max step budget reached (${config.maxSteps}).` };
    }
    if (elapsedMs() >= config.maxWallMs) {
      return { ok: false, reason: `Wall time budget reached (${config.maxWallMs}ms).` };
    }
    return { ok: true, reason: '' };
  }

  function beginStep() {
    const check = canContinue();
    if (!check.ok) {
      return check;
    }
    state.steps += 1;
    return { ok: true, reason: '' };
  }

  function canCallTool() {
    if (state.toolCalls >= config.maxToolCalls) {
      return { ok: false, reason: `Max tool calls reached (${config.maxToolCalls}).` };
    }
    if (elapsedMs() >= config.maxWallMs) {
      return { ok: false, reason: `Wall time budget reached (${config.maxWallMs}ms).` };
    }
    return { ok: true, reason: '' };
  }

  function authorizeTool(tool, context = {}) {
    if (!tool) {
      return { allowed: false, reason: 'Unknown tool.' };
    }
    if (tool.runtime === 'server' && !context.proxyAvailable) {
      return { allowed: false, reason: 'Server tools require local proxy/server mode.' };
    }
    if (tool.policyClass === 'mutating' && !config.allowMutatingTools) {
      return { allowed: false, reason: 'Mutating tools are disabled by policy.' };
    }
    if (tool.policyClass === 'privileged' && !config.allowPrivilegedTools) {
      return { allowed: false, reason: 'Privileged tools are disabled by policy.' };
    }
    const budget = canCallTool();
    if (!budget.ok) {
      return { allowed: false, reason: budget.reason };
    }
    return { allowed: true, reason: '' };
  }

  function noteToolCall() {
    state.toolCalls += 1;
  }

  function snapshot() {
    return {
      startedAt: state.startedAt,
      elapsedMs: elapsedMs(),
      steps: state.steps,
      toolCalls: state.toolCalls,
      limits: {
        maxSteps: config.maxSteps,
        maxToolCalls: config.maxToolCalls,
        maxWallMs: config.maxWallMs
      }
    };
  }

  return {
    beginStep,
    authorizeTool,
    noteToolCall,
    snapshot
  };
}
