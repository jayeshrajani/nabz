"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import { formatDays } from "@/domain/risk";
import { cn } from "@/lib/utils";

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
      {note && <p className="text-xs text-ink-subtle">{note}</p>}
    </div>
  );
}

export function FacilityPanel({ item, onClose }: { item: AssessedFacility; onClose: () => void }) {
  const { facility: f, assessment: a } = item;
  const medicineSeverity = new Map(a.signals.filter((s) => s.domain === "medicine" && s.ref).map((s) => [s.ref, s.severity]));
  const testsAvailable = f.diagnostics.filter((t) => t.available && t.kitsRemaining > 0).length;

  return (
    <motion.section
      aria-labelledby="facility-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="card flex h-full flex-col overflow-hidden"
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">
            {f.type === "CHC" ? "Community Health Centre" : "Primary Health Centre"}, {f.block}
          </p>
          <h2 id="facility-heading" className="mt-0.5 truncate text-lg font-semibold">
            {f.name}
          </h2>
          <StatusBadge severity={a.status} className="mt-2" />
        </div>
        <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {a.signals.length > 0 && (
          <ul aria-label="What needs attention" className="space-y-2">
            {a.signals.map((s, i) => (
              <li key={`${s.domain}-${s.ref ?? i}`} className="flex items-start gap-2.5 text-sm text-ink">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: SEVERITY_META[s.severity].hex }} />
                <span>
                  {s.message}
                  <span className="sr-only"> ({SEVERITY_META[s.severity].label})</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Fact label="Beds free" value={`${f.beds.total - f.beds.occupied} of ${f.beds.total}`} />
          <Fact label="Doctors present" value={`${f.doctors.present} of ${f.doctors.scheduled}`} />
          <Fact
            label="Patients today"
            value={a.footfallToday?.toString() ?? "n/a"}
            note={a.footfallAverage7d === null ? undefined : `Usually around ${Math.round(a.footfallAverage7d)}`}
          />
          <Fact label="Tests available" value={`${testsAvailable} of ${f.diagnostics.length}`} />
        </div>

        <section aria-labelledby="medicines-heading">
          <h3 id="medicines-heading" className="mb-2 text-sm font-semibold">
            Medicines
          </h3>
          <ul className="divide-y divide-line">
            {a.medicines.map((m) => {
              const severity = medicineSeverity.get(m.id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">{m.name}</span>
                  <span className={cn("tabular shrink-0", severity ? `font-medium ${SEVERITY_META[severity].ink}` : "text-ink-muted")}>
                    {m.daysOfCover === null ? "No history" : `${formatDays(m.daysOfCover)} left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="tests-heading">
          <h3 id="tests-heading" className="mb-2 text-sm font-semibold">
            Tests
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {f.diagnostics.map((t) => {
              const ok = t.available && t.kitsRemaining > 0;
              return (
                <li key={t.id} className={cn("rounded-full px-2.5 py-1 text-xs", ok ? "bg-surface-2 text-ink-muted" : "bg-alert-soft font-medium text-alert-ink")}>
                  {t.name}
                  {!ok && <span>, unavailable</span>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </motion.section>
  );
}
