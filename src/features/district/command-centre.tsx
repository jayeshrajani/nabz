"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { FacilityDirectory } from "@/components/facilities/facility-directory";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { KpiStrip } from "@/components/facilities/kpi-strip";
import { Button } from "@/components/ui/button";
import type { DistrictView } from "@/domain/district";
import type { RiskDomain } from "@/domain/risk";
import { useDistrict } from "./use-district";

const timeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const PRESSURE_LABEL: Record<RiskDomain, string> = {
  medicine: "medicine stock",
  beds: "bed space",
  staffing: "doctor attendance",
  diagnostics: "test availability",
};

function headline(view: DistrictView): string {
  const { critical, warning, facilities } = view.summary;
  const flagged = critical + warning;
  if (flagged === 0) return `All ${facilities} centres are running normally.`;

  const counts = new Map<RiskDomain, number>();
  for (const { assessment } of view.facilities)
    for (const s of assessment.signals) if (s.severity === "critical") counts.set(s.domain, (counts.get(s.domain) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => PRESSURE_LABEL[d]);

  const lead = `${flagged} of ${facilities} centres need attention today.`;
  return top.length ? `${lead} The biggest pressure is on ${top.join(" and ")}.` : lead;
}

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading district</span>
      <div className="space-y-3">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-line" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
        ))}
      </div>
      <div className="h-[560px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}

export function CommandCentre() {
  const { state, reload } = useDistrict();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  if (state.status === "loading") return <Skeleton />;

  if (state.status === "error") {
    return (
      <div role="alert" className="card mx-auto mt-16 max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">We could not load the district</h1>
        <p className="mt-2 text-sm text-ink-muted">{state.message}</p>
        <Button className="mt-5" variant="primary" onClick={reload}>
          <RefreshCw aria-hidden className="size-4" /> Try again
        </Button>
      </div>
    );
  }

  const { view } = state;
  const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;

  return (
    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{view.district.name}</h1>
          <p className="mt-2 text-base leading-relaxed text-ink-muted">{headline(view)}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-subtle">
          {view.summary.lastUpdated && (
            <span>
              Updated <time dateTime={view.summary.lastUpdated}>{timeFormat.format(new Date(view.summary.lastUpdated))}</time>
            </span>
          )}
          <Button size="icon" variant="outline" aria-label="Refresh" onClick={reload}>
            <RefreshCw aria-hidden className="size-4" />
          </Button>
        </div>
      </header>

      <KpiStrip summary={view.summary} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <NetworkStage facilities={view.facilities} selectedId={selectedId} onSelect={setSelectedId} animate={!reducedMotion} />
        <div className="min-h-[320px] lg:h-[560px]">
          <AnimatePresence mode="wait">
            {selected ? (
              <FacilityPanel key={selected.facility.id} item={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <AlertsPanel key="attention" facilities={view.facilities} onSelect={setSelectedId} />
            )}
          </AnimatePresence>
        </div>
      </div>

      <FacilityDirectory facilities={view.facilities} selectedId={selectedId} onSelect={setSelectedId} />
    </motion.div>
  );
}
