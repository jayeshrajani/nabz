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
    <div className="relative size-full bg-ink-950">
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
                  stroke={active ? "#4fd7e8" : "#2c3b52"}
                  strokeDasharray={active ? undefined : "4 4"}
                />
              );
            }),
        )}
      </svg>
      <ul aria-label="Facilities in network" className="absolute inset-0">
        {facilities.map(({ facility, assessment }) => {
          const meta = SEVERITY_META[assessment.status];
          const selected = facility.id === selectedId;
          return (
            <li key={facility.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: toPct(facility.position.x), top: toPct(facility.position.z) }}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${facility.name}, ${facility.type}, status ${meta.label}`}
                onClick={() => onSelect(selected ? null : facility.id)}
                className="group flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "block rounded-full border-2 transition-transform duration-(--duration-fast) group-hover:scale-110",
                    facility.type === "CHC" ? "size-5 rotate-45 rounded-sm" : "size-3.5",
                    selected && "scale-125 ring-2 ring-signal-cyan ring-offset-2 ring-offset-ink-950",
                  )}
                  style={{ borderColor: meta.hex, backgroundColor: `${meta.hex}55` }}
                />
                <span className="hidden text-[10px] whitespace-nowrap text-fg-muted sm:block">{facility.name.replace(/^(PHC|CHC) /, "")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
