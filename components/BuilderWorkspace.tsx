"use client";

import { useState } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ChatCircleText,
  Faders,
  Globe,
  Monitor,
  SidebarSimple,
} from "@phosphor-icons/react";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";
import { CopyButton, gradeBadgeClass, ThemeToggle } from "@/lib/ui";
import ChatPanel from "./ChatPanel";
import OutputPanel from "./OutputPanel";

interface BuilderWorkspaceProps {
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
  activeTab,
  onSelectTab,
  onNewAudit,
  onRetry,
  onBackToHome,
  onOpenSettings,
}: BuilderWorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"chat" | "output">("output");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-sage-950 dark:bg-[#0E140F] dark:text-sage-50">
      {/* Studio Top Navigation Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-sage-200/80 bg-white/90 px-4 backdrop-blur-md dark:border-sage-800/80 dark:bg-[#151D16]/90">
        {/* Left: Back button + Brand logo + Target URL */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to home landing page"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sage-200 bg-sage-50/80 px-2.5 py-1.5 text-xs font-semibold text-sage-800 transition-colors hover:border-sage-400 hover:bg-sage-100 hover:text-sage-950 dark:border-sage-800 dark:bg-[#1B241C] dark:text-sage-200 dark:hover:bg-sage-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            <span className="hidden sm:inline">New Audit</span>
          </button>

          <div className="h-4 w-px bg-sage-200 dark:bg-sage-800 hidden sm:block" />

          {/* Target URL chip */}
          <div className="flex max-w-[200px] items-center gap-1.5 rounded-full border border-sage-200 bg-white px-2.5 py-1 text-xs dark:border-sage-800 dark:bg-[#1B241C] sm:max-w-xs md:max-w-md">
            <Globe className="h-3.5 w-3.5 shrink-0 text-sage-500" />
            <span className="truncate font-mono text-[11px] font-medium text-sage-800 dark:text-sage-200">
              {targetUrl}
            </span>
            <CopyButton text={targetUrl} label="Copy target URL" className="min-h-[28px] py-0 text-[10px]" />
          </div>

          {targetQuery && (
            <span className="hidden rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-medium text-sage-700 dark:bg-sage-900/60 dark:text-sage-300 md:inline-block">
              &ldquo;{targetQuery}&rdquo;
            </span>
          )}
        </div>

        {/* Center: Mobile view switcher */}
        <div className="flex items-center rounded-xl border border-sage-200 bg-sage-50 p-0.5 dark:border-sage-800 dark:bg-[#1B241C] md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              mobileTab === "chat"
                ? "bg-white text-sage-950 shadow-2xs dark:bg-sage-800 dark:text-white"
                : "text-sage-600 dark:text-sage-400"
            }`}
          >
            <ChatCircleText className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("output")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              mobileTab === "output"
                ? "bg-white text-sage-950 shadow-2xs dark:bg-sage-800 dark:text-white"
                : "text-sage-600 dark:text-sage-400"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Report
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {report && (
            <span
              className={`hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${gradeBadgeClass(
                report.score.grade,
              )}`}
            >
              Grade {report.score.grade} ({report.score.total}/100)
            </span>
          )}

          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            aria-label="Re-run audit"
            title="Re-run live audit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sage-200/80 bg-white/60 text-sage-700 transition-colors hover:border-sage-400 hover:bg-sage-100 hover:text-sage-950 disabled:opacity-40 dark:border-sage-800 dark:bg-sage-950/60 dark:text-sage-300 dark:hover:border-sage-600 dark:hover:bg-sage-900"
          >
            <ArrowClockwise className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} weight="bold" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="API keys and settings"
            title="API Keys & Settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sage-200/80 bg-white/60 text-sage-700 transition-colors hover:border-sage-400 hover:bg-sage-100 hover:text-sage-950 dark:border-sage-800 dark:bg-sage-950/60 dark:text-sage-300 dark:hover:border-sage-600 dark:hover:bg-sage-900"
          >
            <Faders className="h-4 w-4" weight="bold" />
          </button>

          <ThemeToggle />

          {/* Toggle sidebar button (desktop) */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse Chat Panel" : "Expand Chat Panel"}
            title={sidebarOpen ? "Collapse Chat Panel" : "Expand Chat Panel"}
            className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sage-200/80 bg-white/60 text-sage-700 transition-colors hover:border-sage-400 hover:bg-sage-100 hover:text-sage-950 dark:border-sage-800 dark:bg-sage-950/60 dark:text-sage-300 dark:hover:border-sage-600 dark:hover:bg-sage-900"
          >
            <SidebarSimple className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Side: Chat Panel */}
        <div
          className={`h-full border-r border-sage-200 transition-all duration-300 dark:border-sage-800 md:block ${
            sidebarOpen ? "md:w-[380px] lg:w-[420px]" : "md:hidden"
          } ${mobileTab === "chat" ? "w-full block" : "hidden md:block"}`}
        >
          <ChatPanel
            report={report}
            failure={failure}
            loading={loading}
            stage={stage}
            targetUrl={targetUrl}
            targetQuery={targetQuery}
            activeTab={activeTab}
            onSelectTab={(tab) => {
              onSelectTab(tab);
              setMobileTab("output");
            }}
            onNewAudit={onNewAudit}
            onRetry={onRetry}
          />
        </div>

        {/* Right Side: Output Panel */}
        <div
          className={`flex-1 h-full overflow-hidden ${
            mobileTab === "output" ? "block" : "hidden md:block"
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
        </div>
      </div>
    </div>
  );
}
