import { useEffect, useRef, useState } from 'react';
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

/** The model is an actual GLB mesh, not a single photograph or HTML billboard. */
const MODEL_URL = assetUrl('princess/luma-princess-hd-study-v2.glb');
const PLACE_X = 6.25;
const PLACE_Z = 7.15;
const PLACE_Y = GROUND_Y + snowHeightAt(PLACE_X, PLACE_Z) + 0.02;

function detachIntoPivot(root: THREE.Object3D, namePrefix: string, pivot: THREE.Vector3) {
  const moved: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.name.startsWith(namePrefix)) moved.push(node);
  });
  if (!moved.length) return null;
  const group = new THREE.Group();
  group.name = namePrefix + 'animation-pivot';
  group.position.copy(pivot);
  for (const node of moved) {
    const parent = node.parent;
    if (!parent) continue;
    // Exported GLB nodes are in the common local coordinate system.
    parent.remove(node);
    node.position.sub(pivot);
    group.add(node);
  }
  root.add(group);
  return group;
}

function disposeScene(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function DetailedPrincess(props: Props & { onUnavailable: () => void }) {
  const mount = useRef<THREE.Group>(null);
  const loaded = useRef<THREE.Group | null>(null);
  const headPivot = useRef<THREE.Group | null>(null);
  const armPivot = useRef<THREE.Group | null>(null);
  const elapsed = useRef(0);
  const waveAt = useRef(-100);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const parent = mount.current;
    if (!parent) return;
    let mounted = true;
    const loader = new GLTFLoader();
    const previousCursor = gl.domElement.style.cursor;

    loader.load(MODEL_URL, (asset) => {
      if (!mounted) {
        disposeScene(asset.scene);
        return;
      }
      const scene = asset.scene;
      const head = detachIntoPivot(scene, 'luma-head-', new THREE.Vector3(0, 4.23, 0));
      const arm = detachIntoPivot(scene, 'luma-arm-', new THREE.Vector3(0.64, 3.45, 0));
      const root = new THREE.Group();
      root.name = 'luma-detailed-princess';
      root.add(scene);
      parent.add(root);
      headPivot.current = head;
      armPivot.current = arm;
      loaded.current = root;
      invalidate();
    }, undefined, () => {
      if (mounted) props.onUnavailable();
    });
    return () => {
      mounted = false;
      gl.domElement.style.cursor = previousCursor;
      const root = loaded.current;
      if (root) {
        parent.remove(root);
        disposeScene(root);
      }
      loaded.current = null;
      headPivot.current = null;
      armPivot.current = null;
    };
  }, [gl, invalidate, props.onUnavailable]);

  useFrame((_, delta) => {
    const group = loaded.current;
    if (!group || !props.active || props.paused) return;
    if (props.reducedMotion) {
      group.rotation.y = -0.24;
      group.position.y = 0;
      if (headPivot.current) headPivot.current.rotation.y = 0;
      if (armPivot.current) armPivot.current.rotation.z = 0;
      return;
    }
    elapsed.current += Math.min(Math.max(delta, 0), 0.05);
    const t = elapsed.current;
    group.rotation.y = -0.24 + Math.sin(t * 0.23) * 0.065;
    group.position.y = Math.sin(t * 0.75) * 0.014;
    if (headPivot.current) headPivot.current.rotation.y = Math.sin(t * 0.35) * 0.055;
    const phase = t - waveAt.current;
    if (armPivot.current) armPivot.current.rotation.z =
      phase > 0 && phase < 2.25 ? -0.17 - Math.sin(phase * Math.PI / 2.25) * (0.28 + 0.06 * Math.sin(phase * 11)) : 0;
  });

  return <group position={[PLACE_X, PLACE_Y, PLACE_Z]} ref={mount}
    onClick={event => {
      event.stopPropagation();
      waveAt.current = elapsed.current;
      invalidate();
    }}
    onPointerOver={event => {
      if (!loaded.current) return;
      event.stopPropagation();
      gl.domElement.style.cursor = 'pointer';
    }}
    onPointerOut={() => { gl.domElement.style.cursor = ''; }}
  />;
}

export default function PrincessAsset({ active, paused, reducedMotion }: Props) {
  const [unavailable, setUnavailable] = useState(false);
  // A safe fallback means a missing/invalid GLB never hides or breaks the tree.
  if (unavailable) return <FairytalePrincess active={active} paused={paused} reducedMotion={reducedMotion} />;
  return <DetailedPrincess active={active} paused={paused} reducedMotion={reducedMotion}
    onUnavailable={() => setUnavailable(true)} />;
}
