"use client";

import { motion, useReducedMotion } from "motion/react";
import { PulseLine } from "@/components/ui/pulse-line";
import type { DistrictView } from "@/domain/district";
import type { RiskDomain } from "@/domain/risk";
import { intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/provider";

function pressures(view: DistrictView): RiskDomain[] {
  const counts = new Map<RiskDomain, number>();
  for (const { assessment } of view.facilities)
    for (const s of assessment.signals) counts.set(s.domain, (counts.get(s.domain) ?? 0) + (s.severity === "critical" ? 3 : 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => d);
}

export function DistrictHero({ view }: { view: DistrictView }) {
  const reduced = useReducedMotion();
  const { t, number, locale } = useI18n();
  const { summary } = view;
  const flagged = summary.critical + summary.warning;
  const top = pressures(view);
  const series = view.footfallSeries;
  const usual = series.length > 1 ? Math.round(series.slice(-8, -1).reduce((a, b) => a + b, 0) / Math.min(7, series.length - 1)) : null;
  const date = summary.lastUpdated
    ? new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long" }).format(new Date(summary.lastUpdated))
    : "";

  const stats = [
    { value: summary.stockOutRisks, label: t("hero.stockout"), hot: summary.stockOutRisks > 0 },
    { value: summary.bedsTotal - summary.bedsOccupied, label: t("hero.bedsFree", { total: number(summary.bedsTotal) }), hot: false },
    { value: summary.doctorGap, label: t("hero.doctorsAway"), hot: summary.doctorGap > 0 },
    { value: summary.diagnosticShortages, label: t("hero.testsOffline"), hot: summary.diagnosticShortages > 0 },
  ];

  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden rounded-[var(--radius-hero)] bg-forest text-white">
      <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="eyebrow text-mint/80">{t("hero.eyebrow", { date })}</p>
            <motion.h1
              id="hero-heading"
              key={locale}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 max-w-xl font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl"
            >
              {flagged === 0 ? t("hero.allGood", { district: view.district.name }) : t("hero.needHand", { count: number(flagged), total: number(summary.facilities) })}
            </motion.h1>
            {top.length > 0 && (
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                {t("hero.pressure", { areas: top.map((d) => t(`pressure.${d}`)).join(` ${t("common.and")} `) })}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-sm leading-snug text-white/60">{s.label}</dt>
                <dd className={`tabular font-display text-3xl font-semibold ${s.hot ? "text-[#ffb4a8]" : "text-white"}`}>{number(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col justify-end">
          <p className="eyebrow text-white/50">{t("hero.patients", { days: series.length })}</p>
          <p className="tabular mt-2 font-display text-5xl font-semibold text-mint">{number(summary.footfallToday)}</p>
          <p className="mt-1 text-sm text-white/60">
            {t("hero.today")}
            {usual !== null && `, ${t("hero.usual", { n: number(usual) })}`}
          </p>
          <PulseLine values={series} label={t("hero.patients", { days: series.length })} className="mt-6 h-32 w-full text-mint" />
        </div>
      </div>
    </section>
  );
}
