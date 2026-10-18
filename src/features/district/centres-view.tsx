"use client";

import { FacilityDirectory } from "@/components/facilities/facility-directory";
import { useI18n } from "@/i18n/provider";
import { DistrictGate } from "./district-gate";

export function CentresView() {
  const { t, number } = useI18n();
  return (
    <DistrictGate>
      {(view) => (
        <div className="space-y-8">
          <header className="max-w-2xl">
            <p className="eyebrow text-ink-subtle">{view.district.name}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("centres.title")}</h1>
            <p className="mt-3 text-base text-ink-muted">{t("centres.subtitle")}</p>
          </header>
          <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
            {(
              [
                ["critical", view.summary.critical],
                ["warning", view.summary.warning],
                ["healthy", view.summary.facilities - view.summary.critical - view.summary.warning],
              ] as const
            ).map(([s, n]) => (
              <div key={s} className="card flex flex-col-reverse px-5 py-4">
                <dt className="text-sm text-ink-muted">{t(`status.${s}`)}</dt>
                <dd className="tabular font-display text-3xl font-semibold">{number(n)}</dd>
              </div>
            ))}
          </dl>
          <FacilityDirectory facilities={view.facilities} />
        </div>
      )}
    </DistrictGate>
  );
}
