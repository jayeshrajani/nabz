"use client";

import { ArrowRight, Check, ChevronDown, Loader2, Package, PackageCheck, Sparkles, Truck, Waypoints, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
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
function CoverBar({
  before,
  after,
  lead,
  tone,
}: {
  before: number | null;
  after: number | null;
  lead?: number;
  tone: "receiver" | "donor";
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useI18n();
  const finite = (value: number | null | undefined) => (value != null && Number.isFinite(value) ? Math.max(0, value) : 0);
  const max = Math.max(finite(before), finite(after), finite(lead) * 2, 1);
  const ratio = (value: number | null) => (value === Infinity ? 1 : Math.min(1, finite(value) / max));
  return (
    <div aria-hidden className="relative h-2 w-full rounded-sm bg-ink/10">
      <motion.span
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: ratio(tone === "receiver" ? after : before) }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
        className={cn("absolute inset-0 origin-left rounded-sm", tone === "receiver" ? "bg-ok/35" : "bg-ink/15")}
      />
      <motion.span
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: ratio(tone === "receiver" ? before : after) }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.06 }}
        className={cn("absolute inset-0 origin-left rounded-sm", tone === "receiver" ? "bg-alert" : "bg-ok")}
      />
      {lead !== undefined && (
        <span title={t("runout.restockMark")} className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${ratio(lead) * 100}%` }} />
      )}
    </div>
  );
}

function SuggestionRow({ s, view, mutate, index }: { s: TransferSuggestion; view: DistrictView; mutate: Mutate; index: number }) {
  const { t, number } = useI18n();
  const { ask } = useAssistant();
  const reduceMotion = useReducedMotion();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const from = name(s.fromFacilityId);
  const to = name(s.toFacilityId);

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      initial={reduceMotion ? false : { opacity: 0.5, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.25) }}
      className="min-w-0 border-b border-line py-5 last:border-b-0"
    >
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky text-cyan">
              <Package className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base leading-snug font-semibold">{s.medicineName}</h3>
              <p className="tabular mt-1 text-sm text-ink-muted">
                <span className="font-semibold text-ink">{number(s.quantity)}</span> {s.unit}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t("transfers.route", { from, to, km: s.distanceKm })}</p>
        </div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {(["receiver", "donor"] as const).map((tone) => {
            const cover = s[tone];
            return (
              <div key={tone} className="min-w-0">
                <p className="text-xs text-ink-muted">{t(`transfers.${tone}`)}</p>
                <p className="mt-1 text-sm font-medium">{tone === "receiver" ? to : from}</p>
                <div className="tabular mt-3 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-ink-muted">
                    {t("transfers.now")}{" "}
                    <span className={tone === "receiver" ? "font-medium text-alert-ink" : "font-medium text-ink"}>
                      {t("transfers.daysShort", { n: days(cover.daysLeftBefore) })}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="size-3 shrink-0 text-ink-muted" />
                  <span className="text-ink-muted">
                    {t("transfers.after")}{" "}
                    <span className="font-medium text-ok-ink">{t("transfers.daysShort", { n: days(cover.daysLeftAfter) })}</span>
                  </span>
                </div>
                <CoverBar
                  before={cover.daysLeftBefore}
                  after={cover.daysLeftAfter}
                  lead={tone === "receiver" ? s.receiver.leadTimeDays : undefined}
                  tone={tone}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={mutate.pending !== null}
          onClick={() =>
            void mutate.run(s.id, "/api/transfers", {
              fromFacilityId: s.fromFacilityId,
              toFacilityId: s.toFacilityId,
              medicineId: s.medicineId,
              quantity: s.quantity,
            })
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan disabled:cursor-wait disabled:opacity-60"
        >
          {mutate.pending === s.id ? (
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
          ) : (
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          )}
          {t("transfers.propose")}
        </button>
        <button
          type="button"
          aria-label={t("transfers.ask")}
          title={t("transfers.ask")}
          onClick={() => ask(t("assistant.why", { qty: number(s.quantity), medicine: s.medicineName, from, to }))}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-line-strong text-cyan transition-colors hover:border-cyan hover:bg-sky"
        >
          <Sparkles aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t("transfers.why")}
          title={t("transfers.why")}
          onClick={() => setOpen(!open)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-2",
            open ? "bg-surface-2 text-ink" : "text-ink-muted",
          )}
        >
          {t("transfers.why")}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="overflow-hidden"
          >
            <ul className="mt-4 space-y-2 border-l-2 border-cyan bg-sky/50 px-4 py-3 text-sm leading-relaxed text-ink-muted">
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function PipelineCard({ tr, view, mutate }: { tr: Transfer; view: DistrictView; mutate: Mutate }) {
  const { t, number } = useI18n();
  const reduceMotion = useReducedMotion();
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;
  const medicine = view.facilities.flatMap((f) => f.facility.medicines).find((m) => m.id === tr.medicineId);

  return (
    <motion.li
      layout={!reduceMotion}
      layoutId={reduceMotion ? undefined : `transfer-${tr.id}`}
      initial={reduceMotion ? false : { opacity: 0.5, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.28 }}
      className="min-w-0 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-cyan/50 focus-within:border-cyan"
    >
      <h4 className="text-sm leading-snug font-semibold">{medicine?.name}</h4>
      <p className="tabular mt-1 text-xs text-ink-muted">
        {number(tr.quantity)} {medicine?.unit}
      </p>
      <div className="mt-4 space-y-2 border-l border-line-strong pl-3 text-xs leading-relaxed">
        <p>
          <span className="block text-ink-muted">{t("transfers.donor")}</span>
          {name(tr.fromFacilityId)}
        </p>
        <p>
          <span className="block text-ink-muted">{t("transfers.receiver")}</span>
          {name(tr.toFacilityId)}
        </p>
      </div>
      {NEXT_ACTIONS[tr.status].length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          {NEXT_ACTIONS[tr.status].map((action) => (
            <button
              key={action}
              type="button"
              disabled={mutate.pending !== null}
              onClick={() => void mutate.run(`${tr.id}:${action}`, `/api/transfers/${tr.id}`, { action })}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-60",
                action === "cancel"
                  ? "border border-line text-ink-muted hover:border-alert hover:text-alert-ink"
                  : "bg-ink text-white hover:bg-forest",
              )}
            >
              {mutate.pending === `${tr.id}:${action}` ? (
                <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
              ) : action === "receive" ? (
                <PackageCheck aria-hidden className="size-3.5 shrink-0" />
              ) : action === "dispatch" ? (
                <Truck aria-hidden className="size-3.5 shrink-0" />
              ) : action === "cancel" ? (
                <X aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <Check aria-hidden className="size-3.5 shrink-0" />
              )}
              {t(`transfer.action.${action}`)}
            </button>
          ))}
        </div>
      )}
    </motion.li>
  );
}

export function TransfersView() {
  const { t, number } = useI18n();
  const mutate = useMutate();
  const reduceMotion = useReducedMotion();
  const workflowId = useId();

  return (
    <DistrictGate>
      {(view) => {
        const units = view.suggestions.reduce((s, x) => s + x.quantity, 0);
        const helped = new Set(view.suggestions.map((s) => s.toFacilityId)).size;
        const moving = view.transfers.filter((x) => x.status === "approved" || x.status === "dispatched").length;
        const route = [
          { icon: Waypoints, label: t("kpi.suggested"), value: view.suggestions.length },
          { icon: Package, label: t("transfers.kpiUnits"), value: units },
          { icon: Truck, label: t("kpi.inProgress"), value: moving },
        ];

        return (
          <div className="min-w-0 space-y-7">
            <header>
              <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-muted">
                <span>{view.district.name}</span>
                <span className="border-l border-line-strong pl-3">{t("common.sample")}</span>
              </p>
              <h1 className="max-w-3xl font-display text-2xl leading-tight font-semibold sm:text-3xl">{t("transfers.title")}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">{t("transfers.subtitle")}</p>
              <dl className="mt-6 grid min-w-0 grid-cols-1 border-y border-line sm:grid-cols-[1fr_1.4fr_1fr]">
                {route.map((item, index) => (
                  <div key={item.label} className={cn("relative min-w-0 px-5 py-4 sm:py-5", index === 1 ? "bg-citron" : "bg-sky")}>
                    <div aria-hidden className="mb-3 flex items-center gap-3">
                      <item.icon className={cn("size-5 shrink-0", index === 1 ? "text-forest" : "text-cyan")} />
                      <motion.span
                        initial={reduceMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : index * 0.08 }}
                        className="h-px flex-1 origin-left bg-ink/20"
                      />
                      <ArrowRight className="size-3.5 text-ink-muted" />
                    </div>
                    <dt className="text-xs leading-relaxed text-ink-muted">{item.label}</dt>
                    <dd>
                      <motion.span
                        key={item.value}
                        initial={reduceMotion ? false : { y: 8, opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.06 }}
                        className="tabular mt-1 block font-display text-3xl font-semibold sm:text-4xl"
                      >
                        {number(item.value)}
                      </motion.span>
                      {index === 1 && (
                        <span className="mt-2 block text-xs leading-relaxed text-ink-muted">
                          <span className="tabular font-semibold text-ink">{number(helped)}</span> {t("transfers.kpiCentres")}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </header>

            {mutate.error && (
              <p role="alert" className="border-l-2 border-alert bg-alert-soft px-5 py-3 text-sm text-alert-ink">
                {mutate.error}
              </p>
            )}

            <section aria-label={t("transfers.pipeline")}>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Truck aria-hidden className="size-5 text-cyan" />
                {t("transfers.pipeline")}
              </h2>
              <p className="mt-2 mb-5 max-w-4xl text-sm leading-relaxed text-ink-muted">{t("transfers.note")}</p>
              <LayoutGroup id={workflowId}>
                <div className="grid min-w-0 gap-x-5 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
                  {COLUMNS.map((col) => {
                    const items = view.transfers.filter((x) => x.status === col.status);
                    return (
                      <section
                        key={col.status}
                        aria-label={t(`transfer.status.${col.status}`)}
                        className="min-w-0 border-t-2 border-line-strong pt-3"
                      >
                        <h3 className="mb-4 flex items-start justify-between gap-2 text-sm font-medium">
                          <span className="flex min-w-0 items-center gap-2">
                            <span aria-hidden className={cn("size-2 rounded-full", col.dot)} />
                            {t(`transfer.status.${col.status}`)}
                          </span>
                          <motion.span
                            key={items.length}
                            initial={reduceMotion ? false : { y: 4 }}
                            animate={{ y: 0 }}
                            className="tabular min-w-6 shrink-0 text-right text-sm text-ink-muted"
                          >
                            {number(items.length)}
                          </motion.span>
                        </h3>
                        {items.length === 0 && (
                          <p className="border-b border-dashed border-line-strong px-3 py-7 text-center text-xs text-ink-muted">
                            {t("transfers.pipelineEmpty")}
                          </p>
                        )}
                        <ul className="space-y-3">
                          <AnimatePresence initial={false}>
                            {items.map((tr) => (
                              <PipelineCard key={tr.id} tr={tr} view={view} mutate={mutate} />
                            ))}
                          </AnimatePresence>
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </LayoutGroup>
            </section>

            <section aria-label={t("transfers.suggestions")} className="min-w-0 border-t border-line bg-surface px-4 pb-1 sm:px-5">
              <h2 className="flex items-center gap-2 border-b border-line py-4 font-display text-xl font-semibold">
                <Waypoints aria-hidden className="size-5 shrink-0 text-cyan" />
                {t("transfers.suggestions")}
                <span className="tabular ml-auto text-sm font-normal text-ink-muted">{number(view.suggestions.length)}</span>
              </h2>
              {view.suggestions.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">{t("transfers.none")}</p>
              ) : (
                <ul>
                  {view.suggestions.map((s, index) => (
                    <SuggestionRow key={s.id} s={s} view={view} mutate={mutate} index={index} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      }}
    </DistrictGate>
  );
}
