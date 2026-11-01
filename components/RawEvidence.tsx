"use client";

import { useState } from "react";
import { CaretDown, Code, FileText, MagnifyingGlass } from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";
import { cn, CopyButton } from "@/lib/ui";
import { Collapse } from "./report/Collapse";
import { Term } from "./report/Term";

const EXCERPT_LIMIT = 800;

function EvidenceSection({
  icon: Icon,
  title,
  meta,
  copyValue,
  children,
}: {
  icon: typeof FileText;
  title: string;
  meta: string;
  copyValue?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="inset flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)]">
          <Icon className="h-3.5 w-3.5" weight="duotone" aria-hidden="true" />
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-snug tracking-tight">
              {title}
            </span>
            <span className="block truncate font-mono text-xs tabular-nums text-[var(--text-subtle)]">
              {meta}
            </span>
          </span>
          <CaretDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)] transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {copyValue ? (
          <CopyButton text={copyValue} label={`Copy ${title}`} />
        ) : null}
      </div>

      <Collapse open={open}>
        <div className="border-t border-[var(--surface-border)] p-3.5">
          {children}
        </div>
      </Collapse>
    </div>
  );
}

export default function RawEvidence({ report }: { report: AuditReport }) {
  const excerpt = report.fetch.markdown.excerpt ?? "";
  const [showAll, setShowAll] = useState(false);
  const truncated = excerpt.length > EXCERPT_LIMIT;
  const visible =
    showAll || !truncated ? excerpt : excerpt.slice(0, EXCERPT_LIMIT);

  const searchJson = JSON.stringify(
    {
      indexation: report.search.indexation,
      ranking: {
        ...report.search.ranking,
        results: report.search.ranking.results.slice(0, 10),
      },
      competitors: report.search.competitors,
    },
    null,
    2,
  );

  const probeLines = [
    ...report.raw.searchQueries,
    ...report.raw.fetchErrors.map(
      (e) =>
        `${e.url}: ${e.error}${typeof e.status === "number" ? ` (${e.status})` : ""}`,
    ),
  ];
  const probeText = probeLines.length > 0 ? probeLines.join("\n") : undefined;

  return (
    <section
      id="evidence"
      aria-label="Raw evidence"
      className="w-full scroll-mt-24 space-y-4"
    >
      <div className="panel p-4 sm:p-5">
        <h2 className="panel-title">The unedited receipts</h2>
        <p className="panel-sub mt-1">
          Everything above is a reading of these. Nothing here is summarised or
          cleaned up: this is what the page and the search checks sent back.
        </p>
      </div>

      <div className="grid gap-2.5">
        <EvidenceSection
          icon={FileText}
          title="The text a reader pulled out"
          meta={`${excerpt.length} characters · ${report.fetch.wordCount} words`}
          copyValue={excerpt || undefined}
        >
          <p className="panel-sub mb-2 text-sm leading-relaxed">
            <Term k="markdown">Plain text</Term> is what most AI tools are
            handed instead of your page&rsquo;s design.
          </p>
          <pre className="code-block__body max-h-96 rounded-xl border border-[var(--landing-console-edge)] bg-[var(--landing-console)]">
            {visible || "The reader came back with no text at all."}
          </pre>
          {truncated ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="composer-chip mt-2"
            >
              {showAll ? "Show less" : `Show all ${excerpt.length} characters`}
            </button>
          ) : null}
        </EvidenceSection>

        <EvidenceSection
          icon={Code}
          title="The raw search answers"
          meta="exactly what the search service returned"
          copyValue={searchJson}
        >
          <pre className="code-block__body max-h-96 rounded-xl border border-[var(--landing-console-edge)] bg-[var(--landing-console)]">
            {searchJson}
          </pre>
        </EvidenceSection>

        <EvidenceSection
          icon={MagnifyingGlass}
          title="What we asked, and what failed"
          meta={`${report.raw.fetchErrors.length} errors · ${report.raw.searchQueries.length} searches run`}
          copyValue={probeText}
        >
          <div className="grid gap-3.5">
            <div>
              <h3 className="panel-eyebrow text-xs">Searches run</h3>
              {report.raw.searchQueries.length === 0 ? (
                <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                  none recorded
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {report.raw.searchQueries.map((q) => (
                    <li
                      key={q}
                      className="truncate font-mono text-xs text-[var(--text-muted)]"
                      title={q}
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="panel-eyebrow text-xs">Read attempts</h3>
              {report.raw.fetchErrors.length === 0 ? (
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                  Both reads succeeded: the page&rsquo;s markup and its plain
                  text came back complete.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {report.raw.fetchErrors.map((e, i) => (
                    <li
                      key={`${e.url}-${i}`}
                      className="break-words font-mono text-xs leading-relaxed text-[var(--fail-strong)]"
                    >
                      {e.url}: {e.error}
                      {typeof e.status === "number" ? ` (${e.status})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </EvidenceSection>
      </div>
    </section>
  );
}
