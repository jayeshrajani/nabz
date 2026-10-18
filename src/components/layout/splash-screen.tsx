"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/config/brand";
import { useDistrict } from "@/features/district/use-district";
import { useI18n } from "@/i18n/provider";

const GREETINGS = [
  { text: "namaste", lang: "en" },
  { text: "नमस्ते", lang: "hi" },
  { text: "নমস্কার", lang: "bn" },
  { text: "வணக்கம்", lang: "ta" },
  { text: "నమస్కారం", lang: "te" },
  { text: "ನಮಸ್ಕಾರ", lang: "kn" },
  { text: "नमस्कार", lang: "mr" },
] as const;

const GREETING_MS = 1400;
const MIN_GREETINGS = 2;

// One heartbeat is 400 units wide; three beats per sweep keeps the rhythm near 75 bpm.
const BEAT = "h120 q10 -10 20 0 h30 l6 8 l10 -52 l10 70 l8 -26 h36 q16 -18 32 0 h128";
const ECG = `M0 60 ${BEAT} ${BEAT} ${BEAT}`;
const SWEEP_S = 2.4;

const EASE = [0.22, 1, 0.36, 1] as const;

export function SplashScreen() {
  const { state } = useDistrict();
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = state.status !== "loading";
  }, [state.status]);

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => {
      if (settledRef.current && index >= MIN_GREETINGS - 1) setDone(true);
      else setIndex((i) => (i + 1) % GREETINGS.length);
    }, GREETING_MS);
    return () => window.clearTimeout(id);
  }, [index, done]);

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDone(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done]);

  const greeting = GREETINGS[index];

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="splash"
          role="status"
          aria-live="polite"
          onClick={() => setDone(true)}
          initial={false}
          exit={{ opacity: 0, filter: "blur(12px)", scale: 1.03 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="fixed inset-0 z-[100] flex cursor-default flex-col items-center justify-center overflow-hidden bg-forest text-white select-none"
        >
          <span className="sr-only">{t("common.loading")}</span>

          {/* ECG paper grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-mint) 1px, transparent 1px), linear-gradient(90deg, var(--color-mint) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse 60% 55% at 50% 50%, black, transparent)",
            }}
          />

          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center pb-24">
            <div
              className="size-[min(90vw,640px)] shrink-0 rounded-full animate-[nabz-beat_0.8s_ease-out_infinite]"
              style={{
                background: "radial-gradient(circle, rgb(159 232 194 / 0.16), transparent 62%)",
                animationDelay: `${0.147 * SWEEP_S}s`,
              }}
            />
          </div>

          <div aria-hidden className="absolute top-6 right-6 flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-mint/60 uppercase sm:top-8 sm:right-10">
            <span className="size-1.5 rounded-full bg-alert animate-[nabz-beat-dot_0.8s_ease-out_infinite]" />
            75 bpm
          </div>

          <div aria-hidden className="relative flex h-[9.5rem] flex-col items-center justify-end sm:h-[11rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={greeting.lang}
                className="flex flex-col items-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(10px)", clipPath: "inset(-30% 100% -30% 0%)" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)", clipPath: "inset(-30% -8% -30% 0%)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(8px)" }}
                transition={{ duration: 0.75, ease: EASE }}
              >
                <span
                  lang={greeting.lang}
                  className="bg-gradient-to-b from-white via-white to-mint/70 bg-clip-text px-2 pb-2 font-display text-7xl leading-[1.25] font-medium tracking-tight text-transparent sm:text-8xl"
                >
                  {greeting.text}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <svg aria-hidden viewBox="0 0 1200 120" className="relative mt-10 w-[min(92vw,760px)]" style={{ maskImage: "linear-gradient(90deg, transparent, black 14%, black 86%, transparent)" }}>
            <defs>
              <filter id="nabz-glow" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d={ECG} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" strokeLinejoin="round" />
            {!reduce && (
              <>
                <path d={ECG} pathLength={1} fill="none" stroke="rgb(159 232 194 / 0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.42 1.6">
                  <animate attributeName="stroke-dashoffset" from="0.42" to="-0.58" dur={`${SWEEP_S}s`} repeatCount="indefinite" />
                </path>
                <path d={ECG} pathLength={1} fill="none" stroke="#9fe8c2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.16 1.6" filter="url(#nabz-glow)">
                  <animate attributeName="stroke-dashoffset" from="0.16" to="-0.84" dur={`${SWEEP_S}s`} repeatCount="indefinite" />
                </path>
                <g filter="url(#nabz-glow)">
                  <circle r="9" fill="rgb(159 232 194 / 0.35)" />
                  <circle r="4" fill="#fff" />
                  <animateMotion path={ECG} dur={`${SWEEP_S}s`} repeatCount="indefinite" />
                </g>
              </>
            )}
          </svg>

          <div aria-hidden className="absolute bottom-10 flex flex-col items-center gap-2 px-6 text-center sm:bottom-14">
            <span className="font-display text-6xl font-semibold tracking-tight text-white sm:text-7xl">{BRAND.name}</span>
            <span className="text-sm text-white/55">no stethoscope needed. we&apos;re checking the whole district&apos;s pulse.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
