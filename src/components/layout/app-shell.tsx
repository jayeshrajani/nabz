"use client";

import { Languages, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BRAND } from "@/config/brand";
import { useAssistant } from "@/features/assistant/assistant-context";
import { LOCALES, isLocale, type MessageKey } from "@/i18n";
import { setLocale, useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: MessageKey; match: (p: string) => boolean }[] = [
  { href: "/", label: "nav.overview", match: (p) => p === "/" },
  { href: "/centres", label: "nav.centres", match: (p) => p.startsWith("/centres") || p.startsWith("/facilities") },
  { href: "/transfers", label: "nav.transfers", match: (p) => p.startsWith("/transfers") },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const { setOpen } = useAssistant();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-4 sm:px-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight text-ink">{BRAND.name}</span>
            <span className="hidden text-sm text-ink-subtle xl:inline">{t("brand.tagline")}</span>
          </Link>

          <nav aria-label="Primary" className="mx-auto">
            <ul className="flex rounded-full border border-line bg-surface p-1 text-sm">
              {TABS.map((tab) => {
                const active = tab.match(pathname);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("block rounded-full px-3 py-1.5 font-medium transition-colors sm:px-4", active ? "bg-forest text-white" : "text-ink-muted hover:text-ink")}
                    >
                      {t(tab.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <label className="relative flex items-center">
              <span className="sr-only">{t("nav.language")}</span>
              <Languages aria-hidden className="pointer-events-none absolute left-3 size-4 text-ink-subtle" />
              <select
                value={locale}
                onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
                className="h-9 appearance-none rounded-full border border-line bg-surface pr-3 pl-9 text-sm text-ink-muted hover:border-line-strong"
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="hidden h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-medium text-white transition-colors hover:bg-forest-2 sm:inline-flex"
            >
              <Sparkles aria-hidden className="size-4 text-mint" /> {t("nav.ask")}
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1360px] px-4 pt-6 pb-24 sm:px-8">
        {children}
      </main>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.ask")}
        className="fixed right-5 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-forest text-mint shadow-(--shadow-lift) transition-transform hover:scale-105 sm:hidden"
      >
        <Sparkles aria-hidden className="size-6" />
      </button>
    </div>
  );
}
