"use client";

import { useId, useState, type ReactNode } from "react";
import { glossaryFor } from "@/lib/plain-language";

interface TermProps {
  /** Glossary key from lib/plain-language.ts */
  k: string;
  /** Optional override for the visible wording. */
  children?: ReactNode;
}

/**
 * A jargon word that opens a plain-English note: on hover or focus for a
 * mouse and keyboard, on tap for touch. The note only exists in the DOM while
 * it is open, so nothing has to fight a hidden state.
 */
export function Term({ k, children }: TermProps) {
  const entry = glossaryFor(k);
  const tipId = useId();
  const [open, setOpen] = useState(false);

  if (!entry) return <>{children ?? k}</>;

  return (
    <button
      type="button"
      className="term"
      aria-expanded={open}
      aria-describedby={open ? tipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {children ?? entry.label}
      {open ? (
        <span role="tooltip" id={tipId} className="term__tip">
          {entry.body}
        </span>
      ) : null}
    </button>
  );
}
