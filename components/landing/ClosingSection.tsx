"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Broadcast,
  ListChecks,
  SealCheck,
} from "@phosphor-icons/react";
import { MascotMark } from "./Mascot";
import { DOCS_URL } from "@/lib/links";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function ClosingSection({ onStartAudit }: { onStartAudit: () => void }) {
  return (
    <section
      aria-labelledby="close-title"
      className="mx-auto w-full max-w-6xl px-4 pb-16 pt-2 sm:px-6 sm:pb-20"
    >
      <motion.div
        className="closing-panel"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        <div className="relative z-[1] grid gap-6 p-7 sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2
              id="close-title"
              className="text-[2rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[2.75rem]"
            >
              See what AI sees.
              <br />
              <span className="text-[#A9CC9F]">In two minutes.</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[rgba(238,245,233,0.68)]">
              Run a live audit on any public page. You get the score, the
              evidence behind it, and the fixes in the order they matter.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onStartAudit} className="btn-on-dark">
                <span>Start an audit</span>
                <ArrowRight className="h-4 w-4" weight="bold" />
              </button>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost-dark"
              >
                <span>Read the docs</span>
                <ArrowUpRight className="h-4 w-4" weight="bold" />
              </a>
            </div>

            <p className="mt-5 text-[12.5px] text-[rgba(238,245,233,0.5)]">
              No signup. No card. Run history stays in this browser.
            </p>
          </div>

          <div className="cta-mascot">
            <span className="cta-mascot__halo" aria-hidden="true" />
            <span className="cta-mascot__ring" aria-hidden="true" />
            <MascotMark size={132} className="cta-mascot__mark" />
            <span className="cta-float cta-float--one" aria-hidden="true">
              <span className="cta-float__icon">
                <ListChecks weight="bold" className="h-3.5 w-3.5" />
              </span>
              20 checks
            </span>
            <span className="cta-float cta-float--two" aria-hidden="true">
              <span className="cta-float__icon">
                <Broadcast weight="fill" className="h-3.5 w-3.5" />
              </span>
              4 live probes
            </span>
            <span className="cta-float cta-float--three" aria-hidden="true">
              <span className="cta-float__icon">
                <SealCheck weight="fill" className="h-3.5 w-3.5" />
              </span>
              No signup
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
