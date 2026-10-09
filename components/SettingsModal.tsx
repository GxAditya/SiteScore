"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Key, Sparkle, X } from "@phosphor-icons/react";
import { type AuditFormValues } from "./AuditForm";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  values: AuditFormValues;
  onChange: (patch: Partial<AuditFormValues>) => void;
}

export default function SettingsModal({
  open,
  onClose,
  values,
  onChange,
}: SettingsModalProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            aria-hidden="true"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-sage-950/60 backdrop-blur-sm dark:bg-black/70"
          />
          <motion.div
            ref={panelRef}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="card relative max-h-[90dvh] w-full max-w-lg overflow-y-auto p-6 shadow-lift"
          >
        <div className="flex items-center justify-between border-b border-sage-100 pb-4 dark:border-sage-800/80">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-100 text-sage-700 dark:bg-sage-900/80 dark:text-sage-300">
              <Key className="h-4 w-4" weight="bold" />
            </span>
            <div>
              <h2
                id="settings-modal-title"
                className="text-base font-semibold text-sage-950 dark:text-sage-50"
              >
                Auditor Settings & API Keys
              </h2>
              <p className="text-xs text-sage-600 dark:text-sage-400">
                Optional credentials. Keys remain in memory and are never saved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full p-1.5 text-sage-500 hover:bg-sage-100 hover:text-sage-900 dark:text-sage-400 dark:hover:bg-sage-800 dark:hover:text-sage-100"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="modal-tinyfish-key"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-sage-300"
            >
              TinyFish API Key (BYOK)
            </label>
            <input
              id="modal-tinyfish-key"
              type="password"
              autoComplete="off"
              placeholder="Uses server TINYFISH_API_KEY when empty"
              value={values.tinyfishKey}
              onChange={(e) => onChange({ tinyfishKey: e.target.value })}
              className="w-full rounded-xl border border-sage-200 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-950 transition-all placeholder:text-sage-400 hover:border-sage-300 focus:border-sage-200 focus:bg-white focus:outline-none focus:shadow-none dark:border-sage-800 dark:bg-[#1b251d] dark:text-sage-50 dark:hover:border-sage-700 dark:focus:border-sage-800 dark:focus:bg-[#1b251d] dark:focus:shadow-none"
            />
            <p className="mt-1 text-[11px] text-sage-500 dark:text-sage-400">
              Powers TinyFish Search & Fetch probes. Get a free key at{" "}
              <a
                href="https://agent.tinyfish.ai/api-keys"
                target="_blank"
                rel="noreferrer"
                className="transition-colors text-sage-700 hover:text-sage-900 dark:text-sage-300 dark:hover:text-sage-100 font-medium"
              >
                agent.tinyfish.ai
              </a>
              .
            </p>
          </div>

          <div className="rounded-xl border border-sage-200/80 bg-sage-50/60 p-4 dark:border-sage-800/80 dark:bg-sage-950/40">
            <div className="flex items-center gap-2">
              <Sparkle className="h-4 w-4 text-coral-500" weight="fill" />
              <span className="text-xs font-semibold text-sage-900 dark:text-sage-100">
                AI Executive Summary (Optional)
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="modal-llm-provider"
                  className="mb-1 block text-xs font-medium text-sage-700 dark:text-sage-300"
                >
                  Provider
                </label>
                <select
                  id="modal-llm-provider"
                  value={values.llmProvider}
                  onChange={(e) =>
                    onChange({
                      llmProvider:
                        e.target.value === "gemini" ? "gemini" : "none",
                    })
                  }
                  className="w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-xs font-medium text-sage-900 transition-all hover:border-sage-300 focus:border-sage-200 focus:outline-none focus:shadow-none dark:border-sage-700 dark:bg-[#151D16] dark:text-sage-100 dark:hover:border-sage-600 dark:focus:border-sage-700 dark:focus:shadow-none"
                >
                  <option value="none">Rule-based scoring only</option>
                  <option value="gemini">Google Gemini AI</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-llm-key"
                  className="mb-1 block text-xs font-medium text-sage-700 dark:text-sage-300"
                >
                  Gemini API Key
                </label>
                <input
                  id="modal-llm-key"
                  type="password"
                  placeholder="Optional Gemini key"
                  value={values.llmKey}
                  onChange={(e) => onChange({ llmKey: e.target.value })}
                  disabled={values.llmProvider !== "gemini"}
                  className="w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-xs text-sage-900 transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:border-sage-300 focus:border-sage-200 focus:outline-none focus:shadow-none dark:border-sage-700 dark:bg-[#151D16] dark:text-sage-100 dark:hover:border-sage-600 dark:focus:border-sage-700 dark:focus:shadow-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-full border border-sage-200 px-5 py-2 text-xs font-semibold text-sage-800 transition-colors hover:bg-sage-100 dark:border-sage-800 dark:text-sage-200 dark:hover:bg-sage-900"
          >
            Cancel
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-full bg-sage-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-sage-700 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
          >
            Save and continue
          </button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
