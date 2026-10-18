"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { apiRequest } from "@/lib/api/client";
import { ensureSession } from "@/lib/api/session";
import type { AssistantReply } from "@/lib/assistant/answer";

export type Turn = { role: "user"; text: string } | { role: "bot"; reply: AssistantReply } | { role: "error"; text: string };

interface AssistantUi {
  open: boolean;
  setOpen: (open: boolean) => void;
  draft: string;
  setDraft: (draft: string) => void;
  turns: Turn[];
  pending: boolean;
  send: (question: string) => Promise<void>;
  /** Opens the drawer with a pre-filled question. */
  ask: (question: string) => void;
}

const AssistantContext = createContext<AssistantUi | null>(null);

/** One conversation shared by the greeting tile and the drawer. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (question: string) => {
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
    },
    [pending, locale, t],
  );

  const ask = useCallback((question: string) => {
    setDraft(question);
    setOpen(true);
  }, []);

  return (
    <AssistantContext.Provider value={{ open, setOpen, draft, setDraft, turns, pending, send, ask }}>{children}</AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantUi {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used inside AssistantProvider");
  return ctx;
}
