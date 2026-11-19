/* Inserted into the pinned production TreeScene by build-princess-v77-release.mjs.
 * React, R3F and Three aliases come from that same production module.
 * The existing mobile camera, album, film and photo code is left byte-for-byte intact.
 */
function GeminiKittenCradleV77({cat, anchorRef, onTapCat, onInteract}) {
  return fe.jsx("group", {
    ref: anchorRef,
    name: "princess-hold-anchor-v77",
    position: [0, 2.95, .77],
    rotation: [.04, .68, -.03],
    scale: [.46, .46, .46],
    onPointerDown: e => { onInteract?.(); e.stopPropagation(); e.nativeEvent?.stopPropagation?.(); },
    onPointerUp: e => { e.stopPropagation(); e.nativeEvent?.stopPropagation?.(); },
    onClick: e => {
      e.stopPropagation(); e.nativeEvent?.stopPropagation?.();
      if (e.delta <= 6) onTapCat?.();
    },
    children: cat && fe.jsx("primitive", {object: cat, dispose: null})
  });
}

function disposePrincessV77(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set(), images = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material) materials.add(material);
    }
  });
  for (const material of materials) for (const value of Object.values(material)) {
    if (value?.isTexture) { textures.add(value); if (value.image?.close) images.add(value.image); }
  }
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  for (const bitmap of images) bitmap.close();
}

function GeminiPrincessV77({active = true, paused = false, reducedMotion = false, onInteract, characterRuntime}) {
  const [bundle, setBundle] = U.useState(null), [failed, setFailed] = U.useState(false);
  const pivot = U.useRef(null), holdAnchor = U.useRef(null), adapterRef = U.useRef(null);
  // Opt-in DOM evidence for browser integration tests; no extra scene or controls.
  const qaProbe = U.useRef({enabled: new URLSearchParams(location.search).has('rigqa'), bones: null, heldBody: null, point: new J()});
  const {gl, invalidate} = $e();
  U.useEffect(() => {
    let disposed = false, ownedScene = null, ownedCats = null, pendingCat = null, readyModel = null, catSettled = false;
    const abort = new AbortController(), startMs = performance.now();
    const dataset = document.documentElement.dataset;
    dataset.princessV77 = "loading";
    dataset.princessHeldKitten = "loading";
    dataset.princessVersion = "v77-skeletal";
    setBundle(null); setFailed(false);
    const reveal = () => {
      if (disposed || !readyModel || !catSettled) return;
      dataset.princessV77 = "ready";
      dataset.princessV77ReadyMs = String(Math.round(performance.now() - startMs));
      setBundle({model: readyModel, cat: pendingCat});
      invalidate();
    };
    import("./princess-v72-loader.js").then(async module => {
      const loader = new module.PrincessGLTFLoader();
      const response = await fetch("/princess/luma-princess-rigged-v77.glb.gz", {signal: abort.signal, cache: "force-cache", priority: "low"});
      if (!response.ok) throw new Error("V77 model download: " + response.status);
      let bytes = await response.arrayBuffer();
      if (new DataView(bytes).getUint32(0, true) !== 0x46546c67) {
        if (typeof DecompressionStream !== "function") throw new Error("GZIP_UNSUPPORTED");
        bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      }
      if (disposed) return null;
      return loader.parseAsync(bytes, "");
    }).catch(async error => {
      if (disposed || abort.signal.aborted) return null;
      // Same V77 asset on browsers without DecompressionStream; never silently use an old character.
      const module = await import("./princess-v72-loader.js");
      const response = await fetch("/princess/luma-princess-rigged-v77.glb", {signal: abort.signal, cache: "force-cache", priority: "low"});
      if (!response.ok) throw new Error("V77 model fallback: " + response.status, {cause: error});
      const bytes = await response.arrayBuffer();
      if (disposed) return null;
      return new module.PrincessGLTFLoader().parseAsync(bytes, "");
    }).then(gltf => {
      if (!gltf) return;
      if (disposed) { disposePrincessV77(gltf.scene); return; }
      ownedScene = readyModel = gltf.scene;
      const adapter = bindPrincessRigV77(readyModel);
      if (!adapter.capabilities.canUseArmPose || !adapter.capabilities.canBlink) {
        throw new Error("V77 model is missing its required arm or eyelid skin");
      }
      adapterRef.current = adapter;
      if (qaProbe.current.enabled) {
        const bones = new Map();
        readyModel.traverse(node => { if (node.isBone) bones.set(node.name, node); });
        qaProbe.current.bones = bones;
      }
      characterRuntime.setPrincessRig(adapter);
      dataset.princessArmRig = String(Boolean(adapter.capabilities.canUseArmPose));
      dataset.princessEyelidRig = String(Boolean(adapter.capabilities.canBlink));
      reveal();
    }).catch(error => {
      if (disposed) return;
      if (ownedScene) { disposePrincessV77(ownedScene); ownedScene = readyModel = null; }
      dataset.princessV77 = "failed";
      dataset.princessV77Error = String(error?.message || error).slice(0, 200);
      console.error("V77 character could not load", error);
      setFailed(true); invalidate();
    });
    import("./chonky-rig-BHbgENN5.js").then(async module => {
      const trio = await module.loadChonkyTrio("/assets/chonky-cat-trio-BEKpO2QH.glb", abort.signal);
      if (disposed) { module.disposeChonkyTrio(trio); return; }
      ownedCats = {module, trio};
      const chosen = trio.cats.find(cat => cat.id === "cream") || trio.cats[0];
      pendingCat = chosen?.group ?? null;
      if (chosen) characterRuntime.setHeldCat(chosen);
      qaProbe.current.heldBody = chosen?.body ?? null;
      dataset.princessHeldKitten = pendingCat ? "ready" : "failed";
      catSettled = true; reveal();
    }).catch(error => {
      if (disposed) return;
      dataset.princessHeldKitten = "failed";
      console.warn("V77 held kitten could not load", error);
      catSettled = true; reveal();
    });
    return () => {
      disposed = true;
      abort.abort();
      characterRuntime.setPrincessRig(null);
      characterRuntime.setHeldCat(null);
      adapterRef.current?.dispose?.();
      adapterRef.current = null;
      disposePrincessV77(ownedScene);
      if (ownedCats) ownedCats.module.disposeChonkyTrio(ownedCats.trio);
      gl.domElement.style.cursor = "";
    };
  }, [gl, invalidate, characterRuntime]);
  U.useLayoutEffect(() => {
    adapterRef.current?.setHoldAnchor?.(holdAnchor.current);
  }, [bundle]);
  zt(({camera}) => {
    if (!active || paused) return;
    characterRuntime.applyHeld();
    const probe = qaProbe.current;
    if (!probe.enabled || !bundle || !probe.bones) return;
    const rect = gl.domElement.getBoundingClientRect();
    const screenPoint = point => ({x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2});
    const princessPoint = screenPoint(probe.point.set(0, .28, .055).applyMatrix4(bundle.model.matrixWorld).project(camera));
    const heldPoint = probe.heldBody ? screenPoint(probe.heldBody.getWorldPosition(probe.point).project(camera)) : null;
    document.documentElement.dataset.characterHitPoints = JSON.stringify({princess: princessPoint, 'held-cat': heldPoint});
    document.documentElement.dataset.princessV77Pose = JSON.stringify({
      leftArm: probe.bones.get('forearm_L').quaternion.toArray(),
      rightArm: probe.bones.get('forearm_R').quaternion.toArray(),
      upperLidY: probe.bones.get('eyelid_upper_L').position.y
    });
  });
  const tap = actor => {
    if (!active || paused) return;
    characterRuntime.tap(actor);
    document.documentElement.dataset.characterLastTap = actor;
    invalidate(); onInteract?.();
  };
  if (!bundle) return failed ? fe.jsx(PrincessCompanion, {active, reducedMotion, onInteract}) : null;
  return fe.jsx("group", {position: [4.6, -20.42, 9.35], children: fe.jsxs("group", {
    ref: pivot,
    rotation: [0, -.24, 0],
    onPointerDown: e => { onInteract?.(); e.stopPropagation(); e.nativeEvent?.stopPropagation?.(); },
    onPointerUp: e => { e.stopPropagation(); e.nativeEvent?.stopPropagation?.(); },
    onClick: e => { e.stopPropagation(); e.nativeEvent?.stopPropagation?.(); if (e.delta <= 6) tap("princess"); },
    onPointerOver: e => { e.stopPropagation(); gl.domElement.style.cursor = "pointer"; },
    onPointerOut: () => { gl.domElement.style.cursor = ""; },
    children: [
      fe.jsx("pointLight", {position: [-1.65, 4.3, 2.7], intensity: 29, distance: 9, decay: 2, color: "#fff0e5"}),
      fe.jsx("pointLight", {position: [1.8, 3.8, 1.4], intensity: 15, distance: 8, decay: 2, color: "#dfebff"}),
      fe.jsx("pointLight", {position: [.35, 4, -1.5], intensity: 11, distance: 7, decay: 2, color: "#ffe1ce"}),
      fe.jsx("primitive", {object: bundle.model, position: [0, 2.558, 0], scale: [5.12, 5.12, 5.12], dispose: null}),
      fe.jsx(GeminiKittenCradleV77, {cat: bundle.cat, anchorRef: holdAnchor, onTapCat: () => tap("held-cat"), onInteract})
    ]
  })});
}
