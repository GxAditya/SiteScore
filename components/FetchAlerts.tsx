"use client";

import type { AuditReport } from "@/lib/audit-types";
import { CheckRow } from "./report/CheckRow";

/** Plain-English next step per machine code the fetcher can return. */
const NEXT_STEPS: Record<string, string> = {
  bot_blocked:
    "Let well-behaved search and AI readers through your bot protection, keeping your normal abuse limits. Then run this again.",
  login_required:
    "Put the important content on an address anyone can open, without signing in, and audit that one instead.",
  empty_content:
    "Render the main text into the page itself rather than building it only with browser scripts. Then run this again.",
  slow_response:
    "Get the server's first answer under about a second: cache the page and hold back heavy third-party scripts.",
  page_not_found:
    "Check the address for a typo, put the page back, or point the old address at its replacement.",
};

const FALLBACK_STEP =
  "Open the Fixes tab, apply the change listed for this error, then run the audit again.";

interface FetchAlertsProps {
  report: AuditReport;
  technicalDetail: boolean;
}

export default function FetchAlerts({ report, technicalDetail }: FetchAlertsProps) {
  const checks = report.checks.filter((c) => c.id.startsWith("fetch_error_"));
  const orphans =
    checks.length === 0 ? report.raw.fetchErrors.filter((e) => Boolean(e.error)) : [];

  if (checks.length === 0 && orphans.length === 0) return null;

  return (
    <section aria-label="Access warnings" className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="state-pill state-pill--warn">Needs attention</span>
        <h2 className="panel-title">The reader could not get everything</h2>
      </div>
      <p className="panel-sub mt-1">
        Whatever blocked this audit is very likely blocking the same AI tools
        your visitors ask questions of.
      </p>

      <ul className="mt-3 space-y-2.5">
        {checks.map((c) => {
          const code = c.id.replace("fetch_error_", "");
          return (
            <li key={c.id} className="inset px-2 py-1.5">
              <CheckRow check={c} technical={technicalDetail} />
              <p className="mt-1.5 border-t border-[var(--surface-border)] px-1 pt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                <span className="panel-eyebrow mr-1 text-xs">Do this</span>
                {NEXT_STEPS[code] ?? FALLBACK_STEP}
              </p>
            </li>
          );
        })}

        {orphans.map((e) => (
          <li key={`${e.url}-${e.error}`} className="inset px-3 py-2.5">
            <p className="check-row__plain">One read of the page failed</p>
            <p className="check-row__means">{e.url}</p>
            {technicalDetail ? (
              <p className="check-row__tech">{e.error}</p>
            ) : null}
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
              <span className="panel-eyebrow mr-1 text-xs">Do this</span>
              {FALLBACK_STEP}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
