"use client";

import { Activity } from "lucide-react";
import { useId } from "react";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import { useI18n } from "@/i18n/provider";

const R = 110;
const CX = 130;
const CY = 130;

function point(fraction: number): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}

/** Today's district arrivals placed on a semicircle spanning the 30-day low to high. */
export function PatientsGauge({ view, className }: { view: DistrictView; className?: string }) {
  const { t, number } = useI18n();
  const gradient = useId();
  const series = view.footfallSeries;
  const today = series.at(-1) ?? 0;
  const prior = series.slice(-8, -1);
  const usual = prior.length ? Math.round(prior.reduce((a, b) => a + b, 0) / prior.length) : null;
  const low = Math.min(...series);
  const high = Math.max(...series);
  const fraction = high > low ? (today - low) / (high - low) : 0.5;
  const [mx, my] = point(fraction);
  const [sx, sy] = point(0);
  const [ex, ey] = point(1);
  const arc = `M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}`;

  return (
    <Tile icon={Activity} label={t("gauge.title")} tone="dark" className={className}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="tabular font-display text-6xl font-medium tracking-tight">{number(today)}</p>
        <p className="mt-1 text-sm text-white/55">{usual !== null ? t("gauge.usual", { n: number(usual) }) : ""}</p>
      </div>
      <svg
        viewBox="0 0 260 150"
        className="mt-2 w-full"
        role="img"
        aria-label={`${t("gauge.title")}: ${today}, ${t("gauge.low")} ${low}, ${t("gauge.high")} ${high}`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="1">
            <stop offset="0%" stopColor="#9fe8c2" />
            <stop offset="60%" stopColor="#f0ad32" />
            <stop offset="100%" stopColor="#ef5f4f" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth={18} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth={18}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${fraction} 1`}
        />
        <circle cx={mx} cy={my} r={7} fill="#fff" />
      </svg>
      <div className="tabular -mt-3 flex justify-between text-[11px] text-white/50">
        <span>
          {t("gauge.low")} <span className="text-white/80">{number(low)}</span>
        </span>
        <span>
          {t("gauge.high")} <span className="text-white/80">{number(high)}</span>
        </span>
      </div>
    </Tile>
  );
}
