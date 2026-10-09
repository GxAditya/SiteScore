"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CaretDown,
  Check,
  CheckCircle,
  FunnelSimple,
  Robot,
} from "@phosphor-icons/react";
import type { AuditFix, FixPriority } from "@/lib/audit-types";
import {
  buildFixPrompt,
  buildFullRepairBrief,
  type AgentPromptContext,
} from "@/lib/agent-prompt";
import { cn, CopyButton, copyText, Rise, useToast } from "@/lib/ui";

const PRIORITY_STYLE: Record<FixPriority, string> = {
  P0: "bg-coral-500 text-white dark:bg-coral-600 dark:text-white",
  P1: "bg-amber-500 text-white dark:bg-amber-400 dark:text-zinc-950",
  P2: "bg-sage-200 text-sage-900 dark:bg-sage-800 dark:text-sage-200",
};

const GROUP_NOTE: Record<FixPriority, string> = {
  P0: "Blocking - prevents AI agents & search from citing your page.",
  P1: "High impact - fix this week to increase visibility.",
  P2: "Opportunistic - compounds search understanding over time.",
};

type Filter = "All" | FixPriority;
const FILTERS: Filter[] = ["All", "P0", "P1", "P2"];

function CodeBlock({ kind, code }: { kind: "before" | "after"; code: string }) {
  const isAfter = kind === "after";
  return (
    <div className="overflow-hidden rounded-xl border border-sage-200 dark:border-sage-800">
      <div className="flex items-center justify-between gap-2 border-b border-sage-200 bg-sage-50/80 px-3 py-1.5 dark:border-sage-800 dark:bg-sage-900/40">
        <span className="text-xs font-semibold text-sage-700 dark:text-sage-300">
          {isAfter ? "After - Suggested Fix" : "Before - Current Markup"}
        </span>
        <CopyButton
          text={code}
          label={`Copy ${isAfter ? "fixed" : "current"} code`}
        />
      </div>
      <pre className="overflow-x-auto bg-sage-50/40 p-3 font-mono text-xs leading-relaxed text-sage-900 dark:bg-[#111712] dark:text-sage-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FixCard({
  fix,
  index,
  ctx,
}: {
  fix: AuditFix;
  index: number;
  ctx: AgentPromptContext;
}) {
  const [open, setOpen] = useState(fix.priority === "P0");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const prompt = useMemo(() => buildFixPrompt(fix, ctx), [fix, ctx]);

  async function copyPrompt() {
    const ok = await copyText(prompt);
    toast(
      ok
        ? "Agent prompt copied - paste into Claude, Cursor, or ChatGPT"
        : "Copy failed - select the text manually",
    );
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.35,
              delay: Math.min(index * 0.04, 0.25),
              ease: "easeOut",
            }
      }
      className="card"
    >
      <div className="flex flex-wrap items-center gap-2.5 p-4 sm:p-5">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-xs font-bold tabular-nums",
            PRIORITY_STYLE[fix.priority],
          )}
        >
          {fix.priority}
        </span>
        <h4 className="min-w-0 flex-1 basis-48 text-sm font-semibold text-sage-950 dark:text-sage-50">
          {fix.title}
        </h4>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-400 dark:hover:bg-sage-800 dark:hover:text-sage-100"
        >
          {open ? "Collapse" : "Expand"}
          <CaretDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
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
            <div className="grid gap-2.5 border-t border-sage-100 px-4 py-3.5 dark:border-sage-800 sm:px-5">
              <p className="text-sm text-sage-800 dark:text-sage-200">
                <span className="font-semibold text-sage-950 dark:text-sage-50">
                  Why it matters:{" "}
                </span>
                {fix.why}
              </p>
              <p className="text-sm text-sage-800 dark:text-sage-200">
                <span className="font-semibold text-sage-950 dark:text-sage-50">
                  How to fix:{" "}
                </span>
                {fix.how}
              </p>
              {(fix.codeBefore || fix.codeAfter) && (
                <div className="mt-2 grid gap-2.5">
                  {fix.codeBefore && (
                    <CodeBlock kind="before" code={fix.codeBefore} />
                  )}
                  {fix.codeAfter && (
                    <CodeBlock kind="after" code={fix.codeAfter} />
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyPrompt}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]",
                    "bg-sage-500 text-white hover:bg-sage-600",
                    "dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100",
                  )}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Robot className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy prompt for Cursor / Claude"}
                </button>
              </div>
              <details className="mt-1 rounded-xl border border-sage-200 dark:border-sage-800">
                <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:text-sage-900 dark:text-sage-400 dark:hover:text-sage-100">
                  Preview prompt text
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-sage-200 bg-sage-50/50 p-3 font-mono text-xs leading-relaxed text-sage-900 dark:border-sage-800 dark:bg-[#111712] dark:text-sage-200">
                  {prompt}
                </pre>
              </details>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function FixesList({
  fixes,
  url = "",
  finalUrl = "",
  query = "",
}: {
  fixes: AuditFix[];
  url?: string;
  finalUrl?: string;
  query?: string;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const { toast } = useToast();
  const ctx: AgentPromptContext = useMemo(
    () => ({ url, finalUrl: finalUrl || url, query }),
    [url, finalUrl, query],
  );

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      All: fixes.length,
      P0: fixes.filter((f) => f.priority === "P0").length,
      P1: fixes.filter((f) => f.priority === "P1").length,
      P2: fixes.filter((f) => f.priority === "P2").length,
    }),
    [fixes],
  );

  const groups: FixPriority[] = ["P0", "P1", "P2"];
  const visibleGroups = filter === "All" ? groups : [filter];
  let stagger = 0;

  return (
    <section
      id="fixes"
      aria-label="Prioritized fixes"
      className="w-full scroll-mt-24 space-y-4"
    >
      <Rise>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <p className="eyebrow text-sage-500 dark:text-sage-400">
              Action plan
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-sage-950 dark:text-sage-50">
              Prioritized Action Plan{" "}
              <span className="tabular-nums">({fixes.length})</span>
            </h2>
            <p className="body-secondary mt-1 text-sage-600 dark:text-sage-400">
              Specific, actionable fixes with before/after code. No generic tips.
            </p>
          </div>
        </div>
      </Rise>

      {fixes.length === 0 ? (
        <Rise delay={0.05}>
          <div className="card flex items-start gap-3 bg-sage-50/80 p-5 dark:bg-sage-950">
            <CheckCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-sage-500 dark:text-sage-300"
              weight="fill"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-sage-950 dark:text-sage-50">
                No fixes needed - your page is in peak condition!
              </h3>
              <p className="mt-1 text-xs text-sage-700 dark:text-sage-300">
                Every audit check passed. AI search crawlers can read, index, and cite your page smoothly.
              </p>
            </div>
          </div>
        </Rise>
      ) : (
        <>
          <Rise
            delay={0.05}
            className="no-print flex flex-wrap items-center gap-2"
          >
            <span
              className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-sage-600 dark:text-sage-400"
              aria-hidden="true"
            >
              <FunnelSimple className="h-3.5 w-3.5" />
              Filter:
            </span>
            <div
              role="group"
              aria-label="Filter fixes by priority"
              className="flex flex-wrap items-center gap-1.5"
            >
              {FILTERS.map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                      active
                        ? "bg-sage-500 text-white dark:bg-sage-200 dark:text-sage-950"
                        : "border border-sage-200 bg-white text-sage-800 hover:bg-sage-100 dark:border-sage-800 dark:bg-[#161D17] dark:text-sage-200 dark:hover:bg-sage-900",
                    )}
                  >
                    {f} ({counts[f]})
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(buildFullRepairBrief(fixes, ctx));
                toast(
                  ok
                    ? "Full repair brief copied - paste into your AI coding tool"
                    : "Copy failed - select text manually",
                );
              }}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold shadow-xs transition-colors",
                "bg-coral-500 text-white hover:bg-coral-600 active:scale-[0.98]",
              )}
            >
              <Robot className="h-3.5 w-3.5" aria-hidden="true" />
              Copy Full Repair Brief (P0 First)
            </button>
          </Rise>

          <div className="space-y-5">
            {visibleGroups.map((p) => {
              const items = fixes.filter((f) => f.priority === p);
              if (items.length === 0) return null;
              return (
                <div key={p} className="space-y-3">
                  <h3 className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-900 dark:text-sage-100">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-xs tabular-nums",
                        PRIORITY_STYLE[p],
                      )}
                    >
                      {p}
                    </span>
                    <span>
                      {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                      {GROUP_NOTE[p]}
                    </span>
                  </h3>
                  <div className="grid gap-3">
                    {items.map((fix, i) => {
                      const idx = stagger++;
                      return (
                        <FixCard
                          key={`${filter}-${p}-${i}`}
                          fix={fix}
                          index={idx}
                          ctx={ctx}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
