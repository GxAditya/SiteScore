"use client";

import { useState, useRef, useSyncExternalStore } from "react";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowUpRight,
  GearSix,
  X,
} from "@phosphor-icons/react";
import { ThemeToggle, useToast } from "@/lib/ui";
import { MascotMark } from "@/components/landing/Mascot";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { VisibilitySection } from "@/components/landing/VisibilitySection";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { type AuditFormValues } from "@/components/AuditForm";
import HeroComposer from "@/components/HeroComposer";
import BuilderWorkspace from "@/components/BuilderWorkspace";
import SettingsModal from "@/components/SettingsModal";
import { DOCS_URL } from "@/lib/links";
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

  function focusAudit() {
    const composer = document.getElementById("audit");
    const input = document.getElementById("hero-url");
    composer?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    input?.focus({ preventScroll: true });
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
      <MotionConfig reducedMotion="user">
        <BuilderWorkspace
          report={report}
          failure={failure}
          loading={status === "loading"}
          stage={stage}
          targetUrl={values.url}
          targetQuery={values.query}
          keys={{
            tinyfishKey: values.tinyfishKey,
            llmKey: values.llmKey,
            llmProvider: values.llmProvider,
          }}
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
      </MotionConfig>
    );
  }

  const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-[var(--surface)] text-[var(--text)]">
      {/* ============== NAV ============== */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center bg-[linear-gradient(to_bottom,var(--surface)_0%,color-mix(in_srgb,var(--surface)_70%,transparent)_70%,transparent_100%)] px-4 pb-5 pt-3 sm:pt-4">
        <div className="nav-shell pointer-events-auto px-2 py-1.5">
          <a
            href="#top"
            className="inline-flex h-10 items-center gap-2 rounded-full px-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <MascotMark size={28} />
            <span className="text-[14.5px] font-semibold tracking-tight">
              SiteScore
            </span>
          </a>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            <a href="#features" className="nav-link">
              Features
            </a>
            <a href="#how" className="nav-link">
              How it works
            </a>
            <a href="#visibility" className="nav-link">
              Why AI visibility
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="nav-link"
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
              className="nav-icon"
            >
              <GearSix className="h-4 w-4" weight="bold" aria-hidden="true" />
            </button>
            <ThemeToggle />
            {report ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setIsWorkspaceOpen(true)}
                whileTap={{ scale: 0.97 }}
                className="btn-primary"
                style={{
                  paddingTop: "0.45rem",
                  paddingBottom: "0.45rem",
                  paddingLeft: "0.9rem",
                  paddingRight: "0.9rem",
                  fontSize: "13px",
                }}
              >
                <span>Open report</span>
                <ArrowRight className="h-3 w-3" weight="bold" />
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={focusAudit}
                className="btn-primary"
                style={{
                  paddingTop: "0.45rem",
                  paddingBottom: "0.45rem",
                  paddingLeft: "0.9rem",
                  paddingRight: "0.9rem",
                  fontSize: "13px",
                }}
              >
                <span className="hidden sm:inline">Start an audit</span>
                <span className="sm:hidden">Audit</span>
                <ArrowRight className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 overflow-hidden">
        {/* ============== HERO: chat-first, lit from behind ============== */}
        <section aria-labelledby="hero-title" className="relative">
          <div className="hero-aura" aria-hidden="true" />
          <div className="hero-dotgrid" aria-hidden="true" />

          <div className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-32 text-center sm:px-6 sm:pb-24 sm:pt-40">
            <motion.h1
              id="hero-title"
              className="mx-auto max-w-4xl text-[2.5rem] font-semibold leading-[1.02] tracking-[var(--tracking-display-tight)] sm:text-[3.6rem] lg:text-[4.1rem]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE_OUT }}
            >
              Make your site{" "}
              <span className="relative inline-block whitespace-nowrap">
                unmissable
                <svg
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden="true"
                  className="hero-underline pointer-events-none absolute -bottom-[0.1em] left-0 h-[0.2em] w-full"
                >
                  <motion.path
                    d="M2 8.5C42 3.2 96 2.4 198 6.6"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.45 }}
                  />
                </svg>
              </span>
              .
              <br />
              For AI, too.
            </motion.h1>

            <motion.p
              className="mx-auto mt-6 max-w-xl text-[16.5px] leading-[1.65] text-[var(--text-muted)] sm:text-[18px]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.14 }}
            >
              Paste any URL. SiteScore reads the page the way AI search and
              assistants do, then hands you a score and the fixes that move it.
            </motion.p>

            <motion.div
              id="audit"
              className="mx-auto mt-11 w-full max-w-2xl scroll-mt-28"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.24 }}
            >
              <HeroComposer
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                onSubmit={(urlOverride) => runAudit(urlOverride)}
                onOpenSettings={() => setSettingsOpen(true)}
                loading={status === "loading"}
              />
            </motion.div>
          </div>
        </section>

        {/* ============== RECENT RUNS ============== */}
        <AnimatePresence>
          {history.length > 0 && (
            <motion.section
              aria-labelledby="runs-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-y border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--landing-card)_55%,transparent)] px-4 py-12 sm:px-6"
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
                        className="recent-card p-3.5"
                      >
                        <div className="score-tile">
                          <div className="text-center">
                            <div
                              className={`text-[20px] font-semibold leading-none tabular-nums ${grade.tone}`}
                            >
                              {h.score}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-subtle)]">
                              {grade.letter}
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium">
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
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => runAudit(h.url)}
                            title="Re-run audit"
                            aria-label={`Re-run audit for ${h.url}`}
                            className="nav-icon h-8 w-8 border border-[var(--surface-border)]"
                          >
                            <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHistoryEntry(h.url)}
                            title="Remove from recent runs"
                            aria-label={`Remove ${h.url} from recent runs`}
                            className="nav-icon h-8 w-8"
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

        <FeatureSection onStartAudit={focusAudit} />
        <HowItWorksSection />
        <VisibilitySection />
        <ClosingSection onStartAudit={focusAudit} />
      </main>

      <SiteFooter
        onStartAudit={focusAudit}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      />
      </div>
    </MotionConfig>
  );
}
