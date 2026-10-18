"use client";

import { Map as MapIcon, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SEVERITY_META } from "@/components/ui/status-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
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
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      webglSupport = Boolean(context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

function StageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-full place-items-center bg-[#0b231d]">
      <p role="status" className="text-sm text-white/75 motion-safe:animate-pulse">
        {children}
      </p>
    </div>
  );
}

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onFailure();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function NetworkStage({ title, panel, ...props }: Omit<NetworkProps, "labels"> & { title?: string; panel?: ReactNode }) {
  const { t } = useI18n();
  const labels = { healthy: t("status.healthy"), warning: t("status.warning"), critical: t("status.critical") };
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => null);
  const [preferred, setPreferred] = useState<"3d" | "2d">("3d");
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [cameraVersion, setCameraVersion] = useState(0);
  const stageRef = useRef<HTMLElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const mode = webgl === false || failed ? "2d" : preferred;
  const animate = props.animate && !reducedMotion && visible;
  const planned = props.transfers?.some((transfer) => transfer.status === "approved");
  const dispatched = props.transfers?.some((transfer) => transfer.status === "dispatched");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let intersecting = true;
    const updateVisibility = () => setVisible(intersecting && !document.hidden);
    const handleContextLoss = () => setFailed(true);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            intersecting = entry.isIntersecting;
            updateVisibility();
          });
    observer?.observe(stage);
    document.addEventListener("visibilitychange", updateVisibility);
    stage.addEventListener("webglcontextlost", handleContextLoss, true);
    updateVisibility();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      stage.removeEventListener("webglcontextlost", handleContextLoss, true);
    };
  }, []);

  return (
    <section ref={stageRef} aria-label={t("map.label")} className="relative isolate w-full bg-[#0b231d]">
      <div className="relative h-[440px] sm:h-[520px]">
        <div className={cn("absolute inset-0", panel && "lg:right-[340px] xl:right-[380px]")}>
          <div className="absolute inset-x-0 top-20 bottom-20 overflow-hidden sm:top-24 sm:bottom-16">
            {webgl === null ? (
              <StageMessage>{t("map.loading")}</StageMessage>
            ) : mode === "3d" ? (
              <div className="size-full" aria-hidden>
                <SceneBoundary onFailure={() => setFailed(true)}>
                  <DistrictNetwork3D key={cameraVersion} {...props} animate={animate} labels={labels} />
                </SceneBoundary>
              </div>
            ) : (
              <DistrictNetwork2D
                facilities={props.facilities}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                labels={labels}
                transfers={props.transfers}
              />
            )}
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0b231d] to-transparent" />

          <header className="pointer-events-none absolute top-5 right-5 left-5 flex items-start justify-between gap-3 sm:right-6 sm:left-6">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-2 text-mint/70">
                <MapIcon aria-hidden className="size-3.5" /> {t("map.label")}
              </p>
              {title && (
                <h2 className="mt-1.5 font-display text-2xl leading-tight font-semibold wrap-break-word text-white sm:text-3xl">{title}</h2>
              )}
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              {mode === "3d" && webgl && !failed && (
                <button
                  type="button"
                  aria-label={t("common.back")}
                  title={t("common.back")}
                  onClick={() => {
                    props.onSelect(null);
                    setCameraVersion((version) => version + 1);
                  }}
                  className="grid size-10 place-items-center rounded border border-white/20 text-white/85 transition-colors hover:border-mint hover:text-mint focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
                >
                  <RotateCcw aria-hidden className="size-4" />
                </button>
              )}
              {webgl && !failed && (
                <div role="group" aria-label={t("map.label")} className="flex rounded border border-white/20 bg-[#102e27] p-0.5 text-xs">
                  {(["3d", "2d"] as const).map((mapMode) => (
                    <button
                      key={mapMode}
                      type="button"
                      aria-pressed={mode === mapMode}
                      onClick={() => setPreferred(mapMode)}
                      className={cn(
                        "min-h-10 rounded-sm px-2.5 py-1 font-medium uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint",
                        mode === mapMode ? "bg-mint text-forest" : "text-white/75 hover:text-white",
                      )}
                    >
                      {mapMode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <ul
            aria-label={t("map.label")}
            className="pointer-events-none absolute right-6 bottom-5 left-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/85"
          >
            {(["healthy", "warning", "critical"] as const).map((severity) => (
              <li key={severity} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SEVERITY_META[severity].hex }} />
                {labels[severity]}
              </li>
            ))}
            {planned && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 border-t-2 border-dashed border-watch" />
                {t("map.planned")}
              </li>
            )}
            {dispatched && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 bg-[#8ddcce]" />
                {t("map.inTransit")}
              </li>
            )}
          </ul>
          {mode === "3d" && (
            <div className="sr-only focus-within:not-sr-only">
              <ul
                aria-label={t("directory.title")}
                className="absolute inset-x-5 top-24 bottom-20 z-10 overflow-y-auto bg-[#0b231d] p-3"
                onKeyDown={(event) => {
                  if (event.key === "Escape") props.onSelect(null);
                }}
              >
                {props.facilities.map(({ facility, assessment }) => (
                  <li key={facility.id}>
                    <button
                      type="button"
                      aria-pressed={props.selectedId === facility.id}
                      onClick={() => props.onSelect(props.selectedId === facility.id ? null : facility.id)}
                      className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-white focus-visible:outline-2 focus-visible:outline-mint"
                    >
                      {facility.name}, {labels[assessment.status]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(webgl === false || failed) && (
            <p role="status" className="sr-only">
              {t("map.flat")}
            </p>
          )}
        </div>
      </div>
      {panel && (
        <div className="border-t border-white/10 p-4 lg:absolute lg:inset-y-5 lg:right-5 lg:w-[300px] lg:border-0 lg:p-0 xl:w-[340px]">
          {panel}
        </div>
      )}
    </section>
  );
}
