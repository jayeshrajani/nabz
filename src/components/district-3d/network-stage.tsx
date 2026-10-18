"use client";

import { Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { SEVERITY_META } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { DistrictNetwork2D } from "./district-network-2d";
import type { NetworkProps } from "./district-network";

const DistrictNetwork3D = dynamic(() => import("./district-network").then((m) => m.DistrictNetwork), {
  ssr: false,
  loading: () => <StageMessage>…</StageMessage>,
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

function StageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-full place-items-center bg-[#0b231d]">
      <p className="animate-pulse text-sm text-white/50">{children}</p>
    </div>
  );
}

/** Dark hero card hosting the district map, with an optional floating panel on the right. */
export function NetworkStage({ title, panel, ...props }: Omit<NetworkProps, "labels"> & { title?: string; panel?: ReactNode }) {
  const { t } = useI18n();
  const labels = { healthy: t("status.healthy"), warning: t("status.warning"), critical: t("status.critical") };
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => null);
  const [preferred, setPreferred] = useState<"3d" | "2d">("3d");
  const mode = webgl === false ? "2d" : preferred;
  const moving = props.transfers?.some((x) => x.status === "approved" || x.status === "dispatched");

  return (
    <section aria-label={t("map.label")} className="relative h-[420px] overflow-hidden rounded-[30px] bg-[#0b231d] text-white shadow-(--shadow-lift) sm:h-[520px] lg:h-[640px]">
      <div className="absolute inset-0">
        {webgl === null ? (
          <StageMessage>{t("map.loading")}</StageMessage>
        ) : mode === "3d" ? (
          <div className="size-full" aria-hidden>
            <DistrictNetwork3D {...props} labels={labels} />
          </div>
        ) : (
          <DistrictNetwork2D facilities={props.facilities} selectedId={props.selectedId} onSelect={props.onSelect} labels={labels} />
        )}
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0b231d] to-transparent" />

      <header className="pointer-events-none absolute top-5 left-6 right-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-mint/70">
            <MapIcon aria-hidden className="size-3.5" /> {t("map.label")}
          </p>
          {title && <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>}
        </div>
        {webgl && (
          <div role="group" aria-label={t("map.label")} className="pointer-events-auto flex rounded-full border border-white/15 bg-white/5 p-0.5 text-xs backdrop-blur">
            {(["3d", "2d"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setPreferred(m)}
                className={cn("rounded-full px-3 py-1 font-medium uppercase transition-colors", mode === m ? "bg-mint text-forest" : "text-white/60 hover:text-white")}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </header>

      {panel && <div className="absolute top-24 right-5 bottom-5 w-[380px]">{panel}</div>}

      <ul aria-label={t("map.label")} className="pointer-events-none absolute bottom-5 left-6 flex flex-wrap gap-x-4 gap-y-1 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-white/75 backdrop-blur">
        {(["healthy", "warning", "critical"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: SEVERITY_META[s].hex }} />
            {labels[s]}
          </li>
        ))}
        <li className="hidden text-white/45 sm:block">{t("map.legendShape")}</li>
        {moving && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 border-t-2 border-dashed border-watch" />
            {t("map.planned")}
            <span aria-hidden className="ml-2 h-0.5 w-4 bg-mint" />
            {t("map.inTransit")}
          </li>
        )}
      </ul>
      {webgl === false && <p className="absolute top-20 left-6 text-xs text-white/50">{t("map.flat")}</p>}
    </section>
  );
}
