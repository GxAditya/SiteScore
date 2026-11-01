"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { AuditCheck, CheckCategory } from "@/lib/audit-types";
import { AXES, AXIS_ORDER, axisVerdict } from "@/lib/plain-language";
import { CheckList } from "./report/CheckRow";
import { Collapse } from "./report/Collapse";

interface CategoryCardsProps {
  readability: number;
  visibility: number;
  technical: number;
  checks: AuditCheck[];
  /** Reveals measured values inside each finding. */
  technicalDetail: boolean;
}

export default function CategoryCards({
  readability,
  visibility,
  technical,
  checks,
  technicalDetail,
}: CategoryCardsProps) {
  const scores: Record<CheckCategory, number> = {
    readability,
    visibility,
    technical,
  };

  const firstBroken = AXIS_ORDER.find(
    (key) =>
      checks.filter((c) => c.category === key && c.status !== "pass").length > 0,
  );
  const [open, setOpen] = useState<Record<CheckCategory, boolean>>({
    readability: firstBroken === "readability",
    visibility: firstBroken === "visibility",
    technical: firstBroken === "technical",
  });

  return (
    <section aria-label="The three things we check" className="panel p-4 sm:p-5">
      <h2 className="panel-title">Three questions, answered</h2>
      <p className="panel-sub mt-1">
        Every check below feeds one of these. Open a question to see the findings
        behind its score.
      </p>

      <div className="mt-4 space-y-2.5">
        {AXIS_ORDER.map((key) => {
          const axis = AXES[key];
          const score = Math.max(0, Math.min(100, Math.round(scores[key] ?? 0)));
          const v = axisVerdict(score);
          const items = checks.filter((c) => c.category === key);
          const broken = items.filter((c) => c.status === "fail").length;
          const weak = items.filter((c) => c.status === "warn").length;
          const fine = items.filter((c) => c.status === "pass").length;
          const isOpen = open[key];

          return (
            <article key={key} className="inset px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  {axis.question}
                </h3>
                <span
                  className={`state-pill shrink-0 ${
                    v.tone === "pass"
                      ? "state-pill--pass"
                      : v.tone === "warn"
                        ? "state-pill--warn"
                        : "state-pill--fail"
                  }`}
                >
                  {v.word} · {score}
                </span>
              </div>

              <div
                className="meter mt-2"
                role="meter"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={axis.question}
              >
                <div
                  className={
                    v.tone === "warn"
                      ? "meter__fill meter__fill--warn"
                      : v.tone === "fail"
                        ? "meter__fill meter__fill--fail"
                        : "meter__fill"
                  }
                  style={{ width: `${score}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-subtle)]">
                  {broken} broken · {weak} weak · {fine} fine · {axis.weight}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                  aria-expanded={isOpen}
                  className="composer-chip"
                >
                  <CaretDown
                    className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    weight="bold"
                    aria-hidden="true"
                  />
                  <span>{isOpen ? "Hide" : "Show"} {items.length} checks</span>
                </button>
              </div>

              <Collapse open={isOpen}>
                <div className="mt-2.5">
                  <CheckList
                    checks={items}
                    technical={technicalDetail}
                    emptyText="No checks recorded for this question."
                  />
                </div>
              </Collapse>
            </article>
          );
        })}
      </div>
    </section>
  );
}
