"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { GreetingTile } from "@/components/facilities/greeting-tile";
import { PatientsGauge } from "@/components/facilities/patients-gauge";
import { StatusMatrix } from "@/components/facilities/status-matrix";
import { StrugglingList } from "@/components/facilities/struggling-list";
import { DistrictGate } from "./district-gate";

export function CommandCentre() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const enter = (i: number) =>
    reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <DistrictGate>
      {(view) => {
        const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;
        return (
          <div className="grid gap-4 lg:grid-cols-12">
            <motion.div {...enter(0)} className="lg:col-span-4">
              <GreetingTile view={view} className="h-full min-h-[420px]" />
            </motion.div>
            <motion.div {...enter(1)} className="lg:col-span-3">
              <PatientsGauge view={view} className="h-full min-h-[420px]" />
            </motion.div>
            <motion.div {...enter(2)} className="lg:col-span-5">
              <StatusMatrix view={view} className="h-full min-h-[420px]" />
            </motion.div>

            <motion.div {...enter(3)} className="lg:col-span-8">
              <NetworkStage facilities={view.facilities} transfers={view.transfers} selectedId={selectedId} onSelect={setSelectedId} animate={!reducedMotion} />
            </motion.div>
            <motion.div {...enter(4)} className="min-h-[320px] lg:col-span-4 lg:h-[560px]">
              <AnimatePresence mode="wait">
                {selected ? (
                  <FacilityPanel key={selected.facility.id} item={selected} onClose={() => setSelectedId(null)} />
                ) : (
                  <AlertsPanel key="attention" facilities={view.facilities} onSelect={setSelectedId} />
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div {...enter(5)} className="lg:col-span-12">
              <StrugglingList ranking={view.struggling} facilities={view.facilities} />
            </motion.div>
          </div>
        );
      }}
    </DistrictGate>
  );
}
