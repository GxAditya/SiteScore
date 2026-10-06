"use client";

import type { AuditReport } from "@/lib/audit-types";
import { gradeFor } from "@/lib/audit-types";

function verdictFor(grade: string, p0Count: number): string {
  const noun = p0Count === 1 ? "blocking issue keeps" : "blocking issues keep";
  if (grade === "A")
    return p0Count > 0
      ? `Strong foundation — ${p0Count} ${noun} AI search from citing this page.`
      : "Strong foundation — ready for AI search to cite this page.";
  if (grade === "B")
    return p0Count > 0
      ? `Good progress — ${p0Count} ${noun} AI search from citing this page.`
      : "Good progress — polish the details to earn more citations.";
  if (grade === "C")
    return p0Count > 0
      ? `Shaky ground — ${p0Count} ${noun} AI search from citing this page.`
      : "Shaky ground — work through the fixes to earn citations.";
  return p0Count > 0
    ? `Critical gaps — ${p0Count} ${noun} AI search from citing this page.`
    : "Critical gaps — work through the fixes to become citable.";
}

export default function ExecutiveSummary({
  report,
  onJumpToFixes,
}: {
  report: AuditReport;
  onJumpToFixes: () => void;
}) {
  const grade = report.score.grade ?? gradeFor(report.score.total);
  const p0Count = report.fixes.filter((f) => f.priority === "P0").length;
  const p1Count = report.fixes.filter((f) => f.priority === "P1").length;
  const p0 = report.fixes.filter((f) => f.priority === "P0").slice(0, 3);
  const indexed = report.search.indexation.indexed;
  const rank = report.search.ranking.rank;

  return (
    <section
      aria-label="Executive summary"
      className="card w-full p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-sage-500 dark:text-sage-400">
            Executive summary
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-sage-950 dark:text-sage-50">
            {verdictFor(grade, p0Count)}
          </p>
          <p className="body-secondary mt-1 text-sage-600 dark:text-sage-400">
            {p0Count > 0
              ? `Start with the ${p0Count} blocking ${p0Count === 1 ? "fix" : "fixes"} — then work through ${p1Count} high-impact improvements.`
              : p1Count > 0
                ? `No blocking issues. ${p1Count} high-impact ${p1Count === 1 ? "improvement remains" : "improvements remain"} to earn more citations.`
                : "No blocking or high-impact issues. Keep the page fast and structured."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              indexed
                ? "bg-sage-100 text-sage-800 dark:bg-sage-900/60 dark:text-sage-200"
                : "bg-coral-50 text-coral-800 dark:bg-coral-950/60 dark:text-coral-200"
            }`}
          >
            {indexed ? "Indexed" : "Not indexed"}
          </span>
          <span className="inline-flex items-center rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-800 dark:bg-sage-900/60 dark:text-sage-200">
            {rank != null ? `Rank #${rank}` : "Unranked"}
          </span>
        </div>
      </div>

      {p0.length > 0 ? (
        <div className="mt-3.5 space-y-2">
          <p className="text-xs font-semibold text-coral-700 dark:text-coral-300">
            Top Priority Blocking Issues (Fix Today):
          </p>
          <ul className="grid gap-2">
            {p0.map((f) => (
              <li key={f.title}>
                <button
                  type="button"
                  onClick={onJumpToFixes}
                  className="flex w-full items-center gap-2 truncate rounded-xl border border-sage-100 bg-sage-50/60 px-3 py-2 text-left text-xs text-sage-800 transition-colors hover:border-coral-300 hover:bg-coral-50/50 hover:text-coral-950 dark:border-sage-800 dark:bg-[#111712] dark:text-sage-200 dark:hover:border-coral-800 dark:hover:bg-coral-950/40"
                >
                  <span className="shrink-0 rounded-md bg-coral-500 px-1.5 py-0.5 font-bold text-white text-[10px]">
                    P0
                  </span>
                  <span className="truncate font-medium">{f.title}</span>
                  <span className="ml-auto text-[11px] text-sage-500 hover:underline">
                    View fix →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-sage-600 dark:text-sage-400">
          No blocking P0 fixes detected — proceed with P1 optimizations.
        </p>
      )}
    </section>
  );
}
