"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesForecast } from "@/domain/forecast";

interface Point {
  label: string;
  actual?: number;
  expected?: number;
  range?: [number, number];
}

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function buildPoints(history: readonly number[], endDate: string, forecast: SeriesForecast | null): Point[] {
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const at = (offset: number) => dayLabel.format(new Date(end + offset * 86_400_000));
  const points: Point[] = history.map((v, i) => ({ label: at(i - history.length + 1), actual: v }));
  if (forecast && points.length) {
    const last = points.at(-1)!;
    last.expected = last.actual;
    last.range = [last.actual!, last.actual!];
    for (const p of forecast.points) points.push({ label: at(p.day), expected: p.expected, range: [p.low, p.high] });
  }
  return points;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: Point }[]; label?: string }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-(--shadow-lift)">
      <p className="text-ink-subtle">{label}</p>
      {p.actual !== undefined && <p className="font-medium">{p.actual} patients</p>}
      {p.actual === undefined && p.range && (
        <p className="font-medium">
          Likely {Math.round(p.range[0])} to {Math.round(p.range[1])}
        </p>
      )}
    </div>
  );
}

export function FootfallChart({
  history,
  endDate,
  forecast,
}: {
  history: readonly number[];
  endDate: string;
  forecast: SeriesForecast | null;
}) {
  const data = buildPoints(history, endDate, forecast);
  return (
    <div className="h-56 w-full" role="img" aria-label={`Daily patients for the last ${history.length} days with a 7-day outlook`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={6} tick={{ fontSize: 11, fill: "#7b8882" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7b8882" }} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#c9d1c6", strokeDasharray: "3 3" }} />
          <Area dataKey="range" stroke="none" fill="#9fe8c2" fillOpacity={0.45} isAnimationActive={false} />
          <Line dataKey="actual" stroke="#10201b" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="expected" stroke="#0f7a5f" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
