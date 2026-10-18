"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import type { RiskSignal } from "@/domain/risk";

interface Alert {
  facilityId: string;
  facilityName: string;
  signal: RiskSignal;
}

const LIMIT = 8;

export function AlertsPanel({ facilities, onSelect }: { facilities: AssessedFacility[]; onSelect: (id: string) => void }) {
  const alerts: Alert[] = facilities
    .flatMap(({ facility, assessment }) =>
      assessment.signals.map((signal) => ({ facilityId: facility.id, facilityName: facility.name, signal })),
    )
    .sort((a, b) => (a.signal.severity === b.signal.severity ? 0 : a.signal.severity === "critical" ? -1 : 1));

  return (
    <section aria-labelledby="alerts-heading" className="panel flex h-full flex-col p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 id="alerts-heading" className="text-sm font-medium">
          Priority alerts
        </h2>
        <span className="text-xs text-fg-subtle tabular">{alerts.length} total</span>
      </header>
      {alerts.length === 0 ? (
        <p className="m-auto text-sm text-fg-muted">No active risks across the district.</p>
      ) : (
        <ol className="-mx-2 flex flex-col gap-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {alerts.slice(0, LIMIT).map((a, i) => (
              <motion.li
                key={`${a.facilityId}-${a.signal.domain}-${a.signal.ref ?? i}`}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(a.facilityId)}
                  className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink-800"
                >
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_META[a.signal.severity].hex }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm text-fg">{a.facilityName}</span>
                      <StatusBadge severity={a.signal.severity} className="shrink-0" />
                    </span>
                    <span className="mt-0.5 block text-xs text-fg-muted">{a.signal.message}</span>
                  </span>
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-fg-subtle group-hover:text-fg" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {alerts.length > LIMIT && <p className="mt-2 text-xs text-fg-subtle">+{alerts.length - LIMIT} more in facility details</p>}
    </section>
  );
}
