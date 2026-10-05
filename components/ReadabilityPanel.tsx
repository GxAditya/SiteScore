import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import type { AuditCheck, AuditReport } from "@/lib/audit-types";
import { cn } from "@/lib/ui";

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
        No readability checks recorded.
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
            <h3
              className={cn(
                "text-xs font-semibold tabular-nums",
                s.head,
              )}
            >
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

export default function ReadabilityPanel({ report }: { report: AuditReport }) {
  const readability = report.checks.filter((c) => c.category === "readability");
  const f = report.fetch;

  return (
    <section
      id="readability"
      aria-label="AI readability"
      className="w-full scroll-mt-24 space-y-4"
    >
      <div>
        <h2 className="text-lg font-bold text-sage-950 dark:text-sage-50">
          AI Assistant Readability
        </h2>
        <p className="mt-0.5 text-xs text-sage-600 dark:text-sage-400">
          What AI fetch tools extracted from the live page markup (ttl=0).
        </p>
        <p className="mt-1 text-xs tabular-nums text-sage-500 dark:text-sage-400">
          {f.wordCount.toLocaleString()} words · {f.latencyMs.toLocaleString()} ms latency · title:{" "}
          {f.html.title ? `${f.html.title.length} chars` : "missing"} · H1:{" "}
          {f.html.h1 ? "present" : "missing"}
        </p>
      </div>

      <div className="rounded-2xl border border-sage-200 bg-white p-4 shadow-card dark:border-sage-800/80 dark:bg-[#161D17]">
        <CompactCheckList items={readability} />
      </div>
    </section>
  );
}
