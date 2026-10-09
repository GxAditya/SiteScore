"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, Code, FileText, MagnifyingGlass } from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";
import { cn, CopyButton } from "@/lib/ui";

const EXCERPT_LIMIT = 800;

function EvidenceSection({
  icon: Icon,
  title,
  meta,
  copyValue,
  defaultOpen,
  children,
}: {
  icon: typeof FileText;
  title: string;
  meta: string;
  copyValue?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon
          className="h-4 w-4 shrink-0 text-sage-500 dark:text-sage-400"
          aria-hidden="true"
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-semibold text-sage-900 dark:text-sage-100">
            {title}{" "}
            <span className="font-normal tabular-nums text-sage-500 dark:text-sage-400">
              ({meta})
            </span>
          </span>
          <CaretDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-sage-500 transition-transform dark:text-sage-400",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {copyValue ? (
          <CopyButton text={copyValue} label={`Copy ${title}`} />
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }
            }
            className="overflow-hidden"
          >
            <div className="border-t border-sage-100 p-4 dark:border-sage-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div>
        <h2 className="text-lg font-bold text-sage-950 dark:text-sage-50">
          Raw Probe Evidence
        </h2>
        <p className="mt-0.5 text-xs text-sage-600 dark:text-sage-400">
          Unedited payloads from live fetch and TinyFish search responses.
        </p>
      </div>

      <div className="grid gap-3">
        <EvidenceSection
          icon={FileText}
          title="Extracted Markdown Excerpt"
          meta={`${excerpt.length} chars · ${report.fetch.wordCount} words`}
          copyValue={excerpt || undefined}
          defaultOpen={false}
        >
          <pre className="max-h-96 overflow-auto rounded-xl bg-sage-50/60 p-3 font-mono text-xs leading-relaxed text-sage-900 dark:bg-[#111712] dark:text-sage-200">
            <code>{visible || "(no markdown excerpt returned)"}</code>
          </pre>
          {truncated && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs font-semibold tabular-nums text-sage-700 transition-colors hover:text-sage-950 dark:text-sage-300 dark:hover:text-sage-100"
            >
              {showAll
                ? "Show less"
                : `Show full excerpt (${excerpt.length} chars)`}
            </button>
          )}
        </EvidenceSection>

        <EvidenceSection
          icon={Code}
          title="Search JSON (Indexation & Rankings)"
          meta="raw response payload"
          copyValue={searchJson}
          defaultOpen={false}
        >
          <pre className="max-h-96 overflow-auto rounded-xl bg-sage-50/60 p-3 font-mono text-xs leading-relaxed text-sage-900 dark:bg-[#111712] dark:text-sage-200">
            <code>{searchJson}</code>
          </pre>
        </EvidenceSection>

        <EvidenceSection
          icon={MagnifyingGlass}
          title="Search Queries & Fetch Logs"
          meta={`${report.raw.fetchErrors.length} error(s) · ${report.raw.searchQueries.length} query probe(s)`}
          copyValue={probeText}
          defaultOpen={false}
        >
          <div className="grid gap-3 text-xs sm:text-sm">
            <div>
              <h3 className="font-mono text-xs font-bold text-sage-500 dark:text-sage-400">
                PROBED SEARCH QUERIES
              </h3>
              {report.raw.searchQueries.length === 0 ? (
                <p className="mt-1 font-mono text-xs text-sage-800 dark:text-sage-200">
                  none recorded
                </p>
              ) : (
                <ul className="mt-1 grid gap-1">
                  {report.raw.searchQueries.map((q) => (
                    <li
                      key={q}
                      className="truncate font-mono text-xs text-sage-800 dark:text-sage-200"
                      title={q}
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-mono text-xs font-bold text-sage-500 dark:text-sage-400">
                FETCH DIAGNOSTICS
              </h3>
              {report.raw.fetchErrors.length === 0 ? (
                <p className="mt-1 font-mono text-xs text-sage-800 dark:text-sage-200">
                  Clean fetch - both HTML and Markdown payloads successfully parsed.
                </p>
              ) : (
                <ul className="mt-1 grid gap-1">
                  {report.raw.fetchErrors.map((e, i) => (
                    <li
                      key={`${e.url}-${i}`}
                      className="font-mono text-xs text-coral-700 dark:text-coral-300"
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
