import { bn } from "./messages/bn";
import { en, type MessageKey, type Messages } from "./messages/en";
import { hi } from "./messages/hi";
import { kn } from "./messages/kn";
import { mr } from "./messages/mr";
import { ta } from "./messages/ta";
import { te } from "./messages/te";

export const LOCALES = [
  { code: "en", label: "English", intl: "en-IN" },
  { code: "hi", label: "हिन्दी", intl: "hi-IN" },
  { code: "bn", label: "বাংলা", intl: "bn-IN" },
  { code: "ta", label: "தமிழ்", intl: "ta-IN" },
  { code: "te", label: "తెలుగు", intl: "te-IN" },
  { code: "mr", label: "मराठी", intl: "mr-IN" },
  { code: "kn", label: "ಕನ್ನಡ", intl: "kn-IN" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const LOCALE_CODES = LOCALES.map((l) => l.code) as [Locale, ...Locale[]];

const DICTIONARIES: Record<Locale, Messages> = { en, hi, bn, ta, te, mr, kn };

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const template = DICTIONARIES[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

export function intlLocale(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)!.intl;
}

export type { MessageKey };
