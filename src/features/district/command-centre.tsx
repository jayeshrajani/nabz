"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { NetworkStage } from "@/components/district-3d/network-stage";
import { AlertsPanel } from "@/components/facilities/alerts-panel";
import { DistrictHero } from "@/components/facilities/district-hero";
import { FacilityPanel } from "@/components/facilities/facility-panel";
import { StrugglingList } from "@/components/facilities/struggling-list";
import { DistrictGate } from "./district-gate";

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export function CommandCentre() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const motionProps = reducedMotion ? {} : reveal;

  return (
    <DistrictGate>
      {(view) => {
        const selected = view.facilities.find((f) => f.facility.id === selectedId) ?? null;
        return (
          <div className="space-y-6 sm:space-y-8">
            <DistrictHero view={view} />

            <motion.div {...motionProps} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
              <NetworkStage facilities={view.facilities} transfers={view.transfers} selectedId={selectedId} onSelect={setSelectedId} animate={!reducedMotion} />
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
          </div>
        );
      }}
    </DistrictGate>
  );
}
