"use client";

import { SEVERITY_META } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { NetworkProps } from "./district-network";

const EXTENT = 26;
const toPct = (v: number) => `${((v + EXTENT) / (EXTENT * 2)) * 100}%`;

/** Accessible, WebGL-free view of the same network. */
export function DistrictNetwork2D({ facilities, selectedId, onSelect }: Omit<NetworkProps, "animate">) {
  const byId = new Map(facilities.map((f) => [f.facility.id, f.facility]));

  return (
    <div className="relative size-full bg-[#eef3f1]">
      <svg aria-hidden className="absolute inset-0 size-full">
        {facilities.flatMap(({ facility }) =>
          facility.links
            .filter((id) => id > facility.id && byId.has(id))
            .map((id) => {
              const other = byId.get(id)!;
              const active = selectedId === facility.id || selectedId === id;
              return (
                <line
                  key={`${facility.id}-${id}`}
                  x1={toPct(facility.position.x)}
                  y1={toPct(facility.position.z)}
                  x2={toPct(other.position.x)}
                  y2={toPct(other.position.z)}
                  stroke={active ? "#0e7c66" : "#c5d2cd"}
                  strokeWidth={active ? 2 : 1.5}
                />
              );
            }),
        )}
      </svg>
      <ul aria-label="Health centres on the map" className="absolute inset-0">
        {facilities.map(({ facility, assessment }) => {
          const meta = SEVERITY_META[assessment.status];
          const selected = facility.id === selectedId;
          return (
            <li key={facility.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: toPct(facility.position.x), top: toPct(facility.position.z) }}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${facility.name}, ${meta.label}`}
                onClick={() => onSelect(selected ? null : facility.id)}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "block shadow-sm ring-4 ring-white transition-transform duration-(--duration-fast) group-hover:scale-110",
                    facility.type === "CHC" ? "size-5 rounded-md" : "size-4 rounded-full",
                    selected && "scale-125 ring-brand/30",
                  )}
                  style={{ backgroundColor: meta.hex }}
                />
                <span className="hidden text-xs whitespace-nowrap text-ink-muted sm:block">{facility.name.replace(/^(PHC|CHC) /, "")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
