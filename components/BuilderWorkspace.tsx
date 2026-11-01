"use client";

import { useState } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ChatCircleText,
  GearSix,
  Globe,
  Monitor,
  SidebarSimple,
} from "@phosphor-icons/react";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";
import { CopyButton, ThemeToggle } from "@/lib/ui";
import { scoreInWords } from "@/lib/plain-language";
import { MascotMark } from "@/components/landing/Mascot";
import ChatPanel from "./ChatPanel";
import OutputPanel from "./OutputPanel";

interface BuilderWorkspaceProps {
  report: AuditReport | null;
  failure: ApiFailure | null;
  loading: boolean;
  stage: number;
  targetUrl: string;
  targetQuery: string;
  /** Keys the chat answerer needs. Held by page.tsx; never rendered. */
  keys: { tinyfishKey: string; llmKey: string; llmProvider: string };
  activeTab: ReportTabId;
  onSelectTab: (tab: ReportTabId) => void;
  onNewAudit: (url: string, query?: string) => void;
  onRetry: () => void;
  onBackToHome: () => void;
  onOpenSettings: () => void;
}

export default function BuilderWorkspace({
  report,
  failure,
  loading,
  stage,
  targetUrl,
  targetQuery,
  keys,
  activeTab,
  onSelectTab,
  onNewAudit,
  onRetry,
  onBackToHome,
  onOpenSettings,
}: BuilderWorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileView, setMobileView] = useState<"chat" | "report">("report");

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--surface)] text-[var(--text)]">
      {/* Instrument top bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-[var(--surface-border)] bg-[var(--landing-card)] px-2.5 py-2 sm:px-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to the SiteScore start page"
            className="key-btn key-btn--wide"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            <span className="hidden sm:inline">New audit</span>
          </button>

          <span className="hidden items-center gap-1.5 md:inline-flex">
            <MascotMark size={24} />
            <span className="text-[13px] font-semibold tracking-tight">
              SiteScore
            </span>
          </span>

          {/* What was audited */}
          <div className="inset flex min-w-0 max-w-[19rem] items-center gap-1.5 px-2 py-1">
            <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--text-subtle)]" weight="duotone" />
            <span className="truncate font-mono text-xs font-medium text-[var(--text)]">
              {targetUrl}
            </span>
            <CopyButton
              text={targetUrl}
              label="Copy audited URL"
              className="min-h-[22px] py-0 text-xs"
            />
          </div>

          {targetQuery && (
            <span className="hidden shrink-0 rounded-full border border-[var(--surface-border)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] lg:inline-block">
              &ldquo;{targetQuery}&rdquo;
            </span>
          )}
        </div>

        {/* Phone view switch: its own row so the address stays readable */}
        <div className="seg order-last w-full justify-center md:hidden" role="tablist" aria-label="Panel">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "chat"}
            onClick={() => setMobileView("chat")}
            className="seg-tab"
          >
            <ChatCircleText className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "report"}
            onClick={() => setMobileView("report")}
            className="seg-tab"
          >
            <Monitor className="h-3.5 w-3.5" />
            Report
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {report && !loading && (
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--landing-card-edge)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[var(--text)] shadow-[var(--flat-shadow-sm)] sm:inline-flex">
              <span className="led" aria-hidden="true" />
              {scoreInWords(report.score.total)}
              <span className="font-mono text-xs font-medium text-[var(--text-muted)]">
                {report.score.total}/100
              </span>
            </span>
          )}

          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            aria-label="Run the audit again"
            title="Run the audit again"
            className="key-btn"
          >
            <ArrowClockwise
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              weight="bold"
            />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="API keys and settings"
            title="API keys and settings"
            className="key-btn"
          >
            <GearSix className="h-4 w-4" weight="bold" />
          </button>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Hide the assistant panel" : "Show the assistant panel"}
            title={sidebarOpen ? "Hide the assistant panel" : "Show the assistant panel"}
            className="key-btn hidden md:inline-flex"
          >
            <SidebarSimple className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </header>

      {/* Two-panel bench: assistant on the left, report on the right */}
      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`chat-shell h-full w-full border-r border-[var(--surface-border)] md:block md:w-[360px] lg:w-[400px] ${
            sidebarOpen ? "md:w-[380px] lg:w-[420px]" : "md:hidden"
          } ${mobileView === "chat" ? "block" : "hidden md:block"}`}
        >
          <ChatPanel
            report={report}
            failure={failure}
            loading={loading}
            stage={stage}
            targetUrl={targetUrl}
            targetQuery={targetQuery}
            keys={keys}
            onSelectTab={(tab) => {
              onSelectTab(tab);
              setMobileView("report");
            }}
            onNewAudit={onNewAudit}
            onRetry={onRetry}
          />
        </aside>

        <main
          className={`h-full min-w-0 flex-1 ${
            mobileView === "report" ? "block" : "hidden md:block"
          }`}
        >
          <OutputPanel
            report={report}
            failure={failure}
            loading={loading}
            stage={stage}
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            onRetry={onRetry}
          />
        </main>
      </div>
    </div>
  );
}
