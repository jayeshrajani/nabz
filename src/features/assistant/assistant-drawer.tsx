"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { useAssistant } from "./assistant-context";
import { ChatComposer, ChatThread } from "./chat-parts";

export const SUGGESTIONS: MessageKey[] = ["assistant.q1", "assistant.q2", "assistant.q3", "assistant.q4"];

export function AssistantDrawer() {
  const { open, setOpen, turns, send } = useAssistant();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

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

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {turns.length === 0 && (
                <div className="mb-4 space-y-4">
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
              <ChatThread />
            </div>

            <div className="border-t border-line bg-surface p-4">
              <ChatComposer id="assistant-drawer-input" inputRef={inputRef} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
