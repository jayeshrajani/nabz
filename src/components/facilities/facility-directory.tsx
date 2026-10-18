"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import type { Severity } from "@/domain/risk";
import type { FacilityType } from "@/domain/schemas";
import { cn } from "@/lib/utils";

const selectClass = "h-9 rounded-lg border border-line bg-ink-850 px-2.5 text-sm text-fg";

export function FacilityDirectory({
  facilities,
  selectedId,
  onSelect,
}: {
  facilities: AssessedFacility[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Severity | "all">("all");
  const [type, setType] = useState<FacilityType | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities.filter(
      ({ facility, assessment }) =>
        (status === "all" || assessment.status === status) &&
        (type === "all" || facility.type === type) &&
        (!q || facility.name.toLowerCase().includes(q) || facility.block.toLowerCase().includes(q)),
    );
  }, [facilities, query, status, type]);

  return (
    <section aria-labelledby="directory-heading" className="panel p-4">
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="directory-heading" className="text-sm font-medium">
          Facility directory <span className="text-fg-subtle tabular">({rows.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">Search facilities</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              value={query}
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or block"
              className={cn(selectClass, "w-52 pl-8 placeholder:text-fg-subtle")}
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Severity | "all")} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="critical">Critical</option>
              <option value="warning">Watch</option>
              <option value="healthy">Stable</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by type</span>
            <select value={type} onChange={(e) => setType(e.target.value as FacilityType | "all")} className={selectClass}>
              <option value="all">PHC + CHC</option>
              <option value="PHC">PHC</option>
              <option value="CHC">CHC</option>
            </select>
          </label>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">No facilities match these filters.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ facility, assessment }) => {
            const selected = facility.id === selectedId;
            return (
              <li key={facility.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : facility.id)}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors duration-(--duration-fast)",
                    selected ? "border-signal-cyan/60 bg-signal-cyan/5" : "border-line bg-ink-850 hover:border-line-strong",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{facility.name}</span>
                    <StatusBadge severity={assessment.status} />
                  </span>
                  <span className="tabular flex gap-3 text-[11px] text-fg-muted">
                    <span>{facility.type}</span>
                    <span>{facility.block}</span>
                    <span>
                      Beds {facility.beds.occupied}/{facility.beds.total}
                    </span>
                    <span>{assessment.signals.length} signals</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
