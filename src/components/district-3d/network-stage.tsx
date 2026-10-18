"use client";

import { Box, LayoutGrid } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DistrictNetwork2D } from "./district-network-2d";
import type { NetworkProps } from "./district-network";

const DistrictNetwork3D = dynamic(() => import("./district-network").then((m) => m.DistrictNetwork), {
  ssr: false,
  loading: () => <StageMessage>Initialising spatial view…</StageMessage>,
});

let webglSupport: boolean | undefined;
function detectWebGL(): boolean {
  if (webglSupport === undefined) {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

function StageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid size-full place-items-center">
      <p className="animate-pulse text-xs tracking-wide text-fg-subtle uppercase">{children}</p>
    </div>
  );
}

export function NetworkStage(props: NetworkProps) {
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => null);
  const [preferred, setPreferred] = useState<"3d" | "2d">("3d");
  const mode = webgl === false ? "2d" : preferred;

  return (
    <section aria-label="District healthcare network" className="panel relative h-[380px] overflow-hidden sm:h-[460px] xl:h-[540px]">
      <div className="absolute inset-0">
        {webgl === null ? (
          <StageMessage>Preparing network…</StageMessage>
        ) : mode === "3d" ? (
          <div className="size-full" aria-hidden>
            <DistrictNetwork3D {...props} />
          </div>
        ) : (
          <DistrictNetwork2D facilities={props.facilities} selectedId={props.selectedId} onSelect={props.onSelect} />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div>
          <h2 className="text-sm font-medium">District network</h2>
          <p className="text-xs text-fg-subtle">
            {mode === "3d" ? "Drag to orbit · pillar height = today's footfall" : "2D view"} · ◆ CHC ● PHC
          </p>
        </div>
        {webgl && (
          <div role="group" aria-label="Network view" className="pointer-events-auto flex rounded-lg border border-line bg-ink-900/80 p-0.5">
            <Button size="sm" variant={mode === "3d" ? "primary" : "ghost"} aria-pressed={mode === "3d"} onClick={() => setPreferred("3d")}>
              <Box aria-hidden className="size-3.5" /> 3D
            </Button>
            <Button size="sm" variant={mode === "2d" ? "primary" : "ghost"} aria-pressed={mode === "2d"} onClick={() => setPreferred("2d")}>
              <LayoutGrid aria-hidden className="size-3.5" /> 2D
            </Button>
          </div>
        )}
      </div>
      {webgl === false && (
        <p className="absolute right-4 bottom-3 text-[11px] text-fg-subtle">WebGL unavailable — showing 2D view.</p>
      )}
    </section>
  );
}
