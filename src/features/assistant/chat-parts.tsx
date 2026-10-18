"use client";

import { ArrowUp, Bot, Loader2 } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-context";

type Tone = "light" | "dark";

export function ChatThread({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const { turns, pending } = useAssistant();
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, pending]);

  return (
    <div className={cn("space-y-3", className)} aria-live="polite">
      {turns.map((turn, i) =>
        turn.role === "user" ? (
          <p key={i} className={cn("ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2 text-sm", dark ? "bg-mint text-forest" : "bg-ink text-white")}>
            {turn.text}
          </p>
        ) : turn.role === "error" ? (
          <p key={i} role="alert" className="w-fit max-w-[90%] rounded-2xl bg-alert-soft px-4 py-2 text-sm text-alert-ink">
            {turn.text}
          </p>
        ) : (
          <div key={i} className={cn("max-w-[94%] space-y-2.5 rounded-2xl rounded-bl-md p-4", dark ? "bg-white/[0.07] text-white" : "border border-line bg-surface")}>
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
                    <span className={dark ? "text-white/70" : "text-ink-muted"}>{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={cn("flex items-center gap-1.5 pt-1 text-[11px]", dark ? "text-white/40" : "text-ink-subtle")}>
              <Bot aria-hidden className="size-3.5" />
              {turn.reply.source === "ai" ? t("assistant.byAi", { provider: turn.reply.provider === "cerebras" ? "Cerebras" : "Gemini" }) : t("assistant.computed")}
            </p>
          </div>
        ),
      )}
      {pending && (
        <p className={cn("flex items-center gap-2 text-sm", dark ? "text-white/60" : "text-ink-muted")}>
          <Loader2 aria-hidden className="size-4 animate-spin" /> {t("assistant.thinking")}
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}

export function ChatComposer({ tone = "light", inputRef, id }: { tone?: Tone; inputRef?: RefObject<HTMLTextAreaElement | null>; id: string }) {
  const { draft, setDraft, send, pending } = useAssistant();
  const { t } = useI18n();
  const dark = tone === "dark";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(draft);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("assistant.placeholder")}
      </label>
      <div className={cn("flex items-end gap-2 rounded-3xl border p-1.5", dark ? "border-white/15 bg-white/[0.06] focus-within:border-mint/60" : "border-line bg-paper focus-within:border-brand")}>
        <textarea
          id={id}
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
          className={cn("max-h-28 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none", dark ? "text-white placeholder:text-white/40" : "placeholder:text-ink-subtle")}
        />
        <button
          type="submit"
          aria-label={t("assistant.send")}
          disabled={pending || !draft.trim()}
          className={cn("grid size-10 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-40", dark ? "bg-mint text-forest" : "bg-forest text-mint")}
        >
          <ArrowUp aria-hidden className="size-5" />
        </button>
      </div>
    </form>
  );
}
