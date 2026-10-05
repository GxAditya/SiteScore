import { ArrowRight, Warning } from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";

const NEXT_STEPS: Record<string, string> = {
  fetch_error_bot_blocked:
    "Next: allowlist well-behaved AI fetchers for this path (keep abuse rate-limits), then re-audit. AI assistants hit the same wall.",
  fetch_error_login_required:
    "Next: publish the key content on a public URL (or add first-click-free) and audit that URL instead.",
  fetch_error_empty_content:
    "Next: server-render the main article text into the HTML instead of building it only in client JS, then re-audit.",
  fetch_error_timeout:
    "Next: bring server response (TTFB) under ~1s — cache the page and defer heavy third-party scripts — then re-audit.",
  fetch_error_page_not_found:
    "Next: check the URL for typos, restore the page, or 301-redirect it to its replacement, then re-audit.",
};

export default function FetchAlerts({ report }: { report: AuditReport }) {
  const errorChecks = report.checks.filter((c) =>
    c.id.startsWith("fetch_error_"),
  );
  const orphanErrors = errorChecks.length === 0 ? report.raw.fetchErrors : [];
  if (errorChecks.length === 0 && orphanErrors.length === 0) return null;

  return (
    <section
      id="fetch-alerts"
      aria-label="Fetch warnings"
      className="grid w-full scroll-mt-24 gap-2.5"
    >
      {errorChecks.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-4 shadow-card dark:border-amber-900/80 dark:bg-amber-950/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Warning
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              weight="fill"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {c.label}
            </h3>
            <code className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              {c.id}
            </code>
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100/90">
            {c.detail}
          </p>
          {c.evidence && (
            <p
              className="mt-1 truncate font-mono text-xs text-amber-800 dark:text-amber-300"
              title={c.evidence}
            >
              {c.evidence}
            </p>
          )}
          <p className="mt-2 flex gap-1.5 text-sm text-amber-950 dark:text-amber-100">
            <ArrowRight
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold">Next action: </span>
              {NEXT_STEPS[c.id] ??
                "See the P0 fix for this fetch error below, apply it, then re-audit."}
            </span>
          </p>
        </div>
      ))}
      {orphanErrors.map((e, i) => (
        <div
          key={`${e.url}-${i}`}
          className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-4 shadow-card dark:border-amber-900/80 dark:bg-amber-950/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Warning
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              weight="fill"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              Fetch reported an error
            </h3>
          </div>
          <p className="mt-1 font-mono text-xs text-amber-800 dark:text-amber-300">
            {e.url}: {e.error}
          </p>
          <p className="mt-2 flex gap-1.5 text-sm text-amber-950 dark:text-amber-100">
            <ArrowRight
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold">Next action: </span>
              See the P0 fix referencing this error below, apply it, then
              re-audit.
            </span>
          </p>
        </div>
      ))}
    </section>
  );
}
