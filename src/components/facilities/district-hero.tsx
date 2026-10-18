"use client";

import { motion, useReducedMotion } from "motion/react";
import { PulseLine } from "@/components/ui/pulse-line";
import type { DistrictView } from "@/domain/district";
import type { RiskDomain } from "@/domain/risk";

const nf = new Intl.NumberFormat("en-IN");
const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

const PRESSURE: Record<RiskDomain, string> = {
  medicine: "medicine shelves",
  beds: "bed space",
  staffing: "doctor rosters",
  diagnostics: "lab tests",
  footfall: "patient queues",
};

function pressures(view: DistrictView): string[] {
  const counts = new Map<RiskDomain, number>();
  for (const { assessment } of view.facilities)
    for (const s of assessment.signals) counts.set(s.domain, (counts.get(s.domain) ?? 0) + (s.severity === "critical" ? 3 : 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => PRESSURE[d]);
}

export function DistrictHero({ view }: { view: DistrictView }) {
  const reduced = useReducedMotion();
  const { summary } = view;
  const flagged = summary.critical + summary.warning;
  const top = pressures(view);
  const series = view.footfallSeries;
  const usual = series.length > 1 ? Math.round(series.slice(-8, -1).reduce((a, b) => a + b, 0) / Math.min(7, series.length - 1)) : null;

  const stats = [
    { value: summary.stockOutRisks, label: summary.stockOutRisks === 1 ? "medicine may run dry" : "medicines may run dry", hot: summary.stockOutRisks > 0 },
    { value: summary.bedsTotal - summary.bedsOccupied, label: `beds free of ${nf.format(summary.bedsTotal)}`, hot: false },
    { value: summary.doctorGap, label: summary.doctorGap === 1 ? "doctor away today" : "doctors away today", hot: summary.doctorGap > 0 },
    { value: summary.diagnosticShortages, label: summary.diagnosticShortages === 1 ? "test offline" : "tests offline", hot: summary.diagnosticShortages > 0 },
  ];

  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden rounded-[var(--radius-hero)] bg-forest text-white">
      <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="eyebrow text-mint/80">
              Pulse check, {summary.lastUpdated ? dateFormat.format(new Date(summary.lastUpdated)) : "today"}
            </p>
            <motion.h1
              id="hero-heading"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl"
            >
              {flagged === 0 ? (
                <>Everyone in {view.district.name.replace(" District", "")} is breathing easy.</>
              ) : (
                <>
                  <span className="text-[#ffb4a8]">{flagged}</span> of {summary.facilities} centres
                  <br className="hidden sm:block" /> need a hand today.
                </>
              )}
            </motion.h1>
            {top.length > 0 && (
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                The pressure is mostly on {top.join(" and ")}. Here is where to look first.
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-sm leading-snug text-white/60">{s.label}</dt>
                <dd className={`tabular font-display text-3xl font-semibold ${s.hot ? "text-[#ffb4a8]" : "text-white"}`}>{nf.format(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col justify-end">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-white/50">Patients seen, last {series.length} days</p>
              <p className="tabular mt-2 font-display text-5xl font-semibold text-mint">{nf.format(summary.footfallToday)}</p>
              <p className="mt-1 text-sm text-white/60">today{usual !== null && `, against a usual ${nf.format(usual)}`}</p>
            </div>
          </div>
          <PulseLine values={series} label={`District patient arrivals over the last ${series.length} days`} className="mt-6 h-32 w-full text-mint" />
        </div>
      </div>
    </section>
  );
}
