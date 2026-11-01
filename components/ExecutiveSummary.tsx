"use client";

import { ArrowRight, Eye, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";
import { PRIORITY_COPY, verdictFor } from "@/lib/plain-language";
import { Term } from "./report/Term";

export default function ExecutiveSummary({
  report,
  onJumpToFixes,
}: {
  report: AuditReport;
  onJumpToFixes: () => void;
}) {
  const blockers = report.fixes.filter((f) => f.priority === "P0");
  const thisWeek = report.fixes.filter((f) => f.priority === "P1").length;
  const indexed = report.search.indexation.indexed;
  const rank = report.search.ranking.rank;
  const verdict = verdictFor(
    report.score.total,
    blockers.length,
    thisWeek,
    indexed,
  );

  const toneClass =
    verdict.tone === "pass"
      ? "state-pill--pass"
      : verdict.tone === "warn"
        ? "state-pill--warn"
        : "state-pill--fail";

  const facts = [
    {
      icon: MagnifyingGlass,
      label: "Is this page in search?",
      value: indexed ? "Yes" : "Not yet",
      tone: indexed ? "pass" : "fail",
      note: indexed
        ? rank != null
          ? `It is the ${rank === 1 ? "top" : `number ${rank}`} result we saw for your phrase.`
          : "Search has the page, but it was not in the results we saw for your phrase."
        : "Search has not got this exact page in its catalogue yet.",
    },
    {
      icon: Eye,
      label: "Can a machine read it?",
      value: `${report.score.readability} of 100`,
      tone:
        report.score.readability >= 80
          ? "pass"
          : report.score.readability >= 55
            ? "warn"
            : "fail",
      note: `A live read pulled ${report.fetch.wordCount.toLocaleString()} words of text from the page.`,
    },
    {
      icon: ShieldCheck,
      label: "Anything hiding it?",
      value: blockers.length === 0 ? "No blockers" : `${blockers.length} to clear`,
      tone: blockers.length === 0 ? "pass" : "fail",
      note:
        blockers.length === 0
          ? "No setting is blocking readers or bots right now."
          : "These are the items marked fix today in the list below.",
    },
  ] as const;

  return (
    <section aria-label="What this means" className="panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`state-pill ${toneClass} mt-0.5 shrink-0`}>
          {verdict.tone === "pass" ? "Clear" : verdict.tone === "warn" ? "Some gaps" : "Blocked"}
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight sm:text-[21px]">
            {verdict.headline}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
            {verdict.move}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="inset px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
              <f.icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]" weight="duotone" />
              {f.label}
            </dt>
            <dd className="mt-1">
              <span
                className={`state-pill ${
                  f.tone === "pass"
                    ? "state-pill--pass"
                    : f.tone === "warn"
                      ? "state-pill--warn"
                      : "state-pill--fail"
                }`}
              >
                {f.value}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--text-subtle)]">
                {f.note}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {blockers.length > 0 ? (
        <div className="mt-4">
          <p className="panel-eyebrow mb-2">
            {PRIORITY_COPY.P0.label} · {blockers.length}{" "}
            {blockers.length === 1 ? "item" : "items"}
          </p>
          <ul className="inset divide-y divide-[var(--surface-border)] py-0.5">
            {blockers.slice(0, 3).map((f) => (
              <li key={f.title}>
                <button
                  type="button"
                  onClick={onJumpToFixes}
                  className="check-row w-full text-left"
                >
                  <span className="pri-tag pri-tag--today">
                    <span className="pri-tag__code">P0</span>
                    today
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {f.title}
                    </span>
                    <span className="mt-0.5 block truncate text-sm leading-snug text-[var(--text-muted)]">
                      {f.why}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]"
                    weight="bold"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
          {blockers.length > 3 ? (
            <p className="mt-1.5 text-sm text-[var(--text-subtle)]">
              Plus {blockers.length - 3} more in the Fixes tab.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          Nothing is blocking a machine from reading and quoting this page. The
          remaining items are improvements, and{" "}
          <Term k="citation">being cited</Term> is mostly about having the
          clearest answer on the topic.
        </p>
      )}
    </section>
  );
}
