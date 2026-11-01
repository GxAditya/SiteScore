"use client";

import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import type { AuditCheck, CheckStatus } from "@/lib/audit-types";
import { plainFor, STATUS_COPY } from "@/lib/plain-language";

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle> = {
  pass: CheckCircle,
  warn: WarningCircle,
  fail: XCircle,
};

const STATUS_TONE: Record<CheckStatus, string> = {
  pass: "text-sage-600 dark:text-sage-300",
  warn: "text-ochre-600 dark:text-ochre-300",
  fail: "text-brick-600 dark:text-brick-300",
};

const GROUPS: Array<{ status: CheckStatus; heading: string }> = [
  { status: "fail", heading: "Needs fixing" },
  { status: "warn", heading: "Almost there" },
  { status: "pass", heading: "Already good" },
];

interface CheckRowProps {
  check: AuditCheck;
  /** Reveals the engine's technical name and the raw measurement. */
  technical: boolean;
}

/**
 * One finding, ordered for a person who has never heard of SEO: what the thing
 * is, what we measured, why it costs them, then the raw proof on request.
 */
export function CheckRow({ check, technical }: CheckRowProps) {
  const plain = plainFor(check.id);
  const status = STATUS_COPY[check.status];
  const Icon = STATUS_ICON[check.status];

  return (
    <div className="check-row">
      <span className={`check-row__icon ${STATUS_TONE[check.status]}`}>
        <Icon weight="fill" className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="check-row__plain">{plain?.topic ?? check.label}</h4>
          <span className={`state-pill state-pill--${check.status}`}>
            {status.word}
          </span>
        </div>

        <p className="check-row__means">{check.detail}</p>

        {check.status !== "pass" && plain ? (
          <p className="mt-1.5 border-l-2 border-[var(--accent-tint)] pl-2 text-sm leading-relaxed text-[var(--text)]">
            {plain.why}
          </p>
        ) : null}

        {technical ? (
          <p className="check-row__tech">
            {plain ? `${check.label} · ` : ""}
            {check.evidence}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface CheckListProps {
  checks: AuditCheck[];
  technical: boolean;
  emptyText: string;
}

/** Findings grouped worst-first, so the eye lands on what is broken. */
export function CheckList({ checks, technical, emptyText }: CheckListProps) {
  if (checks.length === 0) {
    return <p className="panel-sub px-1 py-2">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const items = checks.filter((c) => c.status === group.status);
        if (items.length === 0) return null;
        return (
          <div key={group.status}>
            <div className="mb-1 flex items-center gap-2">
              <span className={`state-pill state-pill--${group.status}`}>
                {group.heading}
              </span>
              <span className="panel-eyebrow text-xs">
                {items.length} {items.length === 1 ? "check" : "checks"}
              </span>
            </div>
            <div className="inset divide-y divide-[var(--surface-border)] py-0.5">
              {items.map((c) => (
                <CheckRow key={c.id} check={c} technical={technical} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
