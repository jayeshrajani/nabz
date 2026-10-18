"use client";

import { useCallback, useEffect, useState } from "react";
import type { DistrictView } from "@/domain/district";
import { apiRequest } from "@/lib/api/client";
import { ensureSession } from "@/lib/api/session";

export type DistrictState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; view: DistrictView };

async function loadDistrict(): Promise<DistrictView> {
  await ensureSession();
  return apiRequest<DistrictView>("/api/facilities");
}

export function useDistrict() {
  const [state, setState] = useState<DistrictState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDistrict().then(
      (view) => {
        if (!cancelled) setState({ status: "ready", view });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load district data." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
