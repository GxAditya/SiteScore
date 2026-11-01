"use client";

import { useState } from "react";
import type { AuditReport } from "@/lib/audit-types";
import { cn } from "@/lib/ui";
import { CheckList } from "./report/CheckRow";
import { Term } from "./report/Term";

const RANK_CAP = 5;
const COMPETITOR_CAP = 5;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTerms(query: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "for", "to", "of", "in", "on",
    "with", "vs", "best", "top", "how", "what", "why", "get", "buy",
  ]);
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !stop.has(t)),
    ),
  );
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (!text || terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const lowered = new Set(terms.map((t) => t.toLowerCase()));
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        lowered.has(part.toLowerCase()) && part.length > 0 ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface VisibilityPanelProps {
  report: AuditReport;
  technicalDetail: boolean;
}

export default function VisibilityPanel({
  report,
  technicalDetail,
}: VisibilityPanelProps) {
  const { indexation, ranking } = report.search;
  const competitors = report.search.competitors;
  const terms = queryTerms(report.input.query);
  const snippetCheck = report.checks.find((c) => c.id === "v-snippet-match");
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  const visChecks = report.checks.filter((c) => c.category === "visibility");
  const visibleRanks = showAllRanks
    ? ranking.results
    : ranking.results.slice(0, RANK_CAP);
  const visibleCompetitors = showAllCompetitors
    ? competitors
    : competitors.slice(0, COMPETITOR_CAP);

  return (
    <section
      id="visibility"
      aria-label="Where the page shows up in search"
      className="w-full scroll-mt-24 space-y-4"
    >
      <div className="panel p-4 sm:p-5">
        <h2 className="panel-title">Where this page shows up</h2>
        <p className="panel-sub mt-1">
          Two live questions: is the page in{" "}
          <Term k="index">search&rsquo;s catalogue</Term> at all, and what spot
          does it hold for the phrase you care about.
        </p>
        <p className="spec-strip mt-3">
          <span>
            in catalogue{" "}
            <strong>{indexation.error ? "unknown" : indexation.indexed ? "yes" : "no"}</strong>
          </span>
          <span>
            spot{" "}
            <strong>{ranking.error || ranking.rank === null ? "none" : `#${ranking.rank}`}</strong>
          </span>
          <span>
            results seen <strong>{ranking.results.length}</strong>
          </span>
          <span>
            others ahead <strong>{competitors.length}</strong>
          </span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Catalogue */}
        <article className="panel p-4">
          <h3 className="text-sm font-semibold tracking-tight">
            Can search find the page?
          </h3>
          {indexation.error ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--warn-strong)]">
              That check could not run ({indexation.error}). Nothing about the
              page is proven either way.
            </p>
          ) : (
            <>
              <p className="mt-2">
                <span
                  className={cn(
                    "state-pill",
                    indexation.indexed ? "state-pill--pass" : "state-pill--fail",
                  )}
                >
                  {indexation.indexed ? "In the catalogue" : "Not in the catalogue"}
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {indexation.indexed
                  ? `Searching for this exact address turns it up${
                      indexation.matchUrl ? ` (${indexation.matchUrl})` : ""
                    }.`
                  : "Searching for this exact address does not turn it up, so nobody can click through to it."}
              </p>
              {technicalDetail ? (
                <p className="check-row__tech">
                  looked for: {indexation.query} · {indexation.totalResults}{" "}
                  results returned
                </p>
              ) : null}
            </>
          )}
        </article>

        {/* Rank */}
        <article className="panel p-4">
          <h3 className="text-sm font-semibold tracking-tight">
            What spot does it hold?
          </h3>
          {ranking.error ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--warn-strong)]">
              That check could not run ({ranking.error}).
            </p>
          ) : ranking.rank !== null ? (
            <>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="inset flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-[17px] font-semibold tabular-nums">
                  {ranking.rank}
                </span>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  out of {ranking.results.length} results we saw for{" "}
                  <span className="font-medium text-[var(--text)]">
                    &ldquo;{report.input.query}&rdquo;
                  </span>
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2">
                <span className="state-pill state-pill--fail">
                  Not in the results
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                The page did not appear in the {ranking.results.length} results
                we saw for{" "}
                <span className="font-medium text-[var(--text)]">
                  &ldquo;{report.input.query}&rdquo;
                </span>
                .
              </p>
            </>
          )}
          {technicalDetail ? (
            <p className="check-row__tech">looked for: {ranking.query}</p>
          ) : null}
        </article>
      </div>

      {snippetCheck ? (
        <article className="panel p-4">
          <h3 className="text-sm font-semibold tracking-tight">
            Does your listing repeat what people type?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
            <Highlighted text={snippetCheck.detail} terms={terms} />
          </p>
          {terms.length > 0 ? (
            <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="panel-eyebrow">Words people search</span>
              {terms.map((t) => (
                <code
                  key={t}
                  className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]"
                >
                  {t}
                </code>
              ))}
            </p>
          ) : null}
          {technicalDetail ? (
            <p className="check-row__tech">{snippetCheck.evidence}</p>
          ) : null}
        </article>
      ) : null}

      {ranking.results.length > 0 ? (
        <article className="panel overflow-hidden p-0">
          <div className="px-4 pb-3 pt-4">
            <h3 className="text-sm font-semibold tracking-tight">
              What a search actually returns
            </h3>
            <p className="panel-sub mt-0.5">
              The <Term k="serp">results page</Term> for{" "}
              &ldquo;{report.input.query}&rdquo;, in the order it came back.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] table-fixed text-left">
              <colgroup>
                <col className="w-12" />
                <col className="w-[38%]" />
                <col className="w-[54%]" />
              </colgroup>
              <caption className="sr-only">
                Ranking results for &ldquo;{report.input.query}&rdquo;, showing{" "}
                {visibleRanks.length} of {ranking.results.length}
              </caption>
              <thead className="sticky top-0 z-10 border-y border-[var(--surface-border)] bg-[var(--landing-card)]">
                <tr>
                  <th scope="col" className="panel-eyebrow px-4 py-2 text-left font-semibold">
                    #
                  </th>
                  <th scope="col" className="panel-eyebrow px-4 py-2 text-left font-semibold">
                    Page
                  </th>
                  <th scope="col" className="panel-eyebrow px-4 py-2 text-left font-semibold">
                    Preview text
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRanks.map((r, i) => (
                  <tr
                    key={`${r.url}-${i}`}
                    className="border-b border-[var(--surface-border)] transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--surface-sunken)_45%,transparent)]"
                  >
                    <td className="px-4 py-2.5 align-top font-mono text-xs tabular-nums text-[var(--text-subtle)]">
                      {r.position ?? "-"}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm font-medium leading-snug underline decoration-transparent underline-offset-2 transition-colors hover:decoration-[var(--accent)]"
                      >
                        <Highlighted text={r.title || r.url} terms={terms} />
                      </a>
                      <span className="mt-0.5 block truncate font-mono text-xs text-[var(--text-subtle)]">
                        {r.siteName ? `${r.siteName} · ` : ""}
                        {r.url}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top text-sm leading-relaxed text-[var(--text-muted)]">
                      <Highlighted text={r.snippet} terms={terms} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ranking.results.length > RANK_CAP ? (
            <div className="border-t border-[var(--surface-border)] px-4 py-2.5">
              <button
                type="button"
                aria-expanded={showAllRanks}
                onClick={() => setShowAllRanks((v) => !v)}
                className="composer-chip"
              >
                {showAllRanks
                  ? "Show fewer"
                  : `Show all ${ranking.results.length}`}
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      {competitors.length > 0 ? (
        <article className="panel p-4">
          <h3 className="text-sm font-semibold tracking-tight">
            Who holds those spots instead ({competitors.length})
          </h3>
          <p className="panel-sub mt-0.5">
            These pages came back ahead of yours. Their headings are the content
            gap you are up against.
          </p>
          <ul className="mt-3 space-y-2.5">
            {visibleCompetitors.map((c, i) => (
              <li key={`${c.url}-${i}`} className="check-row">
                <span className="inset flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs tabular-nums text-[var(--text-muted)]">
                  {c.position ?? "-"}
                </span>
                <div className="min-w-0">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium leading-snug underline decoration-transparent underline-offset-2 hover:decoration-[var(--accent)]"
                  >
                    {c.title || c.url}
                  </a>
                  <span className="mt-0.5 block truncate font-mono text-xs text-[var(--text-subtle)]">
                    {c.siteName ? `${c.siteName} · ` : ""}
                    {c.url}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {competitors.length > COMPETITOR_CAP ? (
            <button
              type="button"
              aria-expanded={showAllCompetitors}
              onClick={() => setShowAllCompetitors((v) => !v)}
              className="composer-chip mt-2.5"
            >
              {showAllCompetitors ? "Show fewer" : `Show all ${competitors.length}`}
            </button>
          ) : null}
        </article>
      ) : null}

      <article className="panel p-4 sm:p-5">
        <h3 className="panel-title">The search checks</h3>
        <p className="panel-sub mb-3 mt-0.5">
          Measured against a live search, not estimated.
        </p>
        <CheckList
          checks={visChecks}
          technical={technicalDetail}
          emptyText="No search checks were recorded for this run."
        />
      </article>
    </section>
  );
}
