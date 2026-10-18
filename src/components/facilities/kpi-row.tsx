"use client";

import { BedDouble, FlaskConical, Pill, Stethoscope, Truck, Waypoints, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { DistrictView } from "@/domain/district";
import { stockOutWatch } from "@/domain/insights";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

interface Kpi {
  icon: LucideIcon;
  label: string;
  value: number;
  of?: number;
  tone: "alert" | "watch" | "ok" | "neutral";
  href?: string;
}

const TONE = {
  alert: "text-alert-ink",
  watch: "text-watch-ink",
  ok: "text-ok-ink",
  neutral: "text-ink",
} as const;

export function KpiRow({ view }: { view: DistrictView }) {
  const { t, number } = useI18n();
  const { summary } = view;
  const atRisk = stockOutWatch(view).filter((r) => r.severity === "critical").length;
  const moving = view.transfers.filter((x) => x.status === "approved" || x.status === "dispatched").length;
  const testsDown = view.facilities.reduce(
    (s, f) => s + f.facility.diagnostics.filter((d) => !d.available || d.kitsRemaining === 0).length,
    0,
  );

  const items: Kpi[] = [
    { icon: Pill, label: t("kpi.atRisk"), value: atRisk, tone: atRisk ? "alert" : "ok", href: "#stock-out-watch" },
    {
      icon: BedDouble,
      label: t("kpi.bedsFree"),
      value: summary.bedsTotal - summary.bedsOccupied,
      of: summary.bedsTotal,
      tone: "neutral",
      href: "/centres",
    },
    {
      icon: Stethoscope,
      label: t("kpi.doctorsAway"),
      value: summary.doctorGap,
      tone: summary.doctorGap ? "watch" : "ok",
      href: "/centres",
    },
    { icon: FlaskConical, label: t("kpi.testsDown"), value: testsDown, tone: testsDown ? "watch" : "ok", href: "/centres" },
    { icon: Waypoints, label: t("kpi.suggested"), value: view.suggestions.length, tone: "neutral", href: "/transfers" },
    { icon: Truck, label: t("kpi.inProgress"), value: moving, tone: "neutral", href: "/transfers" },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => (
        <li key={k.label}>
          <Link
            href={k.href ?? "#"}
            className="group flex h-full flex-col gap-3 rounded-[20px] border border-line bg-surface px-4 py-4 shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-lift)"
          >
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              <k.icon aria-hidden className="size-4 text-ink-subtle group-hover:text-brand" />
              {k.label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className={cn("tabular font-display text-3xl font-semibold tracking-tight", TONE[k.tone])}>{number(k.value)}</span>
              {k.of !== undefined && <span className="text-xs text-ink-subtle">{t("kpi.of", { n: number(k.of) })}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
