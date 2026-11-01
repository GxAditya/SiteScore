"use client";

import { useId, type FC } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle,
  Cursor,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ---------------------------------------------------------------- */
/* Visual 1: a physical readability dial                            */
/* ---------------------------------------------------------------- */

function DialVisual() {
  const ticks = Array.from({ length: 33 }, (_, i) => {
    const angle = -120 + (i * 240) / 32;
    const major = i % 8 === 0;
    return (
      <line
        key={i}
        x1="100"
        y1={major ? 13 : 17}
        x2="100"
        y2={major ? 27 : 23}
        stroke="currentColor"
        strokeWidth={major ? 2.4 : 1.2}
        strokeLinecap="round"
        opacity={major ? 0.85 : 0.5}
        transform={`rotate(${angle} 100 100)`}
      />
    );
  });

  return (
    <div className="dial-scene" aria-hidden="true">
      <div className="dial-rim">
        <div className="dial-face">
          <svg viewBox="0 0 200 200" className="dial-ticks">
            {ticks}
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="1 7"
              opacity="0.35"
            />
          </svg>
          <span className="dial-face-label">READABILITY</span>
          <motion.span
            className="dial-needle"
            initial={{ rotate: -120 }}
            whileInView={{ rotate: 67 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
          />
          <span className="dial-hub" />
        </div>
      </div>

      <div className="dial-tag">
        <span className="dial-tag__label">Live score</span>
        <div className="dial-tag__row">
          <strong>78</strong>
          <span>/100</span>
          <span className="dial-grade">B</span>
        </div>
      </div>
      <div className="dial-count">
        <span className="led" />
        20 checks · 4 probes
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 2: the evidence receipt under a lens                      */
/* ---------------------------------------------------------------- */

function EvidenceVisual() {
  return (
    <div className="receipt-scene" aria-hidden="true">
      <div className="receipt-stack">
        <span className="receipt-sheet receipt-sheet--1" />
        <span className="receipt-sheet receipt-sheet--2" />
        <div className="receipt">
          <div className="receipt-head">
            <div>
              <span className="receipt-eyebrow">Audit 014 · live html</span>
              <span className="receipt-domain">tailwindcss.com</span>
            </div>
            <span className="receipt-stamp">
              READ
              <br />
              LIVE
            </span>
          </div>
          <div className="receipt-rows">
            <div className="receipt-row">
              <CheckCircle
                weight="fill"
                className="receipt-row__icon h-3.5 w-3.5 text-sage-500 dark:text-sage-300"
              />
              <span>Heading structure</span>
              <span className="receipt-row__value">Pass</span>
            </div>
            <div className="receipt-row">
              <WarningCircle
                weight="fill"
                className="receipt-row__icon h-3.5 w-3.5 text-ochre-500 dark:text-ochre-300"
              />
              <span>Image alt text</span>
              <span className="receipt-row__value receipt-row__value--warn">
                38%
              </span>
            </div>
            <div className="receipt-row">
              <XCircle
                weight="fill"
                className="receipt-row__icon h-3.5 w-3.5 text-brick-500 dark:text-brick-300"
              />
              <span>Structured data</span>
              <span className="receipt-row__value receipt-row__value--fail">
                None
              </span>
            </div>
          </div>
          <div className="receipt-foot">
            <span>2 fetch</span>
            <span>2 search</span>
          </div>
        </div>
        <span className="magnifier">
          <span className="magnifier-lens" />
          <span className="magnifier-handle" />
        </span>
      </div>
      <code className="code-chip code-chip--1">&lt;h1&gt;</code>
      <code className="code-chip code-chip--2">alt=&quot;&quot;</code>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 3: priority keycaps on a slanted board                    */
/* ---------------------------------------------------------------- */

function FixesVisual() {
  return (
    <div className="key-scene" aria-hidden="true">
      <div className="key-stack">
        <div className="keycap keycap--1">
          <span className="keycap__pri">P0</span>
          <span className="keycap__label">Add JSON-LD</span>
        </div>
        <div className="keycap keycap--2">
          <span className="keycap__pri">P1</span>
          <span className="keycap__label">Label 25 images</span>
        </div>
        <div className="keycap keycap--3">
          <span className="keycap__pri">P2</span>
          <span className="keycap__label">Trim title tag</span>
        </div>
      </div>
      <span className="key-cursor">
        <Cursor weight="fill" className="h-5 w-5 text-[var(--accent-strong)]" />
        <span className="key-cursor__label">start here</span>
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 4: fetch and search probe switches                        */
/* ---------------------------------------------------------------- */

function ProbesVisual() {
  return (
    <div className="probe-panel" aria-hidden="true">
      <div className="probe-row">
        <span className="probe-name">FETCH</span>
        <span className="probe-detail">HTML + Markdown, ttl 0</span>
        <span className="probe-switch" />
        <span className="led" />
      </div>
      <div className="probe-row">
        <span className="probe-name">SEARCH</span>
        <span className="probe-detail">Index + ranking probes</span>
        <span className="probe-switch" />
        <span className="led" />
      </div>
      <div className="probe-readout">
        <span>4 calls per run</span>
        <strong>Live</strong>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Visual 5: a padlock with storage switched off                    */
/* ---------------------------------------------------------------- */

function PrivacyVisual() {
  const uid = useId().replace(/:/g, "");
  const grad = `padlock-${uid}`;

  return (
    <div className="lock-scene" aria-hidden="true">
      <div className="lock-wrap">
        <svg viewBox="0 0 120 132" className="padlock">
          <defs>
            <linearGradient id={grad} x1="24" y1="60" x2="96" y2="122" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#87A87D" />
              <stop offset="0.55" stopColor="#63805B" />
              <stop offset="1" stopColor="#425A3C" />
            </linearGradient>
          </defs>
          <path
            d="M38 64V45a22 22 0 0 1 44 0v19"
            stroke="#42583D"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M36 62V45a21 21 0 0 1 42 0"
            stroke="#A9C4A0"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <rect x="20" y="58" width="80" height="66" rx="17" fill={`url(#${grad})`} />
          <rect
            x="20.75"
            y="58.75"
            width="78.5"
            height="64.5"
            rx="16.25"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.22"
          />
          <path
            d="M30 70h60"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="60" cy="86" r="8" fill="#182214" />
          <path d="M60 92v13" stroke="#182214" strokeWidth="6" strokeLinecap="round" />
          <circle cx="57.5" cy="83.5" r="2" fill="#8FB086" opacity="0.55" />
        </svg>
        <span className="lock-tag">BYOK</span>
      </div>
      <div className="lock-row">
        <strong>Server storage</strong>
        <span className="switch">
          <span className="switch__knob" />
        </span>
        <span className="switch__state">Off</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface Feature {
  id: string;
  title: string;
  copy: string;
  span: string;
  stage: string;
  dark?: boolean;
  wideMd?: boolean;
  Visual: FC;
}

const FEATURES: Feature[] = [
  {
    id: "score",
    title: "A score you can trust",
    copy: "A 0-100 rating with a letter grade, plus the checks that moved it. You always know why the number is what it is.",
    span: "md:col-span-1 lg:col-span-3",
    stage: "feature-stage--tall",
    Visual: DialVisual,
  },
  {
    id: "evidence",
    title: "Evidence, not opinions",
    copy: "Every finding points back to the live HTML behind it. See the exact tag, value, and URL before you change anything.",
    span: "md:col-span-1 lg:col-span-3",
    stage: "feature-stage--tall",
    Visual: EvidenceVisual,
  },
  {
    id: "fixes",
    title: "Fix what matters first",
    copy: "P0, P1, and P2 fixes ordered by real AI-visibility impact. Work down the list and ship.",
    span: "md:col-span-1 lg:col-span-2",
    stage: "feature-stage--short",
    Visual: FixesVisual,
  },
  {
    id: "probes",
    title: "Live probes, not screenshots",
    copy: "Two fetches and two search probes per run, against the page as it stands right now. Nothing cached.",
    span: "md:col-span-1 lg:col-span-2",
    stage: "feature-stage--short",
    dark: true,
    Visual: ProbesVisual,
  },
  {
    id: "privacy",
    title: "Private by default",
    copy: "Bring your own TinyFish key if you want one. Keys stay in memory and run history stays in this browser.",
    span: "md:col-span-2 lg:col-span-2",
    stage: "feature-stage--short",
    wideMd: true,
    Visual: PrivacyVisual,
  },
];

export function FeatureSection({ onStartAudit }: { onStartAudit: () => void }) {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
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
          <span className="led" />
          Features
        </span>
        <h2
          id="features-title"
          className="section-title mt-5"
        >
          A grade you can act on.
        </h2>
        <p className="section-sub mx-auto mt-4 max-w-xl">
          One report. A clear score, proof behind every finding, and fixes
          ranked by what actually moves AI visibility.
        </p>
      </motion.div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {FEATURES.map((f, i) => {
          const Visual = f.Visual;
          return (
            <motion.article
              key={f.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{
                duration: 0.55,
                ease: EASE_OUT,
                delay: i * 0.06,
              }}
              className={`landing-card feature-card ${f.span}${f.wideMd ? " feature-card--wide-md" : ""}`}
            >
              <div
                className={`feature-stage ${f.stage}${f.dark ? " stage-dark" : ""}`}
              >
                <Visual />
              </div>
              <div className="feature-card__body">
                <h3 className="text-[1.0625rem] font-semibold tracking-tight sm:text-[1.1875rem]">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                  {f.copy}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={onStartAudit}
          className="btn-primary"
          style={{ fontSize: "13.5px" }}
        >
          <span>Run this on your own URL</span>
          <ArrowRight className="h-4 w-4" weight="bold" />
        </button>
      </div>
    </section>
  );
}
