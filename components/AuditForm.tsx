"use client";

import { useState } from "react";
import {
  CaretDown,
  CircleNotch,
  Link as LinkIcon,
} from "@phosphor-icons/react";

export interface AuditFormValues {
  url: string;
  query: string;
  tinyfishKey: string;
  llmKey: string;
  llmProvider: "gemini" | "none";
}

interface AuditFormProps {
  values: AuditFormValues;
  onChange: (values: AuditFormValues) => void;
  onSubmit: () => void;
  loading: boolean;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100";

const SAMPLES = [
  { label: "Blog post", url: "https://example.com/blog/launch-notes" },
  { label: "Product page", url: "https://example.com/pricing" },
  { label: "Docs", url: "https://example.com/docs/getting-started" },
];

type UrlHint = { kind: "idle" | "note" | "error"; text: string };

function hintFor(raw: string): UrlHint {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      kind: "idle",
      text: "Enter any public page URL. Localhost and private hosts are blocked.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      kind: "error",
      text: "URLs can't contain spaces — paste the full address instead.",
    };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  if (!hasScheme) {
    return trimmed.includes(".")
      ? {
          kind: "note",
          text: `Bare domain detected — we'll audit https://${trimmed}.`,
        }
      : {
          kind: "error",
          text: "That doesn't look like a domain yet — try example.com/page.",
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
    text: "Looks good — press Enter or Audit page to run.",
  };
}

export default function AuditForm({
  values,
  onChange,
  onSubmit,
  loading,
}: AuditFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const set = (patch: Partial<AuditFormValues>) =>
    onChange({ ...values, ...patch });

  const hint = hintFor(values.url);
  const canSubmit =
    !loading && values.url.trim().length > 0 && hint.kind !== "error";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
      className="w-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      aria-label="Audit request form"
    >
      <div className="grid gap-4">
        <div>
          <label
            htmlFor="audit-url"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Page URL <span aria-hidden="true" className="text-red-600">*</span>
          </label>
          <div className="relative">
            <LinkIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              id="audit-url"
              name="url"
              type="text"
              inputMode="url"
              required
              autoComplete="url"
              placeholder="https://example.com/page"
              value={values.url}
              onChange={(e) => set({ url: e.target.value })}
              aria-describedby="audit-url-help"
              aria-invalid={hint.kind === "error"}
              className={`${inputClass} pl-9`}
            />
          </div>
          <p
            id="audit-url-help"
            className={
              hint.kind === "error"
                ? "mt-1 text-xs text-red-600 dark:text-red-400"
                : hint.kind === "note"
                  ? "mt-1 text-xs text-emerald-700 dark:text-emerald-400"
                  : "mt-1 text-xs text-zinc-500 dark:text-zinc-400"
            }
          >
            {hint.text}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Try:
            </span>
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => set({ url: s.url })}
                aria-label={`Use sample URL: ${s.url}`}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="audit-query"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Target search query{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          <input
            id="audit-query"
            name="query"
            type="text"
            placeholder="e.g. best sourdough recipe"
            value={values.query}
            onChange={(e) => set({ query: e.target.value })}
            aria-describedby="audit-query-help"
            className={inputClass}
          />
          <p
            id="audit-query-help"
            className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
          >
            Leave empty to auto-derive the query from the page title, H1, or
            meta description. The report shows which source was used.
          </p>
        </div>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="advanced-keys"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>Advanced: API keys (optional)</span>
            <CaretDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          {advancedOpen && (
            <div
              id="advanced-keys"
              className="grid gap-4 border-t border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div>
                <label
                  htmlFor="audit-tinyfish-key"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  TinyFish API key{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    (BYOK)
                  </span>
                </label>
                <input
                  id="audit-tinyfish-key"
                  name="tinyfishKey"
                  type="password"
                  autoComplete="off"
                  placeholder="Uses server TINYFISH_API_KEY when empty"
                  value={values.tinyfishKey}
                  onChange={(e) => set({ tinyfishKey: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="audit-llm-key"
                    className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                  >
                    Gemini API key{" "}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="audit-llm-key"
                    name="llmKey"
                    type="password"
                    autoComplete="off"
                    placeholder="Optional executive summary"
                    value={values.llmKey}
                    onChange={(e) => set({ llmKey: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="audit-llm-provider"
                    className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                  >
                    Summary provider
                  </label>
                  <select
                    id="audit-llm-provider"
                    name="llmProvider"
                    value={values.llmProvider}
                    onChange={(e) =>
                      set({
                        llmProvider:
                          e.target.value === "gemini" ? "gemini" : "none",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="none">Rules only (no LLM)</option>
                    <option value="gemini">Gemini (needs key)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Keys are sent to <code>/api/audit</code> and used server-side
                only — they never go to TinyFish from your browser, and they
                are kept in memory for this page only (never stored).
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading && (
            <CircleNotch
              aria-hidden="true"
              weight="bold"
              className="h-4 w-4 animate-spin"
            />
          )}
          {loading ? "Auditing — this can take up to two minutes…" : "Audit page"}
        </button>
      </div>
    </form>
  );
}
