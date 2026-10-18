"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ActivitySection, MedicinesSection, PatientsSection, RightNowSection, TestsSection } from "@/components/facilities/facility-sections";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFacility } from "./use-facility";

export function FacilityView({ id }: { id: string }) {
  const { state, reload, submit } = useFacility(id);

  return (
    <div className="space-y-6 pt-2">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> District
      </Link>

      {state.status === "loading" && (
        <div aria-busy="true" className="space-y-4">
          <div className="h-12 w-80 max-w-full animate-pulse rounded-2xl bg-line" />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface lg:col-span-8" />
            <div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface lg:col-span-4" />
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-semibold">Couldn&apos;t open this centre</h1>
          <p className="mt-2 text-sm text-ink-muted">{state.message}</p>
          <button type="button" onClick={reload} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white">
            <RefreshCw aria-hidden className="size-4" /> Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-ink-subtle">
                {state.detail.facility.type === "CHC" ? "Community Health Centre" : "Primary Health Centre"}, {state.detail.facility.block}
              </p>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{state.detail.facility.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge severity={state.detail.assessment.status} className="px-3 py-1 text-sm" />
              <span className="text-sm text-ink-muted">
                {state.detail.assessment.signals.length === 0
                  ? "Running like clockwork"
                  : `${state.detail.assessment.signals.length} ${state.detail.assessment.signals.length === 1 ? "thing" : "things"} to look at`}
              </span>
            </div>
          </header>

          {state.detail.assessment.signals.length > 0 && (
            <ul aria-label="What needs attention" className="flex flex-wrap gap-2">
              {state.detail.assessment.signals.map((s, i) => (
                <li
                  key={`${s.domain}-${s.ref ?? i}`}
                  className={s.severity === "critical" ? "rounded-full bg-alert-soft px-3 py-1.5 text-sm text-alert-ink" : "rounded-full bg-watch-soft px-3 py-1.5 text-sm text-watch-ink"}
                >
                  {s.message}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 lg:grid-cols-12">
            <PatientsSection detail={state.detail} submit={submit} />
            <RightNowSection detail={state.detail} submit={submit} />
            <MedicinesSection detail={state.detail} submit={submit} />
            <TestsSection detail={state.detail} submit={submit} />
            <ActivitySection detail={state.detail} />
          </div>
        </>
      )}
    </div>
  );
}
