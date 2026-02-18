const DEFAULT_TASKS_VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
const DEFAULT_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const DEFAULT_MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const visionModulePromises = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance2D(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function resolveModelAssetPath(options = {}) {
  const direct = String(options.modelAssetPath || '').trim();
  if (direct) return direct;
  const base = String(options.modelBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return DEFAULT_MODEL_ASSET_PATH;
  return `${base}/hand_landmarker.task`;
}

function normalizeLandmark(landmark, mirrorX) {
  if (!landmark || typeof landmark !== 'object') return null;
  const xRaw = Number(landmark.x);
  const yRaw = Number(landmark.y);
  if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) return null;
  const x = mirrorX ? 1 - xRaw : xRaw;
  return {
    x: clamp(x, 0, 1),
    y: clamp(yRaw, 0, 1)
  };
}

function parseDetection(result) {
  const all = Array.isArray(result?.landmarks) ? result.landmarks : [];
  if (!all.length) return null;
  const handedness = Array.isArray(result?.handedness) ? result.handedness : [];
  if (!handedness.length) return all[0] || null;
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < all.length; i += 1) {
    const score = Number(handedness?.[i]?.[0]?.score || 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return all[bestIndex] || all[0] || null;
}

async function loadVisionModule(url) {
  const key = String(url || DEFAULT_TASKS_VISION_URL);
  if (!visionModulePromises.has(key)) {
    visionModulePromises.set(key, import(key));
  }
  return visionModulePromises.get(key);
}

export function createHandControls({ view, canvasShell, setStatus, options = {} } = {}) {
  if (!view?.canvas) {
    throw new Error('Hand controls require a view with a canvas.');
  }
  const status = typeof setStatus === 'function' ? setStatus : () => {};
  const onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;
  const config = {
    tasksVisionUrl: options.tasksVisionUrl || DEFAULT_TASKS_VISION_URL,
    wasmBaseUrl: options.wasmBaseUrl || DEFAULT_WASM_BASE_URL,
    modelAssetPath: resolveModelAssetPath(options),
    maxDetectFps: Number(options.maxDetectFps) > 0 ? Number(options.maxDetectFps) : 24,
    pointerSmoothing: Number(options.pointerSmoothing) > 0 ? Number(options.pointerSmoothing) : 0.62,
    cursorGain: Number(options.cursorGain) > 0 ? Number(options.cursorGain) : 1.35,
    pinchStartThreshold: Number(options.pinchStartThreshold) > 0 ? Number(options.pinchStartThreshold) : 0.42,
    pinchReleaseThreshold: Number(options.pinchReleaseThreshold) > 0 ? Number(options.pinchReleaseThreshold) : 0.58,
    zoomPinchStartThreshold: Number(options.zoomPinchStartThreshold) > 0 ? Number(options.zoomPinchStartThreshold) : 0.4,
    zoomPinchReleaseThreshold: Number(options.zoomPinchReleaseThreshold) > 0 ? Number(options.zoomPinchReleaseThreshold) : 0.52,
    zoomGestureGain: Number(options.zoomGestureGain) > 0 ? Number(options.zoomGestureGain) : 1.9,
    panGain: Number(options.panGain) > 0 ? Number(options.panGain) : 1.25,
    dragGain: Number(options.dragGain) > 0 ? Number(options.dragGain) : 1.18,
    releaseAfterMissingFrames: Number(options.releaseAfterMissingFrames) > 0 ? Number(options.releaseAfterMissingFrames) : 6,
    mirrorX: options.mirrorX !== false,
    minHandDetectionConfidence: Number(options.minHandDetectionConfidence) > 0 ? Number(options.minHandDetectionConfidence) : 0.55,
    minHandPresenceConfidence: Number(options.minHandPresenceConfidence) > 0 ? Number(options.minHandPresenceConfidence) : 0.5,
    minTrackingConfidence: Number(options.minTrackingConfidence) > 0 ? Number(options.minTrackingConfidence) : 0.5
  };

  let enabled = false;
  let initializing = false;
  let destroyed = false;
  let rafId = 0;
  let lastDetectAt = 0;
  let missingFrames = 0;
  let stream = null;
  let videoEl = null;
  let handLandmarker = null;
  let pointer = null;
  let cursorEl = null;
  let lastClientPoint = null;

  let gesture = createGestureState();

  function createGestureState() {
    return {
      pinching: false,
      action: 'idle',
      startPinchRatio: 1,
      startZoomRatio: 1,
      zoomMode: false,
      startLocal: null,
      startCamera: null,
      startWorld: null,
      startNodeId: '',
      startNode: null,
      lastNode: null
    };
  }

  function emitState(active, meta = {}) {
    if (!onStateChange) return;
    try {
      onStateChange(Boolean(active), meta);
    } catch (err) {
      console.warn('Hand controls state callback failed', err);
    }
  }

  function resetGesture() {
    gesture = createGestureState();
  }

  function getCanvasRect() {
    const rect = view.canvas?.getBoundingClientRect?.();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    return rect;
  }

  function toLocalPoint(clientX, clientY) {
    const rect = getCanvasRect();
    if (!rect) return null;
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height)
    };
  }

  function worldFromLocal(local, cameraOverride = null) {
    if (!local) return null;
    if (!cameraOverride && typeof view.screenToWorld === 'function') {
      return view.screenToWorld(local.x, local.y);
    }
    const cam = cameraOverride || view.camera || { x: 0, y: 0, s: 1 };
    const s = Number.isFinite(cam.s) && cam.s > 0 ? cam.s : 1;
    return {
      x: (local.x - (Number(cam.x) || 0)) / s,
      y: (local.y - (Number(cam.y) || 0)) / s
    };
  }

  function getCameraSnapshot() {
    return {
      x: Number(view?.camera?.x || 0),
      y: Number(view?.camera?.y || 0),
      s: Number(view?.camera?.s || 1)
    };
  }

  function getZoomBounds() {
    const min = Number.isFinite(view?.minZoom) ? Number(view.minZoom) : 0.3;
    const max = Number.isFinite(view?.maxZoom) ? Number(view.maxZoom) : 2.5;
    return { min, max: Math.max(min, max) };
  }

  function applyCamera(nextCamera) {
    if (!view?.camera) return;
    const bounds = getZoomBounds();
    const nextScale = clamp(Number(nextCamera.s || view.camera.s || 1), bounds.min, bounds.max);
    view.camera.s = nextScale;
    view.camera.x = Number(nextCamera.x || 0);
    view.camera.y = Number(nextCamera.y || 0);
    if (typeof view._invalidate === 'function') view._invalidate();
  }

  function ensureCursorElement() {
    if (cursorEl) return cursorEl;
    const el = document.createElement('div');
    el.className = 'ew-hand-cursor';
    el.setAttribute('aria-hidden', 'true');
    (canvasShell || document.body).appendChild(el);
    cursorEl = el;
    return cursorEl;
  }

  function updateCursor(clientPoint, pinching = false) {
    if (!clientPoint) return;
    const el = ensureCursorElement();
    el.classList.add('is-visible');
    el.classList.toggle('is-pinching', Boolean(pinching));
    el.style.transform = `translate(${clientPoint.x}px, ${clientPoint.y}px)`;
    lastClientPoint = { x: clientPoint.x, y: clientPoint.y };
  }

  function hideCursor() {
    if (!cursorEl) return;
    cursorEl.classList.remove('is-visible');
    cursorEl.classList.remove('is-pinching');
    lastClientPoint = null;
  }

  function removeCursor() {
    if (!cursorEl) return;
    cursorEl.remove();
    cursorEl = null;
    lastClientPoint = null;
  }

  function elementAtPoint(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const target = document.elementFromPoint(clientX, clientY);
    return target instanceof Element ? target : null;
  }

  function isUiBlocked(clientX, clientY) {
    const target = elementAtPoint(clientX, clientY);
    if (!target) return false;
    if (target.closest('.modal-backdrop:not([hidden]), .modal:not([hidden])')) return true;
    if (target.closest('.app-panel, .input-bar, .hint-center, .status, .panel-expand')) return true;
    if (target.closest('.ew-node-context-menu')) return true;
    if (canvasShell && !target.closest('.canvas-shell')) return true;
    return false;
  }

  function getNodeAtPoint(clientX, clientY) {
    const target = elementAtPoint(clientX, clientY);
    if (!target) return null;
    const nodeEl = target.closest('[data-ew-node-id]');
    if (!nodeEl) return null;
    const nodeId = String(nodeEl.getAttribute('data-ew-node-id') || '').trim();
    if (!nodeId) return null;
    const node = view?.graph?.getNode?.(nodeId);
    return node || null;
  }

  function smoothPointer(nextPoint) {
    if (!nextPoint) return null;
    if (!pointer) {
      pointer = { x: nextPoint.x, y: nextPoint.y };
      return pointer;
    }
    const alpha = clamp(config.pointerSmoothing, 0.05, 1);
    pointer.x += (nextPoint.x - pointer.x) * alpha;
    pointer.y += (nextPoint.y - pointer.y) * alpha;
    return pointer;
  }

  function releaseGesture() {
    if (!gesture.pinching) return;
    resetGesture();
    if (lastClientPoint) {
      updateCursor(lastClientPoint, false);
    }
  }

  function beginPinch(clientPoint, pinchRatio, zoomPinchRatio) {
    if (!clientPoint || !Number.isFinite(pinchRatio)) return;
    if (isUiBlocked(clientPoint.x, clientPoint.y)) return;
    const local = toLocalPoint(clientPoint.x, clientPoint.y);
    if (!local) return;
    const startCamera = getCameraSnapshot();
    const startWorld = worldFromLocal(local, startCamera);
    if (!startWorld) return;

    const node = getNodeAtPoint(clientPoint.x, clientPoint.y);
    gesture.pinching = true;
    gesture.startPinchRatio = Math.max(0.0001, pinchRatio);
    gesture.startZoomRatio = Number.isFinite(zoomPinchRatio) ? Math.max(0.0001, zoomPinchRatio) : 1;
    gesture.zoomMode = Number.isFinite(zoomPinchRatio) && zoomPinchRatio <= config.zoomPinchStartThreshold;
    gesture.startLocal = local;
    gesture.startCamera = startCamera;
    gesture.startWorld = startWorld;
    gesture.lastNode = null;
    updateCursor(clientPoint, true);

    if (node?.id) {
      gesture.action = 'drag';
      gesture.startNodeId = node.id;
      gesture.startNode = { x: Number(node.x || 0), y: Number(node.y || 0) };
      if (typeof view.selectNode === 'function') {
        view.selectNode(node.id);
      }
      return;
    }
    gesture.action = 'canvas';
  }

  function updateNodeDrag(local) {
    if (!gesture.startNodeId || !gesture.startNode) return;
    const node = view?.graph?.getNode?.(gesture.startNodeId);
    if (!node) return;
    const world = worldFromLocal(local);
    if (!world || !gesture.startWorld) return;
    const nextX = gesture.startNode.x + (world.x - gesture.startWorld.x) * config.dragGain;
    const nextY = gesture.startNode.y + (world.y - gesture.startWorld.y) * config.dragGain;
    if (gesture.lastNode) {
      const dx = Math.abs(nextX - gesture.lastNode.x);
      const dy = Math.abs(nextY - gesture.lastNode.y);
      if (dx < 0.08 && dy < 0.08) return;
    }
    gesture.lastNode = { x: nextX, y: nextY };
    view.updateNode(node.id, { x: nextX, y: nextY, autoPlace: false });
  }

  function updateCanvasGesture(local, zoomPinchRatio) {
    if (!gesture.startCamera || !gesture.startWorld || !gesture.startLocal) return;
    const canEvaluateZoom = Number.isFinite(zoomPinchRatio);
    if (gesture.zoomMode) {
      if (!canEvaluateZoom || zoomPinchRatio >= config.zoomPinchReleaseThreshold) {
        gesture.zoomMode = false;
        gesture.startCamera = getCameraSnapshot();
        gesture.startLocal = local;
        const world = worldFromLocal(local, gesture.startCamera);
        if (world) gesture.startWorld = world;
      }
    } else if (canEvaluateZoom && zoomPinchRatio <= config.zoomPinchStartThreshold) {
      gesture.zoomMode = true;
      gesture.startCamera = getCameraSnapshot();
      gesture.startLocal = local;
      gesture.startZoomRatio = Math.max(0.0001, zoomPinchRatio);
      const world = worldFromLocal(local, gesture.startCamera);
      if (world) gesture.startWorld = world;
    }

    if (gesture.zoomMode) {
      const ratio = canEvaluateZoom
        ? Math.max(0.2, Math.min(5, zoomPinchRatio / Math.max(0.0001, gesture.startZoomRatio)))
        : 1;
      const nextScale = gesture.startCamera.s * Math.pow(ratio, config.zoomGestureGain);
      applyCamera({
        x: local.x - gesture.startWorld.x * nextScale,
        y: local.y - gesture.startWorld.y * nextScale,
        s: nextScale
      });
      return;
    }

    const deltaLocal = {
      x: local.x - gesture.startLocal.x,
      y: local.y - gesture.startLocal.y
    };
    applyCamera({
      x: gesture.startCamera.x + deltaLocal.x * config.panGain,
      y: gesture.startCamera.y + deltaLocal.y * config.panGain,
      s: gesture.startCamera.s
    });
  }

  function updatePinch(clientPoint, zoomPinchRatio) {
    if (!gesture.pinching || !clientPoint) return;
    const local = toLocalPoint(clientPoint.x, clientPoint.y);
    if (!local) return;
    if (gesture.action === 'drag') {
      updateNodeDrag(local);
      return;
    }
    updateCanvasGesture(local, zoomPinchRatio);
  }

  function computePinchRatio(landmarks) {
    const thumbTip = normalizeLandmark(landmarks?.[4], config.mirrorX);
    const indexTip = normalizeLandmark(landmarks?.[8], config.mirrorX);
    const indexMcp = normalizeLandmark(landmarks?.[5], config.mirrorX);
    const pinkyMcp = normalizeLandmark(landmarks?.[17], config.mirrorX);
    if (!thumbTip || !indexTip || !indexMcp || !pinkyMcp) return NaN;
    const tipDistance = distance2D(thumbTip, indexTip);
    const handSpan = distance2D(indexMcp, pinkyMcp);
    if (!Number.isFinite(handSpan) || handSpan < 0.0001) return NaN;
    return tipDistance / handSpan;
  }

  function computeZoomPinchRatio(landmarks) {
    const thumbTip = normalizeLandmark(landmarks?.[4], config.mirrorX);
    const indexTip = normalizeLandmark(landmarks?.[8], config.mirrorX);
    const middleTip = normalizeLandmark(landmarks?.[12], config.mirrorX);
    const indexMcp = normalizeLandmark(landmarks?.[5], config.mirrorX);
    const pinkyMcp = normalizeLandmark(landmarks?.[17], config.mirrorX);
    if (!thumbTip || !indexTip || !middleTip || !indexMcp || !pinkyMcp) return NaN;
    const handSpan = distance2D(indexMcp, pinkyMcp);
    if (!Number.isFinite(handSpan) || handSpan < 0.0001) return NaN;
    const ti = distance2D(thumbTip, indexTip);
    const tm = distance2D(thumbTip, middleTip);
    return Math.max(ti, tm) / handSpan;
  }

  function palmToCanvasClient(landmarks) {
    const wrist = normalizeLandmark(landmarks?.[0], config.mirrorX);
    const indexMcp = normalizeLandmark(landmarks?.[5], config.mirrorX);
    const pinkyMcp = normalizeLandmark(landmarks?.[17], config.mirrorX);
    const points = [wrist, indexMcp, pinkyMcp].filter(Boolean);
    if (!points.length) return null;
    const nxRaw = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const nyRaw = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const nx = clamp(0.5 + (nxRaw - 0.5) * config.cursorGain, 0, 1);
    const ny = clamp(0.5 + (nyRaw - 0.5) * config.cursorGain, 0, 1);
    const rect = getCanvasRect();
    if (!rect) return null;
    return {
      x: rect.left + nx * rect.width,
      y: rect.top + ny * rect.height
    };
  }

  function processLandmarks(result) {
    const landmarks = parseDetection(result);
    if (!landmarks) {
      missingFrames += 1;
      if (gesture.pinching && missingFrames >= config.releaseAfterMissingFrames) {
        releaseGesture();
      }
      if (missingFrames >= config.releaseAfterMissingFrames) {
        hideCursor();
      }
      return;
    }

    const clientPointRaw = palmToCanvasClient(landmarks);
    const pinchRatio = computePinchRatio(landmarks);
    const zoomPinchRatio = computeZoomPinchRatio(landmarks);
    if (!clientPointRaw || !Number.isFinite(pinchRatio)) {
      return;
    }

    missingFrames = 0;
    const clientPoint = smoothPointer(clientPointRaw);
    if (!clientPoint) return;
    updateCursor(clientPoint, gesture.pinching);

    if (!gesture.pinching && pinchRatio <= config.pinchStartThreshold) {
      beginPinch(clientPoint, pinchRatio, zoomPinchRatio);
      return;
    }
    if (gesture.pinching && pinchRatio >= config.pinchReleaseThreshold) {
      releaseGesture();
      return;
    }
    if (gesture.pinching) {
      updateCursor(clientPoint, true);
      updatePinch(clientPoint, zoomPinchRatio);
      return;
    }
    updateCursor(clientPoint, false);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function scheduleLoop() {
    if (!enabled) return;
    rafId = requestAnimationFrame(runLoop);
  }

  function runLoop() {
    if (!enabled || destroyed) return;
    scheduleLoop();
    if (!videoEl || !handLandmarker) return;
    if (videoEl.readyState < 2) return;
    const now = performance.now();
    const minInterval = 1000 / config.maxDetectFps;
    if (now - lastDetectAt < minInterval) return;
    lastDetectAt = now;
    try {
      const result = handLandmarker.detectForVideo(videoEl, now);
      processLandmarks(result);
    } catch (err) {
      console.warn('Hand controls detect failed', err);
      status('Hand tracking failed. Disabling hand controls.', 2200);
      void disable();
    }
  }

  async function ensureHandLandmarker() {
    if (handLandmarker) return;
    const vision = await loadVisionModule(config.tasksVisionUrl);
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(config.wasmBaseUrl);
    handLandmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: config.modelAssetPath
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: config.minHandDetectionConfidence,
      minHandPresenceConfidence: config.minHandPresenceConfidence,
      minTrackingConfidence: config.minTrackingConfidence
    });
  }

  async function ensureVideoStream() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Camera API is not available in this browser.');
    }
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
    }
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 }
        },
        audio: false
      });
    }
    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (err) {
      throw new Error('Camera permission denied or blocked.');
    }
  }

  async function enable() {
    if (destroyed) throw new Error('Hand controls have been destroyed.');
    if (enabled || initializing) return;
    initializing = true;
    try {
      await ensureHandLandmarker();
      await ensureVideoStream();
      resetGesture();
      pointer = null;
      missingFrames = 0;
      lastDetectAt = 0;
      enabled = true;
      emitState(true, { reason: 'enabled' });
      scheduleLoop();
    } finally {
      initializing = false;
    }
  }

  async function disable() {
    if (!enabled && !initializing && !stream && !videoEl) return;
    const wasEnabled = enabled;
    enabled = false;
    stopLoop();
    releaseGesture();
    pointer = null;
    hideCursor();
    missingFrames = 0;
    if (videoEl) {
      try {
        videoEl.pause();
      } catch (err) {
        console.warn('Video pause failed', err);
      }
      videoEl.srcObject = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          return;
        }
      });
      stream = null;
    }
    if (wasEnabled) {
      emitState(false, { reason: 'disabled' });
    }
  }

  async function destroy() {
    destroyed = true;
    await disable();
    if (typeof handLandmarker?.close === 'function') {
      handLandmarker.close();
    }
    handLandmarker = null;
    videoEl = null;
    removeCursor();
  }

  return {
    enable,
    disable,
    destroy,
    isEnabled: () => enabled
  };
}
