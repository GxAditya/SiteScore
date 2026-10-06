"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CaretDown,
  CheckCircle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { AuditCheck, CheckStatus } from "@/lib/audit-types";
import { cn } from "@/lib/ui";

interface CategoryCardsProps {
  readability: number;
  visibility: number;
  technical: number;
  checks: AuditCheck[];
}

const CATEGORIES = [
  {
    key: "readability",
    label: "Readability",
    hint: "Can AI tools read and extract page content cleanly?",
    weight: "40% of score",
  },
  {
    key: "visibility",
    label: "Visibility",
    hint: "Does search surface and rank this URL in answer results?",
    weight: "35% of score",
  },
  {
    key: "technical",
    label: "Technical",
    hint: "Fast latency, clean headers, and frictionless crawlability?",
    weight: "25% of score",
  },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

function barClass(value: number): string {
  if (value >= 70) return "bg-sage-500 dark:bg-sage-300";
  if (value >= 50) return "bg-amber-500 dark:bg-amber-400";
  return "bg-coral-500 dark:bg-coral-400";
}

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle> = {
  pass: CheckCircle,
  warn: WarningCircle,
  fail: XCircle,
};

const STATUS_ICON_CLASS: Record<CheckStatus, string> = {
  pass: "text-sage-500 dark:text-sage-300",
  warn: "text-amber-500 dark:text-amber-400",
  fail: "text-coral-500 dark:text-coral-400",
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function CategoryRow({
  cat,
  value,
  checks,
}: {
  cat: (typeof CATEGORIES)[number];
  value: number;
  checks: AuditCheck[];
}) {
  const group = checks.filter((c) => c.category === cat.key);
  const pass = group.filter((c) => c.status === "pass").length;
  const warn = group.filter((c) => c.status === "warn").length;
  const fail = group.filter((c) => c.status === "fail").length;
  const [open, setOpen] = useState(fail > 0);
  const reduce = useReducedMotion();
  const score = clamp(value);

  const counts: Array<{ status: CheckStatus; n: number; label: string }> = [
    { status: "pass", n: pass, label: "pass" },
    { status: "warn", n: warn, label: "warn" },
    { status: "fail", n: fail, label: "fail" },
  ];

  return (
    <div className="card">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-sage-950 dark:text-sage-50">
              {cat.label}{" "}
              <span className="font-normal tabular-nums text-sage-500 dark:text-sage-400">
                · {cat.weight}
              </span>
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-sage-600 dark:text-sage-400">
              {cat.hint}
            </p>
          </div>
          <span className="shrink-0 rounded-xl bg-sage-100/80 px-2.5 py-1 text-xl font-bold tabular-nums text-sage-950 dark:bg-sage-900/70 dark:text-sage-50">
            {score}
          </span>
        </div>
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900"
          role="img"
          aria-label={`${cat.label} score ${score} out of 100`}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500", barClass(score))}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {counts.map(({ status, n, label }) => {
            const Icon = STATUS_ICON[status];
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1 text-xs text-sage-700 dark:text-sage-300"
              >
                <Icon
                  className={cn("h-3.5 w-3.5", STATUS_ICON_CLASS[status])}
                  weight="fill"
                  aria-hidden="true"
                />
                <span className="font-semibold tabular-nums text-sage-950 dark:text-sage-100">
                  {n}
                </span>{" "}
                {label}
              </span>
            );
          })}
          <span className="text-xs tabular-nums text-sage-400 dark:text-sage-500">
            {group.length} checks
          </span>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-sage-700 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-300 dark:hover:bg-sage-800 dark:hover:text-sage-100"
          >
            {open ? "Hide" : "Show"} checks
            <CaretDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="checks"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }
            }
            className="grid gap-2.5 overflow-hidden border-t border-sage-100 px-4 py-3.5 dark:border-sage-800"
          >
            {group.map((c) => {
              const Icon = STATUS_ICON[c.status];
              return (
                <li key={c.id} className="flex gap-2 text-xs sm:text-sm">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      STATUS_ICON_CLASS[c.status],
                    )}
                    weight="fill"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="font-semibold text-sage-950 dark:text-sage-100">
                      {c.label}.{" "}
                    </span>
                    <span className="text-sage-700 dark:text-sage-300">
                      {c.detail}
                    </span>
                    <span
                      className="mt-0.5 block truncate font-mono text-[11px] text-sage-500 dark:text-sage-500"
                      title={c.evidence}
                    >
                      {c.evidence}
                    </span>
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CategoryCards({
  readability,
  visibility,
  technical,
  checks,
}: CategoryCardsProps) {
  const values: Record<CategoryKey, number> = {
    readability,
    visibility,
    technical,
  };
  return (
    <section
      id="categories"
      aria-label="Category scores"
      className="grid w-full scroll-mt-24 gap-3"
    >
      {CATEGORIES.map((cat) => (
        <CategoryRow
          key={cat.key}
          cat={cat}
          value={values[cat.key]}
          checks={checks}
        />
      ))}
    </section>
  );
}
