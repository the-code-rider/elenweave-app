const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const AUDIO_INPUT_MIME = 'audio/pcm;rate=16000';
const ACTION_THROTTLE_MS = 120;
const MIN_SPEECH_FRAMES = 2;
const MIN_USER_AUDIO_RMS = 0.008;
const MIN_USER_AUDIO_PEAK = 0.02;
const REALTIME_SYSTEM_PROMPT = [
  'You are a realtime audio agent inside the Elenweave canvas.',
  'Use tool calls for canvas actions or to request board plans.',
  'After calling any tool, always provide a short spoken confirmation.',
  'Keep spoken responses brief and in audio only.'
].join(' ');

let cachedGenAi = null;
async function loadGenAi() {
  if (cachedGenAi) return cachedGenAi;
  const mod = await import('https://esm.run/@google/genai');
  cachedGenAi = mod;
  return mod;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (outputRate >= inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const length = Math.round(buffer.length / ratio);
  const result = new Float32Array(length);
  let offset = 0;
  for (let i = 0; i < length; i += 1) {
    const next = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = offset; j < next && j < buffer.length; j += 1) {
      sum += buffer[j];
      count += 1;
    }
    result[i] = count ? sum / count : 0;
    offset = next;
  }
  return result;
}

function floatToInt16(buffer) {
  const output = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    const s = clamp(buffer[i], -1, 1);
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function concatInt16(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

function measurePcm(samples) {
  if (!samples?.length) return { rms: 0, peak: 0 };
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] / 32768;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  return { rms, peak };
}

function pcm16ToWavBlob(samples, sampleRate = OUTPUT_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function parseToolArgs(call) {
  if (!call) return {};
  const raw = call.args ?? call.arguments ?? call.params ?? null;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function extractAudioChunks(message) {
  const chunks = [];
  if (typeof message?.data === 'string' || message?.data instanceof ArrayBuffer || ArrayBuffer.isView(message?.data)) {
    chunks.push(message.data);
  }
  const parts = message?.serverContent?.modelTurn?.parts;
  if (Array.isArray(parts)) {
    parts.forEach((part) => {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) chunks.push(inline.data);
    });
  }
  return chunks;
}

function int16ToFloat32(samples) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = samples[i] / 32768;
  }
  return out;
}

function mergeLiveText(current, incoming) {
  const base = String(current || '').trim();
  const next = String(incoming || '').trim();
  if (!next) return base;
  if (!base) return next;
  if (next === base) return base;
  if (next.startsWith(base)) return next;
  if (base.startsWith(next)) return base;
  if (base.includes(next)) return base;
  return `${base}\n${next}`;
}

function buildTurnId() {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `rt_${stamp}_${rand}`;
}

function extractTextParts(message) {
  const chunks = [];
  const pushText = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    if (chunks[chunks.length - 1] === text) return;
    chunks.push(text);
  };

  pushText(message?.text);
  const parts = message?.serverContent?.modelTurn?.parts;
  if (Array.isArray(parts)) {
    parts.forEach((part) => {
      pushText(part?.text);
    });
  }

  const outputTranscription = message?.serverContent?.outputTranscription
    || message?.outputTranscription
    || message?.modelOutputTranscription
    || null;
  if (typeof outputTranscription === 'string') {
    pushText(outputTranscription);
  } else if (outputTranscription && typeof outputTranscription === 'object') {
    pushText(outputTranscription.text || outputTranscription.transcript || outputTranscription.content);
  }

  return chunks;
}

function extractInputTranscriptions(message) {
  const out = [];
  const appendEntry = (entry, fallbackFinal = false) => {
    if (entry == null) return;
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) return;
      out.push({ text, isFinal: fallbackFinal });
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item) => appendEntry(item, fallbackFinal));
      return;
    }
    if (typeof entry !== 'object') return;

    const text = String(
      entry.text
      || entry.transcript
      || entry.partial
      || entry.content
      || entry.final
      || ''
    ).trim();
    if (!text) return;
    const isFinal = Boolean(
      entry.isFinal
      || entry.finalized
      || entry.done
      || entry.completed
      || entry.turnComplete
      || fallbackFinal
    );
    out.push({ text, isFinal });
  };

  const fallbackFinal = Boolean(message?.serverContent?.turnComplete);
  const candidates = [
    message?.serverContent?.inputTranscription,
    message?.serverContent?.inputTranscript,
    message?.inputTranscription,
    message?.inputTranscript,
    message?.clientContent?.inputTranscription,
    message?.clientContent?.inputTranscript,
    message?.transcription?.input,
    message?.userTranscript
  ];
  candidates.forEach((entry) => appendEntry(entry, fallbackFinal));
  return out;
}

function buildToolSummary(name, response) {
  if (!name) return '';
  if (name === 'request_board_plan') {
    if (typeof response?.summary === 'string' && response.summary.trim()) return response.summary.trim();
    if (response?.result === 'ok') {
      const nodes = Number(response?.nodesAdded) || 0;
      const edges = Number(response?.edgesAdded) || 0;
      return `Board plan applied (${nodes} nodes, ${edges} edges).`;
    }
    if (response?.result === 'invalid_plan') return 'Board plan was invalid.';
    if (response?.result === 'missing_api_key') return 'Missing Gemini API key for board planning.';
  }
  if (response?.result === 'error') {
    return `${name} failed: ${response?.error || 'unknown error'}`;
  }
  return '';
}

export function createRealtimeAgent(options = {}) {
  const {
    view,
    onIntent,
    onUserAudio,
    onAiAudio,
    onUserTurnStart,
    onUserTranscriptDelta,
    onUserTurnEnd,
    onAiAudioChunk,
    onAiTurnComplete,
    onStatus,
    onError,
    onState
  } = options;

  let session = null;
  let running = false;
  let audioContext = null;
  let source = null;
  let processor = null;
  let gainNode = null;
  let stream = null;
  let userChunks = [];
  let aiChunks = [];
  let lastActionAt = 0;
  let lastSpeechAt = 0;
  let speechActive = false;
  let speechFrames = 0;
  let turnActive = false;
  let aiSpeaking = false;
  let currentTurn = null;
  let playbackGain = null;
  let playbackCursor = 0;
  let finalizingTurn = false;
  const silenceMs = 900;
  const speechThreshold = 0.018;

  const pushState = () => {
    if (typeof onState !== 'function') return;
    onState({
      listening: running,
      speaking: aiSpeaking,
      capturing: speechActive
    });
  };

  const ensureTurn = () => {
    if (currentTurn) return currentTurn;
    const now = Date.now();
    currentTurn = {
      id: buildTurnId(),
      startedAt: now,
      userEndedAt: null,
      userTranscript: '',
      aiText: '',
      toolSummaries: []
    };
    if (typeof onUserTurnStart === 'function') {
      onUserTurnStart({
        turnId: currentTurn.id,
        startedAt: now
      });
    }
    return currentTurn;
  };

  const emitUserTranscript = (text, isFinal = false) => {
    const nextText = String(text || '').trim();
    if (!nextText) return;
    const turn = ensureTurn();
    if (turn.userTranscript === nextText && !isFinal) return;
    turn.userTranscript = mergeLiveText(turn.userTranscript, nextText);
    if (typeof onUserTranscriptDelta === 'function') {
      onUserTranscriptDelta({
        turnId: turn.id,
        text: turn.userTranscript,
        isFinal: Boolean(isFinal)
      });
    }
    if (isFinal) {
      markUserTurnEnd();
    }
  };

  const markUserTurnEnd = () => {
    const turn = currentTurn;
    if (!turn || turn.userEndedAt) return;
    turn.userEndedAt = Date.now();
    if (typeof onUserTurnEnd === 'function') {
      onUserTurnEnd({
        turnId: turn.id,
        endedAt: turn.userEndedAt
      });
    }
  };

  const ensurePlaybackOutput = () => {
    if (!audioContext) return null;
    if (!playbackGain) {
      playbackGain = audioContext.createGain();
      playbackGain.gain.value = 1;
      playbackGain.connect(audioContext.destination);
      playbackCursor = audioContext.currentTime;
    }
    return playbackGain;
  };

  const playAiChunk = (chunk) => {
    if (!chunk?.length || !audioContext) return;
    const out = ensurePlaybackOutput();
    if (!out) return;
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    const buffer = audioContext.createBuffer(1, chunk.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(int16ToFloat32(chunk), 0);
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(out);
    const now = audioContext.currentTime;
    const startAt = Math.max(now + 0.01, playbackCursor);
    node.start(startAt);
    playbackCursor = startAt + buffer.duration;
    node.onended = () => {
      try {
        node.disconnect();
      } catch (err) {
        return;
      }
    };
  };

  const toolDeclarations = [
    {
      name: 'canvas_pan',
      description: 'Pan the canvas by dx, dy screen pixels.',
      parameters: {
        type: 'object',
        properties: { dx: { type: 'number' }, dy: { type: 'number' } },
        required: ['dx', 'dy']
      }
    },
    {
      name: 'canvas_zoom',
      description: 'Zoom the canvas by a delta (positive to zoom in, negative to zoom out).',
      parameters: {
        type: 'object',
        properties: { delta: { type: 'number' } },
        required: ['delta']
      }
    },
    {
      name: 'canvas_fit',
      description: 'Fit the view to show all nodes.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'canvas_center',
      description: 'Center the camera on the origin.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'canvas_focus_node',
      description: 'Focus the camera on a specific node id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    },
    {
      name: 'request_board_plan',
      description: 'Extract intent and request the app to add new nodes for the board.',
      parameters: {
        type: 'object',
        properties: { intent: { type: 'string' } },
        required: ['intent']
      }
    }
  ];

  const config = (Modality) => ({
    responseModalities: [Modality.AUDIO],
    tools: [{ functionDeclarations: toolDeclarations }],
    systemInstruction: { parts: [{ text: REALTIME_SYSTEM_PROMPT }] }
  });

  const sendRealtimePayload = (payload) => {
    if (!session) return false;
    if (typeof session.sendRealtimeInput === 'function') {
      try {
        session.sendRealtimeInput(payload);
        return true;
      } catch (err) {
        // fallback to other shapes
      }
    }
    if (typeof session.send === 'function') {
      try {
        session.send({ realtimeInput: payload });
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  };

  const sendAudioChunk = (pcm16) => {
    if (!session) return;
    const buffer = pcm16.buffer.slice(pcm16.byteOffset, pcm16.byteOffset + pcm16.byteLength);
    const base64 = arrayBufferToBase64(buffer);
    if (sendRealtimePayload({ audio: { data: base64, mimeType: AUDIO_INPUT_MIME } })) return;
    const blob = new Blob([buffer], { type: AUDIO_INPUT_MIME });
    if (sendRealtimePayload({ audio: blob })) return;
    if (sendRealtimePayload({ mediaChunks: [blob] })) return;
    sendRealtimePayload({ media: blob });
  };

  const sendTurnEnd = () => {
    if (!turnActive) return;
    sendRealtimePayload({ audioStreamEnd: true });
    turnActive = false;
  };

  const appendAiAudio = (data) => {
    try {
      let chunk = null;
      if (typeof data === 'string') {
        chunk = base64ToInt16(data);
      }
      if (!chunk && data instanceof ArrayBuffer) {
        chunk = new Int16Array(data);
      }
      if (!chunk && ArrayBuffer.isView(data)) {
        if (data instanceof Int16Array) {
          chunk = data;
        } else {
          chunk = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
        }
      }
      if (!chunk || !chunk.length) return;
      ensureTurn();
      aiChunks.push(chunk);
      playAiChunk(chunk);
      if (typeof onAiAudioChunk === 'function' && currentTurn?.id) {
        onAiAudioChunk({
          turnId: currentTurn.id,
          pcm16Chunk: chunk,
          sampleRate: OUTPUT_SAMPLE_RATE
        });
      }
    } catch (err) {
      // ignore invalid audio
    }
  };

  const flushUserAudio = async () => {
    const user = userChunks.length ? concatInt16(userChunks) : null;
    userChunks = [];
    if (!user || !user.length || typeof onUserAudio !== 'function') return;
    const { rms, peak } = measurePcm(user);
    if (rms < MIN_USER_AUDIO_RMS && peak < MIN_USER_AUDIO_PEAK) return;
    await onUserAudio(pcm16ToWavBlob(user, INPUT_SAMPLE_RATE));
  };

  const flushAiAudio = async () => {
    const ai = aiChunks.length ? concatInt16(aiChunks) : null;
    aiChunks = [];
    if (!ai || !ai.length) return null;
    const blob = pcm16ToWavBlob(ai);
    if (typeof onAiAudio === 'function') {
      await onAiAudio(blob);
    }
    return blob;
  };

  const finalizeTurn = async () => {
    if (finalizingTurn) return;
    finalizingTurn = true;
    const turn = currentTurn;
    try {
      if (!turn) {
        await flushAiAudio();
        return;
      }
      markUserTurnEnd();
      const audioBlob = await flushAiAudio();
      const text = String(turn.aiText || '').trim();
      const toolSummary = turn.toolSummaries.filter(Boolean).join('\n').trim();
      currentTurn = null;
      if (typeof onAiTurnComplete === 'function') {
        await onAiTurnComplete({
          turnId: turn.id,
          startedAt: turn.startedAt,
          userEndedAt: turn.userEndedAt || Date.now(),
          audioBlob: audioBlob || null,
          text: text || null,
          toolSummary: toolSummary || null,
          userTranscript: turn.userTranscript || ''
        });
      }
    } finally {
      finalizingTurn = false;
    }
  };

  const applyPan = (dx, dy) => {
    if (!view?.camera) return;
    view.camera.x += Number(dx) || 0;
    view.camera.y += Number(dy) || 0;
    if (typeof view._invalidate === 'function') view._invalidate();
  };

  const applyZoom = (delta) => {
    if (!view?.camera) return;
    const step = Number(delta) || 0;
    const next = clamp(view.camera.s * (1 + step), view.minZoom || 0.3, view.maxZoom || 2.5);
    view.camera.s = next;
    if (typeof view._invalidate === 'function') view._invalidate();
  };

  const applyCenter = () => {
    if (!view?.canvas || !view?.camera) return;
    view.camera.x = view.canvas.clientWidth / 2;
    view.camera.y = view.canvas.clientHeight / 2;
    if (typeof view._invalidate === 'function') view._invalidate();
  };

  const applyFit = () => {
    if (!view?.graph || !view?.canvas || !view?.camera) return;
    const nodes = view.graph.nodes || [];
    if (!nodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.w);
      maxY = Math.max(maxY, node.y + node.h);
    });
    const padding = 80;
    const width = Math.max(1, maxX - minX + padding * 2);
    const height = Math.max(1, maxY - minY + padding * 2);
    const scaleX = view.canvas.clientWidth / width;
    const scaleY = view.canvas.clientHeight / height;
    const nextScale = clamp(Math.min(scaleX, scaleY), view.minZoom || 0.3, view.maxZoom || 2.5);
    view.camera.s = nextScale;
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;
    view.camera.x = -(centerX) * nextScale + view.canvas.clientWidth / 2;
    view.camera.y = -(centerY) * nextScale + view.canvas.clientHeight / 2;
    if (typeof view._invalidate === 'function') view._invalidate();
  };

  const handleToolCall = async (toolCall) => {
    if (!session || !toolCall?.functionCalls) return;
    ensureTurn();
    const responses = [];
    for (const call of toolCall.functionCalls) {
      const args = parseToolArgs(call);
      const name = call?.name || '';
      let response = { result: 'ok', speak: 'Provide a brief spoken confirmation.' };
      try {
        const now = Date.now();
        if (now - lastActionAt < ACTION_THROTTLE_MS && name.startsWith('canvas_')) {
          response = { result: 'throttled' };
        } else if (name === 'canvas_pan') {
          lastActionAt = now;
          applyPan(args.dx, args.dy);
        } else if (name === 'canvas_zoom') {
          lastActionAt = now;
          applyZoom(args.delta);
        } else if (name === 'canvas_fit') {
          applyFit();
        } else if (name === 'canvas_center') {
          applyCenter();
        } else if (name === 'canvas_focus_node') {
          if (args.id && typeof view?.moveTo === 'function') {
            view.moveTo(args.id);
          } else if (args.id && typeof view?.focusNode === 'function') {
            view.focusNode(args.id);
          }
        } else if (name === 'request_board_plan') {
          if (typeof onIntent === 'function') {
            response = await onIntent(String(args.intent || '').trim());
          } else {
            response = { result: 'unsupported' };
          }
        } else {
          response = { result: 'unknown_tool' };
        }
      } catch (err) {
        response = { result: 'error', error: err?.message || 'Tool failed' };
      }
      const summary = buildToolSummary(name, response);
      if (summary && currentTurn) {
        currentTurn.toolSummaries.push(summary);
      }
      responses.push({ id: call.id, name, response });
    }
    if (responses.length && typeof session.sendToolResponse === 'function') {
      session.sendToolResponse({ functionResponses: responses });
    }
  };

  const handleMessage = async (message) => {
    if (!message) return;
    const userTranscripts = extractInputTranscriptions(message);
    userTranscripts.forEach((entry) => {
      emitUserTranscript(entry.text, entry.isFinal);
    });

    const modelTexts = extractTextParts(message);
    if (modelTexts.length) {
      const turn = ensureTurn();
      modelTexts.forEach((text) => {
        turn.aiText = mergeLiveText(turn.aiText, text);
      });
    }

    const chunks = extractAudioChunks(message);
    if (chunks.length) {
      ensureTurn();
      aiSpeaking = true;
      chunks.forEach((chunk) => appendAiAudio(chunk));
      pushState();
    }
    if (message.toolCall) {
      await handleToolCall(message.toolCall);
    }
    if (message.serverContent?.turnComplete) {
      aiSpeaking = false;
      pushState();
      await finalizeTurn();
    }
  };

  const startAudio = async () => {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (!running) return;
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, INPUT_SAMPLE_RATE);
      const pcm16 = floatToInt16(downsampled);
      if (!pcm16.length) return;
      let sum = 0;
      for (let i = 0; i < downsampled.length; i += 1) {
        sum += downsampled[i] * downsampled[i];
      }
      const rms = Math.sqrt(sum / downsampled.length);
      const now = Date.now();
      if (rms >= speechThreshold) {
        speechFrames = Math.min(MIN_SPEECH_FRAMES, speechFrames + 1);
        if (!speechActive && speechFrames >= MIN_SPEECH_FRAMES) {
          ensureTurn();
          speechActive = true;
          pushState();
        }
        if (speechActive) lastSpeechAt = now;
      } else {
        speechFrames = 0;
      }
      const withinTail = speechActive && (now - lastSpeechAt < silenceMs);
      if (speechActive || withinTail) {
        userChunks.push(pcm16);
        sendAudioChunk(pcm16);
        turnActive = true;
      }
      if (speechActive && !withinTail) {
        speechActive = false;
        sendTurnEnd();
        markUserTurnEnd();
        pushState();
        flushUserAudio();
      }
    };

    source.connect(processor);
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);
  };

  const stopAudio = async () => {
    if (processor) processor.disconnect();
    if (source) source.disconnect();
    if (gainNode) gainNode.disconnect();
    if (playbackGain) playbackGain.disconnect();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
    }
    processor = null;
    source = null;
    gainNode = null;
    playbackGain = null;
    playbackCursor = 0;
    stream = null;
    audioContext = null;
  };

  const start = async ({ apiKey, model = DEFAULT_MODEL } = {}) => {
    if (running) return;
    if (!apiKey) throw new Error('Missing API key');
    running = true;
    turnActive = false;
    currentTurn = null;
    userChunks = [];
    aiChunks = [];
    pushState();
    onStatus?.('Realtime listening...', 0);
    const { GoogleGenAI, Modality } = await loadGenAi();
    const ai = new GoogleGenAI({ apiKey });
    session = await ai.live.connect({
      model,
      callbacks: {
        onopen: () => onStatus?.('Realtime connected.', 1200),
        onmessage: (message) => handleMessage(message),
        onerror: (err) => onError?.(err),
        onclose: () => {
          onStatus?.('Realtime stopped.', 1200);
          aiSpeaking = false;
          pushState();
          finalizeTurn().catch(() => {});
        }
      },
      config: config(Modality)
    });
    await startAudio();
  };

  const stop = async () => {
    if (!running) return;
    running = false;
    speechActive = false;
    aiSpeaking = false;
    sendTurnEnd();
    markUserTurnEnd();
    turnActive = false;
    pushState();
    await stopAudio();
    if (session && typeof session.close === 'function') {
      session.close();
    }
    session = null;
    await flushUserAudio();
    await finalizeTurn();
  };

  return {
    start,
    stop,
    isActive: () => running
  };
}
