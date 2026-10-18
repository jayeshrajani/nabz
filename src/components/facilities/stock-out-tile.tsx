"use client";

import { ArrowRight, PackageX, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import { stockOutWatch, type RunOut } from "@/domain/insights";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const FEATURED = 4;
const LIST_COLLAPSED = 6;

function Countdown({ r }: { r: RunOut }) {
  const { t, number } = useI18n();
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0.03, Math.min(1, r.daysLeft / r.leadTimeDays));
  const days = Math.max(0, Math.round(r.daysLeft));

  return (
    <li className="relative flex flex-col overflow-hidden rounded-[22px] bg-gradient-to-br from-[#fff1ee] to-[#fde3dd] p-5">
      <div className="flex items-center gap-4">
        <div className="relative size-[84px] shrink-0">
          <svg viewBox="0 0 84 84" className="size-full -rotate-90" aria-hidden>
            <circle cx="42" cy="42" r={radius} fill="none" stroke="rgb(239 95 79 / 0.15)" strokeWidth="7" />
            <circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke="#ef5f4f"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${fraction * circumference} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <span className="tabular font-display text-3xl leading-none font-semibold text-alert-ink">{days}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight font-semibold">{r.medicineName}</p>
          <Link href={`/facilities/${r.facilityId}`} className="mt-0.5 block truncate text-sm text-ink-muted hover:text-brand">
            {r.facilityName}
          </Link>
          <p className="mt-1 text-xs text-alert-ink">
            {days < 1 ? t("runout.outNow") : t("runout.daysLeft", { n: days })}, {t("runout.restock", { n: r.leadTimeDays }).toLowerCase()}
          </p>
        </div>
      </div>
      <p className="tabular mt-4 text-xs text-ink-muted">
        {t("runout.stock")}: <span className="font-medium text-ink">{number(r.quantity)}</span> {r.unit}
      </p>
      <div className="mt-3">
        {r.transferQuantity ? (
          <Link
            href="/transfers"
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-2"
          >
            <Truck aria-hidden className="size-3.5 text-mint" /> {t("runout.transfer", { qty: number(r.transferQuantity) })}
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/30 bg-white/60 px-3 py-1.5 text-xs font-medium text-alert-ink">
            <ShoppingCart aria-hidden className="size-3.5" /> {t("runout.order", { qty: `${number(r.suggestedOrder)} ${r.unit}` })}
          </span>
        )}
      </div>
    </li>
  );
}

function Runway({ r, horizon }: { r: RunOut; horizon: number }) {
  const { t, number } = useI18n();
  const critical = r.severity === "critical";
  const pct = (d: number) => `${Math.min(100, (d / horizon) * 100)}%`;

  return (
    <li className="grid items-center gap-x-5 gap-y-2 py-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate font-medium">{r.medicineName}</p>
        <Link href={`/facilities/${r.facilityId}`} className="block truncate text-xs text-ink-muted hover:text-brand">
          {r.facilityName}
        </Link>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#eef2ec_0_6px,#e3e9e1_6px_12px)]" />
        <div
          className={cn(
            "absolute top-1/2 left-0 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r",
            critical ? "from-alert to-[#f58a6b]" : "from-watch to-[#f6cc72]",
          )}
          style={{ width: pct(r.daysLeft) }}
        />
        <div
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: pct(r.leadTimeDays) }}
          title={t("runout.restock", { n: r.leadTimeDays })}
        >
          <span aria-hidden className="h-full w-0.5 -translate-x-1/2 rounded bg-ink/50" />
        </div>
        <span
          className={cn(
            "tabular absolute top-1/2 -translate-y-1/2 pl-2 text-xs font-semibold",
            critical ? "text-alert-ink" : "text-watch-ink",
          )}
          style={{ left: pct(r.daysLeft) }}
        >
          {Math.max(0, Math.round(r.daysLeft))}d
        </span>
      </div>
      <div className="text-xs sm:text-right">
        {r.transferQuantity ? (
          <Link href="/transfers" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <Truck aria-hidden className="size-3.5" /> {number(r.transferQuantity)} {r.unit}
          </Link>
        ) : (
          <span className="tabular text-ink-muted">{t("runout.order", { qty: number(r.suggestedOrder) })}</span>
        )}
      </div>
    </li>
  );
}

export function StockOutTile({ view, className }: { view: DistrictView; className?: string }) {
  const { t, number } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const rows = stockOutWatch(view);
  const urgent = rows.filter((r) => r.severity === "critical");
  const featured = urgent.slice(0, FEATURED);
  const rest = rows.filter((r) => !featured.includes(r));
  const shown = expanded ? rest : rest.slice(0, LIST_COLLAPSED);
  const horizon = Math.max(...rows.map((r) => r.leadTimeDays * 2), 1);

  return (
    <Tile
      icon={PackageX}
      label={t("runout.title")}
      className={className}
      aside={
        <span className="flex gap-1.5 text-xs font-medium">
          <span className="tabular rounded-full bg-alert-soft px-2.5 py-0.5 text-alert-ink">
            {number(urgent.length)} {t("status.critical")}
          </span>
          <span className="tabular rounded-full bg-watch-soft px-2.5 py-0.5 text-watch-ink">
            {number(rows.length - urgent.length)} {t("status.warning")}
          </span>
        </span>
      }
    >
      <p id="stock-out-watch" className="-mt-2 mb-5 scroll-mt-24 text-sm text-ink-muted">
        {t("runout.subtitle")}
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">{t("runout.empty")}</p>
      ) : (
        <>
          {featured.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((r) => (
                <Countdown key={`${r.facilityId}-${r.medicineId}`} r={r} />
              ))}
            </ul>
          )}

          {rest.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
                <p className="eyebrow text-ink-subtle">{t("runout.lasts")}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  <span aria-hidden className="h-3 w-0.5 rounded bg-ink/50" /> {t("runout.restockMark")}
                </p>
              </div>
              <ul className="divide-y divide-line">
                {shown.map((r) => (
                  <Runway key={`${r.facilityId}-${r.medicineId}`} r={r} horizon={horizon} />
                ))}
              </ul>
              {rest.length > LIST_COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 text-sm font-medium text-brand hover:underline"
                >
                  {expanded ? t("common.close") : t("runout.more", { n: rest.length - LIST_COLLAPSED })}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Tile>
  );
}
