import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { assetUrl } from '../lib/content';
import { GROUND_Y } from './tree-profile';
import { snowHeightAt } from './tree-base';
import FairytalePrincess from './FairytalePrincess';

interface Props {
  active: boolean;
  paused: boolean;
  reducedMotion: boolean;
}

/** V72 is user-selected for preview, not a film-grade or rigged production asset. */
const ENABLE_V72_PREVIEW = import.meta.env.VITE_PRINCESS_V72_PREVIEW === 'true';
const MODEL_URL = assetUrl('princess/luma-princess-v72.glb');
const PLACE_X = 6.25;
const PLACE_Z = 7.15;
const PLACE_Y = GROUND_Y + snowHeightAt(PLACE_X, PLACE_Z) + 0.02;
const DISPLAY_HEIGHT = 5.12;
const DEFAULT_YAW = -0.24;

/** GLTFLoader owns unique GLB materials/textures; keep them intact while displayed. */
function disposeImportedScene(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    const assigned = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of assigned) if (material) materials.add(material);
  });
  for (const material of materials) {
    // The original PBR data and normal maps are part of the accepted V72 look.
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
  }
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function V72Princess({ active, paused, reducedMotion, onUnavailable }: Props & { onUnavailable: () => void }) {
  const mount = useRef<THREE.Group>(null);
  const loaded = useRef<THREE.Group | null>(null);
  const elapsed = useRef(0);
  const greetingAt = useRef(-100);
  const [ready, setReady] = useState(false);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const parent = mount.current;
    if (!parent) return;
    let mounted = true;
    const previousCursor = gl.domElement.style.cursor;
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, asset => {
      if (!mounted) {
        disposeImportedScene(asset.scene);
        return;
      }
      const scene = asset.scene;
      const bounds = new THREE.Box3().setFromObject(scene);
      const dimensions = bounds.getSize(new THREE.Vector3());
      if (bounds.isEmpty() || !Number.isFinite(dimensions.y) || dimensions.y < 1e-5) {
        disposeImportedScene(scene);
        onUnavailable();
        return;
      }
      const scale = DISPLAY_HEIGHT / dimensions.y;
      const center = bounds.getCenter(new THREE.Vector3());
      // V72 is Y-up and faces +Z. Never alter source vertices/normals/UVs.
      scene.scale.setScalar(scale);
      scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      const wrapper = new THREE.Group();
      wrapper.name = 'princess-v72-greeting';
      wrapper.rotation.y = DEFAULT_YAW;
      wrapper.add(scene);
      parent.add(wrapper);
      loaded.current = wrapper;
      setReady(true);
      invalidate();
    }, undefined, error => {
      if (!mounted) return;
      console.warn('Princess V72 could not load; displaying the procedural companion.', error);
      onUnavailable();
    });
    return () => {
      mounted = false;
      gl.domElement.style.cursor = previousCursor;
      if (loaded.current) {
        parent.remove(loaded.current);
        disposeImportedScene(loaded.current);
        loaded.current = null;
      }
    };
  }, [gl, invalidate, onUnavailable]);

  useFrame((_, delta) => {
    const model = loaded.current;
    if (!model || !active || paused) return;
    if (reducedMotion) {
      model.rotation.set(0, DEFAULT_YAW, 0);
      model.position.y = 0;
      return;
    }
    elapsed.current += THREE.MathUtils.clamp(delta, 0, 0.05);
    const t = elapsed.current;
    const afterTap = t - greetingAt.current;
    const greeting = afterTap >= 0 && afterTap < 1.6
      ? Math.sin((afterTap / 1.6) * Math.PI) : 0;
    // Unrigged V72: only a modest whole-body acknowledgement. No fake wave.
    model.rotation.y = DEFAULT_YAW + Math.sin(t * 0.26) * 0.045;
    model.rotation.x = greeting * 0.055;
    model.rotation.z = Math.sin(t * 0.33) * 0.008;
    model.position.y = Math.sin(t * 0.85) * 0.012;
  });

  return <>
    {!ready && <FairytalePrincess active={active} paused={paused} reducedMotion={reducedMotion} />}
    <group ref={mount} position={[PLACE_X, PLACE_Y, PLACE_Z]}
      onClick={event => {
        if (!loaded.current || event.delta > 6) return;
        event.stopPropagation();
        greetingAt.current = elapsed.current;
        invalidate();
      }}
      onPointerOver={event => {
        if (!loaded.current) return;
        event.stopPropagation();
        gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={() => { gl.domElement.style.cursor = ''; }}
    />
  </>;
}

export default function PrincessAsset({ active, paused, reducedMotion }: Props) {
  const [unavailable, setUnavailable] = useState(false);
  const [everActivated, setEverActivated] = useState(active);
  useEffect(() => { if (active) setEverActivated(true); }, [active]);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  if (!ENABLE_V72_PREVIEW || !everActivated || unavailable) {
    return <FairytalePrincess active={active} paused={paused} reducedMotion={reducedMotion} />;
  }
  return <V72Princess active={active} paused={paused} reducedMotion={reducedMotion}
    onUnavailable={onUnavailable} />;
}
