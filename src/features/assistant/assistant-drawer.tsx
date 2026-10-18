"use client";

import { ArrowUp, Bot, Loader2, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import { apiRequest } from "@/lib/api/client";
import { ensureSession } from "@/lib/api/session";
import type { AssistantReply } from "@/lib/assistant/answer";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-context";

type Turn = { role: "user"; text: string } | { role: "bot"; reply: AssistantReply } | { role: "error"; text: string };

const SUGGESTIONS: MessageKey[] = ["assistant.q1", "assistant.q2", "assistant.q3", "assistant.q4"];

export function AssistantDrawer() {
  const { open, setOpen, draft, setDraft } = useAssistant();
  const { t, locale } = useI18n();
  const reduced = useReducedMotion();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [turns, pending, reduced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setTurns((prev) => [...prev, { role: "user", text: q }]);
    setDraft("");
    setPending(true);
    try {
      await ensureSession();
      const reply = await apiRequest<AssistantReply>("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, locale }),
      });
      setTurns((prev) => [...prev, { role: "bot", reply }]);
    } catch (error) {
      setTurns((prev) => [...prev, { role: "error", text: error instanceof Error ? error.message : t("assistant.error") }]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            aria-hidden
            className="fixed inset-0 z-40 bg-forest/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-title"
            initial={reduced ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-paper shadow-2xl sm:rounded-l-[28px]"
          >
            <header className="flex items-start justify-between gap-3 bg-forest px-6 pt-6 pb-5 text-white sm:rounded-tl-[28px]">
              <div>
                <h2 id="assistant-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
                  <Sparkles aria-hidden className="size-5 text-mint" /> {t("assistant.title")}
                </h2>
                <p className="mt-1 text-sm text-white/65">{t("assistant.subtitle")}</p>
              </div>
              <button type="button" aria-label={t("common.close")} onClick={() => setOpen(false)} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X aria-hidden className="size-5" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
              {turns.length === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">{t("assistant.empty")}</p>
                  <ul className="flex flex-col gap-2">
                    {SUGGESTIONS.map((k) => (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => void send(t(k))}
                          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-brand hover:text-brand"
                        >
                          {t(k)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {turns.map((turn, i) =>
                turn.role === "user" ? (
                  <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">
                    {turn.text}
                  </p>
                ) : turn.role === "error" ? (
                  <p key={i} role="alert" className="w-fit max-w-[90%] rounded-2xl bg-alert-soft px-4 py-2.5 text-sm text-alert-ink">
                    {turn.text}
                  </p>
                ) : (
                  <div key={i} className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-md border border-line bg-surface p-4">
                    <p className="text-sm leading-relaxed">{turn.reply.answer}</p>
                    {turn.reply.facts.length > 0 && (
                      <ul className="space-y-1.5">
                        {turn.reply.facts.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                                f.kind === "forecast" ? "bg-watch-soft text-watch-ink" : "bg-brand-soft text-brand",
                              )}
                            >
                              {t(f.kind === "forecast" ? "assistant.forecast" : "assistant.recorded")}
                            </span>
                            <span className="text-ink-muted">{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-ink-subtle">
                      <Bot aria-hidden className="size-3.5" />
                      {turn.reply.source === "ai" ? t("assistant.byAi", { provider: turn.reply.provider === "cerebras" ? "Cerebras" : "Gemini" }) : t("assistant.computed")}
                    </p>
                  </div>
                ),
              )}

              {pending && (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 aria-hidden className="size-4 animate-spin" /> {t("assistant.thinking")}
                </p>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={onSubmit} className="border-t border-line bg-surface p-4">
              <label htmlFor="assistant-input" className="sr-only">
                {t("assistant.placeholder")}
              </label>
              <div className="flex items-end gap-2 rounded-3xl border border-line bg-paper p-2 focus-within:border-brand">
                <textarea
                  id="assistant-input"
                  ref={inputRef}
                  rows={1}
                  maxLength={500}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(draft);
                    }
                  }}
                  placeholder={t("assistant.placeholder")}
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-subtle"
                />
                <button
                  type="submit"
                  aria-label={t("assistant.send")}
                  disabled={pending || !draft.trim()}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-mint transition-opacity disabled:opacity-40"
                >
                  <ArrowUp aria-hidden className="size-5" />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
