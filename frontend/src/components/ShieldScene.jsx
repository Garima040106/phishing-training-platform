import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PointMaterial, Points } from "@react-three/drei";

const seededRandom = (seed) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

function ShieldCore() {
  const meshRef = useRef(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.16;
    meshRef.current.rotation.y += delta * 0.2;
  });

  return (
    <mesh ref={meshRef} scale={1.45}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#6c63ff"
        wireframe
        emissive="#6c63ff"
        emissiveIntensity={0.55}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

function FloatingDots() {
  const pointsRef = useRef(null);
  const positions = useMemo(() => {
    const count = 260;
    const data = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      data[i3] = (seededRandom(i + 1) - 0.5) * 8.5;
      data[i3 + 1] = (seededRandom(i + 401) - 0.5) * 6.5;
      data[i3 + 2] = (seededRandom(i + 997) - 0.5) * 7;
    }

    return data;
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.022;
    pointsRef.current.rotation.x += delta * 0.008;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color="#8e87ff"
        size={0.02}
        sizeAttenuation
        depthWrite={false}
      />
    </Points>
  );
}

export default function ShieldScene() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#090910]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(108,99,255,0.22),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(108,99,255,0.08),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35" />

      <Canvas className="!h-full !w-full" camera={{ position: [0, 0, 4.4], fov: 52 }} dpr={[1, 1.8]}>
        <ambientLight intensity={0.55} />
        <pointLight position={[2.5, 2, 3]} intensity={1.2} color="#6c63ff" />
        <pointLight position={[-2, -1.8, 2]} intensity={0.45} color="#7a74ff" />

        <ShieldCore />
        <FloatingDots />

        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  );
}