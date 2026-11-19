/** Pixel-budget governor. Pure state: input/render integration lives in the R3F adapter.
 * Camera input always stays at the browser's frame rate. We change buffer size,
 * never CSS size, camera position, photo texture resolution or gesture deltas.
 */
export function createMobilePerformance({mobile = false, nativeDpr = 1} = {}) {
  const native = Math.max(.5, Math.min(3, Number(nativeDpr) || 1));
  const levels = [
    {idle: 1, gesture: .8, idlePixels: 500000, gesturePixels: 260000},
    {idle: 1.25, gesture: .9, idlePixels: 650000, gesturePixels: 330000},
    {idle: 1.5, gesture: 1, idlePixels: 850000, gesturePixels: 420000},
  ];
  let width = 1, height = 1, level = 2, gesture = false;
  let sampleStart = 0, sampleTotal = 0, sampleCount = 0, startedAt = null;
  let lastChange = -Infinity, fastSince = null;
  function state() {
    const profile = levels[level];
    const budget = mobile ? profile[gesture ? 'gesturePixels' : 'idlePixels'] : 8000000;
    const cap = mobile ? profile[gesture ? 'gesture' : 'idle'] : 3;
    const dpr = Math.min(native, cap, Math.sqrt(budget / Math.max(1, width * height)));
    return {mobile, gesture, level, dpr: Math.max(.5, dpr), budget, quality: gesture ? 'gesture' : 'idle'};
  }
  return {
    getState: state,
    resize(w, h) { width = Math.max(1, Number(w) || 1); height = Math.max(1, Number(h) || 1); return state(); },
    setGesture(value) { gesture = !!value; return state(); },
    resetSamples() { sampleStart = sampleTotal = sampleCount = 0; fastSince = null; startedAt = null; },
    sample(deltaMs, now) {
      if (!mobile || !Number.isFinite(deltaMs) || deltaMs <= 0 || !Number.isFinite(now)) return null;
      if (startedAt === null) { startedAt = now; return null; }
      // Exclude initial texture/shader compilation and resume after backgrounding.
      if (now - startedAt < 1800) return null;
      if (!sampleCount) sampleStart = now;
      sampleTotal += Math.min(100, deltaMs);
      sampleCount++;
      if (sampleCount < 8 || now - sampleStart < 700) return null;
      const average = sampleTotal / sampleCount;
      sampleTotal = sampleCount = 0;
      if (average > 28) {
        fastSince = null;
        if (level > 0 && now - lastChange >= 1500) {
          level--; lastChange = now; return state();
        }
      } else if (average < 19) {
        fastSince ??= now;
        // Recover only after sustained headroom; avoid resize oscillation.
        if (!gesture && level < 2 && now - fastSince >= 4000 && now - lastChange >= 8000) {
          level++; lastChange = now; fastSince = now; return state();
        }
      } else fastSince = null;
      return null;
    },
  };
}
