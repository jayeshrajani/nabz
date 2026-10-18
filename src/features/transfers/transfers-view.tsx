"use client";

import { ArrowRight, Check, ChevronDown, Loader2, Package, Sparkles, Truck, Waypoints, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Tile } from "@/components/ui/tile";
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

const COLUMNS: { status: Transfer["status"]; dot: string }[] = [
  { status: "proposed", dot: "bg-ink-subtle" },
  { status: "approved", dot: "bg-watch" },
  { status: "dispatched", dot: "bg-brand" },
  { status: "received", dot: "bg-ok" },
];

type Mutate = ReturnType<typeof useMutate>;

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

const days = (n: number | null) => (n === null ? "?" : !Number.isFinite(n) ? "∞" : String(Math.round(n)));

/** Before/after days-of-stock bar, with the restock lead time marked. */
function CoverBar({ before, after, lead, tone }: { before: number | null; after: number | null; lead?: number; tone: "receiver" | "donor" }) {
  const max = Math.max(before ?? 0, after ?? 0, (lead ?? 0) * 2, 1);
  const pct = (v: number | null) => `${Math.min(100, ((v ?? 0) / max) * 100)}%`;
  return (
    <div className="relative h-2 w-full rounded-full bg-surface-2">
      <span className={cn("absolute inset-y-0 left-0 rounded-full", tone === "receiver" ? "bg-ok/35" : "bg-ink/15")} style={{ width: pct(tone === "receiver" ? after : before) }} />
      <span className={cn("absolute inset-y-0 left-0 rounded-full", tone === "receiver" ? "bg-alert" : "bg-ok")} style={{ width: pct(tone === "receiver" ? before : after) }} />
      {lead !== undefined && <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-ink/60" style={{ left: pct(lead) }} />}
    </div>
  );
}

function SuggestionRow({ s, view, mutate }: { s: TransferSuggestion; view: DistrictView; mutate: Mutate }) {
  const { t, number } = useI18n();
  const { ask } = useAssistant();
  const [open, setOpen] = useState(false);
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const from = name(s.fromFacilityId);
  const to = name(s.toFacilityId);

  return (
    <li className="py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="font-medium">{s.medicineName}</p>
          <p className="tabular text-sm text-ink-muted">
            {number(s.quantity)} {s.unit}, {t("transfers.route", { from, to, km: s.distanceKm })}
          </p>
        </div>
        <div>
          <p className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-muted">
              {t("transfers.receiver")}: <span className="font-medium text-ink">{to}</span>
            </span>
            <span className="tabular">
              <span className="text-alert-ink">{t("transfers.daysShort", { n: days(s.receiver.daysLeftBefore) })}</span> →{" "}
              <span className="font-medium text-ok-ink">{t("transfers.daysShort", { n: days(s.receiver.daysLeftAfter) })}</span>
            </span>
          </p>
          <CoverBar before={s.receiver.daysLeftBefore} after={s.receiver.daysLeftAfter} lead={s.receiver.leadTimeDays} tone="receiver" />
        </div>
        <div>
          <p className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-muted">
              {t("transfers.donor")}: <span className="font-medium text-ink">{from}</span>
            </span>
            <span className="tabular text-ink-muted">
              {t("transfers.daysShort", { n: days(s.donor.daysLeftBefore) })} → {t("transfers.daysShort", { n: days(s.donor.daysLeftAfter) })}
            </span>
          </p>
          <CoverBar before={s.donor.daysLeftBefore} after={s.donor.daysLeftAfter} tone="donor" />
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            disabled={mutate.pending !== null}
            onClick={() => void mutate.run(s.id, "/api/transfers", { fromFacilityId: s.fromFacilityId, toFacilityId: s.toFacilityId, medicineId: s.medicineId, quantity: s.quantity })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-medium text-white transition-colors hover:bg-forest-2 disabled:opacity-60"
          >
            {mutate.pending === s.id && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {t("transfers.propose")}
          </button>
          <button
            type="button"
            aria-label={t("transfers.ask")}
            onClick={() => ask(t("assistant.why", { qty: number(s.quantity), medicine: s.medicineName, from, to }))}
            className="grid size-9 place-items-center rounded-full border border-line text-ink-muted hover:border-brand hover:text-brand"
          >
            <Sparkles aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-label={t("transfers.why")}
            onClick={() => setOpen(!open)}
            className="grid size-9 place-items-center rounded-full border border-line text-ink-muted hover:text-ink"
          >
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      {open && (
        <ul className="mt-3 space-y-1.5 rounded-2xl bg-surface-2 p-4 text-sm text-ink-muted">
          <li>{t("transfers.receiverWhy", { to, before: days(s.receiver.daysLeftBefore), lead: s.receiver.leadTimeDays, after: days(s.receiver.daysLeftAfter) })}</li>
          <li>{t("transfers.donorWhy", { from, before: days(s.donor.daysLeftBefore), after: days(s.donor.daysLeftAfter) })}</li>
          {!s.coversFully && <li>{t("transfers.partial")}</li>}
          {s.alternatives > 0 && <li>{t("transfers.alternatives", { n: s.alternatives })}</li>}
        </ul>
      )}
    </li>
  );
}

function PipelineCard({ tr, view, mutate }: { tr: Transfer; view: DistrictView; mutate: Mutate }) {
  const { t, number } = useI18n();
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const medicine = view.facilities.flatMap((f) => f.facility.medicines).find((m) => m.id === tr.medicineId);

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-(--shadow-card)">
      <p className="text-sm font-medium">{medicine?.name}</p>
      <p className="tabular text-xs text-ink-muted">
        {number(tr.quantity)} {medicine?.unit}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {name(tr.fromFacilityId)} <ArrowRight aria-hidden className="size-3" /> {name(tr.toFacilityId)}
      </p>
      {NEXT_ACTIONS[tr.status].length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {NEXT_ACTIONS[tr.status].map((action) => (
            <button
              key={action}
              type="button"
              disabled={mutate.pending !== null}
              onClick={() => void mutate.run(`${tr.id}:${action}`, `/api/transfers/${tr.id}`, { action })}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-60",
                action === "cancel" ? "border border-line text-ink-muted hover:border-alert hover:text-alert-ink" : "bg-ink text-white hover:bg-forest",
              )}
            >
              {mutate.pending === `${tr.id}:${action}` ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : action === "receive" ? <Check aria-hidden className="size-3.5" /> : null}
              {t(`transfer.action.${action}`)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function TransfersView() {
  const { t, number } = useI18n();
  const mutate = useMutate();

  return (
    <DistrictGate>
      {(view) => {
        const units = view.suggestions.reduce((s, x) => s + x.quantity, 0);
        const helped = new Set(view.suggestions.map((s) => s.toFacilityId)).size;
        const moving = view.transfers.filter((x) => x.status === "approved" || x.status === "dispatched").length;
        const kpis: { icon: LucideIcon; label: string; value: number }[] = [
          { icon: Waypoints, label: t("kpi.suggested"), value: view.suggestions.length },
          { icon: Package, label: t("transfers.kpiUnits"), value: units },
          { icon: ArrowRight, label: t("transfers.kpiCentres"), value: helped },
          { icon: Truck, label: t("kpi.inProgress"), value: moving },
        ];

        return (
          <div className="space-y-6">
            <header className="grid gap-6 rounded-[26px] bg-forest p-7 text-white sm:p-9 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="eyebrow text-mint/80">{view.district.name}</p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("transfers.title")}</h1>
                <p className="mt-3 max-w-xl text-base text-white/70">{t("transfers.subtitle")}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 self-end">
                {kpis.map((k) => (
                  <div key={k.label} className="flex flex-col-reverse rounded-2xl bg-white/[0.06] p-4">
                    <dt className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                      <k.icon aria-hidden className="size-3.5" /> {k.label}
                    </dt>
                    <dd className="tabular font-display text-3xl font-semibold">{number(k.value)}</dd>
                  </div>
                ))}
              </dl>
            </header>

            {mutate.error && (
              <p role="alert" className="rounded-2xl bg-alert-soft px-5 py-3 text-sm text-alert-ink">
                {mutate.error}
              </p>
            )}

            <Tile icon={Truck} label={t("transfers.pipeline")}>
              <p className="-mt-2 mb-4 text-sm text-ink-muted">{t("transfers.note")}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {COLUMNS.map((col) => {
                  const items = view.transfers.filter((x) => x.status === col.status);
                  return (
                    <section key={col.status} aria-label={t(`transfer.status.${col.status}`)} className="rounded-[20px] bg-surface-2 p-3">
                      <h3 className="mb-3 flex items-center justify-between px-1 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={cn("size-2 rounded-full", col.dot)} />
                          {t(`transfer.status.${col.status}`)}
                        </span>
                        <span className="tabular text-xs text-ink-subtle">{items.length}</span>
                      </h3>
                      {items.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-subtle">{t("transfers.pipelineEmpty")}</p>
                      ) : (
                        <ul className="space-y-2">
                          {items.map((tr) => (
                            <PipelineCard key={tr.id} tr={tr} view={view} mutate={mutate} />
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </Tile>

            <Tile icon={Waypoints} label={t("transfers.suggestions")} aside={<span className="tabular text-xs text-ink-subtle">{view.suggestions.length}</span>}>
              {view.suggestions.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">{t("transfers.none")}</p>
              ) : (
                <ul className="-my-4 divide-y divide-line">
                  {view.suggestions.map((s) => (
                    <SuggestionRow key={s.id} s={s} view={view} mutate={mutate} />
                  ))}
                </ul>
              )}
            </Tile>
          </div>
        );
      }}
    </DistrictGate>
  );
}
