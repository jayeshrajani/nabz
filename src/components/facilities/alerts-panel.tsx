"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";

const RANK = { critical: 0, warning: 1, healthy: 2 } as const;

export function AlertsPanel({ facilities, onSelect }: { facilities: AssessedFacility[]; onSelect: (id: string) => void }) {
  const flagged = facilities
    .filter((f) => f.assessment.status !== "healthy")
    .sort((a, b) => RANK[a.assessment.status] - RANK[b.assessment.status] || b.assessment.signals.length - a.assessment.signals.length);

  return (
    <motion.section
      aria-labelledby="attention-heading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card flex h-full flex-col p-6"
    >
      <h2 id="attention-heading" className="font-display text-xl font-semibold tracking-tight">
        Who needs a hand
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Tap a centre for the full story.</p>

      {flagged.length === 0 ? (
        <p className="m-auto text-sm text-ink-muted">Quiet day. Nobody is struggling.</p>
      ) : (
        <ol className="-mx-3 mt-4 flex flex-col overflow-y-auto">
          {flagged.map(({ facility, assessment }) => {
            const [top, ...rest] = assessment.signals;
            return (
              <li key={facility.id}>
                <button
                  type="button"
                  onClick={() => onSelect(facility.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-ink">{facility.name}</span>
                      <StatusBadge severity={assessment.status} className="shrink-0" />
                    </span>
                    <span className="mt-1 block truncate text-sm text-ink-muted">
                      {top?.message}
                      {rest.length > 0 && <span className="text-ink-subtle">, +{rest.length} more</span>}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
}
