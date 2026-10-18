"use client";

import { Line, OrbitControls, RoundedBox, useCursor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
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

const MAP_BACKGROUND = "#0b231d";
const CITRON = "#d8e995";
const CYAN = "#8ddcce";
type Point = [number, number, number];

function towerHeight(item: AssessedFacility): number {
  return 1.25 + Math.min(3.8, Math.max(0, item.assessment.footfallToday ?? 0) / 75);
}

function districtBounds(facilities: AssessedFacility[]): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const { facility } of facilities) {
    bounds.expandByPoint(new THREE.Vector3(facility.position.x - 3.5, -0.8, facility.position.z - 3.5));
    bounds.expandByPoint(new THREE.Vector3(facility.position.x + 3.5, 8, facility.position.z + 3.5));
  }
  return bounds.isEmpty() ? new THREE.Box3(new THREE.Vector3(-12, -1, -12), new THREE.Vector3(12, 8, 12)) : bounds;
}

function DistrictSurface({ bounds }: { bounds: THREE.Box3 }) {
  const { outline, shape, centre } = useMemo(() => {
    const centre = bounds.getCenter(new THREE.Vector3());
    const dimensions = bounds.getSize(new THREE.Vector3());
    const outline: Point[] = Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2;
      const relief = 1 + 0.055 * Math.sin(angle * 3 + 0.5) + 0.035 * Math.cos(angle * 5);
      return [Math.cos(angle) * dimensions.x * 0.72 * relief, 0, Math.sin(angle) * dimensions.z * 0.72 * relief];
    });
    const shape = new THREE.Shape(outline.map(([positionX, , positionZ]) => new THREE.Vector2(positionX, -positionZ)));
    return { outline, shape, centre };
  }, [bounds]);

  return (
    <group position={[centre.x, 0, centre.z]}>
      {[1.06, 1.025, 1].map((scale, index) => (
        <group key={scale} position-y={-0.65 + index * 0.23} scale={[scale, 1, scale]}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow raycast={() => null}>
            <extrudeGeometry
              args={[shape, { depth: 0.16, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.12, bevelThickness: 0.06, steps: 1 }]}
            />
            <meshStandardMaterial color={index === 2 ? "#164438" : "#102f28"} roughness={0.95} />
          </mesh>
          <Line
            points={outline.map(([positionX, , positionZ]): Point => [positionX, 0.24, positionZ])}
            color={index === 2 ? "#458571" : "#295b4c"}
            lineWidth={0.8}
          />
        </group>
      ))}
      {[0.92, 0.84].map((scale) => (
        <Line
          key={scale}
          points={outline.map(([positionX, , positionZ]): Point => [positionX * scale, 0.025, positionZ * scale])}
          color="#265c4c"
          lineWidth={0.65}
        />
      ))}
    </group>
  );
}

function FacadeWindows({ width, height, depth, highlighted }: { width: number; height: number; depth: number; highlighted: boolean }) {
  const instances = useRef<THREE.InstancedMesh>(null);
  const floors = Math.max(2, Math.floor(height / 0.48));
  const count = floors * 5;

  useLayoutEffect(() => {
    const windows = instances.current;
    if (!windows) return;
    const transform = new THREE.Object3D();
    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < 5; column += 1) {
        const side = column >= 3;
        transform.position.set(
          side ? width / 2 + 0.015 : ((column - 1) * width) / 4,
          -height / 2 + 0.3 + floor * ((height - 0.5) / floors),
          side ? ((column - 3.5) * depth) / 2 : depth / 2 + 0.015,
        );
        transform.rotation.y = side ? Math.PI / 2 : 0;
        transform.updateMatrix();
        windows.setMatrixAt(floor * 5 + column, transform.matrix);
      }
    }
    windows.instanceMatrix.needsUpdate = true;
    windows.computeBoundingSphere();
  }, [depth, floors, height, width]);

  return (
    <instancedMesh ref={instances} args={[undefined, undefined, count]} raycast={() => null}>
      <boxGeometry args={[0.19, 0.12, 0.025]} />
      <meshStandardMaterial
        color={highlighted ? CITRON : "#b4e4cd"}
        emissive={highlighted ? CITRON : "#72bca4"}
        emissiveIntensity={0.55}
        roughness={0.35}
      />
    </instancedMesh>
  );
}

function FacilityNode({
  item,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
  animate,
  index,
}: {
  item: AssessedFacility;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onSelect: NetworkProps["onSelect"];
  onHover: (id: string, over: boolean) => void;
  animate: boolean;
  index: number;
}) {
  useCursor(hovered);
  const building = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const { facility, assessment } = item;
  const highlighted = selected || hovered;
  const statusColor = SEVERITY_META[assessment.status].hex;
  const isHub = facility.type === "CHC";
  const height = towerHeight(item);
  const width = isHub ? 2.15 : 1.5;
  const depth = isHub ? 1.85 : 1.35;
  const footprintWidth = isHub ? 4.7 : 3.2;
  const footprintDepth = isHub ? 3.8 : 2.8;
  const border: Point[] = [
    [-footprintWidth / 2, 0.13, -footprintDepth / 2],
    [footprintWidth / 2, 0.13, -footprintDepth / 2],
    [footprintWidth / 2, 0.13, footprintDepth / 2],
    [-footprintWidth / 2, 0.13, footprintDepth / 2],
    [-footprintWidth / 2, 0.13, -footprintDepth / 2],
  ];

  useLayoutEffect(() => {
    if (building.current && !animate) {
      building.current.scale.set(1, 1, 1);
      building.current.position.y = 0;
      elapsed.current = 2;
    }
  }, [animate]);

  useFrame((_, delta) => {
    if (!building.current) return;
    elapsed.current += Math.min(delta, 0.05);
    const progress = animate ? THREE.MathUtils.clamp((elapsed.current - index * 0.045) / 0.85, 0, 1) : 1;
    const rise = 1 - Math.pow(1 - progress, 3);
    const scale = highlighted ? 1.045 : 1;
    const easing = animate ? 1 - Math.exp(-Math.min(delta, 0.05) * 12) : 1;
    const horizontalScale = THREE.MathUtils.lerp(building.current.scale.x, scale, easing);
    building.current.scale.set(horizontalScale, Math.max(0.001, rise), horizontalScale);
    building.current.position.y = highlighted ? 0.12 * rise : 0;
  });

  return (
    <group
      position={[facility.position.x, 0, facility.position.z]}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(facility.id, true);
      }}
      onPointerOut={() => onHover(facility.id, false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selected ? null : facility.id);
      }}
    >
      <RoundedBox args={[footprintWidth, 0.18, footprintDepth]} radius={0.09} smoothness={2} position-y={0.01} receiveShadow>
        <meshStandardMaterial color={highlighted ? "#355f4b" : "#1e4b3b"} roughness={0.9} />
      </RoundedBox>
      <Line
        points={border}
        color={highlighted ? CITRON : statusColor}
        lineWidth={highlighted ? 2 : 1}
        transparent
        opacity={dimmed ? 0.3 : 0.8}
      />
      <group ref={building} scale={[1, animate ? 0.001 : 1, 1]}>
        <RoundedBox
          args={[footprintWidth - 0.45, 0.6, footprintDepth - 0.45]}
          radius={0.09}
          smoothness={2}
          position-y={0.42}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={dimmed ? "#254d40" : "#467f69"} roughness={0.7} />
        </RoundedBox>
        <group position={[-(isHub ? 0.65 : 0.25), height / 2 + 0.72, -0.15]}>
          <RoundedBox args={[width, height, depth]} radius={0.09} smoothness={2} castShadow receiveShadow>
            <meshStandardMaterial color={dimmed ? "#386354" : highlighted ? "#b8d4bf" : "#83ad98"} roughness={0.56} metalness={0.12} />
          </RoundedBox>
          <FacadeWindows width={width} height={height} depth={depth} highlighted={highlighted} />
          <mesh position-y={height / 2 + 0.08}>
            <boxGeometry args={[width + 0.12, 0.16, depth + 0.12]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={highlighted ? 0.6 : 0.18} roughness={0.6} />
          </mesh>
          {[-0.28, 0.28].map((offset) => (
            <mesh key={offset} position={[offset, height / 2 + 0.175, 0]}>
              <boxGeometry args={[0.12, 0.025, 0.7]} />
              <meshBasicMaterial color={CITRON} />
            </mesh>
          ))}
          <mesh position-y={height / 2 + 0.175}>
            <boxGeometry args={[0.5, 0.025, 0.12]} />
            <meshBasicMaterial color={CITRON} />
          </mesh>
        </group>
        {isHub && (
          <RoundedBox
            args={[1.35, height * 0.55, 2.35]}
            radius={0.08}
            smoothness={2}
            position={[1.15, height * 0.275 + 0.72, 0.1]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={dimmed ? "#2a594b" : "#588f7b"} roughness={0.65} />
          </RoundedBox>
        )}
        <mesh position={[0, 0.8, footprintDepth / 2 - 0.18]}>
          <boxGeometry args={[isHub ? 1.3 : 0.95, 0.13, 0.75]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.2} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.4, footprintDepth / 2 - 0.21]}>
          <boxGeometry args={[0.44, 0.5, 0.06]} />
          <meshStandardMaterial color="#102e28" metalness={0.3} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function labelAnchor(item: AssessedFacility): THREE.Vector3 {
  return new THREE.Vector3(item.facility.position.x - 0.3, towerHeight(item) + 1.8, item.facility.position.z);
}

/** Positions DOM labels owned by the outer React tree; avoids drei Html's nested roots. */
function LabelProjector({ facilities, nodes }: { facilities: AssessedFacility[]; nodes: RefObject<Map<string, HTMLDivElement>> }) {
  const anchors = useMemo(() => facilities.map((item) => ({ id: item.facility.id, position: labelAnchor(item) })), [facilities]);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    for (const anchor of anchors) {
      const element = nodes.current.get(anchor.id);
      if (!element) continue;
      projected.copy(anchor.position).project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) <= 1.05 && Math.abs(projected.y) <= 1.05;
      element.style.visibility = onScreen ? "visible" : "hidden";
      element.style.transform = `translate3d(${((projected.x + 1) / 2) * size.width}px, ${((1 - projected.y) / 2) * size.height}px, 0) translate(-50%, -100%)`;
    }
  });

  return null;
}

function Links({ facilities, selectedId }: Pick<NetworkProps, "facilities" | "selectedId">) {
  const edges = useMemo(() => {
    const byId = new Map(facilities.map(({ facility }) => [facility.id, facility]));
    const seen = new Set<string>();
    return facilities.flatMap(({ facility }) =>
      facility.links.flatMap((linkId) => {
        const other = byId.get(linkId);
        const key = [facility.id, linkId].sort().join("|");
        if (!other || seen.has(key)) return [];
        seen.add(key);
        const points: Point[] = [
          [facility.position.x, 0.035, facility.position.z],
          [facility.position.x, 0.035, other.position.z],
          [other.position.x, 0.035, other.position.z],
        ];
        return [{ key, ids: [facility.id, linkId], points }];
      }),
    );
  }, [facilities]);

  return edges.map((edge) => {
    const highlighted = selectedId !== null && edge.ids.includes(selectedId);
    return (
      <group key={edge.key}>
        <Line points={edge.points} color="#0d2c25" lineWidth={highlighted ? 9 : 7} />
        <Line
          points={edge.points.map(([positionX, positionY, positionZ]): Point => [positionX, positionY + 0.005, positionZ])}
          color={highlighted ? CITRON : "#527c69"}
          lineWidth={highlighted ? 1.6 : 0.7}
          dashed={!highlighted}
          dashSize={0.4}
          gapSize={0.45}
        />
      </group>
    );
  });
}

function TransferRoute({ curve, dispatched, animate }: { curve: THREE.QuadraticBezierCurve3; dispatched: boolean; animate: boolean }) {
  const marker = useRef<THREE.Mesh>(null);
  const progress = useRef(0.12);
  const point = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const points = useMemo(() => curve.getPoints(48).map((position) => position.toArray() as Point), [curve]);

  useFrame((_, delta) => {
    if (!marker.current || !dispatched) return;
    if (animate) progress.current = (progress.current + Math.min(delta, 0.05) * 0.1) % 1;
    curve.getPoint(progress.current, point);
    curve.getTangent(progress.current, direction);
    marker.current.position.copy(point);
    marker.current.quaternion.setFromUnitVectors(up, direction.normalize());
  });

  return (
    <group>
      <Line
        points={points}
        color={dispatched ? CYAN : "#f0ad32"}
        lineWidth={dispatched ? 2.3 : 1.8}
        dashed={!dispatched}
        dashSize={0.65}
        gapSize={0.45}
        transparent
        opacity={0.95}
      />
      {dispatched && (
        <mesh ref={marker}>
          <coneGeometry args={[0.2, 0.65, 4]} />
          <meshBasicMaterial color={CITRON} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function TransferRoutes({ facilities, transfers, animate }: { facilities: AssessedFacility[]; transfers: Transfer[]; animate: boolean }) {
  const routes = useMemo(() => {
    const byId = new Map(facilities.map(({ facility }) => [facility.id, facility.position]));
    return transfers.flatMap((transfer) => {
      if (transfer.status !== "approved" && transfer.status !== "dispatched") return [];
      const start = byId.get(transfer.fromFacilityId);
      const end = byId.get(transfer.toFacilityId);
      if (!start || !end) return [];
      const distance = Math.hypot(start.x - end.x, start.z - end.z);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(start.x, 0.9, start.z),
        new THREE.Vector3((start.x + end.x) / 2, 3 + distance * 0.15, (start.z + end.z) / 2),
        new THREE.Vector3(end.x, 0.9, end.z),
      );
      return [{ id: transfer.id, dispatched: transfer.status === "dispatched", curve }];
    });
  }, [facilities, transfers]);

  return routes.map((route) => <TransferRoute key={route.id} {...route} animate={animate} />);
}

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

function CameraRig({
  bounds,
  focus,
  animate,
  userControlledRef,
}: {
  bounds: THREE.Box3;
  focus: { x: number; z: number } | null;
  animate: boolean;
  userControlledRef: RefObject<boolean>;
}) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const settled = useRef(false);
  const idleElapsed = useRef(0);
  const view = useMemo(() => {
    const framing = focus
      ? new THREE.Box3(new THREE.Vector3(focus.x - 7, -0.5, focus.z - 7), new THREE.Vector3(focus.x + 7, 7, focus.z + 7))
      : bounds;
    const target = framing.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(0.5, 0.95, 1.35).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tangent = Math.tan(THREE.MathUtils.degToRad(38 / 2));
    const aspect = Math.max(0.25, size.width / Math.max(1, size.height));
    let distance = 1;
    for (const positionX of [framing.min.x, framing.max.x]) {
      for (const positionY of [framing.min.y, framing.max.y]) {
        for (const positionZ of [framing.min.z, framing.max.z]) {
          const relative = new THREE.Vector3(positionX, positionY, positionZ).sub(target);
          const depth = relative.dot(direction);
          distance = Math.max(
            distance,
            depth + Math.abs(relative.dot(right)) / (tangent * aspect),
            depth + Math.abs(relative.dot(up)) / tangent,
          );
        }
      }
    }
    return { target, position: direction.multiplyScalar(distance * 1.08).add(target) };
  }, [bounds, focus, size.height, size.width]);

  useLayoutEffect(() => {
    settled.current = false;
    userControlledRef.current = false;
    idleElapsed.current = 0;
    invalidate();
  }, [invalidate, userControlledRef, view]);

  useLayoutEffect(() => {
    invalidate();
  }, [animate, invalidate]);

  useFrame((state, delta) => {
    const controls = state.controls as unknown as ControlsLike | null;
    if (!controls || userControlledRef.current) return;
    if (!settled.current) {
      const easing = animate ? 1 - Math.exp(-Math.min(delta, 0.05) * 5) : 1;
      controls.target.lerp(view.target, easing);
      state.camera.position.lerp(view.position, easing);
      if (state.camera.position.distanceToSquared(view.position) < 0.002 && controls.target.distanceToSquared(view.target) < 0.002) {
        state.camera.position.copy(view.position);
        controls.target.copy(view.target);
        settled.current = true;
      }
      controls.update();
    } else if (animate && !focus) {
      idleElapsed.current += Math.min(delta, 0.05);
      const angle = Math.sin(idleElapsed.current * 0.16) * 0.018;
      const offsetX = view.position.x - view.target.x;
      const offsetZ = view.position.z - view.target.z;
      state.camera.position.set(
        view.target.x + offsetX * Math.cos(angle) - offsetZ * Math.sin(angle),
        view.position.y,
        view.target.z + offsetX * Math.sin(angle) + offsetZ * Math.cos(angle),
      );
      controls.update();
    }
  });

  return null;
}

export function DistrictNetwork({ facilities, selectedId, onSelect, animate, labels, transfers = [] }: NetworkProps) {
  const userControlledRef = useRef(false);
  const labelNodes = useRef(new Map<string, HTMLDivElement>());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const onHover = useCallback((id: string, over: boolean) => setHoveredId((current) => (over ? id : current === id ? null : current)), []);
  const selected = facilities.find(({ facility }) => facility.id === selectedId) ?? null;
  const bounds = useMemo(() => districtBounds(facilities), [facilities]);
  const related = useMemo(() => {
    if (!selected) return null;
    const ids = new Set([selected.facility.id, ...selected.facility.links]);
    for (const { facility } of facilities) if (facility.links.includes(selected.facility.id)) ids.add(facility.id);
    return ids;
  }, [facilities, selected]);

  return (
    <div className="relative size-full">
      <Canvas
        shadows
        camera={{ position: [20, 48, 58], fov: 38, near: 0.5, far: 300 }}
        dpr={[1, 1.5]}
        frameloop={animate ? "always" : "demand"}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={[MAP_BACKGROUND]} />
        <hemisphereLight args={["#d8f3e7", "#183c30", 1.7]} />
        <directionalLight
          position={[-18, 32, 12]}
          color="#fff0cc"
          intensity={3.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={bounds.min.x - 15}
          shadow-camera-right={bounds.max.x + 15}
          shadow-camera-top={bounds.max.z + 15}
          shadow-camera-bottom={bounds.min.z - 15}
          shadow-camera-far={120}
          shadow-normalBias={0.06}
        />
        <directionalLight position={[15, 12, -20]} color={CYAN} intensity={1.4} />
        <DistrictSurface bounds={bounds} />
        <Links facilities={facilities} selectedId={selectedId} />
        <TransferRoutes facilities={facilities} transfers={transfers} animate={animate} />
        {facilities.map((item, index) => (
          <FacilityNode
            key={item.facility.id}
            item={item}
            index={index}
            selected={item.facility.id === selectedId}
            hovered={item.facility.id === hoveredId}
            dimmed={related !== null && !related.has(item.facility.id)}
            onSelect={onSelect}
            onHover={onHover}
            animate={animate}
          />
        ))}
        <LabelProjector facilities={facilities} nodes={labelNodes} />
        <CameraRig
          bounds={bounds}
          focus={selected ? selected.facility.position : null}
          animate={animate}
          userControlledRef={userControlledRef}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={14}
          maxDistance={180}
          minPolarAngle={Math.PI / 7}
          maxPolarAngle={Math.PI / 2.6}
          enableDamping={animate}
          dampingFactor={0.08}
          onStart={() => {
            userControlledRef.current = true;
          }}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {facilities.map(({ facility, assessment }) => {
          const highlighted = facility.id === selectedId || facility.id === hoveredId;
          const dimmed = related !== null && !related.has(facility.id);
          const shown = highlighted || (!dimmed && facility.type === "CHC");
          return (
            <div
              key={facility.id}
              ref={(element) => {
                if (element) labelNodes.current.set(facility.id, element);
                else labelNodes.current.delete(facility.id);
              }}
              style={{ visibility: "hidden" }}
              className={`absolute top-0 left-0 will-change-transform ${shown ? "" : "hidden"} ${highlighted ? "z-10" : ""}`}
            >
              <div
                className={
                  highlighted
                    ? "max-w-44 rounded border border-[#d8e995]/50 bg-[#0b231d]/95 px-3 py-2 text-center text-white"
                    : "max-w-36 border-b border-white/30 bg-[#0b231d]/90 px-2 py-1 text-center text-white/85"
                }
              >
                <p className="text-xs leading-snug font-medium">{facility.name}</p>
                {highlighted && (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-white/80">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_META[assessment.status].hex }} />
                    {labels[assessment.status]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
