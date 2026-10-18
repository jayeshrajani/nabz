"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DistrictView } from "@/domain/district";
import { apiRequest } from "@/lib/api/client";
import { ensureSession } from "@/lib/api/session";

export type DistrictState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; view: DistrictView };

interface DistrictContextValue {
  state: DistrictState;
  reload: () => void;
  /** Replace the view with a fresher one returned by a mutation. */
  setView: (view: DistrictView) => void;
}

const DistrictContext = createContext<DistrictContextValue | null>(null);

async function loadDistrict(): Promise<DistrictView> {
  await ensureSession();
  return apiRequest<DistrictView>("/api/facilities");
}

/** Holds district data above the tabs so switching tabs doesn't refetch. */
export function DistrictProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DistrictState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDistrict().then(
      (view) => !cancelled && setState({ status: "ready", view }),
      (error: unknown) =>
        !cancelled && setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load district data." }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setView = useCallback((view: DistrictView) => setState({ status: "ready", view }), []);

  return <DistrictContext.Provider value={{ state, reload, setView }}>{children}</DistrictContext.Provider>;
}

export function useDistrict(): DistrictContextValue {
  const ctx = useContext(DistrictContext);
  if (!ctx) throw new Error("useDistrict must be used inside DistrictProvider");
  return ctx;
}
