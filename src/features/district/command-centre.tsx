"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { FacilityDirectory } from "@/components/facilities/facility-directory";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { KpiStrip } from "@/components/facilities/kpi-strip";
import { Button } from "@/components/ui/button";
import type { DistrictView } from "@/domain/district";
import { useDistrict } from "./use-district";

const timeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function Skeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading district data…</span>
      <div className="h-10 w-72 animate-pulse rounded-lg bg-ink-850" />
      <div className="h-24 animate-pulse rounded-[var(--radius-panel)] bg-ink-900" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-[540px] animate-pulse rounded-[var(--radius-panel)] bg-ink-900" />
        <div className="h-[540px] animate-pulse rounded-[var(--radius-panel)] bg-ink-900" />
      </div>
    </div>
  );
}

export function CommandCentre() {
  const { state, reload } = useDistrict();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6">
      {state.status === "loading" && <Skeleton />}

      {state.status === "error" && (
        <div role="alert" className="panel mx-auto mt-24 max-w-md p-6 text-center">
          <h1 className="text-base font-semibold">District data unavailable</h1>
          <p className="mt-2 text-sm text-fg-muted">{state.message}</p>
          <Button className="mt-4" variant="primary" onClick={reload}>
            <RefreshCw aria-hidden className="size-4" /> Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <ReadyView view={state.view} selectedId={selectedId} onSelect={setSelectedId} onReload={reload} animate={!reducedMotion} />
      )}
    </div>
  );
}

function ReadyView({
  view,
  selectedId,
  onSelect,
  onReload,
  animate,
}: {
  view: DistrictView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReload: () => void;
  animate: boolean;
}) {
  const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-fg-subtle uppercase">
            District command centre
            <span className="rounded border border-signal-amber/30 px-1.5 py-px text-[10px] tracking-wide text-signal-amber">Synthetic data</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{view.district.name}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-fg-subtle">
          {view.summary.lastUpdated && (
            <span>
              Data as of <time dateTime={view.summary.lastUpdated}>{timeFormat.format(new Date(view.summary.lastUpdated))}</time>
            </span>
          )}
          <Button size="sm" variant="outline" onClick={onReload}>
            <RefreshCw aria-hidden className="size-3.5" /> Refresh
          </Button>
        </div>
      </header>

      <KpiStrip summary={view.summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <NetworkStage facilities={view.facilities} selectedId={selectedId} onSelect={onSelect} animate={animate} />
        <div className="min-h-[320px] xl:h-[540px]">
          <AnimatePresence mode="wait">
            {selected ? (
              <FacilityPanel key={selected.facility.id} item={selected} onClose={() => onSelect(null)} />
            ) : (
              <AlertsPanel key="alerts" facilities={view.facilities} onSelect={onSelect} />
            )}
          </AnimatePresence>
        </div>
      </div>

      <FacilityDirectory facilities={view.facilities} selectedId={selectedId} onSelect={onSelect} />
    </>
  );
}
