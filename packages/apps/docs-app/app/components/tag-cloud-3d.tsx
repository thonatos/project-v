import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useNavigate } from 'react-router';
import * as THREE from 'three';
import type { TagInfo } from '~/lib/docs';

interface TagCloud3DProps {
  tags: TagInfo[];
}

interface PlacedTag extends TagInfo {
  position: THREE.Vector3;
  size: number;
  color: THREE.Color;
}

const RADIUS = 4.2;
// 横向椭球分轴系数：X 拉宽、Y 压扁，使标签群整体呈横向长方形而非正方形
const AXIS = { x: 1.55, y: 0.82, z: 1.1 };
const PALETTE = ['#8b6dff', '#d946ef', '#22d3ee', '#34d399', '#fbbf24', '#fb7185'];

// Fibonacci 球面分布：将 n 个点均匀铺在球面上（按 AXIS 拉成椭球）
function fibonacciSphere(index: number, total: number, radius: number): THREE.Vector3 {
  const offset = 2 / total;
  const increment = Math.PI * (3 - Math.sqrt(5)); // 黄金角
  const y = index * offset - 1 + offset / 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = index * increment;
  return new THREE.Vector3(
    Math.cos(phi) * r * radius * AXIS.x,
    y * radius * AXIS.y,
    Math.sin(phi) * r * radius * AXIS.z,
  );
}

function usePlacedTags(tags: TagInfo[]): PlacedTag[] {
  return useMemo(() => {
    const max = tags.reduce((m, t) => Math.max(m, t.count), 0);
    return tags.map((tag, i) => {
      const ratio = max > 0 ? tag.count / max : 0;
      return {
        ...tag,
        position: fibonacciSphere(i, tags.length, RADIUS),
        size: 0.28 + ratio * 0.5, // 0.28 ~ 0.78
        color: new THREE.Color(PALETTE[i % PALETTE.length]),
      };
    });
  }, [tags]);
}

function TagLabel({ tag, onNavigate }: { tag: PlacedTag; onNavigate: (name: string) => void }) {
  const [hovered, setHovered] = useState(false);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHovered(false);
    document.body.style.cursor = '';
  };

  return (
    <Billboard position={tag.position}>
      <Text
        fontSize={tag.size}
        color={hovered ? '#ffffff' : `#${tag.color.getHexString()}`}
        anchorX="center"
        anchorY="middle"
        outlineWidth={hovered ? 0.02 : 0}
        outlineColor="#ffffff"
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(tag.name);
        }}
      >
        {tag.name}
      </Text>
    </Billboard>
  );
}

// 旋转组：自动慢转 + 拖拽惯性
function RotatingCloud({ tags, onNavigate }: { tags: PlacedTag[]; onNavigate: (name: string) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const velocity = useRef({ x: 0, y: 0.0016 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (!dragging.current) {
      // 惯性衰减，回归基础自转
      velocity.current.x *= 0.95;
      velocity.current.y = velocity.current.y * 0.95 + 0.0016 * 0.05;
    }
    g.rotation.y += velocity.current.y;
    g.rotation.x += velocity.current.x;
    g.rotation.x = Math.max(-0.6, Math.min(0.6, g.rotation.x));
  });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: dy * 0.0008, y: dx * 0.0008 };
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <>
      {/* 透明拾取椭球，承载拖拽（随 AXIS 拉伸以覆盖横向椭球范围） */}
      <mesh
        scale={[AXIS.x, AXIS.y, AXIS.z]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <sphereGeometry args={[RADIUS + 1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={groupRef}>
        {tags.map((tag) => (
          <TagLabel key={tag.name} tag={tag} onNavigate={onNavigate} />
        ))}
      </group>
    </>
  );
}

export default function TagCloud3D({ tags }: TagCloud3DProps) {
  const placed = usePlacedTags(tags);
  const navigate = useNavigate();

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <RotatingCloud tags={placed} onNavigate={(name) => navigate(`/tags/${name}`)} />
      </Suspense>
      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
