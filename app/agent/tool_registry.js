function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function makeTools(enableSubagents) {
  return [
    {
      name: 'board_read_context',
      description: 'Read board context for selected node, AI context nodes, and optionally full board snapshot.',
      runtime: 'client',
      policyClass: 'safe',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['selected', 'context', 'full'],
            description: 'selected = active selection summary, context = selected + context nodes, full = includes board snapshot.'
          }
        }
      }
    },
    {
      name: 'media_generate_image',
      description: 'Generate an image from a prompt using server-side AI keys.',
      runtime: 'server',
      policyClass: 'privileged',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image generation prompt.' },
          model: { type: 'string', description: 'Optional image model override.' },
          size: {
            type: 'string',
            enum: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
            description: 'Requested output size.'
          }
        },
        required: ['prompt']
      }
    },
    {
      name: 'task_run_loop',
      description: 'Run a bounded loop task on the server for iterative helper work.',
      runtime: 'server',
      policyClass: 'privileged',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            enum: ['repeat_text', 'count', 'append_index'],
            description: 'Loop operation type.'
          },
          iterations: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Number of iterations.'
          },
          text: { type: 'string', description: 'Input text for repeat_text/append_index.' },
          start: { type: 'number', description: 'Initial number for count task.' },
          step: { type: 'number', description: 'Increment for count task.' },
          delayMs: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Optional per-iteration delay.'
          }
        }
      }
    },
    {
      name: 'agent_invoke_subagent',
      description: 'Delegate part of the task to a specialized subagent.',
      runtime: 'client',
      policyClass: 'privileged',
      enabled: Boolean(enableSubagents),
      parameters: {
        type: 'object',
        properties: {
          agentType: {
            type: 'string',
            enum: ['image', 'code', 'research'],
            description: 'Specialized subagent type.'
          },
          goal: { type: 'string', description: 'Subagent goal.' },
          context: {
            type: 'object',
            description: 'Optional structured context for the subagent.'
          },
          constraints: {
            type: 'object',
            description: 'Optional execution constraints.'
          }
        },
        required: ['agentType', 'goal']
      }
    }
  ];
}

export function createToolRegistry({ clientExecutor, serverExecutor, enableSubagents = false } = {}) {
  const entries = makeTools(enableSubagents);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  function getModelTools() {
    return entries.map((entry) => ({
      type: 'function',
      name: entry.name,
      description: entry.description,
      parameters: entry.parameters
    }));
  }

  function getTool(name) {
    const key = String(name || '').trim();
    return byName.get(key) || null;
  }

  async function execute(name, args, context = {}) {
    const tool = getTool(name);
    if (!tool) {
      return { ok: false, error: 'Unknown tool.', code: 'UnknownTool' };
    }
    if (tool.enabled === false) {
      return { ok: false, error: 'Tool is disabled.', code: 'ToolDisabled' };
    }
    const safeArgs = asObject(args);
    if (tool.runtime === 'client') {
      if (typeof clientExecutor !== 'function') {
        return { ok: false, error: 'Client tool executor is not configured.', code: 'ExecutorMissing' };
      }
      return clientExecutor(tool, safeArgs, context);
    }
    if (tool.runtime === 'server') {
      if (typeof serverExecutor !== 'function') {
        return { ok: false, error: 'Server tool executor is not configured.', code: 'ExecutorMissing' };
      }
      return serverExecutor(tool, safeArgs, context);
    }
    return { ok: false, error: 'Unsupported tool runtime.', code: 'RuntimeUnsupported' };
  }

  return {
    getModelTools,
    getTool,
    execute
  };
}
