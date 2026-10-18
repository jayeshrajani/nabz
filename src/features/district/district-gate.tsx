"use client";

import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useDistrict, type DistrictState } from "./use-district";

/** Shared loading / error frame for tabs backed by the district view. */
export function DistrictGate({ children }: { children: (view: Extract<DistrictState, { status: "ready" }>["view"]) => React.ReactNode }) {
  const { state, reload } = useDistrict();
  const { t } = useI18n();

  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="space-y-6">
        <div className="flex h-[380px] items-center justify-center rounded-[var(--radius-hero)] bg-forest">
          <p className="animate-pulse font-display text-xl text-mint">{t("common.loading")}</p>
        </div>
        <div className="h-[420px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-[var(--radius-hero)] bg-forest p-10 text-center text-white">
        <h1 className="font-display text-2xl font-semibold">{t("common.errorTitle")}</h1>
        <p className="mt-2 text-sm text-white/70">{state.message}</p>
        <button type="button" onClick={reload} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-sm font-medium text-forest hover:bg-white">
          <RefreshCw aria-hidden className="size-4" /> {t("common.retry")}
        </button>
      </div>
    );
  }

  return <>{children(state.view)}</>;
}
