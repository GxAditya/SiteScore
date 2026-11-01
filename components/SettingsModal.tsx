"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Key, Sparkle, X } from "@phosphor-icons/react";
import { type AuditFormValues } from "./AuditForm";
import { Term } from "./report/Term";
import { API_KEYS_URL } from "@/lib/links";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[rgba(12,18,11,0.58)] backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-[var(--landing-card-edge)] bg-[var(--landing-card)] p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_40px_80px_-40px_rgba(15,22,14,0.6)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] pb-4">
              <div ref={titleRef} tabIndex={-1} className="flex min-w-0 items-center gap-2.5 focus:outline-none">
                <span className="inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-subtle)]">
                  <Key className="h-4 w-4" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="settings-modal-title"
                    className="text-[15px] font-semibold tracking-tight"
                  >
                    Keys and options
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
                    Both are optional. Nothing here is written to a server or
                    left behind when you close the tab.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="nav-icon shrink-0"
              >
                <X className="h-4 w-4" weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="modal-tinyfish-key"
                  className="panel-eyebrow mb-1.5 block"
                >
                  Search service key ·{" "}
                  <Term k="byok">bring your own</Term>
                </label>
                <div className="inset flex items-center px-3">
                  <input
                    id="modal-tinyfish-key"
                    type="password"
                    autoComplete="off"
                    placeholder="Leave empty to use the server default"
                    value={values.tinyfishKey}
                    onChange={(e) => onChange({ tinyfishKey: e.target.value })}
                    className="h-11 w-full min-w-0 bg-transparent text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-subtle)]"
                  />
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                  This powers the two page reads and two search checks. Free
                  keys come from{" "}
                  <a
                    href={API_KEYS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--accent-strong)] underline underline-offset-2 dark:text-[var(--accent)]"
                  >
                    agent.tinyfish.ai
                  </a>
                  .
                </p>
              </div>

              <div className="inset p-3.5">
                <div className="flex items-center gap-2">
                  <Sparkle
                    className="h-4 w-4 text-[var(--accent)]"
                    weight="fill"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold tracking-tight">
                    Written summary, if you want one
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                  The score always comes from the rules. Adding a key lets a
                  model also write a paragraph in plain English on top of it.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="modal-llm-provider"
                      className="panel-eyebrow mb-1.5 block"
                    >
                      Source
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
                      className="inset h-11 w-full bg-transparent px-3 text-sm font-medium text-[var(--text)]"
                    >
                      <option value="none">Rules only, no model</option>
                      <option value="gemini">Google Gemini</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="modal-llm-key"
                      className="panel-eyebrow mb-1.5 block"
                    >
                      Gemini key
                    </label>
                    <div className="inset flex items-center px-3">
                      <input
                        id="modal-llm-key"
                        type="password"
                        placeholder="Only needed for Gemini"
                        value={values.llmKey}
                        onChange={(e) => onChange({ llmKey: e.target.value })}
                        disabled={values.llmProvider !== "gemini"}
                        className="h-11 w-full min-w-0 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed disabled:opacity-45"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary min-h-[40px]"
              >
                <span className="text-sm">Close</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary min-h-[40px]"
              >
                <span className="text-sm">Done</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
