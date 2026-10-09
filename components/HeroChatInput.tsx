"use client";

import { useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Check,
  CircleNotch,
  Faders,
  Globe,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { type AuditFormValues } from "./AuditForm";

interface HeroChatInputProps {
  values: AuditFormValues;
  onChange: (patch: Partial<AuditFormValues>) => void;
  onSubmit: (urlOverride?: string) => void;
  onOpenSettings: () => void;
  loading: boolean;
}

const SAMPLE_PROMPTS = [
  {
    label: "Linear",
    url: "https://linear.app",
    query: "linear issue tracking software",
  },
  {
    label: "Stripe Docs",
    url: "https://docs.stripe.com",
    query: "accept payments api integration",
  },
  {
    label: "Tailwind CSS",
    url: "https://tailwindcss.com",
    query: "utility first css framework",
  },
  {
    label: "Vercel AI SDK",
    url: "https://sdk.vercel.ai",
    query: "build ai applications typescript",
  },
];

type UrlHint = { kind: "idle" | "note" | "error"; text: string };

function hintFor(raw: string): UrlHint {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      kind: "idle",
      text: "Paste any public page URL. Runs live in about 90 seconds.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      kind: "error",
      text: "URLs can't contain spaces - double-check and try again.",
    };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  if (!hasScheme) {
    return trimmed.includes(".")
      ? {
          kind: "note",
          text: `We'll add https:// automatically for you.`,
        }
      : {
          kind: "error",
          text: "Enter a valid URL or domain - like example.com or your page link.",
        };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "error",
      text: "We only audit public http(s) URLs - private hosts aren't reachable.",
    };
  }
  return {
    kind: "idle",
    text: "Looks good. Press Enter or tap Audit to start.",
  };
}

export default function HeroChatInput({
  values,
  onChange,
  onSubmit,
  onOpenSettings,
  loading,
}: HeroChatInputProps) {
  const [showQueryInput, setShowQueryInput] = useState(Boolean(values.query));
  const hint = hintFor(values.url);
  const canSubmit = !loading && values.url.trim().length > 0 && hint.kind !== "error";

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  function handleSelectSample(sample: (typeof SAMPLE_PROMPTS)[number]) {
    onChange({ url: sample.url, query: sample.query });
    onSubmit(sample.url);
  }

  const isError = hint.kind === "error";
  const isNote = hint.kind === "note";

  return (
    <div className="w-full">
      {/* Main input pill */}
      <motion.div
        layout
        className={`hero-input-shell ${isError ? "is-error" : ""}`}
      >
        <Globe
          className="hidden h-5 w-5 shrink-0 text-[var(--text-subtle)] sm:block"
          weight="duotone"
        />

        <div className="min-w-0 flex-1">
          <label htmlFor="hero-url" className="sr-only">
            Page URL to audit
          </label>
          <input
            id="hero-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="Paste your URL - e.g. linear.app"
            value={values.url}
            onChange={(e) => onChange({ url: e.target.value })}
            onKeyDown={handleKeyDown}
            aria-label="URL to audit"
            aria-invalid={isError}
            className="w-full bg-transparent py-2 text-[15px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] sm:text-base"
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.button
              key="loading"
              type="button"
              disabled
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="btn-primary pointer-events-none"
              style={{ paddingLeft: "1.1rem", paddingRight: "1.1rem" }}
            >
              <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
              <span>Auditing…</span>
            </motion.button>
          ) : (
            <motion.button
              key="submit"
              type="button"
              onClick={() => onSubmit()}
              disabled={!canSubmit}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="btn-primary"
              style={{ paddingLeft: "1.1rem", paddingRight: "1.1rem" }}
            >
              <span>Audit</span>
              <ArrowRight className="h-4 w-4" weight="bold" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Query row + hints */}
      <motion.div
        layout
        className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1"
      >
        <p
          role={isError ? "alert" : undefined}
          className={`text-[13px] leading-snug ${
            isError
              ? "font-medium text-[var(--fail)]"
              : isNote
                ? "font-medium text-[var(--text)]"
                : "text-[var(--text-muted)]"
          }`}
        >
          {hint.text}
        </p>

        <div className="flex items-center gap-1">
          {showQueryInput ? (
            <motion.div
              key="query"
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-1.5 sm:min-w-[260px]"
            >
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
                placeholder="Target query - we'll auto-derive if empty"
                value={values.query}
                onChange={(e) => onChange({ query: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-[12px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
              />
              <button
                type="button"
                onClick={() => {
                  onChange({ query: "" });
                  setShowQueryInput(false);
                }}
                aria-label="Clear target query"
                className="shrink-0 text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
              >
                <X className="h-3.5 w-3.5" weight="bold" />
              </button>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setShowQueryInput(true)}
              className="chip"
            >
              <MagnifyingGlass className="h-3.5 w-3.5" weight="bold" />
              <span>Add target query</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            title="API keys and settings"
            aria-label="API keys and settings"
            className="chip"
          >
            <Faders className="h-3.5 w-3.5" weight="bold" />
            <span className="hidden sm:inline">API keys</span>
          </button>
        </div>
      </motion.div>

      {/* Sample prompt chips */}
      <div className="mt-5 flex flex-wrap items-center gap-2 px-1">
        <span className="mr-1 text-[13px] text-[var(--text-subtle)]">
          Start with an example:
        </span>
        {SAMPLE_PROMPTS.map((sample) => (
          <motion.button
            key={sample.label}
            type="button"
            onClick={() => handleSelectSample(sample)}
            disabled={loading}
            whileTap={{ scale: 0.96 }}
            className="chip disabled:opacity-50"
          >
            {sample.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
