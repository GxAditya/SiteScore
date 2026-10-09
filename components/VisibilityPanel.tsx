"use client";

import { useState } from "react";
import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import type { AuditCheck, AuditReport } from "@/lib/audit-types";
import { cn } from "@/lib/ui";

const RANK_CAP = 5;
const COMPETITOR_CAP = 5;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryTerms(query: string): string[] {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "of",
    "in",
    "on",
    "with",
    "vs",
    "best",
    "top",
    "how",
    "what",
    "why",
    "get",
    "buy",
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

const GROUP_STYLE = {
  fail: {
    Icon: XCircle,
    head: "text-coral-700 dark:text-coral-300",
    icon: "text-coral-600 dark:text-coral-400",
  },
  warn: {
    Icon: WarningCircle,
    head: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  pass: {
    Icon: CheckCircle,
    head: "text-sage-700 dark:text-sage-300",
    icon: "text-sage-500 dark:text-sage-300",
  },
} as const;

function CompactCheckList({ items }: { items: AuditCheck[] }) {
  const groups = [
    { key: "fail" as const, label: "Failing", rows: items.filter((c) => c.status === "fail") },
    { key: "warn" as const, label: "Needs work", rows: items.filter((c) => c.status === "warn") },
    { key: "pass" as const, label: "Passing", rows: items.filter((c) => c.status === "pass") },
  ].filter((g) => g.rows.length > 0);
  if (groups.length === 0) {
    return (
      <p className="text-sm text-sage-500 dark:text-sage-400">
        No visibility checks recorded.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {groups.map((g) => {
        const s = GROUP_STYLE[g.key];
        const Icon = s.Icon;
        return (
          <div key={g.key}>
            <h3 className={cn("text-xs font-semibold tabular-nums", s.head)}>
              {g.label} ({g.rows.length})
            </h3>
            <ul className="mt-1.5 grid gap-1.5">
              {g.rows.map((c) => (
                <li key={c.id} className="flex gap-2 text-xs sm:text-sm">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", s.icon)}
                    weight="fill"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="font-semibold text-sage-950 dark:text-sage-100">
                      {c.label}.{" "}
                    </span>
                    <span className="text-sage-700 dark:text-sage-300">
                      {c.evidence}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function VisibilityPanel({ report }: { report: AuditReport }) {
  const { indexation, ranking } = report.search;
  const competitors = report.search.competitors;
  const terms = queryTerms(report.input.query);
  const snippetCheck = report.checks.find((c) => c.id === "v-snippet-match");
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  const visChecks = report.checks.filter((c) => c.category === "visibility");
  const indexedLabel = indexation.error
    ? "error"
    : indexation.indexed
      ? "yes"
      : "no";
  const rankLabel =
    ranking.error || ranking.rank === null ? "unranked" : `#${ranking.rank}`;
  const visibleRanks = showAllRanks
    ? ranking.results
    : ranking.results.slice(0, RANK_CAP);
  const visibleCompetitors = showAllCompetitors
    ? competitors
    : competitors.slice(0, COMPETITOR_CAP);

  return (
    <section
      id="visibility"
      aria-label="Search visibility"
      className="w-full scroll-mt-24 space-y-4"
    >
      <div>
        <p className="eyebrow text-sage-500 dark:text-sage-400">
          Search visibility
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-sage-950 dark:text-sage-50">
          Search Visibility Probes
        </h2>
        <p className="body-secondary mt-1 text-sage-600 dark:text-sage-400">
          Live indexation and ranking measured with TinyFish Search probes.
        </p>
        <p className="mt-1 text-xs tabular-nums text-sage-500 dark:text-sage-400">
          indexed: <strong className="text-sage-800 dark:text-sage-200">{indexedLabel}</strong> · rank:{" "}
          <strong className="text-sage-800 dark:text-sage-200">{rankLabel}</strong> ·{" "}
          {ranking.results.length} result(s) observed · {competitors.length} competitor(s)
        </p>
      </div>

      <div className="card p-4">
        <CompactCheckList items={visChecks} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card h-full p-4">
          <h3 className="text-sm font-semibold text-sage-950 dark:text-sage-50">
            Indexation Status
          </h3>
          {indexation.error ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Indexation check unavailable ({indexation.error}).
            </p>
          ) : (
            <p className="mt-1 text-xs sm:text-sm text-sage-800 dark:text-sage-200">
              <span
                className={cn(
                  "mr-2 inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold",
                  indexation.indexed
                    ? "bg-sage-100 text-sage-900 dark:bg-sage-900/60 dark:text-sage-200"
                    : "bg-coral-100 text-coral-900 dark:bg-coral-900/60 dark:text-coral-200",
                )}
              >
                {indexation.indexed ? "INDEXED" : "NOT INDEXED"}
              </span>
              {indexation.indexed
                ? `Exact URL found via site: probe${indexation.matchUrl ? ` (${indexation.matchUrl})` : ""}.`
                : "Exact URL did not surface in the site: probe."}
            </p>
          )}
          <p className="mt-2 font-mono text-[11px] tabular-nums text-sage-500 dark:text-sage-400">
            probe: {indexation.query} · {indexation.totalResults} total result(s)
          </p>
        </div>

        <div className="card h-full p-4">
          <h3 className="text-sm font-semibold text-sage-950 dark:text-sage-50">
            Rank Position
          </h3>
          {ranking.error ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Ranking check unavailable ({ranking.error}).
            </p>
          ) : ranking.rank !== null ? (
            <p className="mt-1 text-xs sm:text-sm text-sage-800 dark:text-sage-200">
              <span className="mr-2 inline-block rounded-md bg-sage-900 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-white dark:bg-sage-100 dark:text-sage-950">
                #{ranking.rank}
              </span>
              for &ldquo;{report.input.query}&rdquo; across {ranking.results.length} results.
            </p>
          ) : (
            <p className="mt-1 text-xs sm:text-sm text-sage-800 dark:text-sage-200">
              <span className="mr-2 inline-block rounded-md bg-coral-100 px-2 py-0.5 font-mono text-xs font-bold text-coral-900 dark:bg-coral-900/60 dark:text-coral-200">
                UNRANKED
              </span>
              Not found among {ranking.results.length} observed search results.
            </p>
          )}
          <p className="mt-2 font-mono text-[11px] text-sage-500 dark:text-sage-400">
            probe: {ranking.query}
          </p>
        </div>
      </div>

      {snippetCheck && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-sage-950 dark:text-sage-50">
            Snippet Term Matching
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-sage-800 dark:text-sage-200">
            <Highlighted text={snippetCheck.evidence} terms={terms} />
          </p>
          {terms.length > 0 && (
            <p className="mt-2 text-xs text-sage-600 dark:text-sage-400">
              Query terms highlighted:{" "}
              {terms.map((t) => (
                <code
                  key={t}
                  className="mr-1 rounded-md bg-sage-100 px-1.5 py-0.5 font-mono text-[11px] text-sage-800 dark:bg-sage-900 dark:text-sage-200"
                >
                  {t}
                </code>
              ))}
            </p>
          )}
        </div>
      )}

      {ranking.results.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-dense w-full min-w-[720px] table-fixed text-left text-xs sm:text-sm">
            <colgroup>
              <col className="w-12" />
              <col className="w-[38%]" />
              <col className="w-[54%]" />
            </colgroup>
            <caption className="px-4 pt-3 text-left text-xs font-semibold tabular-nums text-sage-950 dark:text-sage-50">
              Ranking results for &ldquo;{report.input.query}&rdquo; - showing{" "}
              {visibleRanks.length} of {ranking.results.length}
            </caption>
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#161D17]">
              <tr className="border-b border-sage-200 text-sage-500 dark:border-sage-800 dark:text-sage-400">
                <th scope="col" className="px-4 py-2 align-top font-semibold">
                  #
                </th>
                <th scope="col" className="px-4 py-2 align-top font-semibold">
                  Page
                </th>
                <th scope="col" className="px-4 py-2 align-top font-semibold">
                  Snippet
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRanks.map((r, i) => (
                <tr
                  key={`${r.url}-${i}`}
                  className="border-b border-sage-100/70 transition-colors last:border-0 hover:bg-sage-50/50 dark:border-sage-800 dark:hover:bg-sage-900/40"
                >
                  <td className="px-4 py-2.5 align-top font-mono text-xs tabular-nums text-sage-500 dark:text-sage-400">
                    {r.position ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="min-w-0 space-y-0.5">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block font-medium leading-snug text-sage-950 transition-colors hover:text-sage-700 dark:text-sage-50 dark:hover:text-sage-200"
                      >
                        <Highlighted text={r.title || r.url} terms={terms} />
                      </a>
                      <span className="block truncate font-mono text-[11px] text-sage-500 dark:text-sage-400">
                        {r.siteName ? `${r.siteName} · ` : ""}
                        {r.url}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top text-xs leading-relaxed text-sage-700 dark:text-sage-300">
                    <Highlighted text={r.snippet} terms={terms} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranking.results.length > RANK_CAP && (
            <div className="px-4 py-2 border-t border-sage-100 dark:border-sage-800">
              <button
                type="button"
                aria-expanded={showAllRanks}
                onClick={() => setShowAllRanks((v) => !v)}
                className="text-xs font-semibold text-sage-700 transition-colors hover:text-sage-950 dark:text-sage-300 dark:hover:text-sage-100"
              >
                {showAllRanks
                  ? "Show fewer"
                  : `Show all ${ranking.results.length}`}
              </button>
            </div>
          )}
        </div>
      )}

      {competitors.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold tabular-nums text-sage-950 dark:text-sage-50">
            Competitor Domains Contesting Query ({competitors.length})
          </h3>
          <ul className="mt-2.5 grid gap-2">
            {visibleCompetitors.map((c, i) => (
              <li
                key={`${c.url}-${i}`}
                className="min-w-0 text-xs sm:text-sm text-sage-800 dark:text-sage-200"
              >
                <div className="min-w-0 space-y-0.5 overflow-hidden">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="shrink-0 font-mono text-xs tabular-nums text-sage-500 dark:text-sage-400">
                      #{c.position ?? "-"}
                    </span>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 font-medium leading-snug text-sage-950 underline decoration-sage-300 underline-offset-2 hover:decoration-sage-950 dark:text-sage-50 dark:decoration-sage-700 dark:hover:decoration-sage-200"
                    >
                      {c.title || c.url}
                    </a>
                  </div>
                  <span className="block truncate font-mono text-[11px] text-sage-500 dark:text-sage-400">
                    {c.siteName ? `${c.siteName} · ` : ""}
                    {c.url}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {competitors.length > COMPETITOR_CAP && (
            <button
              type="button"
              aria-expanded={showAllCompetitors}
              onClick={() => setShowAllCompetitors((v) => !v)}
              className="mt-2 text-xs font-semibold text-sage-700 underline-offset-2 hover:underline dark:text-sage-300"
            >
              {showAllCompetitors
                ? "Show fewer"
                : `Show all ${competitors.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
