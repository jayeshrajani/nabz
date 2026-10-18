"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { AssessedFacility, StrugglingFacility } from "@/domain/district";
import { useI18n } from "@/i18n/provider";

export function StrugglingList({ ranking, facilities }: { ranking: StrugglingFacility[]; facilities: AssessedFacility[] }) {
  const { t, signal } = useI18n();
  if (ranking.length === 0) return null;
  const byId = new Map(facilities.map((f) => [f.facility.id, f]));

  return (
    <section aria-labelledby="struggling-heading" className="card p-6 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="struggling-heading" className="font-display text-xl font-semibold tracking-tight">
          {t("struggling.title")}
        </h2>
        <p className="text-sm text-ink-muted">{t("struggling.subtitle")}</p>
      </div>

      <ol className="mt-6 divide-y divide-line">
        {ranking.map((r, i) => {
          const item = byId.get(r.facilityId);
          if (!item) return null;
          const top = item.assessment.signals[0];
          return (
            <li key={r.facilityId}>
              <Link href={`/facilities/${r.facilityId}`} className="group flex items-center gap-5 py-4 sm:gap-8">
                <span aria-hidden className="tabular w-8 font-display text-4xl font-semibold text-line-strong transition-colors group-hover:text-brand">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-semibold">{item.facility.name}</span>
                  <span className="mt-1 block truncate text-sm text-ink-muted">{top && signal(top)}</span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1.5 md:flex">
                  {r.domains.map((d) => (
                    <span key={d} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-muted">
                      {t(`domain.${d}`)}
                    </span>
                  ))}
                </span>
                <ArrowUpRight aria-hidden className="size-5 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
