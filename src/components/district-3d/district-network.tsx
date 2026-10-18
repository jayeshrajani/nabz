"use client";

import { Html, Line, OrbitControls, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SEVERITY_META } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";

export interface NetworkProps {
  facilities: AssessedFacility[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  animate: boolean;
}

const OVERVIEW_CAMERA = new THREE.Vector3(0, 30, 38);

function pillarHeight(item: AssessedFacility): number {
  return 0.8 + Math.min(4, (item.assessment.footfallToday ?? 0) / 60);
}

function FacilityNode({
  item,
  selected,
  dimmed,
  onSelect,
  animate,
}: {
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
  const radius = isChc ? 0.75 : 0.45;
  const height = pillarHeight(item);
  const scaleGoal = selected ? 1.35 : hovered ? 1.15 : 1;

  useFrame((state, delta) => {
    if (head.current) {
      const k = animate ? 1 - Math.exp(-delta * 10) : 1;
      const s = THREE.MathUtils.lerp(head.current.scale.x, scaleGoal, k);
      head.current.scale.setScalar(s);
      if (animate) head.current.position.y = height + Math.sin(state.clock.elapsedTime * 1.2 + facility.position.x) * 0.08;
    }
    if (pulse.current && pulseMaterial.current && animate && assessment.status === "critical") {
      const t = (state.clock.elapsedTime % 1.8) / 1.8;
      pulse.current.scale.setScalar(1 + t * 2.2);
      pulseMaterial.current.opacity = 0.45 * (1 - t);
    }
  });

  const opacity = dimmed ? 0.25 : 1;

  return (
    <group position={[facility.position.x, 0, facility.position.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[radius * 1.4, radius * 1.6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6 * opacity} />
      </mesh>
      {assessment.status === "critical" && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[radius * 1.5, radius * 1.7, 48]} />
          <meshBasicMaterial ref={pulseMaterial} color={color} transparent opacity={animate ? 0 : 0.35} />
        </mesh>
      )}
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.03, 0.03, height, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.35 * opacity} />
      </mesh>
      <group ref={head} position-y={height}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(facility.id);
          }}
        >
          {isChc ? <octahedronGeometry args={[radius, 0]} /> : <sphereGeometry args={[radius, 24, 24]} />}
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 1.4 : hovered ? 1 : 0.6}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={opacity}
          />
        </mesh>
      </group>
      {(hovered || selected) && (
        <Html position={[0, height + radius + 0.8, 0]} center className="pointer-events-none select-none">
          <div className="rounded-md border border-line-strong bg-ink-900/95 px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg">
            <p className="text-xs font-medium text-fg">{facility.name}</p>
            <p className="text-[10px] tracking-wide text-fg-muted uppercase">
              {facility.type} · {SEVERITY_META[assessment.status].label}
            </p>
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
          from: [facility.position.x, 0.05, facility.position.z],
          to: [other.position.x, 0.05, other.position.z],
        });
      }
    }
    return out;
  }, [facilities]);

  return (
    <>
      {edges.map((e) => {
        const active = selectedId !== null && e.ids.includes(selectedId);
        return (
          <Line
            key={e.key}
            points={[e.from, e.to]}
            color={active ? "#4fd7e8" : "#2c3b52"}
            lineWidth={active ? 2 : 1}
            transparent
            opacity={active ? 0.95 : 0.6}
            dashed={!active}
            dashSize={0.4}
            gapSize={0.3}
          />
        );
      })}
    </>
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
      goal.set(focus.x * 1.15 + 6, 14, focus.z * 1.15 + 16);
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

export function DistrictNetwork({ facilities, selectedId, onSelect, animate }: NetworkProps) {
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
      <color attach="background" args={["#05080d"]} />
      <fog attach="fog" args={["#05080d", 40, 95]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 20, 10]} intensity={0.6} />
      <gridHelper args={[80, 40, "#162131", "#0d1520"]} position-y={-0.01} />
      <Links facilities={facilities} selectedId={selectedId} />
      {facilities.map((item) => (
        <FacilityNode
          key={item.facility.id}
          item={item}
          selected={item.facility.id === selectedId}
          dimmed={related !== null && !related.has(item.facility.id)}
          onSelect={onSelect}
          animate={animate}
        />
      ))}
      <CameraRig focus={selected ? selected.facility.position : null} animate={animate} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={10}
        maxDistance={70}
        maxPolarAngle={Math.PI / 2.3}
        enableDamping={animate}
      />
    </Canvas>
  );
}
