"use client";

import { ContactShadows, Html, Line, OrbitControls, RoundedBox, useCursor } from "@react-three/drei";
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

const BACKGROUND = "#f4f7f2";
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
        <meshBasicMaterial color={color} transparent opacity={0.16 * opacity} />
      </mesh>
      {assessment.status === "critical" && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[size * 1.15, size * 1.3, 64]} />
          <meshBasicMaterial ref={pulseMaterial} color={color} transparent opacity={animate ? 0 : 0.3} />
        </mesh>
      )}
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.04, 0.04, height, 8]} />
        <meshStandardMaterial color="#b9c7c1" transparent opacity={opacity} />
      </mesh>
      <group ref={head} position-y={height + size / 2}>
        {isChc ? (
          <RoundedBox args={[size, size, size]} radius={0.22} smoothness={4} castShadow {...handlers}>
            <meshStandardMaterial color={color} roughness={0.5} transparent opacity={opacity} />
          </RoundedBox>
        ) : (
          <mesh castShadow {...handlers}>
            <sphereGeometry args={[size, 32, 32]} />
            <meshStandardMaterial color={color} roughness={0.5} transparent opacity={opacity} />
          </mesh>
        )}
      </group>
      {(hovered || selected) && (
        <Html position={[0, height + size + 0.9, 0]} center className="pointer-events-none select-none">
          <div className="rounded-xl border border-line bg-surface px-3 py-2 text-center whitespace-nowrap shadow-[0_8px_24px_-8px_rgb(19_33_28/0.25)]">
            <p className="text-sm font-medium text-ink">{facility.name}</p>
            <p className={`text-xs ${SEVERITY_META[assessment.status].ink}`}>{SEVERITY_META[assessment.status].label}</p>
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
        return <Line key={e.key} points={[e.from, e.to]} color={active ? "#0e7c66" : "#c5d2cd"} lineWidth={active ? 2.5 : 1.5} />;
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
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 60, 120]} />
      <hemisphereLight args={["#ffffff", "#dfe8e4", 1.6]} />
      <directionalLight position={[8, 20, 6]} intensity={1.4} />
      <ContactShadows position={[0, 0, 0]} scale={70} opacity={0.28} blur={2.4} far={8} frames={1} color="#2c4a40" />
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
      <OrbitControls makeDefault enablePan={false} minDistance={10} maxDistance={75} maxPolarAngle={Math.PI / 2.4} enableDamping={animate} />
    </Canvas>
  );
}
