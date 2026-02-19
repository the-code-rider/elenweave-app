function normalizeScope(value) {
  const scope = String(value || '').trim().toLowerCase();
  if (scope === 'context' || scope === 'full') return scope;
  return 'selected';
}

export function createClientToolExecutor({ getBoardContext, invokeSubagent } = {}) {
  return async function executeClientTool(tool, args, context = {}) {
    if (!tool?.name) {
      return { ok: false, error: 'Invalid client tool.', code: 'InvalidTool' };
    }

    if (tool.name === 'board_read_context') {
      if (typeof getBoardContext !== 'function') {
        return { ok: false, error: 'Board context reader is not configured.', code: 'ContextUnavailable' };
      }
      const scope = normalizeScope(args.scope);
      const snapshot = getBoardContext(scope, context);
      return { ok: true, data: { scope, snapshot } };
    }

    if (tool.name === 'agent_invoke_subagent') {
      if (typeof invokeSubagent !== 'function') {
        return { ok: false, error: 'Subagents are not available.', code: 'SubagentUnavailable' };
      }
      const result = await invokeSubagent({
        agentType: String(args.agentType || '').trim(),
        goal: String(args.goal || '').trim(),
        context: args.context && typeof args.context === 'object' ? args.context : {},
        constraints: args.constraints && typeof args.constraints === 'object' ? args.constraints : {}
      });
      return { ok: true, data: result || {} };
    }

    return { ok: false, error: `Unsupported client tool: ${tool.name}`, code: 'UnsupportedTool' };
  };
}
