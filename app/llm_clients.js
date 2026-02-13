// OpenAI Responses API + Gemini generateContent
// (Endpoints documented by OpenAI + Google AI for Developers.)

function extractOpenAIText(json) {
  if (typeof json.output_text === 'string' && json.output_text.trim()) {
    return json.output_text;
  }

  const out = json.output || [];
  for (const item of out) {
    if (item?.type === 'message') {
      for (const c of item.content || []) {
        if (c?.type === 'output_text' && typeof c.text === 'string') {
          return c.text;
        }
      }
    }
  }
  return '';
}

export async function callOpenAI({ apiKey, model, instructions, input }) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions,
      input
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usage = json?.usage
    ? {
      inputTokens: Number.isFinite(json.usage.input_tokens) ? json.usage.input_tokens : null,
      outputTokens: Number.isFinite(json.usage.output_tokens) ? json.usage.output_tokens : null,
      totalTokens: Number.isFinite(json.usage.total_tokens) ? json.usage.total_tokens : null
    }
    : null;

  const text = extractOpenAIText(json);
  if (text.trim()) return { text, usage };
  throw new Error('OpenAI: could not extract text from response');
}

export async function callOpenAIMultimodal({ apiKey, model, prompt, images = [] }) {
  const content = [{ type: 'input_text', text: prompt }];
  images.forEach((img) => {
    if (!img?.dataUrl) return;
    content.push({ type: 'input_image', image_url: img.dataUrl });
  });

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content }]
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usage = json?.usage
    ? {
      inputTokens: Number.isFinite(json.usage.input_tokens) ? json.usage.input_tokens : null,
      outputTokens: Number.isFinite(json.usage.output_tokens) ? json.usage.output_tokens : null,
      totalTokens: Number.isFinite(json.usage.total_tokens) ? json.usage.total_tokens : null
    }
    : null;

  const text = extractOpenAIText(json);
  if (text.trim()) return { text, usage };
  throw new Error('OpenAI: could not extract text from response');
}

export async function callOpenAITranscription({ apiKey, file, model = 'whisper-1' }) {
  const body = new FormData();
  body.append('model', model);
  body.append('file', file, file.name || 'audio');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI transcription error ${res.status}: ${t}`);
  }

  const json = await res.json().catch(() => ({}));
  const text = json.text || '';
  if (!text.trim()) throw new Error('OpenAI transcription: empty response');
  return { text, response: json };
}

export async function callOpenAIWithTools({ apiKey, model, instructions, input, tools }) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      tools
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usage = json?.usage
    ? {
      inputTokens: Number.isFinite(json.usage.input_tokens) ? json.usage.input_tokens : null,
      outputTokens: Number.isFinite(json.usage.output_tokens) ? json.usage.output_tokens : null,
      totalTokens: Number.isFinite(json.usage.total_tokens) ? json.usage.total_tokens : null
    }
    : null;

  return { response: json, usage };
}

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('');
}

export async function callGemini({ apiKey, model, text }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }]
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usageMeta = json?.usageMetadata || null;
  const usage = usageMeta
    ? {
      inputTokens: Number.isFinite(usageMeta.promptTokenCount) ? usageMeta.promptTokenCount : null,
      outputTokens: Number.isFinite(usageMeta.candidatesTokenCount) ? usageMeta.candidatesTokenCount : null,
      totalTokens: Number.isFinite(usageMeta.totalTokenCount) ? usageMeta.totalTokenCount : null
    }
    : null;

  const textOut = extractGeminiText(json);
  if (!textOut.trim()) throw new Error('Gemini: empty response');
  return { text: textOut, usage };
}

export async function callGeminiMultimodal({ apiKey, model, prompt, images = [], audio = [] }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const parts = [{ text: prompt }];
  images.forEach((img) => {
    if (!img?.base64) return;
    parts.push({ inline_data: { mime_type: img.mimeType || 'image/png', data: img.base64 } });
  });
  audio.forEach((clip) => {
    if (!clip?.base64) return;
    parts.push({ inline_data: { mime_type: clip.mimeType || 'audio/mpeg', data: clip.base64 } });
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }]
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usageMeta = json?.usageMetadata || null;
  const usage = usageMeta
    ? {
      inputTokens: Number.isFinite(usageMeta.promptTokenCount) ? usageMeta.promptTokenCount : null,
      outputTokens: Number.isFinite(usageMeta.candidatesTokenCount) ? usageMeta.candidatesTokenCount : null,
      totalTokens: Number.isFinite(usageMeta.totalTokenCount) ? usageMeta.totalTokenCount : null
    }
    : null;

  const textOut = extractGeminiText(json);
  if (!textOut.trim()) throw new Error('Gemini: empty response');
  return { text: textOut, usage, response: json };
}

export async function callGeminiWithTools({ apiKey, model, contents, tools }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents,
      tools
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const usageMeta = json?.usageMetadata || null;
  const usage = usageMeta
    ? {
      inputTokens: Number.isFinite(usageMeta.promptTokenCount) ? usageMeta.promptTokenCount : null,
      outputTokens: Number.isFinite(usageMeta.candidatesTokenCount) ? usageMeta.candidatesTokenCount : null,
      totalTokens: Number.isFinite(usageMeta.totalTokenCount) ? usageMeta.totalTokenCount : null
    }
    : null;

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const textOut = parts.map((p) => p.text).filter(Boolean).join('');
  const functionCalls = parts.map((p) => p.functionCall).filter(Boolean);
  return { text: textOut, functionCalls, response: json, usage };
}

function normalizeHostedUsage(raw) {
  if (!raw) return null;
  if (raw.inputTokens || raw.outputTokens) return raw;
  const inputTokens = Number.isFinite(raw.input_tokens) ? raw.input_tokens : null;
  const outputTokens = Number.isFinite(raw.output_tokens) ? raw.output_tokens : null;
  const totalTokens = Number.isFinite(raw.total_tokens) ? raw.total_tokens : null;
  if (inputTokens == null && outputTokens == null && totalTokens == null) return null;
  return { inputTokens, outputTokens, totalTokens };
}

export async function callHostedAI({ baseUrl, sessionToken, model, instructions, input }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/ai/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      mode: 'text',
      model,
      instructions,
      input
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Hosted AI error ${res.status}: ${t}`);
  }

  const json = await res.json().catch(() => ({}));
  const text = json.text || json.output_text || json.result || '';
  const usage = normalizeHostedUsage(json.usage || json.usageMetadata || null);
  if (!String(text || '').trim()) throw new Error('Hosted AI: empty response');
  return { text, usage, response: json };
}

export async function callHostedAIWithTools({ baseUrl, sessionToken, model, instructions, input, tools }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/ai/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      mode: 'tools',
      model,
      instructions,
      input,
      tools
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Hosted AI error ${res.status}: ${t}`);
  }

  const json = await res.json().catch(() => ({}));
  const usage = normalizeHostedUsage(json.usage || json.usageMetadata || null);
  const text = json.text || json.output_text || json.result || '';
  const toolCalls = json.tool_calls || json.toolCalls || json.function_calls || [];
  return { text, toolCalls, response: json, usage };
}
