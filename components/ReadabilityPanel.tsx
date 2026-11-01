import { Globe, Timer, BookOpenText, TextT } from "@phosphor-icons/react";
import type { AuditReport, CheckStatus } from "@/lib/audit-types";
import { STATUS_COPY } from "@/lib/plain-language";
import { CheckList } from "./report/CheckRow";
import { Term } from "./report/Term";

interface ReadabilityPanelProps {
  report: AuditReport;
  technicalDetail: boolean;
}

export default function ReadabilityPanel({
  report,
  technicalDetail,
}: ReadabilityPanelProps) {
  const checks = report.checks.filter((c) => c.category === "readability");
  const f = report.fetch;
  const excerpt = (f.markdown.excerpt ?? "").replace(/\s+/g, " ").trim();

  /** Tone comes from the same check the list below shows, so the two never disagree. */
  const statusOf = (id: string): CheckStatus =>
    report.checks.find((c) => c.id === id)?.status ?? "pass";

  const facts = [
    {
      icon: TextT,
      label: "Name in the browser tab",
      value: f.html.title ? `${f.html.title.length} characters` : "nothing found",
      status: statusOf("r-title"),
    },
    {
      icon: BookOpenText,
      label: "Main heading on the page",
      value: f.html.h1
        ? f.html.h1.length > 42
          ? `${f.html.h1.slice(0, 42)}...`
          : f.html.h1
        : "none found",
      status: statusOf("r-h1"),
    },
    {
      icon: Globe,
      label: "Words a reader could pull out",
      value: `${f.wordCount.toLocaleString()} words`,
      status: statusOf("r-word-count"),
    },
    {
      icon: Timer,
      label: "Time to hand the page over",
      value: `${f.latencyMs.toLocaleString()} ms`,
      status: statusOf("t-latency"),
    },
  ] as const;

  return (
    <section
      id="readability"
      aria-label="What a machine can read"
      className="w-full scroll-mt-24 space-y-4"
    >
      <div className="panel p-4 sm:p-5">
        <h2 className="panel-title">What a machine actually received</h2>
        <p className="panel-sub mt-1">
          Not a screenshot. This is the plain text a{" "}
          <Term k="ai-answer">reader</Term> pulled from the live page, with no
          styling, no images, and nothing saved from an earlier copy.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="panel flex items-center gap-3 p-3.5">
            <span className="inset flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)]">
              <fact.icon className="h-4 w-4" weight="duotone" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {fact.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tracking-tight">
                {fact.value}
              </p>
            </div>
            <span
              className={
                fact.status === "pass"
                  ? "state-pill state-pill--pass"
                  : fact.status === "warn"
                    ? "state-pill state-pill--warn"
                    : "state-pill state-pill--fail"
              }
            >
              {STATUS_COPY[fact.status].word}
            </span>
          </div>
        ))}
      </div>

      {excerpt ? (
        <div className="code-block">
          <div className="code-block__bar">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--landing-led)]" aria-hidden="true" />
            The first words a reader gets
          </div>
          <p className="code-block__body max-h-40">{excerpt.slice(0, 480)}</p>
        </div>
      ) : (
        <div className="panel p-4 text-sm leading-relaxed text-[var(--text-muted)]">
          The reader came back with no text at all. That is the single biggest
          problem on this page, and it is what the checks below are about.
        </div>
      )}

      <article className="panel p-4 sm:p-5">
        <h3 className="panel-title">The reading checks</h3>
        <p className="panel-sub mb-3 mt-0.5">
          Each one is a thing a program needs in order to understand the page
          without guessing.
        </p>
        <CheckList
          checks={checks}
          technical={technicalDetail}
          emptyText="No reading checks were recorded for this run."
        />
      </article>
    </section>
  );
}
