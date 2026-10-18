"use client";

import { Html, Line, OrbitControls, QuadraticBezierLine, RoundedBox, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SEVERITY_META } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import type { Transfer } from "@/domain/redistribution";
import type { Severity } from "@/domain/risk";

export interface NetworkProps {
  facilities: AssessedFacility[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  animate: boolean;
  /** Localised status labels; Canvas children render outside the app's React context. */
  labels: Record<Severity, string>;
  transfers?: Transfer[];
}

export const MAP_BACKGROUND = "#0b231d";
const OVERVIEW_CAMERA = new THREE.Vector3(0, 40, 34);

function stemHeight(item: AssessedFacility): number {
  return 0.6 + Math.min(3, (item.assessment.footfallToday ?? 0) / 80);
}

function FacilityNode({
  item,
  selected,
  dimmed,
  onSelect,
  animate,
  labels,
}: {
  labels: Record<Severity, string>;
  item: AssessedFacility;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  animate: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const head = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseMaterial = useRef<THREE.MeshBasicMaterial>(null);

  const { facility, assessment } = item;
  const color = SEVERITY_META[assessment.status].hex;
  const isChc = facility.type === "CHC";
  const size = isChc ? 1.6 : 0.8;
  const height = stemHeight(item);
  const scaleGoal = selected ? 1.25 : hovered ? 1.12 : 1;
  const opacity = dimmed ? 0.3 : 1;

  useFrame((state, delta) => {
    if (head.current) {
      const k = animate ? 1 - Math.exp(-delta * 10) : 1;
      head.current.scale.setScalar(THREE.MathUtils.lerp(head.current.scale.x, scaleGoal, k));
    }
    if (pulse.current && pulseMaterial.current && animate) {
      const t = (state.clock.elapsedTime % 2.4) / 2.4;
      pulse.current.scale.setScalar(1 + t * 1.8);
      pulseMaterial.current.opacity = 0.35 * (1 - t);
    }
  });

  const handlers = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
    },
    onPointerOut: () => setHovered(false),
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(facility.id);
    },
  };

  return (
    <group position={[facility.position.x, 0, facility.position.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[size * 1.15, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.22 * opacity} />
      </mesh>
      {assessment.status === "critical" && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[size * 1.15, size * 1.3, 64]} />
          <meshBasicMaterial ref={pulseMaterial} color={color} transparent opacity={animate ? 0 : 0.3} />
        </mesh>
      )}
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.04, 0.04, height, 8]} />
        <meshBasicMaterial color="#5c8f7f" transparent opacity={0.7 * opacity} />
      </mesh>
      <group ref={head} position-y={height + size / 2}>
        {isChc ? (
          <RoundedBox args={[size, size, size]} radius={0.22} smoothness={4} castShadow {...handlers}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.28} roughness={0.45} transparent opacity={opacity} />
          </RoundedBox>
        ) : (
          <mesh castShadow {...handlers}>
            <sphereGeometry args={[size, 32, 32]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.28} roughness={0.45} transparent opacity={opacity} />
          </mesh>
        )}
      </group>
      {(hovered || selected) && (
        <Html position={[0, height + size + 0.9, 0]} center className="pointer-events-none select-none">
          <div className="rounded-xl border border-line bg-surface px-3 py-2 text-center whitespace-nowrap shadow-[0_8px_24px_-8px_rgb(19_33_28/0.25)]">
            <p className="text-sm font-medium text-ink">{facility.name}</p>
            <p className={`text-xs ${SEVERITY_META[assessment.status].ink}`}>{labels[assessment.status]}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function Links({ facilities, selectedId }: { facilities: AssessedFacility[]; selectedId: string | null }) {
  const edges = useMemo(() => {
    const byId = new Map(facilities.map((f) => [f.facility.id, f.facility]));
    const seen = new Set<string>();
    const out: { key: string; from: [number, number, number]; to: [number, number, number]; ids: [string, string] }[] = [];
    for (const { facility } of facilities) {
      for (const linkId of facility.links) {
        const other = byId.get(linkId);
        const key = [facility.id, linkId].sort().join("|");
        if (!other || seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          ids: [facility.id, linkId],
          from: [facility.position.x, 0.03, facility.position.z],
          to: [other.position.x, 0.03, other.position.z],
        });
      }
    }
    return out;
  }, [facilities]);

  return (
    <>
      {edges.map((e) => {
        const active = selectedId !== null && e.ids.includes(selectedId);
        return <Line key={e.key} points={[e.from, e.to]} color={active ? "#9fe8c2" : "#2c5a4c"} lineWidth={active ? 2.5 : 1.2} />;
      })}
    </>
  );
}

const DOT_SPACING = 1.15;

/** Stylised district outline. Not geographic; gives the network a sense of place. */
function insideDistrict(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  return r < 25 + 2.6 * Math.sin(3 * a + 0.6) + 1.8 * Math.cos(5 * a + 1.3) + 1.2 * Math.sin(7 * a);
}

/** Dotted ground in the district shape; dots near a centre glow in that centre's status colour. */
function DotGround({ facilities }: { facilities: AssessedFacility[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    const out: { x: number; z: number; color: THREE.Color }[] = [];
    const base = new THREE.Color("#2f6b59");
    for (let x = -30; x <= 30; x += DOT_SPACING) {
      for (let z = -30; z <= 30; z += DOT_SPACING) {
        if (!insideDistrict(x, z)) continue;
        let color = base.clone();
        let best = Infinity;
        for (const { facility, assessment } of facilities) {
          const d = Math.hypot(facility.position.x - x, facility.position.z - z);
          if (d < best && d < 4.5) {
            best = d;
            color = base.clone().lerp(new THREE.Color(SEVERITY_META[assessment.status].hex), 0.75 * (1 - d / 4.5));
          }
        }
        out.push({ x, z, color });
      }
    }
    return out;
  }, [facilities]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const scale = new THREE.Vector3(1, 1, 1);
    points.forEach((p, i) => {
      matrix.compose(new THREE.Vector3(p.x, 0, p.z), rotation, scale);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, p.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points]);

  return (
    <instancedMesh key={points.length} ref={mesh} args={[undefined, undefined, points.length]} raycast={() => null}>
      <circleGeometry args={[0.17, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

function CameraRig({ focus, animate }: { focus: { x: number; z: number } | null; animate: boolean }) {
  const goal = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const settledFor = useRef<string | null>(null);
  const key = focus ? `${focus.x},${focus.z}` : "overview";

  useFrame((state, delta) => {
    const controls = state.controls as unknown as ControlsLike | null;
    if (!controls || settledFor.current === key) return;
    if (focus) {
      lookAt.set(focus.x, 1, focus.z);
      goal.set(focus.x * 1.1 + 5, 13, focus.z * 1.1 + 15);
    } else {
      lookAt.set(0, 0, 0);
      goal.copy(OVERVIEW_CAMERA);
    }
    const k = animate ? 1 - Math.exp(-delta * 3) : 1;
    controls.target.lerp(lookAt, k);
    state.camera.position.lerp(goal, k);
    controls.update();
    if (state.camera.position.distanceToSquared(goal) < 0.01) settledFor.current = key;
  });
  return null;
}

function TransferArcs({ facilities, transfers }: { facilities: AssessedFacility[]; transfers: Transfer[] }) {
  const byId = new Map(facilities.map((f) => [f.facility.id, f.facility.position]));
  return (
    <>
      {transfers
        .filter((t) => t.status === "approved" || t.status === "dispatched")
        .map((t) => {
          const a = byId.get(t.fromFacilityId);
          const b = byId.get(t.toFacilityId);
          if (!a || !b) return null;
          const inTransit = t.status === "dispatched";
          // Planned moves are dashed; only dispatched ones are drawn solid. Neither implies arrival.
          return (
            <QuadraticBezierLine
              key={t.id}
              start={[a.x, 0.2, a.z]}
              end={[b.x, 0.2, b.z]}
              mid={[(a.x + b.x) / 2, 5, (a.z + b.z) / 2]}
              color={inTransit ? "#9fe8c2" : "#f0ad32"}
              lineWidth={3}
              dashed={!inTransit}
              dashSize={0.6}
              gapSize={0.4}
            />
          );
        })}
    </>
  );
}

export function DistrictNetwork({ facilities, selectedId, onSelect, animate, labels, transfers = [] }: NetworkProps) {
  const selected = facilities.find((f) => f.facility.id === selectedId) ?? null;
  const related = useMemo(() => {
    if (!selected) return null;
    const ids = new Set([selected.facility.id, ...selected.facility.links]);
    for (const f of facilities) if (f.facility.links.includes(selected.facility.id)) ids.add(f.facility.id);
    return ids;
  }, [facilities, selected]);

  return (
    <Canvas
      camera={{ position: OVERVIEW_CAMERA.toArray(), fov: 38, near: 0.5, far: 200 }}
      dpr={[1, 1.75]}
      frameloop={animate ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[MAP_BACKGROUND]} />
      <fog attach="fog" args={[MAP_BACKGROUND, 55, 110]} />
      <hemisphereLight args={["#d8f5e8", "#0b231d", 1.3]} />
      <directionalLight position={[8, 20, 6]} intensity={1.6} />
      <DotGround facilities={facilities} />
      <Links facilities={facilities} selectedId={selectedId} />
      <TransferArcs facilities={facilities} transfers={transfers} />
      {facilities.map((item) => (
        <FacilityNode
          key={item.facility.id}
          item={item}
          selected={item.facility.id === selectedId}
          dimmed={related !== null && !related.has(item.facility.id)}
          onSelect={onSelect}
          animate={animate}
          labels={labels}
        />
      ))}
      <CameraRig focus={selected ? selected.facility.position : null} animate={animate} />
      <OrbitControls makeDefault enablePan={false} minDistance={10} maxDistance={75} maxPolarAngle={Math.PI / 2.4} enableDamping={animate} />
    </Canvas>
  );
}
