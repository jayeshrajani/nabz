import { z } from "zod";
import type { DistrictView } from "@/domain/district";
import { forecastStock } from "@/domain/forecast";
import { LOCALE_CODES, LOCALES, translate, type Locale, type MessageKey } from "@/i18n";

export const AssistantRequestSchema = z.object({
  question: z.string().trim().min(2).max(500),
  locale: z.enum(LOCALE_CODES).default("en"),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const AssistantAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  facts: z
    .array(z.object({ text: z.string().min(1).max(300), kind: z.enum(["recorded", "forecast"]), facilityId: z.string().max(64).optional() }))
    .max(8),
});
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;

export const ASSISTANT_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Direct answer to the question, 1-5 short sentences." },
    facts: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          kind: { type: "string", enum: ["recorded", "forecast"] },
          facilityId: { type: "string" },
        },
        required: ["text", "kind"],
      },
    },
  },
  required: ["answer", "facts"],
} as const;

/** Compact, bounded snapshot of the caller's own session. The only data the model ever sees. */
export function buildGrounding(view: DistrictView) {
  return {
    district: view.district.name,
    asOf: view.summary.lastUpdated,
    note: "Synthetic sample data. 'recorded' = stored observations; 'forecast' = nabz projections.",
    summary: {
      centres: view.summary.facilities,
      urgent: view.summary.critical,
      watch: view.summary.warning,
      bedsFree: view.summary.bedsTotal - view.summary.bedsOccupied,
      bedsTotal: view.summary.bedsTotal,
      doctorsAbsent: view.summary.doctorGap,
      patientsToday: view.summary.footfallToday,
    },
    centres: view.facilities.map(({ facility: f, assessment: a }) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      block: f.block,
      status: a.status,
      recorded: {
        bedsFree: f.beds.total - f.beds.occupied,
        bedsTotal: f.beds.total,
        doctorsPresent: f.doctors.present,
        doctorsRostered: f.doctors.scheduled,
        patientsToday: a.footfallToday,
        testsDown: f.diagnostics.filter((t) => !t.available || t.kitsRemaining === 0).map((t) => t.name),
      },
      issues: a.signals.map((s) => s.message),
      medicinesAtRisk: f.medicines
        .map((m) => ({ m, fc: forecastStock(m) }))
        .filter(({ fc }) => fc.shouldReorder || (fc.daysUntilStockOut !== null && Number.isFinite(fc.daysUntilStockOut) && fc.daysUntilStockOut < 14))
        .map(({ m, fc }) => ({
          medicine: m.name,
          inStock: m.quantity,
          forecastDaysLeft: fc.daysUntilStockOut,
          restockDays: m.leadTimeDays,
          suggestedOrder: fc.suggestedOrder,
        })),
    })),
    suggestedTransfers: view.suggestions.slice(0, 10).map((s) => ({
      medicine: s.medicineName,
      from: view.facilities.find((f) => f.facility.id === s.fromFacilityId)?.facility.name,
      to: view.facilities.find((f) => f.facility.id === s.toFacilityId)?.facility.name,
      quantity: s.quantity,
      unit: s.unit,
      distanceKm: s.distanceKm,
      receiverDaysBefore: s.receiver.daysLeftBefore,
      receiverDaysAfter: s.receiver.daysLeftAfter,
      donorDaysAfter: s.donor.daysLeftAfter,
    })),
    activeTransfers: view.transfers
      .filter((t) => t.status !== "received" && t.status !== "cancelled")
      .slice(0, 10)
      .map((t) => ({ medicineId: t.medicineId, from: t.fromFacilityId, to: t.toFacilityId, quantity: t.quantity, status: t.status })),
  };
}

export function systemPrompt(locale: Locale): string {
  const language = LOCALES.find((l) => l.code === locale)!.label;
  return [
    "You are nabz, a read-only assistant for a district health officer in India.",
    "Answer ONLY from the JSON context provided. Never invent centres, medicines, quantities or dates.",
    "If the context does not contain the answer, say so plainly.",
    "Distinguish recorded facts (observations) from forecasts (projections) in the facts list.",
    "You cannot change data or approve transfers; suggest the user do it in the app.",
    `Write the answer and fact texts in ${language} (${locale}), using Western digits (0-9) for numbers. Keep centre and medicine names as given.`,
    "Return JSON matching the schema. Keep the answer under 90 words.",
  ].join("\n");
}

/** Rejects answers that mention numbers (2+ digits) absent from the grounding context. */
export function findUngroundedNumber(answer: AssistantAnswer, contextText: string): string | null {
  const known = new Set(contextText.match(/\d+(?:\.\d+)?/g) ?? []);
  const text = [answer.answer, ...answer.facts.map((f) => f.text)].join(" ");
  for (const n of text.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (n.replace(".", "").length >= 2 && !known.has(n) && !known.has(String(Math.round(Number(n))))) return n;
  }
  return null;
}

type Topic = "medicine" | "beds" | "staffing" | "diagnostics" | "transfers" | "overview";

const TOPIC_WORDS: Record<Exclude<Topic, "overview">, RegExp> = {
  transfers: /transfer|spare|surplus|move|donor|redistribut|स्थानांतर|भेज|अतिरिक्त/i,
  medicine: /medicin|stock|drug|run out|tablet|दवा|औषध|ওষুধ|மருந்து|మందు|ಔಷಧ/i,
  beds: /bed|occup|बिस्तर|बेड|শয্যা|படுக்கை|పడక|ಹಾಸಿಗೆ/i,
  staffing: /doctor|staff|absent|attendance|डॉक्टर|ডাক্তার|மருத்துவர்|వైద్య|ವೈದ್ಯ/i,
  diagnostics: /test|diagnos|lab|kit|जांच|পরীক্ষা|பரிசோதனை|పరీక్ష|ಪರೀಕ್ಷ/i,
};

export function detectTopic(question: string): Topic {
  for (const [topic, re] of Object.entries(TOPIC_WORDS) as [Exclude<Topic, "overview">, RegExp][]) if (re.test(question)) return topic;
  return "overview";
}

/** Deterministic, localised answer built straight from the data; used when AI is off or fails. */
export function fallbackAnswer(view: DistrictView, question: string, locale: Locale): AssistantAnswer {
  const t = (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params);
  const topic = detectTopic(question);
  const name = (id: string) => view.facilities.find((f) => f.facility.id === id)?.facility.name ?? id;

  if (topic === "transfers") {
    const facts = view.suggestions.slice(0, 5).map((s) => ({
      kind: "forecast" as const,
      facilityId: s.toFacilityId,
      text: t("assistant.transferLine", { from: name(s.fromFacilityId), to: name(s.toFacilityId), qty: s.quantity, unit: s.unit, medicine: s.medicineName }),
    }));
    return { answer: facts.length ? t("assistant.fb.transfers") : t("assistant.fb.none"), facts };
  }

  const rows = view.facilities.flatMap(({ facility, assessment }) =>
    assessment.signals
      .filter((s) => topic === "overview" || s.domain === topic)
      .map((s) => ({ facility, s })),
  );
  rows.sort((a, b) => (a.s.severity === b.s.severity ? 0 : a.s.severity === "critical" ? -1 : 1));
  const facts = rows.slice(0, 6).map(({ facility, s }) => ({
    kind: (s.domain === "medicine" ? "forecast" : "recorded") as "forecast" | "recorded",
    facilityId: facility.id,
    text: `${facility.name}: ${translate(locale, `signal.${s.code}` as MessageKey, s.params)}`,
  }));
  return { answer: facts.length ? t(`assistant.fb.${topic}` as MessageKey) : t("assistant.fb.none"), facts };
}
