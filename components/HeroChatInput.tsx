"use client";

import { useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CircleNotch,
  Faders,
  Globe,
  Lightning,
  MagnifyingGlass,
  Sparkle,
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
    label: "Linear Product Page",
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
      text: "Paste any public website URL to test AI readability and search indexation.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      kind: "error",
      text: "URLs cannot contain spaces.",
    };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  if (!hasScheme) {
    return trimmed.includes(".")
      ? {
          kind: "note",
          text: `Domain detected — we'll audit https://${trimmed}`,
        }
      : {
          kind: "error",
          text: "Enter a valid URL or domain (e.g. example.com/page)",
        };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "error",
      text: "Only http(s) URLs can be audited.",
    };
  }
  return {
    kind: "idle",
    text: "Ready — press Enter or click Audit to start live analysis.",
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

  return (
    <div className="w-full max-w-3xl">
      {/* Omni-box prompt container */}
      <div className="relative rounded-2xl border border-sage-300/80 bg-white/95 p-3 shadow-builder backdrop-blur-md transition-all focus-within:border-sage-500 focus-within:ring-4 focus-within:ring-sage-500/15 dark:border-sage-700/80 dark:bg-[#151D16]/95 dark:focus-within:border-sage-400 dark:focus-within:ring-sage-400/20 sm:p-4">
        {/* Main URL Input row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-700 dark:bg-sage-900/80 dark:text-sage-300">
            <Globe className="h-5 w-5" weight="duotone" />
          </div>

          <div className="min-w-0 flex-1">
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="Enter any page URL to audit (e.g. https://example.com)..."
              value={values.url}
              onChange={(e) => onChange({ url: e.target.value })}
              onKeyDown={handleKeyDown}
              aria-label="URL to audit"
              className="w-full bg-transparent text-base font-medium text-sage-950 placeholder:text-sage-400 outline-none dark:text-sage-50 dark:placeholder:text-sage-500 sm:text-lg"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSettings}
              title="API Keys & LLM Settings"
              aria-label="API Keys & LLM Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-900 dark:text-sage-400 dark:hover:bg-sage-800 dark:hover:text-sage-100"
            >
              <Faders className="h-4 w-4" weight="bold" />
            </button>

            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={!canSubmit}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-sage-500 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sage-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100 sm:px-5"
            >
              {loading ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                  <span className="hidden sm:inline">Auditing…</span>
                </>
              ) : (
                <>
                  <Lightning className="h-4 w-4" weight="fill" />
                  <span>Audit</span>
                  <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Query expansion row */}
        {showQueryInput ? (
          <div className="mt-3 flex items-center gap-2.5 border-t border-sage-100 pt-3 dark:border-sage-800/80">
            <MagnifyingGlass className="h-4 w-4 shrink-0 text-sage-400" />
            <input
              type="text"
              placeholder="Target search query (e.g. best sourdough bread, or leave empty to auto-derive)"
              value={values.query}
              onChange={(e) => onChange({ query: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs text-sage-800 placeholder:text-sage-400 outline-none dark:text-sage-200 dark:placeholder:text-sage-500"
            />
            <button
              type="button"
              onClick={() => {
                onChange({ query: "" });
                setShowQueryInput(false);
              }}
              className="text-[11px] font-medium text-sage-500 hover:text-sage-800 dark:text-sage-400 dark:hover:text-sage-200"
            >
              Auto-derive
            </button>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between border-t border-sage-100/70 pt-2 dark:border-sage-800/60">
            <p
              className={
                hint.kind === "error"
                  ? "text-xs font-medium text-coral-600 dark:text-coral-400"
                  : hint.kind === "note"
                    ? "text-xs font-medium text-sage-600 dark:text-sage-300"
                    : "text-xs text-sage-500 dark:text-sage-400"
              }
            >
              {hint.text}
            </p>
            <button
              type="button"
              onClick={() => setShowQueryInput(true)}
              className="text-xs font-medium text-sage-600 underline decoration-sage-300 underline-offset-2 hover:text-sage-900 dark:text-sage-400 dark:decoration-sage-700 dark:hover:text-sage-200"
            >
              + Add target query
            </button>
          </div>
        )}
      </div>

      {/* Suggested starter prompt chips (Lovable & Bolt style) */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-sage-600 dark:text-sage-400">
          <Sparkle className="h-3 w-3 text-coral-500" weight="fill" />
          Try live:
        </span>
        {SAMPLE_PROMPTS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => handleSelectSample(sample)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-sage-200/90 bg-white/70 px-3 py-1 text-xs font-medium text-sage-800 shadow-2xs transition-all hover:border-sage-400 hover:bg-sage-100/80 hover:text-sage-950 active:scale-[0.97] disabled:opacity-50 dark:border-sage-800 dark:bg-sage-950/60 dark:text-sage-200 dark:hover:border-sage-600 dark:hover:bg-sage-900"
          >
            <span>{sample.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
