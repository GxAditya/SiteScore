"use client";

import { useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CircleNotch,
  Faders,
  Globe,
  MagnifyingGlass,
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
      text: "Paste any public page URL. The run takes up to two minutes.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      kind: "error",
      text: "URLs cannot contain spaces — check for a stray space and retry.",
    };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  if (!hasScheme) {
    return trimmed.includes(".")
      ? {
          kind: "note",
          text: `Domain detected — will audit https://${trimmed}`,
        }
      : {
          kind: "error",
          text: "Enter a valid URL or domain, e.g. example.com/page.",
        };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      kind: "error",
      text: "Only http(s) URLs can be audited — private hosts are blocked by design.",
    };
  }
  return {
    kind: "idle",
    text: "Ready — press Enter or Audit to start the live run.",
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

  return (
    <div className="w-full">
      <div
        className={`rounded-2xl border bg-white p-2 shadow-builder transition-colors dark:bg-[#151D16] ${
          isError
            ? "border-coral-500 dark:border-coral-400"
            : "border-sage-700/30 focus-within:border-sage-500 dark:border-sage-300/20 dark:focus-within:border-sage-300"
        }`}
      >
        <div className="flex items-center gap-2 p-2 sm:gap-3 sm:p-3">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage-600 text-white sm:flex dark:bg-sage-200 dark:text-sage-950">
            <Globe className="h-5 w-5" weight="duotone" />
          </span>

          <div className="min-w-0 flex-1 px-1">
            <label
              htmlFor="hero-url"
              className="block font-mono text-[10px] font-semibold tracking-[0.14em] text-sage-600 uppercase dark:text-sage-400"
            >
              Page URL
            </label>
            <input
              id="hero-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com/page"
              value={values.url}
              onChange={(e) => onChange({ url: e.target.value })}
              onKeyDown={handleKeyDown}
              aria-label="URL to audit"
              aria-invalid={isError}
              className="w-full bg-transparent py-0.5 text-lg font-medium text-sage-950 outline-none placeholder:text-sage-600 sm:text-xl dark:text-sage-50 dark:placeholder:text-sage-400"
            />
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            title="API keys and settings"
            aria-label="API keys and settings"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-300 dark:hover:bg-sage-800"
          >
            <Faders className="h-5 w-5" weight="bold" />
          </button>

          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={!canSubmit}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-sage-600 px-5 text-sm font-bold text-white transition-all hover:bg-sage-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-7 sm:text-base dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
          >
            {loading ? (
              <>
                <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                <span>Auditing…</span>
              </>
            ) : (
              <>
                <span>Audit</span>
                <ArrowRight className="h-4 w-4" weight="bold" />
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sage-700/15 px-4 py-2.5 dark:border-sage-300/15">
          <p
            role={isError ? "alert" : undefined}
            className={`text-xs ${
              isError
                ? "font-semibold text-coral-700 dark:text-coral-300"
                : hint.kind === "note"
                  ? "font-medium text-sage-700 dark:text-sage-200"
                  : "text-sage-600 dark:text-sage-400"
            }`}
          >
            {hint.text}
          </p>
          {showQueryInput ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs">
              <MagnifyingGlass className="h-4 w-4 shrink-0 text-sage-500" />
              <label htmlFor="hero-query" className="sr-only">
                Target search query
              </label>
              <input
                id="hero-query"
                type="text"
                placeholder="Target query — empty auto-derives"
                value={values.query}
                onChange={(e) => onChange({ query: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-xs font-medium text-sage-900 outline-none placeholder:text-sage-600 dark:text-sage-100 dark:placeholder:text-sage-400"
              />
              <button
                type="button"
                onClick={() => {
                  onChange({ query: "" });
                  setShowQueryInput(false);
                }}
                className="shrink-0 text-xs font-semibold text-sage-600 underline-offset-2 hover:underline dark:text-sage-300"
              >
                Clear
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowQueryInput(true)}
              className="text-xs font-semibold text-sage-700 underline decoration-sage-400 underline-offset-4 hover:text-sage-950 dark:text-sage-300 dark:hover:text-sage-50"
            >
              Add target query
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-sage-600 uppercase dark:text-sage-400">
          Try live
        </span>
        {SAMPLE_PROMPTS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => handleSelectSample(sample)}
            disabled={loading}
            className="rounded-full border border-sage-700/25 bg-white px-3.5 py-1.5 text-xs font-semibold text-sage-900 transition-all hover:border-sage-600 hover:bg-sage-100 active:scale-[0.97] disabled:opacity-50 dark:border-sage-300/20 dark:bg-transparent dark:text-sage-100 dark:hover:bg-sage-900"
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}
