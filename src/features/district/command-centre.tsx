"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { DistrictHero } from "@/components/facilities/district-hero";
import { FacilityDirectory } from "@/components/facilities/facility-directory";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { StrugglingList } from "@/components/facilities/struggling-list";
import { useDistrict } from "./use-district";

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-6 pt-2">
      <div className="flex h-[420px] items-center justify-center rounded-[var(--radius-hero)] bg-forest">
        <p className="animate-pulse font-display text-xl text-mint">Taking the district&apos;s pulse…</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="h-[540px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
        <div className="h-[540px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
      </div>
    </div>
  );
}

const reveal = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } };

export function CommandCentre() {
  const { state, reload } = useDistrict();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const motionProps = reducedMotion ? {} : reveal;

  if (state.status === "loading") return <Skeleton />;

  if (state.status === "error") {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-[var(--radius-hero)] bg-forest p-10 text-center text-white">
        <h1 className="font-display text-2xl font-semibold">Lost the pulse for a moment</h1>
        <p className="mt-2 text-sm text-white/70">{state.message}</p>
        <button type="button" onClick={reload} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-sm font-medium text-forest hover:bg-white">
          <RefreshCw aria-hidden className="size-4" /> Try again
        </button>
      </div>
    );
  }

  const { view } = state;
  const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;

  return (
    <div className="space-y-6 pt-2 sm:space-y-8">
      <DistrictHero view={view} />

      <motion.div {...motionProps} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
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
      </motion.div>

      <motion.div {...motionProps}>
        <StrugglingList ranking={view.struggling} facilities={view.facilities} />
      </motion.div>

      <motion.div {...motionProps} className="pt-4">
        <FacilityDirectory facilities={view.facilities} />
      </motion.div>
    </div>
  );
}
