"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowClockwise,
  Brain,
  CircleNotch,
  PaperPlaneTilt,
  Robot,
  User,
  XCircle,
} from "@phosphor-icons/react";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";
import { buildFullRepairBrief } from "@/lib/agent-prompt";
import { copyText, gradeBadgeClass, useToast } from "@/lib/ui";

interface ChatPanelProps {
  report: AuditReport | null;
  failure: ApiFailure | null;
  loading: boolean;
  stage: number;
  targetUrl: string;
  targetQuery: string;
  activeTab: ReportTabId;
  onSelectTab: (tab: ReportTabId) => void;
  onNewAudit: (url: string, query?: string) => void;
  onRetry: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  chips?: Array<{ label: string; action: () => void }>;
}

const EXECUTION_STAGES = [
  "Connecting to TinyFish Fetch API (ttl=0, live extraction)…",
  "Analyzing DOM readability, heading hierarchy, metadata & schema…",
  "Probing TinyFish Search API for live indexation & rank…",
  "Synthesizing score, correlation model & prioritized fixes…",
];

export default function ChatPanel({
  report,
  failure,
  loading,
  stage,
  targetUrl,
  targetQuery,
  onSelectTab,
  onNewAudit,
  onRetry,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [extraMessages, setExtraMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initial user prompt message
  const initialUserMessage: ChatMessage = useMemo(
    () => ({
      id: "msg-user-init",
      sender: "user",
      text: `Audit ${targetUrl}${targetQuery ? ` for query: "${targetQuery}"` : ""}`,
      time: "Just now",
    }),
    [targetUrl, targetQuery],
  );

  // Assistant summary message derived directly from report
  const assistantReportMessage: ChatMessage | null = useMemo(() => {
    if (!report) return null;

    const p0Count = report.fixes.filter((f) => f.priority === "P0").length;
    const isIndexed = report.search.indexation.indexed;
    const rank = report.search.ranking.rank;

    const summaryText =
      report.aiSummary?.text ||
      `Live audit complete for ${report.input.finalUrl || targetUrl}. Overall score: ${report.score.total}/100 (Grade ${report.score.grade}). ${
        p0Count > 0
          ? `Found ${p0Count} blocking P0 issue${p0Count > 1 ? "s" : ""} preventing AI search engines from citing your content.`
          : "Found no blocking P0 issues — your page is highly citable by AI assistants."
      } ${isIndexed ? `Indexed in search (Rank: ${rank != null ? `#${rank}` : "Unranked"}).` : "Not currently indexed in search probe."}`;

    return {
      id: "msg-assistant-report",
      sender: "assistant",
      text: summaryText,
      time: "Just now",
      chips: [
        {
          label: "🔥 View P0 Fixes",
          action: () => onSelectTab("fixes"),
        },
        {
          label: "👁️ Readability Details",
          action: () => onSelectTab("readability"),
        },
        {
          label: "🔍 Search Visibility",
          action: () => onSelectTab("visibility"),
        },
        {
          label: "📋 Copy Repair Brief",
          action: async () => {
            const brief = buildFullRepairBrief(report.fixes, {
              url: targetUrl,
              finalUrl: report.input.finalUrl || targetUrl,
              query: report.input.query,
            });
            const ok = await copyText(brief);
            toast(ok ? "Copied repair prompt for AI coding agent" : "Copy failed");
          },
        },
      ],
    };
  }, [report, targetUrl, onSelectTab, toast]);

  // Combined messages list
  const allMessages: ChatMessage[] = useMemo(() => {
    const list: ChatMessage[] = [initialUserMessage];
    if (assistantReportMessage) {
      list.push(assistantReportMessage);
    }
    return [...list, ...extraMessages];
  }, [initialUserMessage, assistantReportMessage, extraMessages]);

  // Auto scroll to bottom on message change or stage update
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [allMessages.length, stage, loading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      time: now,
    };

    setExtraMessages((prev) => [...prev, userMsg]);

    // Check if user entered a URL to audit
    const urlMatch = trimmed.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/i);
    if (urlMatch && !trimmed.toLowerCase().startsWith("how") && !trimmed.toLowerCase().startsWith("what")) {
      const newUrl = urlMatch[0];
      const assistantAck: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: `Starting a fresh audit for ${newUrl}…`,
        time: now,
      };
      setExtraMessages((prev) => [...prev, assistantAck]);
      onNewAudit(newUrl);
      return;
    }

    // Contextual answers grounded in the report data
    setTimeout(() => {
      let reply = "";
      const lower = trimmed.toLowerCase();

      if (!report) {
        reply = "I'm currently running the live audit probe. As soon as results finish, I can answer in-depth questions!";
      } else if (lower.includes("p0") || lower.includes("fix") || lower.includes("blocking")) {
        const p0s = report.fixes.filter((f) => f.priority === "P0");
        if (p0s.length > 0) {
          reply = `You have ${p0s.length} blocking P0 fix${p0s.length > 1 ? "es" : ""}:\n` +
            p0s.map((f, i) => `${i + 1}. **${f.title}**: ${f.why}`).join("\n") +
            `\n\nI've opened the Fixes tab for exact code patches.`;
          onSelectTab("fixes");
        } else {
          reply = "You don't have any blocking P0 fixes! Focus on the P1 improvements shown in the Fixes tab.";
          onSelectTab("fixes");
        }
      } else if (lower.includes("rank") || lower.includes("visibility") || lower.includes("index")) {
        const r = report.search.ranking;
        reply = `Search indexation: ${report.search.indexation.indexed ? "Indexed" : "Not indexed"}. ` +
          `Ranking: ${r.rank != null ? `Rank #${r.rank}` : "Unranked"} for query "${report.input.query}". ` +
          `Switch to the Visibility tab to inspect competitor SERP results.`;
        onSelectTab("visibility");
      } else if (lower.includes("read") || lower.includes("crawl") || lower.includes("fetch")) {
        reply = `TinyFish extracted ${report.fetch.wordCount} words with ${report.fetch.latencyMs}ms latency. ` +
          `Heading H1: ${report.fetch.html.h1 ? "Present" : "Missing"}. Title: "${report.fetch.html.title || "None"}". ` +
          `Check the Readability tab to inspect the raw content extraction.`;
        onSelectTab("readability");
      } else if (lower.includes("score")) {
        reply = `Overall Score: ${report.score.total}/100 (Grade ${report.score.grade}). Readability: ${report.score.readability}/100, Visibility: ${report.score.visibility}/100, Technical: ${report.score.technical}/100.`;
        onSelectTab("overview");
      } else {
        reply = `Based on the live audit of ${report.input.finalUrl || targetUrl}, your overall AI-readiness score is ${report.score.total}/100. You can inspect the Fixes tab for actionable patches or ask specific questions like "What are my P0 issues?" or "Why am I unranked?".`;
      }

      setExtraMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 350);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <aside
      aria-label="AI Auditor Chat Panel"
      className="flex h-full w-full flex-col border-r border-sage-200 bg-sage-50/40 dark:border-sage-800 dark:bg-[#111712]"
    >
      {/* Chat header */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b border-sage-200/80 px-4 dark:border-sage-800/80">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage-500 text-white dark:bg-sage-300 dark:text-sage-950">
            <Robot className="h-4 w-4" weight="bold" />
          </span>
          <div>
            <h2 className="text-xs font-bold text-sage-950 dark:text-sage-100">
              SiteScore AI Agent
            </h2>
            <p className="flex items-center gap-1 text-[11px] text-sage-500 dark:text-sage-400">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  loading ? "animate-ping bg-coral-500" : "bg-sage-500"
                }`}
              />
              {loading ? "Analyzing page live…" : "Live Agent"}
            </p>
          </div>
        </div>

        {report && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${gradeBadgeClass(
              report.score.grade,
            )}`}
          >
            Grade {report.score.grade} · {report.score.total}
          </span>
        )}
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto p-4 text-xs leading-relaxed"
      >
        {allMessages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "assistant" && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200">
                <Brain className="h-3.5 w-3.5" weight="bold" />
              </span>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3 shadow-2xs ${
                m.sender === "user"
                  ? "bg-sage-500 text-white dark:bg-sage-300 dark:text-sage-950"
                  : "border border-sage-200 bg-white text-sage-900 dark:border-sage-800/80 dark:bg-[#161D17] dark:text-sage-100"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {m.chips && m.chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sage-100 pt-2 dark:border-sage-800">
                  {m.chips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={chip.action}
                      className="rounded-full border border-sage-200 bg-sage-50 px-2 py-0.5 text-[11px] font-medium text-sage-800 transition-colors hover:border-sage-400 hover:bg-sage-100 dark:border-sage-700 dark:bg-sage-900/60 dark:text-sage-200 dark:hover:bg-sage-800"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <span
                className={`mt-1 block text-right text-[10px] ${
                  m.sender === "user" ? "opacity-75" : "text-sage-400 dark:text-sage-500"
                }`}
              >
                {m.time}
              </span>
            </div>

            {m.sender === "user" && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-500 text-white dark:bg-sage-300 dark:text-sage-950">
                <User className="h-3.5 w-3.5" weight="bold" />
              </span>
            )}
          </div>
        ))}

        {/* Live execution progress stream inside chat (Bolt / Lovable style) */}
        {loading && (
          <div className="rounded-xl border border-sage-200 bg-white/80 p-3 shadow-2xs dark:border-sage-800 dark:bg-[#161D17]">
            <div className="flex items-center gap-2 font-semibold text-sage-900 dark:text-sage-100">
              <CircleNotch className="h-4 w-4 animate-spin text-sage-500" weight="bold" />
              <span>Agent Execution Pipeline</span>
            </div>

            <ol className="mt-2.5 space-y-1.5 border-l-2 border-sage-200 pl-3 dark:border-sage-800">
              {EXECUTION_STAGES.map((label, idx) => {
                const isDone = idx < stage;
                const isCurrent = idx === stage;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 text-[11px] ${
                      isDone
                        ? "text-sage-700 dark:text-sage-300"
                        : isCurrent
                          ? "font-semibold text-sage-950 dark:text-sage-50"
                          : "text-sage-400 dark:text-sage-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isDone
                          ? "bg-sage-500"
                          : isCurrent
                            ? "animate-pulse bg-coral-500"
                            : "bg-sage-200 dark:bg-sage-800"
                      }`}
                    />
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Failure card inside chat */}
        {failure && (
          <div className="rounded-xl border border-coral-300 bg-coral-50/80 p-3 dark:border-coral-900 dark:bg-coral-950/40">
            <div className="flex items-center gap-2 text-coral-800 dark:text-coral-200 font-semibold">
              <XCircle className="h-4 w-4" weight="fill" />
              <span>Audit Probe Failed</span>
            </div>
            <p className="mt-1 text-coral-700 dark:text-coral-300">
              {failure.message}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-coral-600 px-3 py-1 text-xs font-semibold text-white hover:bg-coral-700"
            >
              <ArrowClockwise className="h-3.5 w-3.5" weight="bold" />
              Retry audit
            </button>
          </div>
        )}
      </div>

      {/* Suggested quick prompt pills */}
      <div className="border-t border-sage-200/60 bg-white/40 px-3 py-2 dark:border-sage-800/60 dark:bg-[#161D17]/40">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <span className="shrink-0 text-sage-500">Ask:</span>
          {[
            "What are my P0 issues?",
            "Why am I unranked?",
            "How do I fix metadata?",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setInput(prompt);
              }}
              className="shrink-0 rounded-full border border-sage-200 bg-white px-2.5 py-0.5 text-sage-700 transition-colors hover:border-sage-400 hover:text-sage-950 dark:border-sage-800 dark:bg-[#182019] dark:text-sage-300 dark:hover:text-sage-100"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="relative mt-1">
          <input
            type="text"
            placeholder="Ask agent, refine query, or paste new URL…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-xl border border-sage-200 bg-white py-2 pl-3 pr-9 text-xs text-sage-900 placeholder:text-sage-400 outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500/30 dark:border-sage-700 dark:bg-[#182019] dark:text-sage-100 dark:placeholder:text-sage-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Send message"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sage-500 hover:bg-sage-100 hover:text-sage-900 disabled:opacity-40 dark:text-sage-400 dark:hover:bg-sage-800 dark:hover:text-sage-100"
          >
            <PaperPlaneTilt className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </div>
    </aside>
  );
}
