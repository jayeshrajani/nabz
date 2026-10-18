"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { DistrictHero } from "@/components/facilities/district-hero";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { GreetingTile } from "@/components/facilities/greeting-tile";
import { HistoryTile } from "@/components/facilities/history-tile";
import { KpiRow } from "@/components/facilities/kpi-row";
import { PatientsGauge } from "@/components/facilities/patients-gauge";
import { StatusMatrix } from "@/components/facilities/status-matrix";
import { StockOutTile } from "@/components/facilities/stock-out-tile";
import { StrugglingList } from "@/components/facilities/struggling-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { DistrictGate } from "./district-gate";

export function CommandCentre() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const wide = useMediaQuery("(min-width: 1024px)");
  const enter = (i: number) =>
    reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } };
  const reveal = reducedMotion
    ? {}
    : { initial: { opacity: 0, y: 32 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <DistrictGate>
      {(view) => {
        const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;
        const panel = (
          <AnimatePresence mode="wait">
            {selected ? (
              <FacilityPanel key={selected.facility.id} item={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <AlertsPanel key="attention" facilities={view.facilities} onSelect={setSelectedId} />
            )}
          </AnimatePresence>
        );
        return (
          <div className="grid gap-4 lg:grid-cols-12">
            <motion.div {...enter(0)} className="lg:col-span-8">
              <DistrictHero view={view} className="h-full min-h-[440px]" />
            </motion.div>
            <motion.div {...enter(1)} className="lg:col-span-4">
              <GreetingTile view={view} className="h-full min-h-[440px]" />
            </motion.div>

            <motion.div {...enter(2)} className="overflow-hidden rounded-[var(--radius-hero)] lg:col-span-12">
              <NetworkStage
                title={view.district.name}
                facilities={view.facilities}
                transfers={view.transfers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                animate={!reducedMotion}
                panel={wide ? panel : undefined}
              />
              {!wide && <div className="mt-4 min-h-[320px]">{panel}</div>}
            </motion.div>

            <motion.div {...reveal} className="lg:col-span-12">
              <KpiRow view={view} />
            </motion.div>

            <motion.div {...reveal} className="lg:col-span-12">
              <StockOutTile view={view} />
            </motion.div>

            <motion.div {...reveal} className="lg:col-span-4">
              <PatientsGauge view={view} className="h-full min-h-[400px]" />
            </motion.div>
            <motion.div {...reveal} className="lg:col-span-8">
              <StatusMatrix view={view} className="h-full min-h-[400px]" />
            </motion.div>

            <motion.div {...reveal} className="lg:col-span-7">
              <HistoryTile view={view} className="h-full" />
            </motion.div>
            <motion.div {...reveal} className="lg:col-span-5">
              <StrugglingList flags={view.interventions} facilities={view.facilities} />
            </motion.div>
          </div>
        );
      }}
    </DistrictGate>
  );
}
