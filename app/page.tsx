"use client";

import {
  useState,
  useRef,
  useSyncExternalStore,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowsLeftRight,
  CheckCircle,
  CloudArrowDown,
  Faders,
  Globe,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  Timer,
  Wrench,
} from "@phosphor-icons/react";
import { BrandMark, ThemeToggle } from "@/lib/ui";
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

const TRUST_BADGES = [
  { icon: MagnifyingGlass, label: "TinyFish Search · Live SERP" },
  { icon: Globe, label: "TinyFish Fetch · Clean Markdown" },
  { icon: Timer, label: "ttl=0 · No Stored Cache" },
  { icon: ShieldCheck, label: "Keys Never Persisted" },
];

const PIPELINE_STEPS = [
  {
    step: "01",
    icon: CloudArrowDown,
    title: "Live Fetch (ttl=0)",
    desc: "We extract raw HTML and AI-optimized Markdown exactly as modern search bots and LLM agents parse your page.",
  },
  {
    step: "02",
    icon: MagnifyingGlass,
    title: "Search Visibility Probe",
    desc: "We probe TinyFish Search to verify site: indexation and natural query ranking against top competing URLs.",
  },
  {
    step: "03",
    icon: Wrench,
    title: "Actionable AI Code Fixes",
    desc: "Get an overall 0–100 score with concrete P0 blocking fixes and copy-paste prompts for Cursor, Claude, or ChatGPT.",
  },
];

const COMPARISON_POINTS = [
  {
    title: "Traditional Search (Google)",
    points: [
      "Indexes static HTML and rendered JavaScript DOM",
      "Relies heavily on backlink authority & anchor text",
      "Displays 10 blue links with meta snippet",
      "Tolerates slower page loads and deep client navigation",
    ],
  },
  {
    title: "AI Search (Perplexity, SearchGPT, Gemini)",
    accent: true,
    points: [
      "Extracts direct answers, headings hierarchy & semantic entities",
      "Requires immediate text readability without script blocking",
      "Synthesizes answers and cites only readable, authoritative sources",
      "Discards pages that timeout, require login, or lack Schema.org metadata",
    ],
  },
];

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
          ? "The audit timed out after 150 seconds. The page may be slow or throttled — retry once."
          : "Network request failed. Check your connection and retry.",
        retryable: true,
      });
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
      clearStageTimers();
    }
  }

  // If in workspace mode (auditing or viewing results), show the 2-panel AI Studio interface!
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

  // Otherwise, render the modern AI Builder Landing Page (Lovable / Bolt / Google AI Studio style)
  return (
    <div className="flex min-h-dvh flex-col bg-[#F8FAF7] text-sage-950 dark:bg-[#0E140F] dark:text-sage-50">
      {/* Landing Header */}
      <header className="sticky top-0 z-40 border-b border-sage-200/80 bg-white/80 backdrop-blur-md dark:border-sage-800/80 dark:bg-[#0E140F]/85">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-sage-950 dark:text-sage-50">
                SiteScore
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-sage-500 dark:text-sage-400">
                AI Search Auditor
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Main Navigation">
            <a
              href="#how-it-works"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-300 dark:hover:bg-sage-900 dark:hover:text-sage-100"
            >
              How It Works
            </a>
            <a
              href="#ai-vs-traditional"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-300 dark:hover:bg-sage-900 dark:hover:text-sage-100"
            >
              AI vs Traditional SEO
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-300 dark:hover:bg-sage-900 dark:hover:text-sage-100"
            >
              TinyFish API Docs
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings and API keys"
              title="API Keys (BYOK)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sage-200/80 bg-white/70 text-sage-700 transition-colors hover:bg-sage-100 dark:border-sage-800 dark:bg-sage-950/70 dark:text-sage-300 dark:hover:bg-sage-900"
            >
              <Faders className="h-4 w-4" weight="bold" />
            </button>

            <ThemeToggle />

            {report && (
              <button
                type="button"
                onClick={() => setIsWorkspaceOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sage-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-transform hover:bg-sage-600 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
              >
                <span>View Current Audit</span>
                <ArrowRight className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Landing Page Content */}
      <main className="flex-1">
        {/* Hero Section with Lovable/Bolt style AI Prompt Box in the center */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
          {/* Subtle decorative background gradient matching palette */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-40 dark:opacity-20"
          >
            <div className="h-[480px] w-[640px] rounded-full bg-gradient-to-tr from-sage-200 to-sage-100 blur-3xl dark:from-sage-900 dark:to-sage-800" />
          </div>

          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-sage-300/80 bg-sage-100/70 px-3.5 py-1 text-xs font-bold text-sage-800 dark:border-sage-800 dark:bg-sage-900/60 dark:text-sage-200">
                <Sparkle className="h-3.5 w-3.5 text-coral-500" weight="fill" />
                Next-Gen SEO Audit for AI Search Engines
              </span>

              <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-sage-950 dark:text-sage-50 sm:text-5xl sm:leading-tight">
                See your website the way{" "}
                <span className="text-sage-500 dark:text-sage-300 underline decoration-sage-300 dark:decoration-sage-700 decoration-wavy">
                  AI Search
                </span>{" "}
                reads it.
              </h1>

              <p className="mt-3.5 max-w-xl text-sm text-sage-700 dark:text-sage-300 sm:text-base leading-relaxed">
                Perplexity, SearchGPT, and AI assistants extract content differently than legacy crawlers. We probe live fetch readability and search indexation to uncover why you get cited or missed.
              </p>
            </motion.div>

            {/* Central Chat / Prompt Interface (Lovable / Bolt / AI Studio style) */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-8 w-full flex flex-col items-center"
            >
              <HeroChatInput
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                onSubmit={(urlOverride) => runAudit(urlOverride)}
                onOpenSettings={() => setSettingsOpen(true)}
                loading={status === "loading"}
              />
            </motion.div>
          </div>
        </section>

        {/* Real-time Guarantees Strip */}
        <section className="border-y border-sage-200/80 bg-white/50 py-3 dark:border-sage-800/80 dark:bg-[#151D16]/50">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 sm:px-6">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 text-xs font-semibold text-sage-600 dark:text-sage-300"
              >
                <b.icon className="h-4 w-4 text-sage-500 dark:text-sage-300" weight="bold" />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Audits History (if present) */}
        {history.length > 0 && (
          <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-sage-700 dark:text-sage-300">
                Recent Audits
              </h2>
              <span className="text-[11px] text-sage-500">Stored in browser memory</span>
            </div>

            <div className="grid gap-2">
              {history.map((h) => (
                <div
                  key={`${h.url}-${h.date}`}
                  className="flex items-center justify-between rounded-xl border border-sage-200 bg-white p-3 shadow-2xs transition-all hover:border-sage-400 dark:border-sage-800 dark:bg-[#161D17]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-xs font-bold text-sage-800 dark:bg-sage-900/60 dark:text-sage-200">
                      {h.score}
                    </span>
                    <div className="truncate">
                      <p className="truncate text-xs font-medium text-sage-950 dark:text-sage-50">
                        {h.url}
                      </p>
                      <p className="text-[10px] text-sage-500">
                        {new Date(h.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => runAudit(h.url)}
                    className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1 text-xs font-semibold text-sage-800 hover:bg-sage-100 hover:text-sage-950 dark:border-sage-700 dark:text-sage-200 dark:hover:bg-sage-800"
                  >
                    <ArrowClockwise className="h-3 w-3" weight="bold" />
                    Re-audit
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3-Step Live Pipeline */}
        <section id="how-it-works" className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sage-500 dark:text-sage-400">
                Audit Pipeline
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-sage-950 dark:text-sage-50 sm:text-3xl">
                From Raw URL to Actionable Fixes
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-sage-600 dark:text-sage-400 max-w-lg mx-auto">
                No simulated synthetic metrics. Every score derives directly from live network requests and search results.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PIPELINE_STEPS.map((s) => (
                <div
                  key={s.step}
                  className="relative rounded-2xl border border-sage-200 bg-white p-6 shadow-card transition-all hover:border-sage-400 dark:border-sage-800/80 dark:bg-[#161D17]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 text-sage-700 dark:bg-sage-900 dark:text-sage-300">
                      <s.icon className="h-5 w-5" weight="duotone" />
                    </span>
                    <span className="font-mono text-xs font-bold text-sage-400">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-sage-950 dark:text-sage-50">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-sage-600 dark:text-sage-300">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Search vs Traditional Search Explanation */}
        <section id="ai-vs-traditional" className="border-t border-sage-200/80 bg-sage-50/50 py-16 dark:border-sage-800/80 dark:bg-[#121813]/60 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sage-500 dark:text-sage-400">
                The Shift in Search
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-sage-950 dark:text-sage-50 sm:text-3xl">
                Why Traditional SEO Fails in the AI Era
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-sage-600 dark:text-sage-400 max-w-xl mx-auto">
                AI engines synthesize answers directly. If your page cannot be parsed quickly and cleanly, you are omitted from citation citations entirely.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {COMPARISON_POINTS.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-2xl border p-6 shadow-card ${
                    card.accent
                      ? "border-sage-300 bg-white ring-2 ring-sage-500/20 dark:border-sage-700 dark:bg-[#161D17]"
                      : "border-sage-200 bg-white/70 dark:border-sage-800 dark:bg-[#161D17]/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {card.accent ? (
                      <Sparkle className="h-5 w-5 text-coral-500" weight="fill" />
                    ) : (
                      <ArrowsLeftRight className="h-5 w-5 text-sage-500" weight="bold" />
                    )}
                    <h3 className="text-base font-bold text-sage-950 dark:text-sage-50">
                      {card.title}
                    </h3>
                  </div>

                  <ul className="mt-5 space-y-3">
                    {card.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <CheckCircle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            card.accent
                              ? "text-coral-500"
                              : "text-sage-400 dark:text-sage-600"
                          }`}
                          weight="fill"
                        />
                        <span className="text-sage-800 dark:text-sage-200">
                          {pt}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Landing Footer */}
      <footer className="border-t border-sage-200/80 bg-white py-8 dark:border-sage-800/80 dark:bg-[#0E140F]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-xs font-semibold text-sage-900 dark:text-sage-100">
              SiteScore · AI SEO Page Auditor
            </span>
          </div>

          <p className="text-center text-[11px] text-sage-500 dark:text-sage-400">
            Powered by TinyFish Search & Fetch APIs. Free-tier limits: Search 30 req/min, Fetch 150 URLs/min.
          </p>

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-sage-700 underline hover:text-sage-950 dark:text-sage-300 dark:hover:text-sage-100"
          >
            Documentation →
          </a>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      />
    </div>
  );
}
