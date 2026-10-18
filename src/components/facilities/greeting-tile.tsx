"use client";

import { Maximize2, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Tile } from "@/components/ui/tile";
import type { DistrictView } from "@/domain/district";
import { useAssistant } from "@/features/assistant/assistant-context";
import { SUGGESTIONS } from "@/features/assistant/assistant-drawer";
import { ChatComposer, ChatThread } from "@/features/assistant/chat-parts";
import { useI18n } from "@/i18n/provider";

/** Greeting that doubles as the inline assistant; shares its conversation with the drawer. */
export function GreetingTile({ view, className }: { view: DistrictView; className?: string }) {
  const { t } = useI18n();
  const { turns, send, setOpen } = useAssistant();
  const reduced = useReducedMotion();
  const city = view.district.name.replace(/ District$/, "");

  return (
    <Tile
      icon={MessageCircle}
      label={t("assistant.label")}
      tone="dark"
      className={className}
      aside={
        <button
          type="button"
          aria-label={t("nav.ask")}
          onClick={() => setOpen(true)}
          className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <Maximize2 aria-hidden className="size-4" />
        </button>
      }
    >
      {turns.length === 0 ? (
        <div className="flex flex-1 flex-col">
          <motion.h2
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl leading-[0.95] font-semibold tracking-tight sm:text-5xl"
          >
            {t("greet.title", { district: city })}
          </motion.h2>
          <p className="mt-5 font-mono text-[13px] leading-relaxed text-mint/90">
            <span className="text-white/40">&gt; </span>
            {t("greet.prompt", { district: city })}
            <span aria-hidden className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-mint" />
          </p>
          <ul className="mt-auto flex flex-wrap gap-2 pt-6">
            {SUGGESTIONS.slice(0, 3).map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => void send(t(k))}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-left text-xs text-white/75 transition-colors hover:border-mint/60 hover:text-white"
                >
                  {t(k)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ChatThread tone="dark" className="-mx-1 max-h-[260px] flex-1 overflow-y-auto px-1" />
      )}
      <div className="mt-4">
        <ChatComposer tone="dark" id="assistant-tile-input" />
      </div>
    </Tile>
  );
}
