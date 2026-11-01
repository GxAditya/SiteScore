"use client";

import { motion } from "motion/react";
import { CheckCircle, Sparkle, WarningCircle } from "@phosphor-icons/react";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const BROWSER_POINTS = [
  "Renders your hero, images, and layout exactly as designed",
  "Rewards visual polish, speed, and backlinks",
  "Users scroll, skim, and click instead of parsing",
];

const AI_POINTS = [
  "Sees text, headings, and code. Never a pixel",
  "Cites structured data, alt text, and canonicals",
  "Times out on login walls, empty extraction, or slow pages",
];

function BrowserReaderVisual() {
  return (
    <div className="reader-window" aria-hidden="true">
      <div className="browser-bar">
        <span className="browser-dot" />
        <span className="browser-dot" />
        <span className="browser-dot" />
      </div>
      <div className="reader-page">
        <span className="skeleton-block h-14 w-full" />
        <span className="skeleton-bar mt-1 block h-2.5 w-2/3" />
        <span className="skeleton-bar mt-1.5 block h-2.5 w-1/2" />
        <div className="mt-2 flex gap-1.5">
          <span className="skeleton-bar h-5 w-14 rounded-full" />
          <span className="skeleton-bar h-5 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function AiReaderVisual() {
  return (
    <div className="reader-code" aria-hidden="true">
      <div className="log-bar">
        <span className="log-dot" />
        <span className="log-dot" />
        <span className="log-dot" />
        <span>extraction</span>
        <span className="led ml-auto" />
      </div>
      <div className="reader-code__body">
        <div className="reader-code-line">
          <span>title</span>
          <em>found</em>
        </div>
        <div className="reader-code-line">
          <span>h1 · 1 of 1</span>
          <em>clean</em>
        </div>
        <div className="reader-code-line">
          <span>img alt</span>
          <em className="warn">38%</em>
        </div>
        <div className="reader-code-line">
          <span>json-ld</span>
          <em className="fail">none</em>
        </div>
      </div>
    </div>
  );
}

export function VisibilitySection() {
  return (
    <section
      id="visibility"
      aria-labelledby="visibility-title"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 section-padding sm:px-6"
    >
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <span className="section-tag">
          <span className="led led--warm" />
          Why it matters
        </span>
        <h2 id="visibility-title" className="section-title mt-5">
          Browsers see pixels.
          <br />
          Assistants read code.
        </h2>
        <p className="section-sub mx-auto mt-4 max-w-xl">
          The model writing your next customer’s answer isn’t scrolling your
          hero carousel. It is reading your markup.
        </p>
      </motion.div>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <motion.article
          className="landing-card overflow-hidden p-2.5"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <div className="reader-stage">
            <StageLeft label="Browser" />
            <BrowserReaderVisual />
          </div>
          <div className="px-3 pb-3 pt-5">
            <h3 className="text-[1.0625rem] font-semibold tracking-tight sm:text-[1.1875rem]">
              What you already optimize for
            </h3>
            <ul className="mt-4 space-y-2.5">
              {BROWSER_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <CheckCircle
                    weight="fill"
                    className="mt-0.5 h-4 w-4 shrink-0 text-sage-500 dark:text-sage-300"
                  />
                  <span className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.article>

        <motion.article
          className="landing-card overflow-hidden p-2.5"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.08 }}
        >
          <div className="reader-stage stage-dark">
            <StageLeft label="AI reader" dark />
            <AiReaderVisual />
          </div>
          <div className="px-3 pb-3 pt-5">
            <h3 className="text-[1.0625rem] font-semibold tracking-tight sm:text-[1.1875rem]">
              What quietly decides if you get cited
            </h3>
            <ul className="mt-4 space-y-2.5">
              {AI_POINTS.map((p, i) => (
                <li key={p} className="flex items-start gap-2.5">
                  {i === 2 ? (
                    <WarningCircle
                      weight="fill"
                      className="mt-0.5 h-4 w-4 shrink-0 text-brick-500 dark:text-brick-300"
                    />
                  ) : (
                    <Sparkle
                      weight="fill"
                      className="mt-0.5 h-4 w-4 shrink-0 text-sage-500 dark:text-sage-300"
                    />
                  )}
                  <span className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.article>
      </div>
    </section>
  );
}

function StageLeft({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <div className="stage-meta" aria-hidden="true">
      <span className="stage-meta__left">
        <span className={dark ? "led led--warm" : "led"} />
        {label}
      </span>
    </div>
  );
}
