"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { SEVERITY_META } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { DistrictNetwork2D } from "./district-network-2d";
import type { NetworkProps } from "./district-network";

const DistrictNetwork3D = dynamic(() => import("./district-network").then((m) => m.DistrictNetwork), {
  ssr: false,
  loading: () => <StageMessage>Loading map</StageMessage>,
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
    <div className="grid size-full place-items-center bg-[#f4f7f2]">
      <p className="animate-pulse text-sm text-ink-subtle">{children}</p>
    </div>
  );
}

export function NetworkStage(props: NetworkProps) {
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => null);
  const [preferred, setPreferred] = useState<"3d" | "2d">("3d");
  const mode = webgl === false ? "2d" : preferred;

  return (
    <section aria-label="District map" className="card relative h-[360px] overflow-hidden sm:h-[460px] lg:h-[560px]">
      <div className="absolute inset-0">
        {webgl === null ? (
          <StageMessage>Loading map</StageMessage>
        ) : mode === "3d" ? (
          <div className="size-full" aria-hidden>
            <DistrictNetwork3D {...props} />
          </div>
        ) : (
          <DistrictNetwork2D facilities={props.facilities} selectedId={props.selectedId} onSelect={props.onSelect} />
        )}
      </div>

      {webgl && (
        <div role="group" aria-label="Map style" className="absolute top-4 right-4 flex rounded-full border border-line bg-surface/90 p-0.5 text-xs backdrop-blur">
          {(["3d", "2d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setPreferred(m)}
              className={cn("rounded-full px-3 py-1 font-medium uppercase", mode === m ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <ul aria-label="Legend" className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-x-4 gap-y-1 rounded-full bg-surface/90 px-4 py-2 text-xs text-ink-muted backdrop-blur">
        {(["healthy", "warning", "critical"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: SEVERITY_META[s].hex }} />
            {SEVERITY_META[s].label}
          </li>
        ))}
        <li className="hidden text-ink-subtle sm:block">Cubes are CHCs, spheres are PHCs</li>
      </ul>
      {webgl === false && <p className="absolute top-4 right-4 text-xs text-ink-subtle">Showing flat map</p>}
    </section>
  );
}
