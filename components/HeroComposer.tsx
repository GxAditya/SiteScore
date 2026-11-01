"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  CircleNotch,
  Faders,
  Globe,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/ui";
import { type AuditFormValues } from "./AuditForm";

interface HeroComposerProps {
  values: AuditFormValues;
  onChange: (patch: Partial<AuditFormValues>) => void;
  onSubmit: (urlOverride?: string) => void;
  onOpenSettings: () => void;
  loading: boolean;
}

/** Only real problems are surfaced; a bare domain is accepted silently. */
function errorFor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) {
    return "URLs can't contain spaces - double-check and try again.";
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  if (!hasScheme && !trimmed.includes(".")) {
    return "Enter a valid URL or domain - like example.com or your page link.";
  }
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    return "We only audit public http(s) URLs - private hosts aren't reachable.";
  }
  return null;
}

export default function HeroComposer({
  values,
  onChange,
  onSubmit,
  onOpenSettings,
  loading,
}: HeroComposerProps) {
  const [showQueryInput, setShowQueryInput] = useState(Boolean(values.query));

  const error = errorFor(values.url);
  const canSubmit = !loading && values.url.trim().length > 0 && error === null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  function closeQueryInput() {
    onChange({ query: "" });
    setShowQueryInput(false);
  }

  return (
    <div className="w-full text-left">
      <form
        onSubmit={handleSubmit}
        className={cn("hero-composer", error && "is-error")}
      >
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <Globe
            className="hidden h-5 w-5 shrink-0 text-[var(--text-subtle)] sm:block"
            weight="duotone"
          />
          <label htmlFor="hero-url" className="sr-only">
            Page URL to audit
          </label>
          <input
            id="hero-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="Paste your URL"
            value={values.url}
            onChange={(e) => onChange({ url: e.target.value })}
            onKeyDown={handleKeyDown}
            aria-label="URL to audit"
            aria-invalid={error !== null}
            className="h-14 w-full min-w-0 bg-transparent text-[17px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] sm:h-16 sm:text-[19px]"
          />
        </div>

        <AnimatePresence initial={false}>
          {showQueryInput && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="px-4 pb-1 pt-3 sm:px-5"
            >
              <div className="composer-query">
                <MagnifyingGlass
                  className="h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]"
                  weight="bold"
                />
                <label htmlFor="hero-query" className="sr-only">
                  Target search query
                </label>
                <input
                  id="hero-query"
                  type="text"
                  placeholder="Target query - we'll derive one if you leave this empty"
                  value={values.query}
                  onChange={(e) => onChange({ query: e.target.value })}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="button"
                  onClick={closeQueryInput}
                  aria-label="Remove target query"
                  className="shrink-0 text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
                >
                  <X className="h-3.5 w-3.5" weight="bold" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* composer controls */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowQueryInput((open) => !open)}
              aria-expanded={showQueryInput}
              aria-controls="hero-query"
              className="composer-chip"
            >
              {showQueryInput ? (
                <MagnifyingGlass className="h-3.5 w-3.5" weight="bold" />
              ) : (
                <Plus className="h-3.5 w-3.5" weight="bold" />
              )}
              <span>Target query</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              title="API keys and settings"
              aria-label="API keys and settings"
              className="composer-chip"
            >
              <Faders className="h-3.5 w-3.5" weight="bold" />
              <span>API keys</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={loading ? "Audit in progress" : "Run audit"}
            title={loading ? "Audit in progress" : "Run audit"}
            className="composer-submit"
          >
            {loading ? (
              <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
            ) : (
              <ArrowUp className="h-5 w-5" weight="bold" />
            )}
          </button>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-3 px-1 text-[13px] font-medium leading-snug text-[var(--fail)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
