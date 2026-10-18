"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import { cn } from "@/lib/utils";

type Filter = "all" | "attention" | "stable";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "stable", label: "Stable" },
];

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
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities.filter(({ facility, assessment }) => {
      const stable = assessment.status === "healthy";
      if (filter === "attention" && stable) return false;
      if (filter === "stable" && !stable) return false;
      return !q || facility.name.toLowerCase().includes(q) || facility.block.toLowerCase().includes(q);
    });
  }, [facilities, query, filter]);

  return (
    <section aria-labelledby="directory-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="directory-heading" className="text-base font-semibold">
          All centres
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter centres" className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("rounded-full px-3 py-1", filter === f.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search centres</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 w-44 rounded-full border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-ink-subtle"
            />
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card py-10 text-center text-sm text-ink-muted">No centres match.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ facility, assessment }) => {
            const selected = facility.id === selectedId;
            return (
              <li key={facility.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : facility.id)}
                  className={cn(
                    "card flex w-full flex-col gap-1 p-4 text-left transition-colors duration-(--duration-fast)",
                    selected ? "border-brand ring-2 ring-brand/15" : "hover:border-line-strong",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{facility.name}</span>
                    <StatusBadge severity={assessment.status} />
                  </span>
                  <span className="truncate text-sm text-ink-muted">{assessment.signals[0]?.message ?? "Running normally"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
