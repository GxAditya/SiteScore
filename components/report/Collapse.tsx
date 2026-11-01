"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/** Shared disclosure so every panel in the report expands with the same feel. */
export function Collapse({ open, children, className }: CollapseProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse-body"
          className={className}
          style={{ overflow: "hidden" }}
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
