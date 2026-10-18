"use client";

import { History, TrendingDown, TrendingUp } from "lucide-react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkline } from "@/components/ui/sparkline";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import { consumptionTrends, periodChange, rollingAverage } from "@/domain/insights";
import { intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-subtle">-</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 text-xs font-medium",
        Math.abs(pct) < 3 ? "text-ink-muted" : up ? "text-watch-ink" : "text-ok-ink",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export function HistoryTile({ view, className }: { view: DistrictView; className?: string }) {
  const { t, number, locale } = useI18n();
  const series = view.footfallSeries;
  const avg = rollingAverage(series);
  const end = Date.parse(`${view.district.historyEndDate}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" });
  const data = series.map((v, i) => ({
    label: fmt.format(new Date(end - (series.length - 1 - i) * 86_400_000)),
    patients: v,
    avg: avg[i],
  }));
  const peak = data.reduce((best, d) => (d.patients > best.patients ? d : best), data[0] ?? { label: "", patients: 0, avg: null });
  const week = series.slice(-7).reduce((a, b) => a + b, 0);
  const trends = consumptionTrends(view).slice(0, 6);

  return (
    <Tile icon={History} label={t("history.title")} className={className}>
      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-ink-muted">{t("history.total")}</dt>
          <dd className="tabular font-display text-2xl font-semibold">{number(week)}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-ink-muted">{t("history.wow")}</dt>
          <dd className="font-display text-2xl font-semibold">
            <Change pct={periodChange(series)} />
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-xs text-ink-muted">
            {t("history.peak")}, {peak.label}
          </dt>
          <dd className="tabular font-display text-2xl font-semibold">{number(peak.patients)}</dd>
        </div>
      </dl>

      <p className="eyebrow mt-5 mb-1 flex items-center justify-between text-ink-subtle">
        <span>{t("history.patients", { days: series.length })}</span>
        <span className="flex gap-3 normal-case">
          <span className="flex items-center gap-1">
            <span aria-hidden className="h-2 w-3 rounded-sm bg-mint" /> {t("history.daily")}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="h-0.5 w-3 bg-forest" /> {t("history.avg")}
          </span>
        </span>
      </p>
      <div className="h-40" role="img" aria-label={t("history.patients", { days: series.length })}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={6} tick={{ fontSize: 10, fill: "#7b8882" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#7b8882" }} width={44} />
            <Tooltip
              cursor={{ stroke: "#c9d1c6", strokeDasharray: "3 3" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e1e6de", fontSize: 12 }}
              formatter={(value, name) => [number(Number(value)), name === "avg" ? t("history.avg") : t("history.daily")]}
            />
            <Area dataKey="patients" stroke="#5fc79b" fill="#9fe8c2" fillOpacity={0.45} strokeWidth={1.5} isAnimationActive={false} />
            <Line dataKey="avg" stroke="#0c2a23" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="eyebrow mt-5 mb-2 text-ink-subtle">{t("history.consumption")}</p>
      <ul className="divide-y divide-line">
        {trends.map((m) => (
          <li key={m.medicineId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{m.medicineName}</span>
              <span className="tabular text-xs text-ink-subtle">{t("history.perWeek", { n: number(m.lastWeek), unit: m.unit })}</span>
            </span>
            <Sparkline values={m.series} stroke="#0f7a5f" width={80} height={24} />
            <span className="w-16 text-right">
              <Change pct={m.change} />
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
