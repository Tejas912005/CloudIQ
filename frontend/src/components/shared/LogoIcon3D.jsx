import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

function LogoCube({ isHovered }) {
  const meshRef = useRef();
  const rotationRef = useRef(0);
  const isRotatingRef = useRef(false);
  const wasHoveredRef = useRef(false);

  useFrame(() => {
    if (!meshRef.current) return;

    if (isHovered && !wasHoveredRef.current && !isRotatingRef.current) {
      isRotatingRef.current = true;
      rotationRef.current = 0;
    }
    wasHoveredRef.current = isHovered;

    if (isRotatingRef.current) {
      rotationRef.current += 0.06;
      meshRef.current.rotation.y = rotationRef.current;

      if (rotationRef.current >= Math.PI * 2) {
        rotationRef.current = 0;
        meshRef.current.rotation.y = 0;
        isRotatingRef.current = false;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshStandardMaterial
        color="#7c3aed"
        emissive="#4c1d95"
        emissiveIntensity={0.4}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
}

export default function LogoIcon3D({ size = 36 }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ width: size, height: size, cursor: 'pointer', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 40 }}
        style={{ background: 'transparent', borderRadius: '10px' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} intensity={1.2} color="#a78bfa" />
        <directionalLight position={[-2, -1, -1]} intensity={0.4} color="#22d3ee" />
        <LogoCube isHovered={hovered} />
      </Canvas>
    </div>
  );
}
