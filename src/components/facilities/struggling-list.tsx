"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { AssessedFacility } from "@/domain/district";
import type { InterventionFlag } from "@/domain/interventions";
import { useI18n } from "@/i18n/provider";

export function StrugglingList({ flags, facilities }: { flags: InterventionFlag[]; facilities: AssessedFacility[] }) {
  const { t, signal } = useI18n();
  if (flags.length === 0) return null;
  const byId = new Map(facilities.map((f) => [f.facility.id, f]));

  return (
    <section aria-labelledby="intervene-heading" className="card p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="intervene-heading" className="font-display text-xl font-semibold tracking-tight">
          {t("intervene.title")}
        </h2>
        <p className="text-sm text-ink-muted">{t("intervene.subtitle")}</p>
      </div>

      <ol className="mt-6 divide-y divide-line">
        {flags.map((flag) => {
          const item = byId.get(flag.facilityId);
          if (!item) return null;
          const top = item.assessment.signals[0];
          const urgent = flag.priority === "urgent";
          return (
            <li key={flag.facilityId}>
              <Link href={`/facilities/${flag.facilityId}`} className="group flex items-start gap-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold">{item.facility.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgent ? "bg-alert-soft text-alert-ink" : "bg-watch-soft text-watch-ink"}`}>
                      {t(urgent ? "intervene.urgent" : "intervene.high")}
                    </span>
                    {flag.kinds.map((k) => (
                      <span key={k} className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                        {t(`intervene.kind.${k}`)}
                      </span>
                    ))}
                  </span>
                  {top && <span className="mt-1 block text-sm text-ink-muted">{signal(top)}</span>}
                  {flag.patientsPerDoctor !== null && <span className="block text-sm text-ink-muted">{t("intervene.load", { n: flag.patientsPerDoctor })}</span>}
                  {flag.actions.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm text-ink">
                      {flag.actions.map((a) => (
                        <li key={a}>{t(`intervene.action.${a}`)}</li>
                      ))}
                    </ul>
                  )}
                </span>
                <ArrowUpRight aria-hidden className="mt-1 size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
