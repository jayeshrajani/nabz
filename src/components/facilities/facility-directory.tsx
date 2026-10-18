"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SEVERITY_META } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Filter = "all" | "attention" | "stable";
const FILTERS: { id: Filter; label: MessageKey }[] = [
  { id: "all", label: "directory.all" },
  { id: "attention", label: "directory.attention" },
  { id: "stable", label: "directory.stable" },
];
const RANK = { critical: 0, warning: 1, healthy: 2 } as const;

export function FacilityDirectory({ facilities }: { facilities: AssessedFacility[] }) {
  const { t, signal } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities
      .filter(({ facility, assessment }) => {
        const stable = assessment.status === "healthy";
        if (filter === "attention" && stable) return false;
        if (filter === "stable" && !stable) return false;
        return !q || facility.name.toLowerCase().includes(q) || facility.block.toLowerCase().includes(q);
      })
      .sort((a, b) => RANK[a.assessment.status] - RANK[b.assessment.status] || b.assessment.signals.length - a.assessment.signals.length);
  }, [facilities, query, filter]);

  return (
    <section aria-label={t("directory.title")}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("directory.title")} className="flex rounded-full border border-line bg-surface p-1 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("rounded-full px-3.5 py-1 transition-colors", filter === f.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <label className="relative">
          <span className="sr-only">{t("directory.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("directory.search")}
            className="h-10 w-52 rounded-full border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-ink-subtle"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="card py-12 text-center text-sm text-ink-muted">{t("directory.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ facility, assessment }) => {
            const meta = SEVERITY_META[assessment.status];
            const top = assessment.signals[0];
            return (
              <li key={facility.id}>
                <Link
                  href={`/facilities/${facility.id}`}
                  className="card group relative flex h-full flex-col gap-3 overflow-hidden p-5 transition-shadow duration-(--duration-fast) hover:shadow-(--shadow-lift)"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.hex }} />
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{facility.name}</span>
                      <span className="text-xs text-ink-subtle">
                        {facility.type}, {facility.block}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-medium", meta.ink)}>{t(`status.${assessment.status}`)}</span>
                  </span>
                  <span className="line-clamp-2 text-sm text-ink-muted">{top ? signal(top) : t("directory.ok")}</span>
                  <span className="tabular mt-auto flex gap-4 border-t border-line pt-3 text-xs text-ink-subtle">
                    <span>
                      {t("fact.bedsFree")} {facility.beds.total - facility.beds.occupied}/{facility.beds.total}
                    </span>
                    <span>
                      {t("fact.doctorsIn")} {facility.doctors.present}/{facility.doctors.scheduled}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
