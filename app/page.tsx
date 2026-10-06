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
  ArrowUpRight,
  X,
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

/* Real rows printed by SiteScore's analyzer on the live HTML of
   tailwindcss.com, 6 Oct 2026 (HTML step; search probes excluded —
   they run live at audit time). Values verbatim. */
const RECEIPT_CHECKS: Array<{ id: string; status: RowStatus; evidence: string }> = [
  {
    id: "r-title",
    status: "warn",
    evidence:
      'Title is 76 chars ("Tailwind CSS - Rapidly build modern websites without ever leaving your HTML.") — outside 50–60.',
  },
  {
    id: "r-h1",
    status: "pass",
    evidence:
      'Exactly 1 <h1> ("Rapidly build modern websites without ever leaving your HTML.").',
  },
  {
    id: "r-canonical",
    status: "fail",
    evidence: "0 canonical link tags found (expected 1 absolute URL).",
  },
  {
    id: "r-img-alt",
    status: "fail",
    evidence: "15/40 <img> tags have non-empty alt (38% coverage; pass ≥90%).",
  },
  {
    id: "r-schema",
    status: "fail",
    evidence: '0 valid JSON-LD blocks out of 0 script[type="application/ld+json"] tags (expected ≥1).',
  },
  {
    id: "r-og-tags",
    status: "pass",
    evidence: "3/3 OG tags present (og:title, og:description, og:image).",
  },
  {
    id: "r-word-count",
    status: "pass",
    evidence: "49,109 words in the live HTML (pass ≥600, fail <300).",
  },
];

const RECEIPT_FIXES: Array<{ priority: "P1"; title: string; why: string }> = [
  {
    priority: "P1",
    title: "Rewrite <title> (76 chars → ≤60)",
    why: 'Measured title is 76 chars ("Tailwind CSS - Rapidly build modern websites without ever leaving"), outside the 50–60 display band, so search rewrites it and AI citations quote an unpredictable string.',
  },
  {
    priority: "P1",
    title: "Label 25 unlabeled images (38% alt coverage)",
    why: "Measured 15/40 <img> tags with non-empty alt (38% coverage; pass ≥90%): text-only AI fetchers skip the other 25 images entirely.",
  },
  {
    priority: "P1",
    title: "Add JSON-LD structured data (0 valid blocks today)",
    why: "Measured 0 valid JSON-LD blocks on a 49,109-word page: answer engines get prose only and cite structured competitors first.",
  },
];

const READERS_ROWS = [
  {
    aspect: "What it loads",
    browser: "The full styled page — layout, scripts, images.",
    ai: "Text extraction only, fetched live and never cached.",
  },
  {
    aspect: "What earns a citation",
    browser: "Backlinks and snippet match.",
    ai: "Clear headings, entities, schema — and being indexed at all.",
  },
  {
    aspect: "What sinks a page",
    browser: "Slow loads still rank.",
    ai: "Timeout, login wall, noindex, empty extraction. Omitted entirely.",
  },
];

function statusPill(status: RowStatus): string {
  if (status === "pass")
    return "bg-sage-100 text-sage-800 dark:bg-sage-900/70 dark:text-sage-200";
  if (status === "warn")
    return "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200";
  return "bg-coral-50 text-coral-800 dark:bg-coral-950/60 dark:text-coral-200";
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

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-sage-700/20 bg-[var(--surface)]/90 backdrop-blur-md dark:border-sage-300/15">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="font-display text-[17px] font-bold tracking-tight">
              SiteScore
            </span>
          </div>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main Navigation">
            <a
              href="#receipt"
              className="text-[13px] font-semibold text-sage-700 underline-offset-4 hover:text-sage-950 hover:underline dark:text-sage-300 dark:hover:text-sage-50"
            >
              Receipt
            </a>
            <a
              href="#readers"
              className="text-[13px] font-semibold text-sage-700 underline-offset-4 hover:text-sage-950 hover:underline dark:text-sage-300 dark:hover:text-sage-50"
            >
              Two readers
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-sage-700 underline-offset-4 hover:text-sage-950 hover:underline dark:text-sage-300 dark:hover:text-sage-50"
            >
              TinyFish docs
              <ArrowUpRight className="h-3 w-3" weight="bold" />
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings and API keys"
              title="API keys (BYOK)"
              className="inline-flex h-9 items-center rounded-full border border-sage-700/25 px-3.5 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100 dark:border-sage-300/20 dark:text-sage-300 dark:hover:bg-sage-900"
            >
              API keys
            </button>
            <ThemeToggle />
            {report && (
              <button
                type="button"
                onClick={() => setIsWorkspaceOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sage-600 px-4 py-2 text-xs font-bold text-white transition-transform hover:bg-sage-700 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
              >
                Open report
                <ArrowRight className="h-3 w-3" weight="bold" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section aria-labelledby="hero-title" className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6 sm:pt-24">
          <h1
            id="hero-title"
            className="font-display max-w-2xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl"
            style={{ letterSpacing: "-0.025em" }}
          >
            See your website the way AI search reads it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-sage-700 sm:text-lg dark:text-sage-300">
            SiteScore fetches what AI tools fetch and searches what they cite —
            then hands you a receipt with same-day fixes, every line measured.
          </p>

          <div id="audit" className="mt-9 scroll-mt-24">
            <HeroChatInput
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              onSubmit={(urlOverride) => runAudit(urlOverride)}
              onOpenSettings={() => setSettingsOpen(true)}
              loading={status === "loading"}
            />
          </div>

          <p className="mt-4 font-mono text-[11px] tracking-wide text-sage-600 dark:text-sage-400">
            Live probes · ttl 0 · no stored cache · keys never stored
          </p>
        </section>

        {history.length > 0 && (
          <section aria-labelledby="runs-title" className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="runs-title" tabIndex={-1} className="font-mono text-[11px] font-semibold tracking-[0.14em] text-sage-600 uppercase focus:outline-none dark:text-sage-400">
                Your recent runs
              </h2>
              <button
                type="button"
                onClick={clearHistory}
                className="font-mono text-[11px] font-semibold tracking-[0.12em] text-sage-600 uppercase underline-offset-4 hover:text-sage-950 hover:underline dark:text-sage-400 dark:hover:text-sage-50"
              >
                Clear
              </button>
            </div>
            <ol className="mt-3 divide-y divide-sage-700/15 rounded-2xl border border-sage-700/20 dark:divide-sage-300/10 dark:border-sage-300/15">
              {history.map((h) => (
                <li key={`${h.url}-${h.date}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="font-mono text-sm font-bold tabular-nums">{h.score}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{h.url}</p>
                      <p className="font-mono text-[10px] tracking-wide text-sage-500 uppercase">
                        {new Date(h.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => runAudit(h.url)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sage-700/25 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-sage-100 dark:border-sage-300/20 dark:hover:bg-sage-900"
                    >
                      <ArrowClockwise className="h-3 w-3" weight="bold" />
                      Re-run
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHistoryEntry(h.url)}
                      aria-label={`Remove ${h.url} from recent runs`}
                      title="Remove from recent runs"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sage-500 transition-colors hover:bg-sage-100 hover:text-sage-950 dark:text-sage-400 dark:hover:bg-sage-900 dark:hover:text-sage-50"
                    >
                      <X className="h-3.5 w-3.5" weight="bold" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section id="receipt" aria-labelledby="receipt-title" className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="receipt-title" className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            A run receipt, printed just now.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-sage-700 dark:text-sage-300">
            No sample data, no mockups. These rows were printed by SiteScore&apos;s
            analyzer on the live HTML of tailwindcss.com — the same code path a
            real audit runs.
          </p>

          <motion.ol
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 overflow-hidden rounded-2xl border border-sage-700/20 bg-white dark:border-sage-300/15 dark:bg-[#151D16]"
          >
            {RECEIPT_CHECKS.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 border-b border-sage-700/10 px-4 py-3.5 last:border-b-0 sm:px-5 dark:border-sage-300/10"
              >
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] uppercase ${statusPill(c.status)}`}>
                  {c.status}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold">{c.id}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-sage-700 dark:text-sage-300">
                    {c.evidence}
                  </p>
                </div>
              </li>
            ))}
          </motion.ol>

          <div className="mt-6 space-y-4">
            {RECEIPT_FIXES.map((f) => (
              <div key={f.title}>
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  {f.title}
                  <span className="rounded-full border border-sage-700/30 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-sage-800 uppercase dark:border-sage-300/25 dark:text-sage-200">
                    {f.priority}
                  </span>
                </p>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-sage-700 dark:text-sage-300">
                  {f.why}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 border-t border-sage-700/15 pt-4 font-mono text-[11px] leading-relaxed tracking-wide text-sage-600 dark:border-sage-300/10 dark:text-sage-400">
            Printed 6 Oct 2026 · tailwindcss.com · HTML step — the full audit adds
            AI Markdown extraction and search probes, then scores 0–100.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById("audit")?.querySelector("input")?.focus()}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-sage-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-sage-700 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
          >
            Print mine
            <ArrowRight className="h-4 w-4" weight="bold" />
          </button>
        </section>

        <section id="readers" aria-labelledby="readers-title" className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 pt-20 sm:px-6 sm:pt-28">
          <h2 id="readers-title" className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Two readers. Only one cites you.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-sage-700 dark:text-sage-300">
            Browsers paint. Assistants extract. The second reader decides whether
            your page appears in an answer at all.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-sage-700/20 bg-white dark:border-sage-300/15 dark:bg-[#151D16]">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">How browsers and AI readers treat the same page</caption>
              <thead>
                <tr className="border-b border-sage-700/15 font-mono text-[11px] tracking-[0.12em] uppercase dark:border-sage-300/10">
                  <th scope="col" className="px-5 py-3 font-semibold text-sage-600 dark:text-sage-400"> </th>
                  <th scope="col" className="px-5 py-3 font-semibold text-sage-600 dark:text-sage-400">Browser</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-sage-950 dark:text-sage-50">AI reader</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-700/10 dark:divide-sage-300/10">
                {READERS_ROWS.map((r) => (
                  <tr key={r.aspect}>
                    <th scope="row" className="px-5 py-4 align-top font-mono text-xs font-semibold tracking-wide whitespace-nowrap uppercase">
                      {r.aspect}
                    </th>
                    <td className="px-5 py-4 align-top text-sm text-sage-700 dark:text-sage-300">{r.browser}</td>
                    <td className="px-5 py-4 align-top text-sm font-medium">{r.ai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="close-title" className="mx-auto w-full max-w-3xl px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
          <h2 id="close-title" className="font-display max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Run your URL. Get the receipt.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-sage-700 sm:text-base dark:text-sage-300">
            One paste, live probes, a 0–100 score with P0 fixes first. Free within
            TinyFish limits — Search 30/min, Fetch 150 URLs/min.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#audit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-sage-600 px-7 py-2.5 text-sm font-bold text-white transition-all hover:bg-sage-700 active:scale-[0.98] dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100"
            >
              Start an audit
              <ArrowRight className="h-4 w-4" weight="bold" />
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-sage-700/25 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-sage-100 dark:border-sage-300/20 dark:hover:bg-sage-900"
            >
              TinyFish docs
              <ArrowUpRight className="h-3.5 w-3.5" weight="bold" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-sage-700/15 py-8 dark:border-sage-300/10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark size={22} />
            <span className="text-[13px] font-bold">SiteScore</span>
          </div>
          <p className="font-mono text-[11px] tracking-wide text-sage-600 dark:text-sage-400">
            TinyFish Search + Fetch · ttl 0 · keys never stored
          </p>
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
