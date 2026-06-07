import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function generateSpherePoints(count, radius) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  return positions;
}

function CoreSphere({ state }) {
  const pointsRef = useRef();
  const positions = useMemo(() => generateSpherePoints(1200, 1.2), []);

  const config = {
    idle: { speed: 0.004, pulse: 0.3, size: 0.014, color: '#22d3ee' },
    thinking: { speed: 0.022, pulse: 1.2, size: 0.018, color: '#a78bfa' },
    anomaly: { speed: 0.012, pulse: 0.8, size: 0.016, color: '#fbbf24' },
  };
  const cfg = config[state] || config.idle;
  const materialColor = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();

    pointsRef.current.rotation.y += cfg.speed;
    pointsRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;

    const scale = 1 + Math.sin(t * cfg.pulse) * 0.06;
    pointsRef.current.scale.setScalar(scale);
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={materialColor}
        size={cfg.size}
        sizeAttenuation
        depthWrite={false}
        opacity={0.85}
      />
    </Points>
  );
}

function OuterRing({ state }) {
  const ringRef = useRef();
  const colors = { idle: '#22d3ee', thinking: '#a78bfa', anomaly: '#f87171' };

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z -= 0.008;
    ringRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.4) * 0.2;
  });

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[1.55, 0.008, 8, 120]} />
      <meshBasicMaterial
        color={colors[state] || colors.idle}
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

function InnerRing({ state }) {
  const ringRef = useRef();
  const colors = { idle: '#6366f1', thinking: '#22d3ee', anomaly: '#fbbf24' };

  useFrame(() => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y += 0.012;
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[1.3, 0.005, 8, 100]} />
      <meshBasicMaterial
        color={colors[state] || colors.idle}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
}

export default function AICore({ state = 'idle', size = 180 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '20%',
          borderRadius: '50%',
          background: state === 'idle'
            ? 'radial-gradient(circle, rgba(34,211,238,0.15), transparent 70%)'
            : state === 'thinking'
              ? 'radial-gradient(circle, rgba(167,139,250,0.20), transparent 70%)'
              : 'radial-gradient(circle, rgba(251,191,36,0.15), transparent 70%)',
          transition: 'background 1s ease',
          animation: 'glowPulse 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.2} />
        <CoreSphere state={state} />
        <OuterRing state={state} />
        <InnerRing state={state} />
      </Canvas>
    </div>
  );
}
