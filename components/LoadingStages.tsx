"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "@phosphor-icons/react";
import { DotMatrix } from "./report/DotMatrix";
import { MascotScan } from "./report/MascotScan";

const STAGES = [
  {
    label: "Reading your page as it is right now",
    note: "No saved copy. We fetch it the same way an AI assistant would.",
  },
  {
    label: "Checking whether a machine can follow it",
    note: "Headings, labels, and the facts a program needs to understand the page.",
  },
  {
    label: "Looking for you in live search results",
    note: "Whether the page is in the index, and where it lands for your phrase.",
  },
] as const;

const PROGRESS = [0.35, 0.7, 0.95];

export default function LoadingStages({ stage }: { stage: number }) {
  const index = Math.min(Math.max(stage, 0), STAGES.length - 1);
  const current = STAGES[index];
  const reduce = useReducedMotion();

  return (
    <section aria-live="polite" aria-label="Audit progress" className="panel overflow-hidden">
      {/* The instrument at work: mascot visor sweeping, radar dot matrix turning. */}
      <div className="scan-stage">
        <div className="mascot-scan">
          <span className="mascot-scan__glow" aria-hidden="true" />
          <span className="mascot-scan__ring" aria-hidden="true" />
          <MascotScan
            size={112}
            variant="sweep"
            className="mascot-scan__mark"
            label="SiteScore mascot scanning the page"
          />
        </div>

        <div className="relative z-[1] max-w-md text-center">
          <h2 className="text-[15px] font-semibold leading-snug text-[var(--landing-console-text)] sm:text-[17px]">
            {current.label}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--landing-console-muted)]">
            {current.note}
          </p>
        </div>

        <div className="relative z-[1] flex flex-wrap items-center justify-center gap-3">
          <span className="scan-readout">
            <DotMatrix size={5} dot={3} gap={1.5} variant="radar" speed={2.9} min={0.05} />
            searching
          </span>
          <span className="scan-readout">
            step {index + 1} of {STAGES.length}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Progress rides a physical groove rather than a floating bar. */}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STAGES.length}
          aria-valuenow={index + 1}
          aria-label="Audit progress"
          className="meter"
        >
          <motion.div
            className="meter__fill"
            initial={false}
            animate={{ width: `${PROGRESS[index] * 100}%` }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
            }
          />
        </div>

        {/* Skeleton preview in the same dot-matrix family as the loader. */}
        <div aria-hidden="true" className="mt-5 grid gap-4">
          <div className="flex items-center gap-4">
            <span className="dmx-bar dmx-bar--ring h-16 w-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <span className="dmx-bar block h-3.5 w-2/3" />
              <span className="dmx-bar dmx-bar--round block h-2.5 w-1/2" />
            </div>
          </div>
          <div className="space-y-2.5">
            <span className="dmx-bar dmx-bar--round block h-2 w-11/12" />
            <span className="dmx-bar dmx-bar--round block h-2 w-4/5" />
            <span className="dmx-bar dmx-bar--round block h-2 w-3/5" />
          </div>
        </div>

        <ol className="mt-5 space-y-1 border-t border-[var(--surface-border)] pt-4">
          {STAGES.map((s, i) => {
            const state = i < index ? "done" : i === index ? "active" : "todo";
            return (
              <li
                key={s.label}
                aria-current={state === "active" ? "step" : undefined}
                className="flex items-center gap-3 py-1"
              >
                <span
                  aria-hidden="true"
                  className={
                    state === "done"
                      ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white"
                      : state === "active"
                        ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--landing-card-edge)] bg-[var(--landing-card)]"
                        : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-sunken)]"
                  }
                >
                  {state === "done" ? (
                    <Check weight="bold" className="h-3 w-3" />
                  ) : state === "active" ? (
                    <span className="led led--pulse" />
                  ) : null}
                </span>
                <span
                  className={
                    state === "todo"
                      ? "text-sm text-[var(--text-subtle)]"
                      : "text-sm font-medium text-[var(--text)]"
                  }
                >
                  {s.label}
                  {state === "done" ? <span className="sr-only"> (done)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-sm leading-relaxed text-[var(--text-subtle)]">
          Everything here is measured live: two reads of your page and two search
          checks, usually done in about 90 seconds.
        </p>
      </div>
    </section>
  );
}
