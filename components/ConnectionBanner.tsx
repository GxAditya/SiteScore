"use client";

import { LinkSimple } from "@phosphor-icons/react";
import { Term } from "./report/Term";

interface ConnectionBannerProps {
  summary: string;
  correlation: string;
}

/**
 * The engine's measured link between "a machine can read this" and "a machine
 * can find this", split into what was read and what happened because of it.
 */
export default function ConnectionBanner({
  summary,
  correlation,
}: ConnectionBannerProps) {
  return (
    <section aria-label="How reading connects to being found" className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="inset flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--accent-strong)]">
          <LinkSimple weight="bold" className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <h2 className="panel-title">Reading it and finding it are the same problem</h2>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
        A <Term k="ai-answer">search answer engine</Term> can only quote a page
        it can parse, so the two halves of this report pull on each other. Here
        is what this page measured.
      </p>

      <div className="mt-3 grid gap-2.5">
        <div className="inset px-3 py-2.5">
          <p className="panel-eyebrow">What the reader got</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
            {summary}
          </p>
        </div>
        <div className="inset px-3 py-2.5">
          <p className="panel-eyebrow">What that did to the result</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">
            {correlation}
          </p>
        </div>
      </div>
    </section>
  );
}
