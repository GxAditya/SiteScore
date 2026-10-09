"use client";

import { useState, useRef, useSyncExternalStore } from "react";
import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowUpRight,
  ChartBar,
  Check,
  CheckCircle,
  Globe,
  ListChecks,
  SealCheck,
  Sparkle,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { BrandMark, ThemeToggle, useToast } from "@/lib/ui";
import { type AuditFormValues } from "@/components/AuditForm";
import HeroChatInput from "@/components/HeroChatInput";
import BuilderWorkspace from "@/components/BuilderWorkspace";
import SettingsModal from "@/components/SettingsModal";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";

type Status = "idle" | "loading" | "error" | "success";

const INITIAL_VALUES: AuditFormValues = {
  url: "",
  query: "",
  tinyfishKey: "",
  llmKey: "",
  llmProvider: "none",
};

interface HistoryEntry {
  url: string;
  score: number;
  date: string;
}

const HISTORY_KEY = "sitescore-history";
const HISTORY_LIMIT = 5;
const DOCS_URL = "https://docs.tinyfish.ai";

const EMPTY_HISTORY: HistoryEntry[] = [];
let cachedHistoryRaw: string | null = null;
let cachedHistory: HistoryEntry[] = EMPTY_HISTORY;
const historySubscribers = new Set<() => void>();

function parseHistory(raw: string): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as HistoryEntry).url === "string" &&
          typeof (e as HistoryEntry).score === "number" &&
          typeof (e as HistoryEntry).date === "string",
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function readHistorySnapshot(): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedHistoryRaw) return cachedHistory;
  cachedHistoryRaw = raw;
  cachedHistory = raw ? parseHistory(raw) : EMPTY_HISTORY;
  return cachedHistory;
}

function subscribeHistory(onChange: () => void): () => void {
  historySubscribers.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    historySubscribers.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeHistory(next: HistoryEntry[]): void {
  let raw: string;
  try {
    raw = JSON.stringify(next);
    window.localStorage.setItem(HISTORY_KEY, raw);
  } catch {
    return;
  }
  cachedHistoryRaw = raw;
  cachedHistory = next;
  historySubscribers.forEach((notify) => notify());
}

type RowStatus = "pass" | "warn" | "fail";

/* Sample audit rows for the preview card.
   Adapted from the live analyzer's tailwindcss.com run. */
const SAMPLE_CHECKS: Array<{
  id: string;
  title: string;
  status: RowStatus;
  evidence: string;
}> = [
  {
    id: "s1",
    title: "Heading structure",
    status: "pass",
    evidence: "Single clean <h1> with a logical H2 hierarchy below.",
  },
  {
    id: "s2",
    title: "Image alt text",
    status: "warn",
    evidence: "38% of images have alt tags - aim for 90%+ so AI knows what's shown.",
  },
  {
    id: "s3",
    title: "Structured data",
    status: "fail",
    evidence: "No JSON-LD blocks found. Answer engines cite structured pages first.",
  },
];

const SAMPLE_FIXES: Array<{ priority: "P1" | "P2"; title: string }> = [
  { priority: "P1", title: "Label 25 unlabeled images" },
  { priority: "P1", title: "Add JSON-LD structured data" },
  { priority: "P2", title: "Trim <title> to ≤ 60 chars" },
];

const TRUST_SIGNALS = [
  { label: "Score", value: "0–100" },
  { label: "HTML checks", value: "14+" },
  { label: "Search probes", value: "8" },
  { label: "Live audit", value: "~90s" },
  { label: "Signup", value: "None" },
];

const HOW_STEPS = [
  {
    icon: Globe,
    title: "Paste any URL",
    copy: "Drop in your landing page, docs, or any public page. We'll add https:// if you forget.",
    n: "1",
  },
  {
    icon: ChartBar,
    title: "We run live probes",
    copy: "Real HTML fetch, real search probes, no screenshots or synthetic mocks.",
    n: "2",
  },
  {
    icon: Sparkle,
    title: "Fix what matters",
    copy: "A clear 0–100 score with fixes ranked by actual AI-visibility impact.",
    n: "3",
  },
];

const FEATURES = [
  {
    icon: SealCheck,
    title: "A score you can trust",
    copy: "A clear 0–100 rating with grade letter. Know exactly where you stand in seconds - no clutter, no busywork.",
  },
  {
    icon: ListChecks,
    title: "Evidence, not opinions",
    copy: "Every check links to the raw HTML behind it. No vague advice you can't verify for yourself.",
  },
  {
    icon: Sparkle,
    title: "Prioritized fixes first",
    copy: "P0, P1, P2 ranked by real impact on AI visibility. Ship the changes that actually move the needle.",
  },
];

const BROWSER_POINTS = [
  "Renders your hero, images, and layout exactly as designed",
  "Ranking rewards visual polish, speed, and backlinks",
  "Users scroll, skim, and click - not parse",
];

const AI_POINTS = [
  "Sees text, headings, and code only - never a pixel",
  "Citation rewards structured data, alt text, and canonicals",
  "Times out on login walls, empty extraction, or slow pages",
];

function statusIcon(status: RowStatus, className = "h-4 w-4") {
  if (status === "pass") return <CheckCircle weight="fill" className={`${className} text-sage-500`} />;
  if (status === "warn") return <WarningCircle weight="fill" className={`${className} text-ochre-500`} />;
  return <XCircle weight="fill" className={`${className} text-brick-500`} />;
}

function gradeFor(score: number) {
  if (score >= 90) return { letter: "A", tone: "text-sage-500" };
  if (score >= 75) return { letter: "B", tone: "text-sage-400" };
  if (score >= 60) return { letter: "C", tone: "text-ochre-500" };
  if (score >= 40) return { letter: "D", tone: "text-ochre-600" };
  return { letter: "F", tone: "text-brick-500" };
}

export default function Home() {
  const [values, setValues] = useState<AuditFormValues>(INITIAL_VALUES);
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTabId>("overview");
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const history = useSyncExternalStore(
    subscribeHistory,
    readHistorySnapshot,
    () => EMPTY_HISTORY,
  );

  const stageTimers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();

  function focusAfterRunsChange(fallbackId: string) {
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.getElementById(fallbackId)?.focus({ preventScroll: true });
      }
    });
  }

  function removeHistoryEntry(url: string) {
    writeHistory(history.filter((e) => e.url !== url));
    toast("Removed from recent runs");
    focusAfterRunsChange(history.length > 1 ? "runs-title" : "hero-url");
  }

  function clearHistory() {
    writeHistory([]);
    toast("Cleared recent runs");
    focusAfterRunsChange("hero-url");
  }

  function clearStageTimers() {
    for (const t of stageTimers.current) window.clearTimeout(t);
    stageTimers.current = [];
  }

  async function runAudit(urlOverride?: string, queryOverride?: string) {
    const target = (urlOverride ?? values.url).trim();
    if (!target || status === "loading") return;

    if (urlOverride !== undefined) {
      setValues((v) => ({ ...v, url: urlOverride }));
    }
    if (queryOverride !== undefined) {
      setValues((v) => ({ ...v, query: queryOverride }));
    }

    clearStageTimers();
    setFailure(null);
    setReport(null);
    setStatus("loading");
    setStage(0);
    setIsWorkspaceOpen(true);

    stageTimers.current = [
      window.setTimeout(() => setStage(1), 5000),
      window.setTimeout(() => setStage(2), 14000),
    ];

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 150_000);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          url: target,
          query: (queryOverride ?? values.query).trim() || undefined,
          tinyfishKey: values.tinyfishKey.trim() || undefined,
          llmKey: values.llmKey.trim() || undefined,
          llmProvider: values.llmProvider,
        }),
      });

      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }

      if (!res.ok) {
        setFailure({
          status: res.status,
          code: typeof data.error === "string" ? data.error : "request_failed",
          message:
            typeof data.message === "string"
              ? data.message
              : `Request failed with HTTP ${res.status}.`,
          retryable:
            typeof data.retryable === "boolean" ? data.retryable : undefined,
          docs: typeof data.docs === "string" ? data.docs : undefined,
        });
        setStatus("error");
      } else {
        const next = data as unknown as AuditReport;
        setReport(next);
        setStatus("success");
        setActiveTab("overview");

        const entryUrl = next.input.finalUrl || next.input.url || target;
        writeHistory(
          [
            {
              url: entryUrl,
              score: next.score.total,
              date: new Date().toISOString(),
            },
            ...history.filter((e) => e.url !== entryUrl),
          ].slice(0, HISTORY_LIMIT),
        );
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      setFailure({
        status: 0,
        code: aborted ? "request_timeout" : "request_failed",
        message: aborted
          ? "The audit timed out after 150 seconds. The page may be slow or throttled - retry once."
          : "Network request failed. Check your connection and retry.",
        retryable: true,
      });
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
      clearStageTimers();
    }
  }

  if (isWorkspaceOpen) {
    return (
      <>
        <BuilderWorkspace
          report={report}
          failure={failure}
          loading={status === "loading"}
          stage={stage}
          targetUrl={values.url}
          targetQuery={values.query}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onNewAudit={(url, q) => runAudit(url, q)}
          onRetry={() => runAudit()}
          onBackToHome={() => setIsWorkspaceOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        />
      </>
    );
  }

  const disableMotion = reduceMotion;
  const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const revealMotion = disableMotion
    ? {}
    : {
        initial: { opacity: 0 as const, y: 16 as const },
        whileInView: { opacity: 1 as const, y: 0 as const },
        viewport: { once: true as const, margin: "-80px" as const },
        transition: { duration: 0.55, ease: EASE_OUT },
      };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface)] text-[var(--text)]">
      {/* ============== NAV (floating pill, fixed overlay with top fade so no page whitespace shows behind it) ============== */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center bg-[linear-gradient(to_bottom,var(--surface)_0%,color-mix(in_srgb,var(--surface)_72%,transparent)_72%,transparent_100%)] px-4 pb-5 pt-3 sm:pt-4">
        <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-glass)] px-2 py-1.5 shadow-[0_8px_30px_-12px_rgba(15,20,15,0.2)] backdrop-blur-xl sm:px-2 sm:py-1.5">
          <a
            href="#top"
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <BrandMark size={20} />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--text)]">
              SiteScore
            </span>
          </a>

          <nav
            className="hidden items-center gap-0.5 md:flex"
            aria-label="Main Navigation"
          >
            <a
              href="#how"
              className="inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            >
              How it works
            </a>
            <a
              href="#features"
              className="inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            >
              What you get
            </a>
            <a
              href="#visibility"
              className="inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            >
              AI visibility
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-full px-4 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            >
              Docs
              <ArrowUpRight className="h-3.5 w-3.5" weight="bold" />
            </a>
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings and API keys"
              title="API keys (BYOK)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-all hover:bg-[var(--surface-sunken)] hover:text-[var(--text)]"
            >
              <svg width="15" height="15" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M128 84a44 44 0 1 0 44 44 44 44 0 0 0-44-44Zm0 72a28 28 0 1 1 28-28 28 28 0 0 1-28 28Z" fill="currentColor"/>
                <path d="M235.8 150a16 16 0 0 0-4.4-10.6l-.6-.6-14.9-12.7a4 4 0 0 1-1.3-4.3l2.7-19.3a16 16 0 0 0-4.6-12 16.5 16.5 0 0 0-7.7-3.9l-19-5.1a4 4 0 0 1-3.1-2.2l-8.5-17.2a16.1 16.1 0 0 0-22.7-5.7h-.1l-15.4 11.5a4 4 0 0 1-4.2.6l-18.6-7a16.1 16.1 0 0 0-15.1.9l-1.1.6-15.3 11.5a4 4 0 0 1-4.2.6l-18.7-7a16.1 16.1 0 0 0-16 1.8 16 16 0 0 0-5.8 11.6L30.5 84a4 4 0 0 1-3.1 2.2l-19 5.1a16.4 16.4 0 0 0-12.3 15.9 16 16 0 0 0 .4 3.3l2.7 19.3a4 4 0 0 1-1.3 4.3L2.3 142a16 16 0 0 0 0 25.1l15 12.8a4 4 0 0 1 1.3 4.2l-2.7 19.3a16.5 16.5 0 0 0 12.3 15.9l19 5.1a4 4 0 0 1 3.1 2.2l8.5 17.2a16.1 16.1 0 0 0 22.7 5.7h.1l15.4-11.5a4 4 0 0 1 4.2-.6l18.6 7a16.1 16.1 0 0 0 15.1-.9l1.1-.6 15.3-11.5a4 4 0 0 1 4.2-.6l18.7 7a16.1 16.1 0 0 0 16-1.8 16 16 0 0 0 5.8-11.6l.9-19.1a4 4 0 0 1 3.1-2.2l19-5.1a16.4 16.4 0 0 0 12.3-15.9 16 16 0 0 0-.3-3.3ZM199 198.3a4 4 0 0 1-1.2 2.8 4.1 4.1 0 0 1-2.8 1.2l-18.2-4.9a20 20 0 0 0-15.5 10.8l-8.1 16.3a4 4 0 0 1-2.3 2.3 4 4 0 0 1-2.7.1l-14.7-11a20 20 0 0 0-21.1.3l-17.9 6.7a4 4 0 0 1-4-0.3 4 4 0 0 1-1.4-1.5L90.7 207a20 20 0 0 0-15.5-10.8l-18.2 4.9a4 4 0 0 1-3.9-.5 4 4 0 0 1-1.3-2.8l-2.6-18.3a20 20 0 0 0-12.7-8l-17.6-4.8a4 4 0 0 1-2.8-2.1 4 4 0 0 1-.4-3.1l14-12a20 20 0 0 0 0-28.9l-14-12a4 4 0 0 1 .4-3.1 4 4 0 0 1 2.8-2.1l17.6-4.8a20 20 0 0 0 12.7-8l2.6-18.3a4 4 0 0 1 5.2-3.3l18.2 4.9a20 20 0 0 0 15.5-10.8L85.5 35a4 4 0 0 1 3.8-2.4 4 4 0 0 1 2.6.9l14.7 11a20 20 0 0 0 21.1-.3l17.9-6.7a4 4 0 0 1 4 0.3 4 4 0 0 1 1.4 1.6l8.1 16.3a20 20 0 0 0 15.5 10.8l18.2-4.9a4 4 0 0 1 3.9 0.5 4 4 0 0 1 1.3 2.8l2.6 18.3a20 20 0 0 0 12.7 8l17.6 4.8a4 4 0 0 1 2.8 2.1 4 4 0 0 1 .4 3.1l-14 12a20 20 0 0 0 0 28.9l14 12a4 4 0 0 1-.4 3.1 4 4 0 0 1-2.8 2.1l-17.6 4.8a20 20 0 0 0-12.7 8Z" fill="currentColor"/>
              </svg>
            </button>
            <ThemeToggle />
            <AnimatePresence>
              {report && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setIsWorkspaceOpen(true)}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary"
                  style={{ paddingTop: "0.4rem", paddingBottom: "0.4rem", paddingLeft: "0.9rem", paddingRight: "0.9rem", fontSize: "13px" }}
                >
                  <span>Open report</span>
                  <ArrowRight className="h-3 w-3" weight="bold" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 overflow-hidden">
        {/* ============== HERO ============== */}
        <section
          aria-labelledby="hero-title"
          className="relative"
        >
          {/* Background gradient + grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden="true" />

          <div className="relative mx-auto w-full max-w-4xl px-4 pb-24 pt-32 text-center sm:px-6 sm:pb-32 sm:pt-44">
            <motion.p
              className="eyebrow mb-5 inline-block"
              initial={disableMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Your page, as AI actually reads it.
            </motion.p>

            <motion.h1
              id="hero-title"
              className="mx-auto max-w-3xl font-sans text-[40px] font-semibold leading-[1.06] tracking-[var(--tracking-display-tight)] sm:text-[56px]"
              initial={disableMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            >
              Make your site
              <br className="sm:hidden" />
              <span className="sm:ml-2"> unmissable.</span>
              <br />
              <span className="text-gradient">For AI, too.</span>
            </motion.h1>

            <motion.p
              className="mx-auto mt-6 max-w-xl text-[17px] leading-[1.65] text-[var(--text-muted)] sm:text-[18px]"
              initial={disableMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
            >
              Paste any URL. In under two minutes, SiteScore shows you exactly
              what AI search engines and assistants see - and exactly what to
              fix first, ranked by impact.
            </motion.p>

            <motion.div
              id="audit"
              className="mx-auto mt-12 w-full max-w-2xl scroll-mt-28"
              initial={disableMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
            >
              <HeroChatInput
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                onSubmit={(urlOverride) => runAudit(urlOverride)}
                onOpenSettings={() => setSettingsOpen(true)}
                loading={status === "loading"}
              />
            </motion.div>

            {/* Trust signals strip */}
            <motion.div
              className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3"
              initial={disableMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {TRUST_SIGNALS.map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2"
                >
                  {i > 0 && (
                    <span
                      className="mr-4 h-1 w-1 rounded-full bg-[var(--surface-border)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-[13px] text-[var(--text-subtle)]">
                    {s.label}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text)]">
                    {s.value}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ============== RECENT RUNS (conditional) ============== */}
        <AnimatePresence>
          {history.length > 0 && (
            <motion.section
              aria-labelledby="runs-title"
              initial={disableMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-b border-[var(--surface-border)] bg-[var(--surface-raised)]/40 px-4 py-12 sm:px-6"
            >
              <div className="mx-auto w-full max-w-5xl">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2
                      id="runs-title"
                      tabIndex={-1}
                      className="text-[20px] font-semibold tracking-tight focus:outline-none"
                    >
                      Recent runs
                    </h2>
                    <p className="mt-1 text-[14px] text-[var(--text-muted)]">
                      Pick up where you left off.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    Clear all
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {history.map((h) => {
                    const grade = gradeFor(h.score);
                    return (
                      <motion.div
                        key={`${h.url}-${h.date}`}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card group flex items-center gap-4 p-4"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-tint)]">
                          <div className="text-center">
                            <div className={`font-sans text-[22px] font-bold leading-none ${grade.tone}`}>
                              {h.score}
                            </div>
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                              {grade.letter}
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium">
                            {h.url}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                            {new Date(h.date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => runAudit(h.url)}
                            title="Re-run audit"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-muted)] transition-all hover:bg-[var(--accent-tint)] hover:text-[var(--accent-strong)]"
                            aria-label={`Re-run audit for ${h.url}`}
                          >
                            <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHistoryEntry(h.url)}
                            title="Remove from recent runs"
                            aria-label={`Remove ${h.url} from recent runs`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--text-muted)] transition-all hover:border-[var(--surface-border)] hover:bg-[var(--surface-sunken)] hover:text-[var(--fail)]"
                          >
                            <X className="h-3.5 w-3.5" weight="bold" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ============== HOW IT WORKS ============== */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 section-padding sm:px-6"
        >
          <motion.div className="mx-auto max-w-2xl text-center" {...revealMotion}>
            <p className="eyebrow mb-3 inline-block">How it works</p>
            <h2
              id="how-title"
              className="text-[32px] font-semibold tracking-[var(--tracking-tight)] sm:text-[42px]"
            >
              Three steps. Zero complexity.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-muted)]">
              SiteScore runs a live audit against your page - no screenshots, no
              synthetic mocks, no complex workflows to learn.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.n}
                  className="glass-card relative p-6"
                  initial={disableMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.55,
                    ease: [0.16, 1, 0.3, 1],
                    delay: disableMotion ? 0 : i * 0.08,
                  }}
                >
                  <span className="absolute right-5 top-5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[12px] font-bold text-[var(--accent-strong)]">
                    {s.n}
                  </span>
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                    <Icon className="h-5 w-5" weight="duotone" />
                  </div>
                  <h3 className="text-[18px] font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-muted)]">
                    {s.copy}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ============== WHAT YOU GET ============== */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="relative"
        >
          <div
            className="absolute inset-x-0 inset-y-0 -z-0 opacity-60"
            style={{ background: "var(--gradient-cta)" }}
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 section-padding sm:px-6">
            <motion.div className="mx-auto max-w-2xl text-center" {...revealMotion}>
              <p className="eyebrow mb-3 inline-block">What you get</p>
              <h2
                id="features-title"
                className="text-[32px] font-semibold tracking-[var(--tracking-tight)] sm:text-[42px]"
              >
                A grade you can act on.
                <br className="sm:hidden" />
                <span className="sm:ml-2">A road map to improve it.</span>
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-muted)]">
                One report. A clear score, proof for every issue, and ranked
                fixes ordered by real AI-visibility impact. Know what to fix,
                why it matters, and where to start.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    className="glass-card p-6"
                    initial={disableMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{
                      duration: 0.55,
                      ease: [0.16, 1, 0.3, 1],
                      delay: disableMotion ? 0 : i * 0.08,
                    }}
                  >
                    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                      <Icon className="h-5 w-5" weight="duotone" />
                    </div>
                    <h3 className="text-[18px] font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-muted)]">
                      {f.copy}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Sample report preview */}
            <motion.div
              initial={disableMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-20 w-full max-w-3xl"
            >
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-tint)]">
                  <Check className="h-3.5 w-3.5 text-[var(--accent-strong)]" weight="bold" />
                </span>
                <p className="text-[13px] font-medium text-[var(--text-muted)]">
                  Sample report · tailwindcss.com
                </p>
              </div>

              <div className="rounded-[20px] border border-[var(--surface-border)] bg-[var(--surface-raised)] p-5 shadow-[0_24px_60px_-32px_rgba(15,20,15,0.25)] sm:p-7">
                {/* Header: URL + score */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-sunken)]">
                      <Globe className="h-4.5 w-4.5 text-[var(--text-subtle)]" weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold">
                        tailwindcss.com
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        Run just now · live HTML
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[36px] font-semibold leading-none tracking-tight">
                        78
                      </div>
                      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">
                        of 100
                      </div>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-tint)]">
                      <span className="text-[24px] font-bold text-sage-600 dark:text-sage-300">
                        B
                      </span>
                    </div>
                  </div>
                </div>

                {/* Checks */}
                <div className="py-5">
                  <p className="mb-3 text-[13px] font-semibold text-[var(--text-subtle)]">
                    Key checks
                  </p>
                  <ul className="space-y-2.5">
                    {SAMPLE_CHECKS.map((c, i) => (
                      <motion.li
                        key={c.id}
                        initial={disableMotion ? false : { opacity: 0, x: -6 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.35,
                          ease: [0.16, 1, 0.3, 1],
                          delay: disableMotion ? 0 : 0.08 + i * 0.08,
                        }}
                        className="flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-[var(--surface-border)] hover:bg-[var(--surface)]/50"
                      >
                        <span className="mt-0.5 shrink-0">{statusIcon(c.status, "h-4.5 w-4.5")}</span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">{c.title}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                            {c.evidence}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Fixes strip */}
                <div className="border-t border-[var(--surface-border)] pt-5">
                  <p className="mb-3 text-[13px] font-semibold text-[var(--text-subtle)]">
                    Top fixes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_FIXES.map((f) => (
                      <span
                        key={f.title}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px]"
                      >
                        <span
                          className={`inline-flex h-4 items-center rounded-full px-1.5 text-[9.5px] font-bold uppercase tracking-wider ${
                            f.priority === "P1"
                              ? "bg-brick-100 text-brick-700 dark:bg-brick-900/40 dark:text-brick-300"
                              : "bg-ochre-100 text-ochre-700 dark:bg-ochre-900/40 dark:text-ochre-300"
                          }`}
                        >
                          {f.priority}
                        </span>
                        <span className="font-medium text-[var(--text)]">{f.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <a
                  href="#audit"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("audit")?.querySelector("input")?.focus();
                    document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="btn-primary inline-flex"
                >
                  <span>Run your URL</span>
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============== WHY AI VISIBILITY ============== */}
        <section
          id="visibility"
          aria-labelledby="visibility-title"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 section-padding sm:px-6"
        >
          <motion.div className="mx-auto max-w-2xl text-center" {...revealMotion}>
            <p className="eyebrow mb-3 inline-block">Why it matters</p>
            <h2
              id="visibility-title"
              className="text-[32px] font-semibold tracking-[var(--tracking-tight)] sm:text-[42px]"
            >
              Browsers see pixels.
              <br className="sm:hidden" />
              <span className="sm:ml-2"> Assistants read code.</span>
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-muted)]">
              The thing building your next customer's answer isn't scrolling
              your hero carousel.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <motion.div
              className="glass-card p-6 sm:p-7"
              initial={disableMotion ? false : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-[var(--text)]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M4 5a2 2 0 0 1 2-2h7.586a1 1 0 0 1 .707.293l5.414 5.414A1 1 0 0 1 20 9.414V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" stroke="currentColor" strokeWidth="1.7"/>
                    <path d="M14 3v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.7"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight">
                    Browser reader
                  </h3>
                  <p className="text-[12.5px] text-[var(--text-muted)]">
                    What you optimize for today.
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {BROWSER_POINTS.map((p, i) => (
                  <li
                    key={`b-${i}`}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 shrink-0">
                      <CheckCircle className="h-4 w-4 text-sage-500" weight="fill" />
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
                      {p}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="glass-card p-6 sm:p-7"
              initial={disableMotion ? false : { opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                  <Sparkle className="h-5 w-5" weight="duotone" />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight">
                    AI reader
                  </h3>
                  <p className="text-[12.5px] text-[var(--text-muted)]">
                    What's new, and quietly deciding.
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {AI_POINTS.map((p, i) => (
                  <li
                    key={`a-${i}`}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 shrink-0">
                      {i === 2 ? (
                        <WarningCircle className="h-4 w-4 text-brick-500" weight="fill" />
                      ) : (
                        <Sparkle className="h-4 w-4 text-sage-500" weight="fill" />
                      )}
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
                      {p}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* ============== FINAL CTA ============== */}
        <section
          aria-labelledby="close-title"
          className="mx-auto w-full max-w-5xl px-4 pb-28 pt-8 sm:px-6 sm:pb-36"
        >
          <motion.div
            initial={disableMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[28px] border border-[var(--surface-border)] p-8 text-center sm:p-14"
            style={{ background: "var(--gradient-cta)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(141,175,134,0.22) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <p className="eyebrow mb-4 inline-block">Ready when you are</p>
              <h2
                id="close-title"
                className="mx-auto max-w-2xl text-[32px] font-semibold tracking-[var(--tracking-tight)] sm:text-[44px]"
              >
                See what AI sees.
                <br className="sm:hidden" />
                <span className="sm:ml-2"> In two minutes.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--text-muted)]">
                Free to run. No signup, no credit card, no watermarks.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#audit"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("audit")?.querySelector("input")?.focus();
                    document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="btn-primary"
                  style={{ paddingTop: "0.85rem", paddingBottom: "0.85rem", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
                >
                  <span className="text-[15px]">Start an audit</span>
                  <ArrowRight className="h-4.5 w-4.5" weight="bold" />
                </a>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ paddingTop: "0.85rem", paddingBottom: "0.85rem", paddingLeft: "1.3rem", paddingRight: "1.3rem" }}
                >
                  <span className="text-[15px]">Read the docs</span>
                  <ArrowUpRight className="h-4 w-4" weight="bold" />
                </a>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ============== FOOTER ============== */}
      <footer className="border-t border-[var(--surface-border)] py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark size={20} />
            <span className="text-[14px] font-semibold">SiteScore</span>
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">
            Built with TinyFish Search + Fetch.
          </p>
          <div className="flex items-center gap-5">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              Docs
            </a>
            <span className="text-[13px] text-[var(--text-subtle)]">
              © 2026
            </span>
          </div>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      />
    </div>
  );
}
