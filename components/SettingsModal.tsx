"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-sage-200 bg-white p-6 shadow-2xl dark:border-sage-800 dark:bg-[#151D16]">
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
              className="w-full rounded-xl border border-sage-200 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-950 placeholder:text-sage-400 outline-none transition-all focus:border-sage-500 focus:bg-white focus:ring-2 focus:ring-sage-500/20 dark:border-sage-800 dark:bg-[#1b251d] dark:text-sage-50 dark:focus:border-sage-400 dark:focus:bg-[#1b251d]"
            />
            <p className="mt-1 text-[11px] text-sage-500 dark:text-sage-400">
              Powers TinyFish Search & Fetch probes. Get a free key at{" "}
              <a
                href="https://agent.tinyfish.ai/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-sage-700 dark:hover:text-sage-200"
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
                  className="w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-xs font-medium text-sage-900 outline-none focus:border-sage-500 dark:border-sage-700 dark:bg-[#151D16] dark:text-sage-100"
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
                  className="w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-xs text-sage-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-sage-500 dark:border-sage-700 dark:bg-[#151D16] dark:text-sage-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-sage-500 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sage-600 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
