"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { Globe, MagnifyingGlass } from "@phosphor-icons/react";
import { gradeFor } from "@/lib/audit-types";
import { cn, CopyButton } from "@/lib/ui";
import { AXES, axisVerdict, scoreInWords } from "@/lib/plain-language";

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

const R = 66;
const CIRC = 2 * Math.PI * R;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  const [counted, setCounted] = useState(0);
  const shown = reduce ? pct : counted;
  const gaugeRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gaugeRef, { once: true, margin: "-40px" });
  const verdict = axisVerdict(pct);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, pct, {
      type: "spring",
      stiffness: 44,
      damping: 17,
      onUpdate: (v) => setCounted(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, pct, reduce]);

  const axes = [
    { key: "readability" as const, value: clamp(readability) },
    { key: "visibility" as const, value: clamp(visibility) },
    { key: "technical" as const, value: clamp(technical) },
  ];

  return (
    <section aria-label="Overall score" className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* The dial, with its verdict read out underneath rather than crowded
            into the face. */}
        <div
          ref={gaugeRef}
          className="mx-auto flex shrink-0 flex-col items-center gap-2.5 sm:mx-0"
        >
          <div className="gauge">
            <div className="gauge__face">
              <svg
                viewBox="0 0 168 168"
                className="gauge__svg"
                role="img"
                aria-label={`Score ${pct} out of 100, ${scoreInWords(pct)}`}
              >
                <circle
                  cx="84"
                  cy="84"
                  r={R}
                  fill="none"
                  stroke="var(--surface-sunken)"
                  strokeWidth="11"
                />
                <motion.circle
                  cx="84"
                  cy="84"
                  r={R}
                  fill="none"
                  stroke={
                    verdict.tone === "pass"
                      ? "var(--accent)"
                      : verdict.tone === "warn"
                        ? "var(--warn)"
                        : "var(--fail)"
                  }
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={reduce ? false : { strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
                  transition={
                    reduce ? { duration: 0 } : { type: "spring", stiffness: 42, damping: 17 }
                  }
                  transform="rotate(-90 84 84)"
                />
              </svg>
              <div className="gauge__center">
                <span className="gauge__value">{shown}</span>
                <span className="gauge__scale">out of 100</span>
              </div>
            </div>
          </div>

          <span
            className={cn(
              "state-pill",
              verdict.tone === "pass"
                ? "state-pill--pass"
                : verdict.tone === "warn"
                  ? "state-pill--warn"
                  : "state-pill--fail",
            )}
          >
            {scoreInWords(pct)} · {g}
          </span>
        </div>

        {/* What the number is, in words */}
        <div className="min-w-0 flex-1">
          <p className="panel-eyebrow">
            <span className="led led--pulse mr-1.5" aria-hidden="true" />
            Read live {timeAgo(fetchedAt)}
          </p>

          <div className="mt-1.5 flex items-start gap-1.5">
            <Globe
              className="mt-1 h-4 w-4 shrink-0 text-[var(--text-subtle)]"
              weight="duotone"
              aria-hidden="true"
            />
            <span
              className="min-w-0 flex-1 break-words text-sm font-medium leading-snug"
              title={finalUrl}
            >
              {finalUrl}
            </span>
            <CopyButton text={finalUrl} label="Copy page address" />
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[var(--text-muted)]">
            <MagnifyingGlass
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]"
              aria-hidden="true"
            />
            <span>Checked against the phrase</span>
            <span className="font-semibold text-[var(--text)]">
              &ldquo;{query}&rdquo;
            </span>
            <span className="state-pill">
              {querySource === "auto" ? "picked from the page" : "you typed"}
            </span>
          </p>

          {/* Three questions instead of three abstract scores */}
          <dl className="mt-4 space-y-2.5" aria-label="What makes up the score">
            {axes.map(({ key, value }) => {
              const axis = AXES[key];
              const v = axisVerdict(value);
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-sm font-medium text-[var(--text)]">
                      {axis.question}
                    </dt>
                    <dd className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                      {v.word.toLowerCase()} · {value}
                    </dd>
                  </div>
                  <div
                    className="meter mt-1"
                    role="meter"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={axis.question}
                  >
                    <div
                      className={cn(
                        "meter__fill",
                        v.tone === "warn" && "meter__fill--warn",
                        v.tone === "fail" && "meter__fill--fail",
                      )}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-subtle)]">
                    {axis.note} · {axis.weight}
                  </p>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}
