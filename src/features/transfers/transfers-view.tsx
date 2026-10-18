"use client";

import { ArrowRight, Check, Loader2, Sparkles, Truck } from "lucide-react";
import { useState } from "react";
import type { DistrictView } from "@/domain/district";
import type { Transfer, TransferAction, TransferSuggestion } from "@/domain/redistribution";
import { useAssistant } from "@/features/assistant/assistant-context";
import { DistrictGate } from "@/features/district/district-gate";
import { useDistrict } from "@/features/district/use-district";
import { useI18n } from "@/i18n/provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const NEXT_ACTIONS: Record<Transfer["status"], TransferAction[]> = {
  proposed: ["approve", "cancel"],
  approved: ["dispatch", "cancel"],
  dispatched: ["receive"],
  received: [],
  cancelled: [],
};

const STEPS: Transfer["status"][] = ["proposed", "approved", "dispatched", "received"];

function useMutate() {
  const { setView } = useDistrict();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, path: string, body: unknown) {
    setPending(key);
    setError(null);
    try {
      const res = await apiRequest<{ view: DistrictView }>(path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      setView(res.view);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }
  return { pending, error, run };
}

function days(n: number | null): string {
  if (n === null) return "?";
  if (!Number.isFinite(n)) return "∞";
  return String(Math.round(n));
}

function SuggestionCard({ s, view, mutate }: { s: TransferSuggestion; view: DistrictView; mutate: ReturnType<typeof useMutate> }) {
  const { t, number } = useI18n();
  const { ask } = useAssistant();
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const from = name(s.fromFacilityId);
  const to = name(s.toFacilityId);

  return (
    <li className="card flex flex-col gap-5 p-6">
      <div>
        <p className="eyebrow text-ink-subtle">{t("transfers.route", { from, to, km: s.distanceKm })}</p>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
          {t("transfers.move", { qty: number(s.quantity), unit: s.unit, medicine: s.medicineName })}
        </h3>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-surface-2 p-4">
        <div>
          <p className="truncate text-sm font-medium">{from}</p>
          <p className="tabular text-xs text-ink-muted">
            {days(s.donor.daysLeftBefore)} <ArrowRight aria-hidden className="inline size-3" /> {days(s.donor.daysLeftAfter)}
          </p>
        </div>
        <Truck aria-hidden className="size-5 text-brand" />
        <div className="text-right">
          <p className="truncate text-sm font-medium">{to}</p>
          <p className="tabular text-xs">
            <span className="text-alert-ink">{days(s.receiver.daysLeftBefore)}</span> <ArrowRight aria-hidden className="inline size-3" />{" "}
            <span className="font-medium text-ok-ink">{days(s.receiver.daysLeftAfter)}</span>
          </p>
        </div>
      </div>

      <details className="group text-sm">
        <summary className="cursor-pointer list-none font-medium text-brand marker:hidden">{t("transfers.why")} →</summary>
        <ul className="mt-3 space-y-2 text-ink-muted">
          <li>
            {t("transfers.receiverWhy", {
              to,
              before: days(s.receiver.daysLeftBefore),
              lead: s.receiver.leadTimeDays,
              after: days(s.receiver.daysLeftAfter),
            })}
          </li>
          <li>{t("transfers.donorWhy", { from, before: days(s.donor.daysLeftBefore), after: days(s.donor.daysLeftAfter) })}</li>
          {!s.coversFully && <li>{t("transfers.partial")}</li>}
          {s.alternatives > 0 && <li>{t("transfers.alternatives", { n: s.alternatives })}</li>}
        </ul>
      </details>

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          disabled={mutate.pending !== null}
          onClick={() =>
            void mutate.run(s.id, "/api/transfers", { fromFacilityId: s.fromFacilityId, toFacilityId: s.toFacilityId, medicineId: s.medicineId, quantity: s.quantity })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-medium text-white transition-colors hover:bg-forest-2 disabled:opacity-60"
        >
          {mutate.pending === s.id && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {t("transfers.propose")}
        </button>
        <button
          type="button"
          onClick={() => ask(t("assistant.why", { qty: number(s.quantity), medicine: s.medicineName, from, to }))}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink-muted hover:border-brand hover:text-brand"
        >
          <Sparkles aria-hidden className="size-4" /> {t("transfers.ask")}
        </button>
      </div>
    </li>
  );
}

function TransferRow({ tr, view, mutate }: { tr: Transfer; view: DistrictView; mutate: ReturnType<typeof useMutate> }) {
  const { t, number } = useI18n();
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const medicine = view.facilities.flatMap((f) => f.facility.medicines).find((m) => m.id === tr.medicineId);
  const stepIndex = STEPS.indexOf(tr.status);

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {number(tr.quantity)} {medicine?.unit} {medicine?.name}
          </p>
          <p className="text-sm text-ink-muted">
            {name(tr.fromFacilityId)} <ArrowRight aria-hidden className="inline size-3.5" /> {name(tr.toFacilityId)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            tr.status === "received" ? "bg-ok-soft text-ok-ink" : tr.status === "cancelled" ? "bg-surface-2 text-ink-subtle" : "bg-watch-soft text-watch-ink",
          )}
        >
          {t(`transfer.status.${tr.status}`)}
        </span>
      </div>

      {tr.status !== "cancelled" && (
        <ol aria-label={t(`transfer.status.${tr.status}`)} className="mt-4 grid grid-cols-4 gap-1.5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col gap-1.5">
              <span aria-hidden className={cn("h-1.5 rounded-full", i <= stepIndex ? "bg-brand" : "bg-line")} />
              <span className={cn("text-[11px]", i <= stepIndex ? "text-ink" : "text-ink-subtle")}>{t(`transfer.status.${step}`)}</span>
            </li>
          ))}
        </ol>
      )}

      {NEXT_ACTIONS[tr.status].length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {NEXT_ACTIONS[tr.status].map((action) => (
            <button
              key={action}
              type="button"
              disabled={mutate.pending !== null}
              onClick={() => void mutate.run(`${tr.id}:${action}`, `/api/transfers/${tr.id}`, { action })}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60",
                action === "cancel" ? "border border-line text-ink-muted hover:border-alert hover:text-alert-ink" : "bg-ink text-white hover:bg-forest",
              )}
            >
              {mutate.pending === `${tr.id}:${action}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : action === "receive" ? <Check aria-hidden className="size-4" /> : null}
              {t(`transfer.action.${action}`)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function TransfersView() {
  const { t } = useI18n();
  const mutate = useMutate();

  return (
    <DistrictGate>
      {(view) => {
        const active = view.transfers.filter((x) => x.status === "proposed" || x.status === "approved" || x.status === "dispatched");
        const done = view.transfers.filter((x) => x.status === "received" || x.status === "cancelled").slice(0, 6);
        return (
          <div className="space-y-10">
            <header className="grid gap-6 rounded-[var(--radius-hero)] bg-forest p-8 text-white sm:p-10 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="eyebrow text-mint/80">{view.district.name}</p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("transfers.title")}</h1>
                <p className="mt-4 max-w-xl text-base text-white/70">{t("transfers.subtitle")}</p>
              </div>
              <p className="self-end rounded-2xl border border-white/10 p-5 text-sm leading-relaxed text-white/70">{t("transfers.note")}</p>
            </header>

            {mutate.error && (
              <p role="alert" className="rounded-2xl bg-alert-soft px-5 py-3 text-sm text-alert-ink">
                {mutate.error}
              </p>
            )}

            <section aria-labelledby="active-heading">
              <h2 id="active-heading" className="mb-4 font-display text-xl font-semibold tracking-tight">
                {t("transfers.active")}
              </h2>
              {active.length === 0 ? (
                <p className="card p-6 text-sm text-ink-muted">{t("transfers.activeEmpty")}</p>
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {active.map((tr) => (
                    <TransferRow key={tr.id} tr={tr} view={view} mutate={mutate} />
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="suggestions-heading">
              <h2 id="suggestions-heading" className="mb-4 font-display text-xl font-semibold tracking-tight">
                {t("transfers.suggestions")}
              </h2>
              {view.suggestions.length === 0 ? (
                <p className="card p-6 text-sm text-ink-muted">{t("transfers.none")}</p>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {view.suggestions.map((s) => (
                    <SuggestionCard key={s.id} s={s} view={view} mutate={mutate} />
                  ))}
                </ul>
              )}
            </section>

            {done.length > 0 && (
              <section aria-labelledby="done-heading">
                <h2 id="done-heading" className="mb-4 font-display text-xl font-semibold tracking-tight">
                  {t("transfers.done")}
                </h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {done.map((tr) => (
                    <TransferRow key={tr.id} tr={tr} view={view} mutate={mutate} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </DistrictGate>
  );
}
