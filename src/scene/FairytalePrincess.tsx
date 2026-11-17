import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GROUND_Y } from './tree-profile';
import { snowHeightAt } from './tree-base';

type Vec3 = [number, number, number];

// Deliberately original geometry and proportions, not a likeness-reconstruction
// or a stock princess IP. This is a lightweight interactive 3D study.
const PRINCESS_X = 6.25;
const PRINCESS_Z = 7.15;
const PRINCESS_Y = GROUND_Y + snowHeightAt(PRINCESS_X, PRINCESS_Z) + 0.02;
const TAU = Math.PI * 2;
const GOLD = '#e3bb77';
const CREAM = '#fff0df';
const ROSE = '#d9a0b5';
const HAIR = '#49313c';

const frontLocks = [
  { x: -0.43, x2: -0.63, z: 0.29, end: 3.16, width: 0.092 },
  { x: -0.53, x2: -0.80, z: 0.10, end: 2.91, width: 0.11 },
  { x: 0.47, x2: 0.63, z: 0.30, end: 3.20, width: 0.09 },
  { x: 0.55, x2: 0.80, z: 0.10, end: 2.94, width: 0.11 },
] as const;

function Pearl({ at, radius = 0.035, color = '#fff6ec' }: { at: Vec3; radius?: number; color?: string }) {
  return <mesh position={at}>
    <sphereGeometry args={[radius, 12, 10]} />
    <meshPhysicalMaterial color={color} roughness={0.19} metalness={0.04} clearcoat={0.9} />
  </mesh>;
}

function Oval({ at, scale, color, roughness = 0.44, metalness = 0 }: {
  at: Vec3; scale: Vec3; color: string; roughness?: number; metalness?: number;
}) {
  return <mesh position={at} scale={scale}>
    <sphereGeometry args={[1, 28, 20]} />
    <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness}
      clearcoat={metalness ? 0.18 : 0.12} />
  </mesh>;
}

function Curve({ points, radius, color, metal = false }: {
  points: Vec3[]; radius: number; color: string; metal?: boolean;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(
    points.map(point => new THREE.Vector3(...point)), false, 'centripetal',
  ), [points]);
  return <mesh>
    <tubeGeometry args={[curve, 24, radius, 6, false]} />
    <meshStandardMaterial color={color} metalness={metal ? 0.75 : 0.05} roughness={metal ? 0.24 : 0.61} />
  </mesh>;
}

function Skirt() {
  const shape = useMemo(() => {
    const points = [
      [0, 0.13], [0.75, 0.13], [1.11, 0.18], [1.19, 0.26],
      [1.18, 0.39], [1.12, 0.55], [1.04, 0.75], [0.95, 1.03],
      [0.82, 1.39], [0.62, 1.85], [0.44, 2.33], [0.31, 2.71],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const geometry = new THREE.LatheGeometry(points, 80);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
      const width = 1 + (0.033 * Math.cos(12 * Math.atan2(z, x))) * Math.max(0.15, 1 - y / 3);
      positions.setXYZ(index, x * width, y, z * width);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);

  const embroidery = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = i * TAU / 12;
    const r = 1.18;
    return {
      at: [r * Math.sin(angle), 0.30, r * Math.cos(angle)] as Vec3,
      angle,
    };
  }), []);

  return <group>
    <mesh geometry={shape}>
      <meshPhysicalMaterial color="#f7e8dd" roughness={0.68}
        sheen={0.84} sheenColor={new THREE.Color('#edc1d4')} sheenRoughness={0.56} />
    </mesh>
    <mesh geometry={shape} scale={[1.025, 1, 1.025]}>
      <meshPhysicalMaterial color="#f2d4d9" roughness={0.65} transparent opacity={0.22}
        side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.21, 0]}>
      <torusGeometry args={[1.16, 0.029, 8, 80]} />
      <meshStandardMaterial color={GOLD} metalness={0.68} roughness={0.27} />
    </mesh>
    {embroidery.map((item, i) => <group key={i} position={item.at} rotation={[0, item.angle, 0]}>
      <Oval at={[0, 0.05, 0.035]} scale={[0.065, 0.11, 0.018]} color="#f7d3cf" />
      <Pearl at={[0, 0.13, 0.055]} radius={0.034} color="#efc99a" />
    </group>)}
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i + 0.5) * TAU / 8;
      return <group key={i} rotation={[0, a, 0]}>
        <Curve color="#e1b87b" metal radius={0.016} points={[
          [-0.17, 0.37, 1.15], [-0.07, 0.47, 1.14], [0, 0.54, 1.11],
          [0.07, 0.47, 1.14], [0.17, 0.37, 1.15],
        ]} />
      </group>;
    })}
  </group>;
}

function Face() {
  return <group>
    <Oval at={[0, 4.37, 0.1]} scale={[0.52, 0.62, 0.42]} color="#f7d9c4" roughness={0.72} />
    <Oval at={[-0.20, 4.42, 0.466]} scale={[0.116, 0.149, 0.056]} color="#fff8ed" />
    <Oval at={[0.20, 4.42, 0.466]} scale={[0.116, 0.149, 0.056]} color="#fff8ed" />
    <Oval at={[-0.20, 4.41, 0.512]} scale={[0.068, 0.107, 0.029]} color="#745865" />
    <Oval at={[0.20, 4.41, 0.512]} scale={[0.068, 0.107, 0.029]} color="#745865" />
    <Oval at={[-0.20, 4.42, 0.539]} scale={[0.041, 0.075, 0.013]} color="#352d39" />
    <Oval at={[0.20, 4.42, 0.539]} scale={[0.041, 0.075, 0.013]} color="#352d39" />
    <Pearl at={[-0.217, 4.462, 0.56]} radius={0.025} />
    <Pearl at={[0.183, 4.462, 0.56]} radius={0.025} />
    <Curve radius={0.022} color="#6d4851" points={[
      [-0.324, 4.523, 0.476], [-0.23, 4.551, 0.514], [-0.105, 4.525, 0.485],
    ]} />
    <Curve radius={0.022} color="#6d4851" points={[
      [0.105, 4.525, 0.485], [0.23, 4.551, 0.514], [0.324, 4.523, 0.476],
    ]} />
    <Curve radius={0.029} color={HAIR} points={[
      [-0.304, 4.71, 0.421], [-0.20, 4.735, 0.475], [-0.09, 4.715, 0.451],
    ]} />
    <Curve radius={0.029} color={HAIR} points={[
      [0.09, 4.715, 0.451], [0.20, 4.735, 0.475], [0.304, 4.71, 0.421],
    ]} />
    <Oval at={[0, 4.196, 0.513]} scale={[0.062, 0.066, 0.044]} color="#f5c6b8" roughness={0.85} />
    <Curve radius={0.018} color="#b66c78" points={[
      [-0.11, 4.08, 0.451], [-0.035, 4.051, 0.48], [0.05, 4.05, 0.473],
      [0.115, 4.083, 0.449],
    ]} />
    <Oval at={[-0.326, 4.22, 0.373]} scale={[0.095, 0.048, 0.021]} color="#e9a3a5" />
    <Oval at={[0.326, 4.22, 0.373]} scale={[0.095, 0.048, 0.021]} color="#e9a3a5" />
    <Oval at={[-0.50, 4.32, 0.10]} scale={[0.105, 0.15, 0.085]} color="#f2d0bc" />
    <Oval at={[0.50, 4.32, 0.10]} scale={[0.105, 0.15, 0.085]} color="#f2d0bc" />
    <Pearl at={[-0.51, 4.12, 0.18]} radius={0.056} />
    <Pearl at={[0.51, 4.12, 0.18]} radius={0.056} />
  </group>;
}

function HairAndTiara() {
  return <group>
    <Oval at={[0, 4.55, -0.235]} scale={[0.60, 0.77, 0.38]} color="#392632" />
    <Oval at={[0, 4.91, -0.10]} scale={[0.54, 0.34, 0.43]} color={HAIR} />
    <Oval at={[-0.35, 4.76, 0.21]} scale={[0.27, 0.22, 0.18]} color="#402a35" />
    <Oval at={[0.29, 4.79, 0.23]} scale={[0.33, 0.24, 0.17]} color={HAIR} />
    <Curve radius={0.105} color="#49313c" points={[
      [-0.21, 5.13, 0.40], [-0.36, 5.02, 0.38], [-0.43, 4.87, 0.35],
      [-0.52, 4.70, 0.33],
    ]} />
    <Curve radius={0.085} color="#513644" points={[
      [0.11, 5.14, 0.42], [0.36, 5.04, 0.41], [0.45, 4.88, 0.35],
    ]} />
    {frontLocks.map((lock, i) => <Curve key={i} color={i % 2 ? '#3b2935' : HAIR}
      radius={lock.width} points={[
        [lock.x, 4.87, lock.z], [lock.x * 1.06, 4.52, lock.z + 0.03],
        [lock.x * 1.14, 4.06, lock.z], [lock.x2, 3.62, lock.z - 0.1],
        [lock.x2 * 0.96, lock.end, lock.z - 0.14],
      ]} />)}
    {Array.from({ length: 9 }, (_, i) => {
      const phase = -Math.PI * 0.9 + i * Math.PI * 0.22;
      return <Curve key={i} color={i % 2 ? '#392833' : '#513742'}
        radius={0.09} points={[
          [0.39 * Math.sin(phase), 4.92, -0.25 + Math.cos(phase) * 0.29],
          [0.49 * Math.sin(phase + 0.18), 4.40, -0.26 + Math.cos(phase) * 0.32],
          [0.55 * Math.sin(phase - 0.20), 3.93, -0.26 + Math.cos(phase) * 0.3],
          [0.63 * Math.sin(phase + 0.15), 3.50, -0.26 + Math.cos(phase) * 0.29],
        ]} />;
    })}
    <group position={[0, 5.18, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.43, 0.027, 8, 48, Math.PI * 1.05]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.23} />
      </mesh>
      {[-2, -1, 0, 1, 2].map((n) => <group key={n} position={[n * 0.155, 0.00, 0.325 + (2 - Math.abs(n)) * 0.023]}>
        <Oval at={[0, 0.13 + (2 - Math.abs(n)) * 0.045, 0]}
          scale={[0.047, 0.115 + (2 - Math.abs(n)) * 0.034, 0.03]}
          color={GOLD} metalness={0.85} />
        <Pearl at={[0, 0.26 + (2 - Math.abs(n)) * 0.085, 0.015]} radius={n ? 0.042 : 0.064} color={n ? CREAM : '#f2a7c6'} />
      </group>)}
    </group>
  </group>;
}

function SleevesAndArms({ wave }: { wave: React.RefObject<THREE.Group> }) {
  return <>
    <group position={[-0.61, 3.46, 0]}>
      <Oval at={[0, 0, 0]} scale={[0.31, 0.33, 0.31]} color="#f8e7dd" />
      <Oval at={[-0.09, -0.19, 0.05]} scale={[0.17, 0.21, 0.17]} color="#f6e8d8" />
      <mesh position={[-0.16, -0.53, 0.04]} rotation={[0, 0, -0.22]}>
        <cylinderGeometry args={[0.13, 0.095, 0.62, 16]} />
        <meshStandardMaterial color="#f6d9c7" roughness={0.71} />
      </mesh>
      <Oval at={[-0.24, -0.87, 0.08]} scale={[0.11, 0.17, 0.10]} color="#f1c9b3" />
    </group>
    <group ref={wave} position={[0.61, 3.46, 0]}>
      <Oval at={[0, 0, 0]} scale={[0.31, 0.33, 0.31]} color="#f8e7dd" />
      <Oval at={[0.09, -0.19, 0.05]} scale={[0.17, 0.21, 0.17]} color="#f6e8d8" />
      <mesh position={[0.16, -0.53, 0.04]} rotation={[0, 0, 0.22]}>
        <cylinderGeometry args={[0.13, 0.095, 0.62, 16]} />
        <meshStandardMaterial color="#f6d9c7" roughness={0.71} />
      </mesh>
      <Oval at={[0.24, -0.87, 0.08]} scale={[0.11, 0.17, 0.10]} color="#f1c9b3" />
    </group>
  </>;
}

function DressAndBody({ wave }: { wave: React.RefObject<THREE.Group> }) {
  return <group>
    <Oval at={[-0.27, 0.18, 0.17]} scale={[0.19, 0.15, 0.36]} color="#e6c5ae" />
    <Oval at={[0.27, 0.18, 0.17]} scale={[0.19, 0.15, 0.36]} color="#e6c5ae" />
    <Skirt />
    <mesh position={[0, 3.06, 0]}>
      <cylinderGeometry args={[0.35, 0.29, 0.87, 32]} />
      <meshPhysicalMaterial color="#f8e7d9" roughness={0.49} clearcoat={0.15} />
    </mesh>
    <Oval at={[0, 3.60, 0.03]} scale={[0.51, 0.20, 0.29]} color="#f6e2d6" />
    <Oval at={[0, 3.68, 0.08]} scale={[0.21, 0.14, 0.16]} color="#f2d1bf" />
    <Oval at={[0, 3.54, 0.265]} scale={[0.20, 0.29, 0.07]} color="#e6b2bb" />
    <Curve metal radius={0.020} color={GOLD} points={[
      [-0.30, 3.38, 0.25], [-0.16, 3.21, 0.30], [0, 3.14, 0.31],
      [0.16, 3.21, 0.30], [0.30, 3.38, 0.25],
    ]} />
    <mesh position={[0, 2.77, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.33, 0.034, 8, 48]} />
      <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.25} />
    </mesh>
    <Oval at={[0, 2.75, 0.33]} scale={[0.17, 0.10, 0.07]} color={ROSE} />
    <Pearl at={[0, 2.75, 0.40]} radius={0.064} color="#fff4dc" />
    <SleevesAndArms wave={wave} />
    <group position={[0, 3.00, -0.35]}>
      <Oval at={[-0.24, 0, 0]} scale={[0.28, 0.17, 0.09]} color="#b66982" />
      <Oval at={[0.24, 0, 0]} scale={[0.28, 0.17, 0.09]} color="#b66982" />
      <Pearl at={[0, 0, -0.02]} radius={0.091} color={GOLD} />
    </group>
    <Pearl at={[0, 3.63, 0.27]} radius={0.066} color="#dfb37c" />
  </group>;
}

/** A real 3D mesh, with a hand wave and a soft acknowledgement on tap. */
export default function FairytalePrincess({
  active, paused, reducedMotion,
}: { active: boolean; paused: boolean; reducedMotion: boolean }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const lastTap = useRef(-10);
  const clock = useRef(0);
  const { invalidate, gl } = useThree();

  useFrame((_, delta) => {
    if (!body.current || !active || paused) return;
    if (reducedMotion) {
      body.current.rotation.y = -0.22;
      body.current.position.y = 0;
      if (head.current) head.current.rotation.y = 0;
      if (rightArm.current) rightArm.current.rotation.z = 0;
      return;
    }
    clock.current += Math.min(Math.max(delta, 0), 0.05);
    const t = clock.current;
    body.current.rotation.y = -0.22 + Math.sin(t * 0.27) * 0.09;
    body.current.position.y = 0.018 * Math.sin(t * 0.76);
    if (head.current) head.current.rotation.y = Math.sin(t * 0.43) * 0.055;
    if (rightArm.current) {
      const afterTap = t - lastTap.current;
      rightArm.current.rotation.z = afterTap >= 0 && afterTap < 2.15
        ? -0.34 - 0.37 * Math.sin(afterTap * Math.PI / 2.15) * Math.sin(afterTap * 13)
        : 0;
    }
  });

  useEffect(() => () => { gl.domElement.style.cursor = ''; }, [gl]);

  return <group position={[PRINCESS_X, PRINCESS_Y, PRINCESS_Z]}
    onClick={event => {
      event.stopPropagation();
      lastTap.current = clock.current;
      invalidate();
    }}
    onPointerOver={event => {
      event.stopPropagation();
      gl.domElement.style.cursor = 'pointer';
    }}
    onPointerOut={() => { gl.domElement.style.cursor = ''; }}
  >
    <group ref={body} rotation={[0, -0.22, 0]}>
      <DressAndBody wave={rightArm} />
      <group ref={head}>
        <Face />
        <HairAndTiara />
      </group>
    </group>
  </group>;
}
