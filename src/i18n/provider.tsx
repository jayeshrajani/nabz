"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { RiskSignal } from "@/domain/risk";
import { intlLocale, isLocale, translate, type Locale, type MessageKey, type Params } from "./index";

const STORAGE_KEY = "nabz-locale";
const listeners = new Set<() => void>();

function readLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : "en";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((l) => l());
}

interface I18n {
  locale: Locale;
  t: (key: MessageKey, params?: Params) => string;
  signal: (s: RiskSignal) => string;
  number: (n: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: MessageKey, params?: Params) => translate(locale, key, params), [locale]);
  const value = useMemo<I18n>(() => {
    const nf = new Intl.NumberFormat(intlLocale(locale));
    return {
      locale,
      t,
      signal: (s) => translate(locale, `signal.${s.code}` as MessageKey, s.params),
      number: (n) => nf.format(n),
    };
  }, [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
