"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEVERITY_META, StatusBadge } from "@/components/ui/status-badge";
import type { AssessedFacility } from "@/domain/district";
import { formatDays } from "@/domain/risk";
import { cn } from "@/lib/utils";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Metric({ label, value, detail, ratio }: { label: string; value: string; detail: string; ratio?: number | null }) {
  return (
    <div className="rounded-lg border border-line bg-ink-850 p-3">
      <p className="text-[11px] tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-fg-muted">{detail}</p>
      {ratio != null && (
        <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-signal-cyan" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export function FacilityPanel({ item, onClose }: { item: AssessedFacility; onClose: () => void }) {
  const { facility: f, assessment: a } = item;
  const medicineSeverity = new Map(a.signals.filter((s) => s.domain === "medicine" && s.ref).map((s) => [s.ref, s.severity]));

  return (
    <motion.section
      aria-labelledby="facility-heading"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="panel flex h-full flex-col overflow-hidden"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line p-4" style={{ boxShadow: `inset 3px 0 0 ${SEVERITY_META[a.status].hex}` }}>
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-fg-subtle uppercase">
            {f.type === "CHC" ? "Community Health Centre" : "Primary Health Centre"} · {f.block}
          </p>
          <h2 id="facility-heading" className="mt-0.5 truncate text-base font-semibold">
            {f.name}
          </h2>
          <StatusBadge severity={a.status} className="mt-2" />
        </div>
        <Button size="icon" variant="ghost" aria-label="Close facility details" onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {a.signals.length > 0 && (
          <section aria-label="Risk signals">
            <ul className="space-y-1.5">
              {a.signals.map((s, i) => (
                <li key={`${s.domain}-${s.ref ?? i}`} className="flex gap-2 text-xs text-fg-muted">
                  <span className={cn("font-medium uppercase", SEVERITY_META[s.severity].text)}>{SEVERITY_META[s.severity].label}</span>
                  {s.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Beds" value={`${f.beds.total - f.beds.occupied} free`} detail={`${f.beds.occupied}/${f.beds.total} occupied · ${pct(a.bedOccupancy)}`} ratio={a.bedOccupancy} />
          <Metric label="Doctors" value={`${f.doctors.present}/${f.doctors.scheduled}`} detail={`present today · ${pct(a.attendanceRate)}`} ratio={a.attendanceRate} />
          <Metric
            label="Footfall today"
            value={a.footfallToday?.toString() ?? "—"}
            detail={a.footfallAverage7d === null ? "insufficient history" : `7-day avg ${Math.round(a.footfallAverage7d)}`}
          />
          <Metric
            label="Diagnostics"
            value={`${f.diagnostics.filter((t) => t.available && t.kitsRemaining > 0).length}/${f.diagnostics.length}`}
            detail="tests available"
          />
        </div>

        <section aria-labelledby="medicines-heading">
          <h3 id="medicines-heading" className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Medicine coverage
          </h3>
          <table className="w-full text-xs">
            <thead className="text-left text-fg-subtle">
              <tr>
                <th scope="col" className="pb-1.5 font-normal">Medicine</th>
                <th scope="col" className="pb-1.5 text-right font-normal">Stock</th>
                <th scope="col" className="pb-1.5 text-right font-normal">Cover</th>
                <th scope="col" className="pb-1.5 text-right font-normal">Lead</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {a.medicines.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-fg-muted">{m.name}</th>
                  <td className="py-1.5 text-right">{m.quantity.toLocaleString("en-IN")}</td>
                  <td className={cn("py-1.5 text-right font-medium", SEVERITY_META[medicineSeverity.get(m.id) ?? "healthy"].text)}>
                    {m.daysOfCover === null ? "n/a" : formatDays(m.daysOfCover)}
                  </td>
                  <td className="py-1.5 text-right text-fg-subtle">{m.leadTimeDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
            Cover = stock ÷ 7-day average consumption (recorded). Critical when cover is shorter than replenishment lead time.
          </p>
        </section>

        <section aria-labelledby="diagnostics-heading">
          <h3 id="diagnostics-heading" className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Diagnostic tests
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {f.diagnostics.map((t) => {
              const ok = t.available && t.kitsRemaining > 0;
              return (
                <li
                  key={t.id}
                  className={cn("rounded-md border px-2 py-1 text-[11px]", ok ? "border-line text-fg-muted" : "border-signal-red/30 bg-signal-red/10 text-signal-red")}
                >
                  {t.name} · {ok ? `${t.kitsRemaining} kits` : "unavailable"}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </motion.section>
  );
}
