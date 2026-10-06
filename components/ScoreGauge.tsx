"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { Link as LinkIcon, MagnifyingGlass } from "@phosphor-icons/react";
import { gradeFor } from "@/lib/audit-types";
import { cn, CopyButton, gradeBadgeClass, gradeTextClass } from "@/lib/ui";

interface ScoreGaugeProps {
  total: number;
  readability: number;
  visibility: number;
  technical: number;
  grade?: string;
  fetchedAt: string;
  query: string;
  querySource: "user" | "auto";
  finalUrl: string;
}

const R = 54;
const CIRC = 2 * Math.PI * R;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function ScoreGauge({
  total,
  readability,
  visibility,
  technical,
  grade,
  fetchedAt,
  query,
  querySource,
  finalUrl,
}: ScoreGaugeProps) {
  const g = grade ?? gradeFor(total);
  const pct = clamp(total);
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number>(reduce ? pct : 0);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gaugeRef, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, pct, {
      type: "spring",
      stiffness: 48,
      damping: 17,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, pct, reduce]);

  let fetchedLabel = fetchedAt;
  try {
    fetchedLabel = new Date(fetchedAt).toLocaleString();
  } catch {
    /* keep raw */
  }

  const subs = [
    { label: "Readability", value: clamp(readability) },
    { label: "Visibility", value: clamp(visibility) },
    { label: "Technical", value: clamp(technical) },
  ];

  return (
    <section aria-label="Overall score" className="w-full">
      <div className="card p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 flex w-full flex-col gap-5">
        <div ref={gaugeRef} className="relative mx-auto shrink-0 sm:mx-0">
          <svg
            viewBox="0 0 140 140"
            width="150"
            height="150"
            role="img"
            aria-label={`Overall score ${pct} out of 100, grade ${g}`}
            className={cn("block", gradeTextClass(g))}
          >
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-sage-100 dark:text-sage-900"
            />
            <motion.circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={reduce ? false : { strokeDashoffset: CIRC }}
              whileInView={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 42, damping: 17 }}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="text-3xl font-bold tabular-nums text-sage-950 dark:text-sage-50">
              {shown}
            </span>
            <span
              className={cn(
                "mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                gradeBadgeClass(g),
              )}
            >
              Grade {g}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-900 dark:bg-sage-900/60 dark:text-sage-200">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sage-500 dark:bg-sage-300"
              />
              Live Probe (ttl=0)
            </span>
            <time
              dateTime={fetchedAt}
              title={fetchedAt}
              className="text-xs tabular-nums text-sage-500 dark:text-sage-400"
            >
              fetched {fetchedLabel}
            </time>
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <LinkIcon
              className="h-4 w-4 shrink-0 text-sage-400 dark:text-sage-500"
              aria-hidden="true"
            />
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium text-sage-950 dark:text-sage-50"
              title={finalUrl}
            >
              {finalUrl}
            </span>
            <CopyButton text={finalUrl} label="Copy page URL" />
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-sage-700 dark:text-sage-300">
            <MagnifyingGlass
              className="h-4 w-4 shrink-0 text-sage-400 dark:text-sage-500"
              aria-hidden="true"
            />
            <span>Target query:</span>
            <span className="font-semibold text-sage-950 dark:text-sage-100">
              &ldquo;{query}&rdquo;
            </span>
            <span className="rounded-full bg-sage-100 px-2 py-0.5 font-mono text-[11px] text-sage-700 dark:bg-sage-900/60 dark:text-sage-400">
              {querySource === "auto" ? "querySource:auto" : "querySource:user"}
            </span>
          </p>

          <div className="mt-3.5 grid gap-2" role="list" aria-label="Subscores">
            {subs.map((s) => (
              <div
                key={s.label}
                role="listitem"
                title={`${s.label} ${s.value} of 100`}
                className="flex items-center gap-2"
              >
                <span className="w-24 shrink-0 text-xs font-medium text-sage-600 dark:text-sage-400">
                  {s.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900">
                  <div
                    className="h-full rounded-full bg-sage-500 dark:bg-sage-300 transition-all duration-500"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-sage-900 dark:text-sage-100">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
