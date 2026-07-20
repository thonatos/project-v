import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { GraphData } from '~/lib/docs';

interface KnowledgeGraph3DProps {
  data: GraphData;
  /** 归一化滚动进度 0..1，用于相机穿行 */
  scrollProgress: React.RefObject<number>;
}

const GROUP_COLORS: Record<string, string> = {
  Blog: '#d946ef',
};
const FALLBACK_PALETTE = ['#8b6dff', '#22d3ee', '#fbbf24', '#34d399', '#fb7185', '#818cf8'];

function colorForGroup(group: string | undefined, groupIndex: Map<string, number>): THREE.Color {
  if (group && GROUP_COLORS[group]) return new THREE.Color(GROUP_COLORS[group]);
  const idx = group ? (groupIndex.get(group) ?? 0) : 0;
  return new THREE.Color(FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length]);
}

// 用节点 id 做确定性伪随机，保证 SSR/CSR 布局稳定
function hashUnit(s: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return (h % 1000) / 1000;
}

function buildLayout(data: GraphData) {
  const groups = Array.from(new Set(data.nodes.map((n) => n.group).filter(Boolean))) as string[];
  const groupIndex = new Map(groups.map((g, i) => [g, i]));
  const pos = new Map<string, THREE.Vector3>();
  const R = 9;

  for (const node of data.nodes) {
    // 球面分布 + 分组偏移：doc 靠外壳，tag 靠内核
    const u = hashUnit(node.id, 1);
    const v = hashUnit(node.id, 7);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = node.kind === 'tag' ? R * 0.5 : R;
    pos.set(
      node.id,
      new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)),
    );
  }
  return { pos, groupIndex };
}

function GraphScene({ data, scrollProgress }: KnowledgeGraph3DProps) {
  const { pos, groupIndex } = useMemo(() => buildLayout(data), [data]);
  const rootRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const { docGeom, tagGeom, lineGeom } = useMemo(() => {
    const docPts: number[] = [];
    const docCols: number[] = [];
    const tagPts: number[] = [];
    const linePts: number[] = [];

    for (const node of data.nodes) {
      const p = pos.get(node.id)!;
      if (node.kind === 'doc') {
        docPts.push(p.x, p.y, p.z);
        const c = colorForGroup(node.group, groupIndex);
        docCols.push(c.r, c.g, c.b);
      } else {
        tagPts.push(p.x, p.y, p.z);
      }
    }
    for (const e of data.edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (a && b) linePts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }

    const docGeom = new THREE.BufferGeometry();
    docGeom.setAttribute('position', new THREE.Float32BufferAttribute(docPts, 3));
    docGeom.setAttribute('color', new THREE.Float32BufferAttribute(docCols, 3));
    const tagGeom = new THREE.BufferGeometry();
    tagGeom.setAttribute('position', new THREE.Float32BufferAttribute(tagPts, 3));
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));

    return { docGeom, tagGeom, lineGeom };
  }, [data, pos, groupIndex]);

  useFrame((_, delta) => {
    const g = rootRef.current;
    if (g) g.rotation.y += delta * 0.04;
    // 相机随滚动推进：z 由远及近
    const p = scrollProgress.current ?? 0;
    const targetZ = 26 - p * 14;
    camera.position.z += (targetZ - camera.position.z) * 0.06;
    camera.position.y += (p * 4 - camera.position.y) * 0.06;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={rootRef}>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#8b6dff" transparent opacity={0.12} />
      </lineSegments>
      <points geometry={docGeom}>
        <pointsMaterial size={0.28} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>
      <points geometry={tagGeom}>
        <pointsMaterial size={0.16} color="#e7e7ea" sizeAttenuation transparent opacity={0.7} />
      </points>
    </group>
  );
}

export default function KnowledgeGraph3D({ data, scrollProgress }: KnowledgeGraph3DProps) {
  return (
    <Canvas camera={{ position: [0, 0, 26], fov: 55 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1} />
      <GraphScene data={data} scrollProgress={scrollProgress} />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
