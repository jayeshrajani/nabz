import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDistrictView } from "@/domain/district";
import { buildSeedDistrict, buildSeedFacilities } from "@/domain/seed";
import { LOCALES, translate } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { bn } from "@/i18n/messages/bn";
import { hi } from "@/i18n/messages/hi";
import { kn } from "@/i18n/messages/kn";
import { mr } from "@/i18n/messages/mr";
import { ta } from "@/i18n/messages/ta";
import { te } from "@/i18n/messages/te";
import type { AIProvider } from "@/lib/ai/types";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { answerQuestion } from "@/lib/assistant/answer";
import { buildGrounding, detectTopic, fallbackAnswer, findUngroundedNumber } from "@/lib/assistant/grounding";

const AT = "2026-10-18T00:00:00.000Z";
const view = buildDistrictView(buildSeedDistrict("2026-10-18"), buildSeedFacilities(AT), []);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const fake = (answer: unknown): AIProvider => ({ name: "gemini", generateStructuredResponse: async () => answer });

describe("assistant grounding", () => {
  it("includes only the caller's centres and bounded lists", () => {
    const g = buildGrounding(view);
    expect(g.centres).toHaveLength(12);
    expect(g.suggestedTransfers.length).toBeLessThanOrEqual(10);
  });

  it("flags numbers that are not in the context", () => {
    const ctx = JSON.stringify(buildGrounding(view));
    expect(findUngroundedNumber({ answer: "There are 12 centres.", facts: [] }, ctx)).toBeNull();
    expect(findUngroundedNumber({ answer: "There are 98765 tablets.", facts: [] }, ctx)).toBe("98765");
  });

  it("routes questions to topics in English and Indian languages", () => {
    expect(detectTopic("Which medicines will run out?")).toBe("medicine");
    expect(detectTopic("किन केंद्रों में दवा की कमी है?")).toBe("medicine");
    expect(detectTopic("Where are doctors absent?")).toBe("staffing");
    expect(detectTopic("Which centres can spare stock?")).toBe("transfers");
    expect(detectTopic("hello")).toBe("overview");
  });

  it("builds a localised computed answer", () => {
    const a = fallbackAnswer(view, "Which medicines will run out?", "hi");
    expect(a.answer).toBe(translate("hi", "assistant.fb.medicine"));
    expect(a.facts.length).toBeGreaterThan(0);
  });
});

describe("answerQuestion", () => {
  it("returns a computed answer when no AI provider is configured", async () => {
    const r = await answerQuestion(view, "Where are doctors absent?", "en", [], 1000);
    expect(r).toMatchObject({ source: "computed", degraded: true });
  });

  it("uses a grounded AI answer", async () => {
    const r = await answerQuestion(view, "How many centres?", "en", [fake({ answer: "There are 12 centres.", facts: [] })], 1000);
    expect(r).toMatchObject({ source: "ai", provider: "gemini", answer: "There are 12 centres." });
  });

  it("rejects AI answers with fabricated numbers or unknown centres and degrades gracefully", async () => {
    const invented = await answerQuestion(view, "stock?", "en", [fake({ answer: "Order 4815162342 vials.", facts: [] })], 1000);
    expect(invented.source).toBe("computed");
    const ghost = await answerQuestion(
      view,
      "x",
      "en",
      [fake({ answer: "ok", facts: [{ text: "x", kind: "recorded", facilityId: "phc-ghost" }] })],
      1000,
    );
    expect(ghost.source).toBe("computed");
  });
});

describe("i18n dictionaries", () => {
  const dictionaries = { hi, bn, ta, te, mr, kn };
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

  it("ships at least five Indian languages", () => {
    expect(LOCALES.filter((l) => l.code !== "en").length).toBeGreaterThanOrEqual(5);
  });

  for (const [code, dict] of Object.entries(dictionaries)) {
    it(`${code} translates every key with the same placeholders`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[key], `${code}:${key}`).toBeTruthy();
        expect(placeholders(dict[key]), `${code}:${key}`).toBe(placeholders(en[key]));
      }
    });
  }
});

describe("rate limiter", () => {
  it("allows up to the limit per window", () => {
    let now = 0;
    const allow = createRateLimiter(2, 1000, () => now);
    expect([allow("a"), allow("a"), allow("a"), allow("b")]).toEqual([true, true, false, true]);
    now = 1001;
    expect(allow("a")).toBe(true);
  });
});
