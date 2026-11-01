"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowClockwise,
  ArrowUp,
  CheckCircle,
  CircleNotch,
  User,
  XCircle,
} from "@phosphor-icons/react";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";
import { buildChatDigest, CHAT_LIMITS } from "@/lib/chat";
import { buildFullRepairBrief } from "@/lib/agent-prompt";
import { copyText, useToast } from "@/lib/ui";
import { scoreInWords } from "@/lib/plain-language";
import { MascotMark } from "@/components/landing/Mascot";
import { DotMatrix } from "./report/DotMatrix";

interface ChatKeys {
  tinyfishKey: string;
  llmKey: string;
  llmProvider: string;
}

interface ChatPanelProps {
  report: AuditReport | null;
  failure: ApiFailure | null;
  loading: boolean;
  stage: number;
  targetUrl: string;
  targetQuery: string;
  keys: ChatKeys;
  onSelectTab: (tab: ReportTabId) => void;
  onNewAudit: (url: string, query?: string) => void;
  onRetry: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  /** The model is still composing this answer. */
  pending?: boolean;
  chips?: Array<{ label: string; action: () => void }>;
}

const EXECUTION_STAGES = [
  "Reading your page as it is right now",
  "Checking whether a machine can follow it",
  "Looking for you in live search results",
  "Writing your score and the fix list",
];

const ASK_PROMPTS = [
  "What is stopping me from being cited?",
  "Why am I not showing up in search?",
  "Can a machine read my page?",
];

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({
  report,
  failure,
  loading,
  stage,
  targetUrl,
  targetQuery,
  keys,
  onSelectTab,
  onNewAudit,
  onRetry,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>([]);
  const [awaiting, setAwaiting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const initialUserMessage: ChatMessage = useMemo(
    () => ({
      id: "msg-user-init",
      sender: "user",
      text: `Audit ${targetUrl}${targetQuery ? ` for the phrase "${targetQuery}"` : ""}`,
      time: "Just now",
    }),
    [targetUrl, targetQuery],
  );

  const assistantReportMessage: ChatMessage | null = useMemo(() => {
    if (!report) return null;

    const blockers = report.fixes.filter((f) => f.priority === "P0").length;
    const indexed = report.search.indexation.indexed;
    const rank = report.search.ranking.rank;

    const text =
      report.aiSummary?.text ||
      `Audit finished for ${report.input.finalUrl || targetUrl}. Score ${report.score.total} out of 100, which reads as ${scoreInWords(
        report.score.total,
      ).toLowerCase()}. ${
        blockers > 0
          ? `${blockers} ${blockers === 1 ? "item is" : "items are"} blocking answer engines from quoting you.`
          : "Nothing is blocking an answer engine from quoting you."
      } ${
        indexed
          ? rank != null
            ? `Search knows the page and ranks it #${rank} for your phrase.`
            : "Search knows the page, but it is not in the results we saw for your phrase."
          : "Search does not have this page in its catalogue yet, so nobody can find it."
      }`;

    return {
      id: "msg-assistant-report",
      sender: "assistant",
      text,
      time: "Just now",
      chips: [
        { label: "Show the blockers", action: () => onSelectTab("fixes") },
        { label: "How it reads", action: () => onSelectTab("readability") },
        { label: "Where you show up", action: () => onSelectTab("visibility") },
        {
          label: "Copy the fix list",
          action: async () => {
            const brief = buildFullRepairBrief(report.fixes, {
              url: targetUrl,
              finalUrl: report.input.finalUrl || targetUrl,
              query: report.input.query,
            });
            const ok = await copyText(brief);
            toast(
              ok
                ? "Copied. Paste it into your coding assistant"
                : "Copy failed - select the text manually",
            );
          },
        },
      ],
    };
  }, [report, targetUrl, onSelectTab, toast]);

  const allMessages: ChatMessage[] = useMemo(() => {
    const list: ChatMessage[] = [initialUserMessage];
    if (assistantReportMessage) list.push(assistantReportMessage);
    return [...list, ...extraMessages];
  }, [initialUserMessage, assistantReportMessage, extraMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [allMessages.length, stage, loading]);

  /**
   * Deterministic answers, read straight out of the report. Used when no model
   * is configured, and as the fallback whenever a model call fails, so a
   * question never comes back empty. Also jumps to the tab that shows the
   * evidence it just described.
   */
  function answerFromRules(lower: string): string {
    if (!report) {
      return "The audit is still running. Once the results land I can answer in detail.";
    }

    if (/(block|fix|p0|stop|today)/.test(lower)) {
      const blockers = report.fixes.filter((f) => f.priority === "P0");
      onSelectTab("fixes");
      if (blockers.length > 0) {
        return (
          `${blockers.length} ${blockers.length === 1 ? "item is" : "items are"} stopping an answer engine from quoting you:\n` +
          blockers.map((f, i) => `${i + 1}. **${f.title}**: ${f.why}`).join("\n") +
          "\n\nI opened the Fixes tab, which has the exact change for each one."
        );
      }
      return "Nothing is blocking you right now. The next tier of changes is in the Fixes tab, marked do this week.";
    }

    if (/(rank|search|show up|index|found|competitor)/.test(lower)) {
      const r = report.search.ranking;
      onSelectTab("visibility");
      return (
        `Search has ${report.search.indexation.indexed ? "this page in its catalogue" : "not got this page in its catalogue yet"}. ` +
        (r.rank != null
          ? `For "${report.input.query}" you sit at #${r.rank}.`
          : `For "${report.input.query}" you are not in the results we saw.`) +
        " The Search tab lists who holds those spots instead."
      );
    }

    if (/(read|machine|crawl|fetch|title|heading|ai)/.test(lower)) {
      onSelectTab("readability");
      return (
        `A reader pulled ${report.fetch.wordCount.toLocaleString()} words from the page in ${report.fetch.latencyMs.toLocaleString()} milliseconds. ` +
        `Main title on the page: ${report.fetch.html.h1 ? "there is one" : "none found"}. ` +
        `Browser tab name: ${report.fetch.html.title ? `"${report.fetch.html.title}"` : "missing"}. ` +
        "The Reading tab walks through what a machine can and cannot follow."
      );
    }

    if (/(score|grade|number)/.test(lower)) {
      onSelectTab("overview");
      return (
        `Overall ${report.score.total} out of 100 (${scoreInWords(report.score.total)}). ` +
        `Reading ${report.score.readability}, being found ${report.score.visibility}, plumbing ${report.score.technical}. ` +
        "The Summary tab explains what moved each one."
      );
    }

    return (
      `From the live read of ${report.input.finalUrl || targetUrl}, your score is ${report.score.total} out of 100. ` +
      'Open the Fixes tab for the exact changes, or ask "What is stopping me from being cited?".'
    );
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || awaiting) return;
    setInput("");

    const time = nowTime();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      time,
    };

    const lower = trimmed.toLowerCase();
    const urlMatch = trimmed.match(
      /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/i,
    );
    const askingHow = lower.startsWith("how") || lower.startsWith("what") || lower.startsWith("why");

    // A URL in the box means "read this page instead". That is a new audit, not
    // a question, and it goes through the audit path.
    if (urlMatch && !askingHow) {
      const newUrl = urlMatch[0];
      setExtraMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: `Starting a fresh read of ${newUrl}. It takes about 90 seconds.`,
          time,
        },
      ]);
      onNewAudit(newUrl);
      return;
    }

    const digest = report ? buildChatDigest(report) : null;
    const canAskModel =
      digest !== null && keys.llmProvider === "gemini" && keys.llmKey.trim().length >= 8;

    if (!canAskModel || !digest) {
      setExtraMessages((prev) => [
        ...prev,
        userMessage,
        { id: `assistant-${Date.now()}`, sender: "assistant", text: answerFromRules(lower), time },
      ]);
      return;
    }

    const history = allMessages.slice(-CHAT_LIMITS.historyTurns).map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      text: m.text.slice(0, CHAT_LIMITS.question),
    }));

    const pendingId = `assistant-${Date.now()}`;
    setExtraMessages((prev) => [
      ...prev,
      userMessage,
      { id: pendingId, sender: "assistant", text: "", time, pending: true },
    ]);
    setAwaiting(true);

    let answer = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          question: trimmed.slice(0, CHAT_LIMITS.question),
          history,
          digest,
          // Omitted when empty: the route treats an absent key as "use the
          // platform fallback if the deployment allows it".
          tinyfishKey: keys.tinyfishKey.trim() || undefined,
          llmKey: keys.llmKey.trim() || undefined,
          llmProvider: "gemini",
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { answer?: unknown; generated?: unknown }
        | null;
      if (
        res.ok &&
        data?.generated === true &&
        typeof data.answer === "string" &&
        data.answer.trim().length > 0
      ) {
        answer = data.answer.trim();
      }
    } catch {
      answer = "";
    }

    setAwaiting(false);
    setExtraMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId
          ? { ...m, pending: false, text: answer || answerFromRules(lower) }
          : m,
      ),
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <aside
      aria-label="Assistant"
      className="flex h-full w-full flex-col bg-[var(--surface)]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--surface-border)] px-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <MascotMark size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-snug tracking-tight">
              SiteScore assistant
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <span className={loading ? "led led--warm led--pulse" : "led"} aria-hidden="true" />
              {loading ? "Reading your page" : "Ready"}
            </p>
          </div>
        </div>

        {report && !loading && (
          <span className="state-pill shrink-0">
            {report.score.total}/100
            <span className="opacity-60">{scoreInWords(report.score.total)}</span>
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3.5 overflow-y-auto p-3.5"
      >
        {allMessages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "assistant" && (
              <span className="inset mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                <MascotMark size={18} />
              </span>
            )}

            <div className={`bubble ${m.sender === "user" ? "bubble--user" : ""}`}>
              {m.pending ? (
                <span className="flex items-center gap-2 text-[var(--text-muted)]">
                  <CircleNotch
                    className="h-3.5 w-3.5 shrink-0 animate-spin"
                    weight="bold"
                    aria-hidden="true"
                  />
                  Reading the report
                </span>
              ) : (
                <div className="whitespace-pre-wrap">
                  {m.text.split("**").map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i} className="font-semibold">
                        {part}
                      </strong>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </div>
              )}

              {m.chips && m.chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--surface-border)] pt-2.5">
                  {m.chips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={chip.action}
                      className="composer-chip"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <span className="mt-1.5 block text-right text-xs text-[var(--text)]">
                {m.time}
              </span>
            </div>

            {m.sender === "user" && (
              <span className="inset mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)]">
                <User className="h-3.5 w-3.5" weight="bold" />
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="panel p-3.5">
            <div className="flex items-center gap-2.5">
              <DotMatrix size={5} dot={3} gap={1.5} variant="radar" speed={2.9} min={0.05} className="text-[var(--accent)]" />
              <span className="panel-eyebrow text-xs">Working</span>
              <CircleNotch
                className="ml-auto h-3.5 w-3.5 animate-spin text-[var(--text-subtle)]"
                weight="bold"
                aria-hidden="true"
              />
            </div>

            <ol className="mt-3 space-y-1.5 border-l border-dashed border-[var(--surface-border)] pl-3">
              {EXECUTION_STAGES.map((label, idx) => {
                const done = idx < stage;
                const current = idx === stage;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 text-sm ${
                      done
                        ? "text-[var(--text-muted)]"
                        : current
                          ? "font-medium text-[var(--text)]"
                          : "text-[var(--text-subtle)]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle weight="fill" className="h-3.5 w-3.5 shrink-0 text-sage-500 dark:text-sage-300" />
                    ) : current ? (
                      <span className="led led--pulse" aria-hidden="true" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--surface-border)]" aria-hidden="true" />
                    )}
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {failure && (
          <div className="bubble bubble--alert">
            <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
              <XCircle
                className="h-4 w-4 shrink-0 text-[var(--fail-strong)]"
                weight="fill"
                aria-hidden="true"
              />
              <span>The audit stopped</span>
            </div>
            <p className="mt-1.5 text-[var(--text)]">{failure.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="composer-chip mt-2.5"
            >
              <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--surface-border)] p-3">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-2">
          <span className="panel-eyebrow shrink-0 text-xs">Ask</span>
          {ASK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className="composer-chip shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="hero-composer composer-mini">
          <label htmlFor="chat-input" className="sr-only">
            Ask about this page, or paste another URL
          </label>
          <input
            id="chat-input"
            type="text"
            placeholder="Ask, or paste another URL"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-subtle)]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || awaiting}
            aria-label="Send"
            className="composer-submit composer-submit--sm"
          >
            <ArrowUp className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </div>
    </aside>
  );
}
