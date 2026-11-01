"use client";

import type { FC } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Broadcast,
  Check,
  Cursor,
  DownloadSimple,
  Lock,
} from "@phosphor-icons/react";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ---------------------------------------------------------------- */
/* Visual 1: a page waiting in the address bar                      */
/* ---------------------------------------------------------------- */

function BrowserVisual() {
  return (
    <div className="browser-card" aria-hidden="true">
      <div className="browser-bar">
        <span className="browser-dot" />
        <span className="browser-dot" />
        <span className="browser-dot" />
        <span className="browser-url">
          <Lock weight="fill" className="h-2.5 w-2.5" />
          yourdomain.com/launch
        </span>
      </div>
      <div className="browser-page">
        <div className="flex items-center justify-between">
          <span className="skeleton-bar h-1.5 w-14" />
          <span className="skeleton-bar h-1.5 w-8" />
        </div>
        <span className="skeleton-bar mt-5 block h-4 w-3/4" />
        <span className="skeleton-bar mt-2 block h-4 w-1/2" />
        <span className="skeleton-bar mt-4 block h-1.5 w-full" />
        <span className="skeleton-bar mt-1.5 block h-1.5 w-5/6" />
        <div className="mt-4 flex gap-2">
          <span className="skeleton-bar h-6 w-20 rounded-full" />
          <span className="skeleton-bar h-6 w-14 rounded-full" />
        </div>
        <span className="skeleton-block mt-4 block h-16 w-full" />
        <span className="scan-beam" />
        <span className="scan-badge">
          <span className="led led--pulse" />
          Reading page
        </span>
        <span className="paste-cursor">
          <Cursor weight="fill" className="h-4 w-4 text-[var(--accent-strong)]" />
          <span className="paste-cursor__label">paste</span>
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 2: the probe log as it prints                             */
/* ---------------------------------------------------------------- */

function ProbeLogVisual() {
  return (
    <>
      <div className="log-card" aria-hidden="true">
        <div className="log-bar">
          <span className="log-dot" />
          <span className="log-dot" />
          <span className="log-dot" />
          <span>probe.log</span>
          <span className="led led--pulse ml-auto" />
        </div>
        <div className="log-lines">
          <div className="log-line">
            <span className="log-line__time">0.0s</span>
            <span className="log-line__cmd">fetch</span>
            <span>html · 200 ok</span>
            <span className="log-line__result">0.8s</span>
          </div>
          <div className="log-line">
            <span className="log-line__time">0.0s</span>
            <span className="log-line__cmd">fetch</span>
            <span>markdown · 200 ok</span>
            <span className="log-line__result">0.9s</span>
          </div>
          <div className="log-line">
            <span className="log-line__time">1.2s</span>
            <span className="log-line__cmd log-line__cmd--warm">search</span>
            <span>site:yourdomain.com</span>
            <span className="log-line__result log-line__result--warm">hit</span>
          </div>
          <div className="log-line">
            <span className="log-line__time">1.4s</span>
            <span className="log-line__cmd log-line__cmd--warm">search</span>
            <span>&quot;your target query&quot;</span>
            <span className="log-line__result log-line__result--warm">rank 4</span>
          </div>
        </div>
        <div className="log-foot">
          <span>ttl 0</span>
          <span>no cache</span>
          <span>4 calls</span>
        </div>
      </div>
      <span className="log-chip" aria-hidden="true">
        <Broadcast weight="fill" className="h-3 w-3" />
        Live run
      </span>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 3: the report, clipped and ready                          */
/* ---------------------------------------------------------------- */

function ReportVisual() {
  return (
    <>
      <div className="report-card" aria-hidden="true">
        <span className="report-clip" />
        <div className="report-eyebrow">
          <span>Audit report</span>
          <span>Sample</span>
        </div>
        <div className="report-score">
          <strong>78</strong>
          <span>/100</span>
          <span className="report-grade">B</span>
        </div>
        <div className="mt-1">
          <div className="report-fix">
            <span className="report-pri">P0</span>
            <span className="report-fix__name">Add JSON-LD</span>
            <ArrowRight weight="bold" className="h-3 w-3 opacity-45" />
          </div>
          <div className="report-fix">
            <span className="report-pri">P1</span>
            <span className="report-fix__name">Label 25 images</span>
            <ArrowRight weight="bold" className="h-3 w-3 opacity-45" />
          </div>
          <div className="report-fix">
            <span className="report-pri">P2</span>
            <span className="report-fix__name">Trim title tag</span>
            <ArrowRight weight="bold" className="h-3 w-3 opacity-45" />
          </div>
        </div>
        <div className="report-foot">tailwindcss.com · live</div>
      </div>
      <span className="report-chip" aria-hidden="true">
        <DownloadSimple weight="bold" className="h-3 w-3" />
        Markdown
      </span>
    </>
  );
}

/* ---------------------------------------------------------------- */

interface Step {
  n: string;
  title: string;
  copy: string;
  bullets: string[];
  Visual: FC;
}

const STEPS: Step[] = [
  {
    n: "1",
    title: "Paste any URL",
    copy: "Drop in a landing page, a docs site, or one blog post. We add https:// if you forget it, and you can pin the query you want to rank for.",
    bullets: [
      "Any public page",
      "Optional target query",
      "No signup, no install",
      "Runs in about 90 seconds",
    ],
    Visual: BrowserVisual,
  },
  {
    n: "2",
    title: "We run live probes",
    copy: "SiteScore fetches the page twice and fires two search probes while you watch. Real HTML, real extraction, real index checks.",
    bullets: [
      "HTML and Markdown fetch",
      "Indexation and ranking checks",
      "Latency on every call",
      "Nothing served from cache",
    ],
    Visual: ProbeLogVisual,
  },
  {
    n: "3",
    title: "Fix what matters",
    copy: "You get a 0-100 score, evidence for every finding, and fixes ordered by impact. Ship the top one, then re-run to watch it move.",
    bullets: [
      "P0, P1, P2 priorities",
      "Evidence behind each line",
      "Export as Markdown or JSON",
      "Re-run in one click",
    ],
    Visual: ReportVisual,
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 section-padding sm:px-6"
    >
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <h2 id="how-title" className="section-title">
          Three steps. Zero setup.
        </h2>
        <p className="section-sub mx-auto mt-4 max-w-xl">
          One URL starts a live run. No crawler to configure, no plugin to
          install, no dashboard to learn.
        </p>
      </motion.div>

      <div className="timeline mt-16">
        <span className="timeline-line" aria-hidden="true" />
        <ol className="list-none p-0 m-0">
          {STEPS.map((step, i) => {
            const Visual = step.Visual;
            return (
              <motion.li
                key={step.n}
                className={`timeline-row${i % 2 === 1 ? " timeline-row--flip" : ""}`}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-90px" }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              >
                <div className="timeline-node">
                  <span className="timeline-badge" aria-hidden="true">
                    {step.n}
                  </span>
                </div>

                <div className="timeline-copy">
                  <h3 className="timeline-heading">
                    <span className="sr-only">Step {step.n}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
                    {step.copy}
                  </p>
                  <ul className="timeline-list">
                    {step.bullets.map((b) => (
                      <li key={b} className="timeline-bullet">
                        <span className="timeline-bullet__dot">
                          <Check weight="bold" className="h-2.5 w-2.5" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="timeline-visual">
                  <div className="timeline-card">
                    <div className="feature-stage timeline-stage">
                      <Visual />
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
