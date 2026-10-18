"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface AssistantUi {
  open: boolean;
  draft: string;
  setOpen: (open: boolean) => void;
  /** Opens the assistant with a pre-filled question. */
  ask: (question: string) => void;
  setDraft: (draft: string) => void;
}

const AssistantContext = createContext<AssistantUi | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ask = useCallback((question: string) => {
    setDraft(question);
    setOpen(true);
  }, []);
  return <AssistantContext.Provider value={{ open, draft, setOpen, ask, setDraft }}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantUi {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used inside AssistantProvider");
  return ctx;
}
