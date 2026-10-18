"use client";

import { ArrowUpRight, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

/** Compact preview shown beside the map; the full workspace lives at /facilities/[id]. */
export function FacilityPanel({ item, onClose }: { item: AssessedFacility; onClose: () => void }) {
  const { facility: f, assessment: a } = item;

  return (
    <motion.section
      aria-labelledby="facility-heading"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="card flex h-full flex-col overflow-hidden"
    >
      <header className="flex items-start justify-between gap-3 px-6 pt-6">
        <div className="min-w-0">
          <p className="eyebrow text-ink-subtle">
            {f.type === "CHC" ? "Community Health Centre" : "Primary Health Centre"}
          </p>
          <h2 id="facility-heading" className="mt-1 truncate font-display text-2xl font-semibold tracking-tight">
            {f.name}
          </h2>
          <StatusBadge severity={a.status} className="mt-2" />
        </div>
        <button type="button" aria-label="Close preview" onClick={onClose} className="rounded-full p-2 text-ink-subtle hover:bg-surface-2 hover:text-ink">
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {a.signals.length > 0 ? (
          <ul aria-label="What needs attention" className="space-y-2.5">
            {a.signals.slice(0, 5).map((s, i) => (
              <li key={`${s.domain}-${s.ref ?? i}`} className="flex items-start gap-2.5 text-sm">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: SEVERITY_META[s.severity].hex }} />
                <span>
                  {s.message}
                  <span className="sr-only"> ({SEVERITY_META[s.severity].label})</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Nothing to flag. Running like clockwork.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Fact label="Beds free" value={`${f.beds.total - f.beds.occupied}/${f.beds.total}`} />
          <Fact label="Doctors in" value={`${f.doctors.present}/${f.doctors.scheduled}`} />
          <Fact label="Patients today" value={a.footfallToday?.toString() ?? "n/a"} />
          <Fact label="Tests working" value={`${f.diagnostics.filter((t) => t.available && t.kitsRemaining > 0).length}/${f.diagnostics.length}`} />
        </div>
      </div>

      <div className="border-t border-line p-4">
        <Link
          href={`/facilities/${f.id}`}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-medium text-white transition-colors hover:bg-forest"
        >
          Open centre <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </div>
    </motion.section>
  );
}
