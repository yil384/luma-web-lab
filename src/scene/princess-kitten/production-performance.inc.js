/* Replaces lm in the pinned production bundle. No independent animation loop. */
function lm({paused = false, active = true}) {
  const {size, viewport, setDpr, gl, invalidate} = $e();
  const mobile = window.matchMedia('(max-width: 1000px) and (pointer: coarse)').matches;
  const quality = U.useMemo(() => createMobilePerformanceV78({mobile, nativeDpr: window.devicePixelRatio}), [mobile]);
  const currentDpr = U.useRef(viewport.dpr);
  const apply = U.useCallback(state => {
    const data = document.documentElement.dataset;
    data.scenePerformance = 'v78';
    data.mobileSceneMode = mobile ? 'performance' : 'desktop';
    data.sceneBloom = mobile ? 'off' : 'on';
    data.sceneQuality = state.quality;
    data.sceneQualityLevel = String(state.level);
    data.sceneDpr = state.dpr.toFixed(3);
    data.scenePixelBudget = String(state.budget);
    if (Math.abs(currentDpr.current - state.dpr) > .005) {
      currentDpr.current = state.dpr;
      setDpr(state.dpr);
      invalidate();
    }
  }, [mobile, setDpr, invalidate]);
  U.useLayoutEffect(() => {
    currentDpr.current = viewport.dpr;
    apply(quality.resize(size.width, size.height));
  }, [quality, size.width, size.height, viewport.dpr, apply]);
  U.useEffect(() => {
    quality.resetSamples();
  }, [quality, paused, active]);
  U.useEffect(() => {
    const canvas = gl.domElement, pointers = new Set();
    let restoreTimer = null;
    const clearRestore = () => { if (restoreTimer !== null) clearTimeout(restoreTimer); restoreTimer = null; };
    const start = event => {
      if (!mobile) return;
      pointers.add(event.pointerId);
      clearRestore();
      apply(quality.setGesture(true));
    };
    const release = event => {
      if (!pointers.delete(event.pointerId) || pointers.size) return;
      clearRestore();
      // A short settle window avoids two framebuffer reallocations between
      // adjacent touches and keeps a continuing two-finger gesture responsive.
      restoreTimer = setTimeout(() => { restoreTimer = null; apply(quality.setGesture(false)); }, 420);
    };
    const reset = () => {
      pointers.clear(); clearRestore(); quality.resetSamples(); apply(quality.setGesture(false));
    };
    canvas.addEventListener('pointerdown', start, {capture: true, passive: true});
    canvas.addEventListener('lostpointercapture', release, {capture: true, passive: true});
    window.addEventListener('pointerup', release, {capture: true, passive: true});
    window.addEventListener('pointercancel', release, {capture: true, passive: true});
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      clearRestore();
      canvas.removeEventListener('pointerdown', start, true);
      canvas.removeEventListener('lostpointercapture', release, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [gl, mobile, quality, apply]);
  zt((_, dt) => {
    if (paused || !active || document.hidden) return;
    const next = quality.sample(dt * 1000, performance.now());
    if (next) apply(next);
  }, -3);
  return null;
}
