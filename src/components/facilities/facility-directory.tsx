"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SEVERITY_META } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import { cn } from "@/lib/utils";

type Filter = "all" | "attention" | "stable";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Need a hand" },
  { id: "stable", label: "Steady" },
];

export function FacilityDirectory({ facilities }: { facilities: AssessedFacility[] }) {
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="directory-heading" className="font-display text-xl font-semibold tracking-tight">
          Every centre
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter centres" className="flex rounded-full border border-line bg-surface p-1 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("rounded-full px-3.5 py-1 transition-colors", filter === f.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search centres</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a centre"
              className="h-10 w-48 rounded-full border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-ink-subtle"
            />
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card py-12 text-center text-sm text-ink-muted">No centre by that name. Try another spelling?</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ facility, assessment }) => {
            const meta = SEVERITY_META[assessment.status];
            return (
              <li key={facility.id}>
                <Link
                  href={`/facilities/${facility.id}`}
                  className="card group relative flex flex-col gap-3 overflow-hidden p-5 transition-shadow duration-(--duration-fast) hover:shadow-(--shadow-lift)"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.hex }} />
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{facility.name}</span>
                      <span className="text-xs text-ink-subtle">{facility.block}</span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-medium", meta.ink)}>{meta.label}</span>
                  </span>
                  <span className="truncate text-sm text-ink-muted">{assessment.signals[0]?.message ?? "Running like clockwork"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
