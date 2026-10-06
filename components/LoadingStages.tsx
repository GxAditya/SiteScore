import { motion, useReducedMotion } from "motion/react";

const STAGES = [
  "Fetching live page with TinyFish (ttl=0)…",
  "Evaluating readability, structure & metadata…",
  "Probing search indexation & SERP rankings…",
] as const;

const PROGRESS = [0.35, 0.7, 0.95];

function CategoryBarSkeleton({ width }: { width: string }) {
  return (
    <div>
      <div className="skeleton h-2.5 w-24 rounded-full" />
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-800">
        <div className="skeleton h-full rounded-full" style={{ width }} />
      </div>
    </div>
  );
}

export default function LoadingStages({ stage }: { stage: number }) {
  const current = STAGES[Math.min(Math.max(stage, 0), STAGES.length - 1)];
  const progress = PROGRESS[Math.min(Math.max(stage, 0), PROGRESS.length - 1)];
  const reduce = useReducedMotion();

  return (
    <section
      aria-live="polite"
      aria-label="Audit progress"
      className="card w-full p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-sage-950 dark:text-sage-50">
          {current}
        </h2>
        <span className="shrink-0 text-xs font-semibold text-sage-500 dark:text-sage-400">
          Step {Math.min(stage + 1, 3)} of 3
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={Math.min(stage + 1, 3)}
        aria-label="Audit progress"
        className="mt-3.5 h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-800"
      >
        <motion.div
          className="h-full w-full origin-left rounded-full bg-sage-500 dark:bg-sage-300"
          initial={false}
          animate={{ scaleX: progress }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </div>

      {/* Report Skeleton Preview */}
      <div aria-hidden="true" className="mt-6 grid gap-5">
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <div className="skeleton h-3 w-2/3 rounded-full" />
            <div className="skeleton h-3 w-1/2 rounded-full" />
          </div>
        </div>
        <div className="grid gap-3">
          <CategoryBarSkeleton width="75%" />
          <CategoryBarSkeleton width="60%" />
          <CategoryBarSkeleton width="85%" />
        </div>
        <div className="grid gap-2 border-t border-sage-100 pt-4 dark:border-sage-800">
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-3 w-11/12 rounded-full" />
          <div className="skeleton h-3 w-4/5 rounded-full" />
        </div>
      </div>

      <ol className="mt-6 grid gap-2.5 border-t border-sage-100 pt-4 dark:border-sage-800">
        {STAGES.map((label, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "active" ? "step" : undefined}
              className="flex items-center gap-3 text-xs sm:text-sm"
            >
              <span
                aria-hidden="true"
                className={
                  state === "done"
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-sage-500 text-xs text-white"
                    : state === "active"
                      ? "h-5 w-5 rounded-full bg-sage-500 ring-4 ring-sage-500/20 dark:bg-sage-300 dark:ring-sage-300/20"
                      : "h-5 w-5 rounded-full border border-sage-300 dark:border-sage-700"
                }
              >
                {state === "done" ? "✓" : ""}
              </span>
              <span
                className={
                  state === "todo"
                    ? "text-sage-400 dark:text-sage-600"
                    : "font-medium text-sage-900 dark:text-sage-100"
                }
              >
                {label}
                {state === "done" ? (
                  <span className="sr-only"> (done)</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[11px] text-sage-500 dark:text-sage-400">
        Live audits only (ttl=0, no saved cache). Search & fetch probes run concurrently.
      </p>
    </section>
  );
}
