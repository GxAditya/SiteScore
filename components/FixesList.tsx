"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CaretDown,
  Check,
  ClipboardText,
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
import { PRIORITY_COPY } from "@/lib/plain-language";
import { Collapse } from "./report/Collapse";
import { Term } from "./report/Term";

const PRIORITY_ORDER: FixPriority[] = ["P0", "P1", "P2"];

type Filter = "All" | FixPriority;
const FILTERS: Filter[] = ["All", "P0", "P1", "P2"];

const FILTER_LABEL: Record<Filter, string> = {
  All: "Everything",
  P0: "Today",
  P1: "This week",
  P2: "Later",
};

function CodeBlock({ kind, code }: { kind: "before" | "after"; code: string }) {
  const isAfter = kind === "after";
  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isAfter ? "bg-[var(--landing-led)]" : "bg-[var(--landing-led-warm)]",
          )}
          aria-hidden="true"
        />
        {isAfter ? "Change it to" : "There right now"}
        <span className="ml-auto">
          <CopyButton
            text={code}
            label={`Copy ${isAfter ? "replacement" : "current"} code`}
            tone="dark"
          />
        </span>
      </div>
      <pre className="code-block__body">{code}</pre>
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
  const priority = PRIORITY_COPY[fix.priority];

  async function copyPrompt() {
    const ok = await copyText(prompt);
    toast(
      ok
        ? "Copied. Paste it into your coding assistant"
        : "Copy failed - select the text manually",
    );
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.32,
              delay: Math.min(index * 0.04, 0.2),
              ease: [0.16, 1, 0.3, 1],
            }
      }
      className="panel"
    >
      <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:p-4">
        <span className={cn("pri-tag", fix.priority === "P0" && "pri-tag--today")}>
          <span className="pri-tag__code">{fix.priority}</span>
          {priority.label}
        </span>
        <h4 className="min-w-0 flex-1 basis-48 text-sm font-semibold leading-snug tracking-tight">
          {fix.title}
        </h4>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="composer-chip"
        >
          <CaretDown
            className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
          <span>{open ? "Less" : "More"}</span>
        </button>
      </div>

      <Collapse open={open}>
        <div className="space-y-2.5 border-t border-[var(--surface-border)] p-3.5 sm:p-4">
          <div className="inset px-3 py-2.5">
            <p className="panel-eyebrow text-xs">Why it matters</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
              {fix.why}
            </p>
          </div>

          <div className="inset px-3 py-2.5">
            <p className="panel-eyebrow text-xs">What to do</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
              {fix.how}
            </p>
          </div>

          {(fix.codeBefore || fix.codeAfter) && (
            <div className="grid gap-2.5">
              {fix.codeBefore ? (
                <CodeBlock kind="before" code={fix.codeBefore} />
              ) : null}
              {fix.codeAfter ? (
                <CodeBlock kind="after" code={fix.codeAfter} />
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button type="button" onClick={copyPrompt} className="btn-primary">
              {copied ? (
                <Check className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
              ) : (
                <Robot className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="text-sm">
                {copied ? "Copied" : "Hand this to a coding assistant"}
              </span>
            </button>
          </div>

          <details className="inset px-3 py-1.5">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-muted)]">
              See the exact text being copied
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border-t border-[var(--surface-border)] pt-2 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
              {prompt}
            </pre>
          </details>
        </div>
      </Collapse>
    </motion.article>
  );
}

interface FixesListProps {
  fixes: AuditFix[];
  url?: string;
  finalUrl?: string;
  query?: string;
}

export default function FixesList({
  fixes,
  url = "",
  finalUrl = "",
  query = "",
}: FixesListProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const { toast } = useToast();

  const ctx = useMemo<AgentPromptContext>(
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

  async function copyBrief() {
    const ok = await copyText(buildFullRepairBrief(fixes, ctx));
    toast(
      ok
        ? "Whole list copied. Paste it into your coding assistant"
        : "Copy failed - select the text manually",
    );
  }

  if (fixes.length === 0) {
    return (
      <section
        id="fixes"
        aria-label="Fixes"
        className="panel scroll-mt-24 p-5 text-center"
      >
        <span className="state-pill state-pill--pass mx-auto">Nothing blocking</span>
        <h2 className="panel-title mt-3">This page is already readable</h2>
        <p className="panel-sub mx-auto mt-1.5 max-w-md">
          Every check passed. A machine can read, index, and quote this page
          without help. Re-run after any big change to keep it that way.
        </p>
      </section>
    );
  }

  const visibleGroups = PRIORITY_ORDER.filter(
    (p) => (filter === "All" || filter === p) && counts[p] > 0,
  );
  let stagger = 0;

  return (
    <section
      id="fixes"
      aria-label="Fixes"
      className="w-full scroll-mt-24 space-y-4"
    >
      <Rise>
        <div className="panel p-4 sm:p-5">
          <h2 className="panel-title">Your work list</h2>
          <p className="panel-sub mt-1">
            {fixes.length} changes, ordered by what actually costs you readers.
            Each one carries the exact code and the reason.{" "}
            <Term k="citation">Being cited</Term> is the goal, not the score.
          </p>

          <div className="no-print mt-3.5 flex flex-wrap items-center gap-2">
            <span className="panel-eyebrow flex items-center gap-1.5 text-xs">
              <FunnelSimple className="h-3 w-3" weight="bold" aria-hidden="true" />
              Show
            </span>
            <div className="seg" role="group" aria-label="Filter fixes by urgency">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className="seg-tab"
                >
                  {FILTER_LABEL[f]}
                  <span
                    className={cn(
                      "seg-count",
                      f === "P0" && counts.P0 > 0 && "seg-count--alert",
                    )}
                  >
                    {counts[f]}
                  </span>
                </button>
              ))}
            </div>

            <button type="button" onClick={copyBrief} className="btn-primary ml-auto">
              <ClipboardText className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm">Copy the whole list</span>
            </button>
          </div>
        </div>
      </Rise>

      {visibleGroups.map((p) => {
        const items = fixes.filter((f) => f.priority === p);
        const priority = PRIORITY_COPY[p];
        return (
          <div key={`${filter}-${p}`} className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 px-0.5">
              <span className={cn("pri-tag", p === "P0" && "pri-tag--today")}>
                <span className="pri-tag__code">{p}</span>
                {priority.label}
              </span>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                {items.length} {items.length === 1 ? "change" : "changes"} ·{" "}
                {priority.note}
              </p>
            </div>

            <div className="grid gap-2.5">
              {items.map((fix) => {
                const idx = stagger++;
                return (
                  <FixCard
                    key={`${filter}-${p}-${fix.title}`}
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
    </section>
  );
}
