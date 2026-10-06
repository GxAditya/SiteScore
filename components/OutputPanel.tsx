"use client";

import { useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChartLineUp,
  Code,
  FileText,
  Gauge,
  Wrench,
} from "@phosphor-icons/react";
import type { ApiFailure, AuditReport, ReportTabId } from "@/lib/audit-types";
import ScoreGauge from "./ScoreGauge";
import ExecutiveSummary from "./ExecutiveSummary";
import CategoryCards from "./CategoryCards";
import ConnectionBanner from "./ConnectionBanner";
import FetchAlerts from "./FetchAlerts";
import FixesList from "./FixesList";
import VisibilityPanel from "./VisibilityPanel";
import ReadabilityPanel from "./ReadabilityPanel";
import RawEvidence from "./RawEvidence";
import ExportBar from "./ExportBar";
import LoadingStages from "./LoadingStages";
import ErrorPanel from "./ErrorPanel";

interface OutputPanelProps {
  report: AuditReport | null;
  failure: ApiFailure | null;
  loading: boolean;
  stage: number;
  activeTab: ReportTabId;
  onSelectTab: (tab: ReportTabId) => void;
  onRetry: () => void;
}

const TABS = [
  { id: "overview" as ReportTabId, label: "Overview", icon: Gauge },
  { id: "fixes" as ReportTabId, label: "Fixes", icon: Wrench },
  { id: "visibility" as ReportTabId, label: "Visibility", icon: ChartLineUp },
  { id: "readability" as ReportTabId, label: "Readability", icon: FileText },
  { id: "evidence" as ReportTabId, label: "Evidence", icon: Code },
];

export default function OutputPanel({
  report,
  failure,
  loading,
  stage,
  activeTab,
  onSelectTab,
  onRetry,
}: OutputPanelProps) {
  const reduceMotion = useReducedMotion();
  const tabsListRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent) {
    if (
      e.key !== "ArrowRight" &&
      e.key !== "ArrowLeft" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.id === activeTab);
    let nextIndex = idx;
    if (e.key === "ArrowRight") nextIndex = (idx + 1) % TABS.length;
    if (e.key === "ArrowLeft") nextIndex = (idx - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = TABS.length - 1;
    const next = TABS[nextIndex];
    onSelectTab(next.id);
    requestAnimationFrame(() => {
      const el = tabsListRef.current?.querySelector<HTMLElement>(
        `#tab-${next.id}`,
      );
      el?.focus();
    });
  }

  const p0Count = report ? report.fixes.filter((f) => f.priority === "P0").length : 0;
  const totalFixes = report ? report.fixes.length : 0;

  return (
    <section
      aria-label="Audit Output Panel"
      className="flex h-full w-full flex-col bg-white dark:bg-[#0E140F]"
    >
      {/* Workspace Tabs Header (Bolt / Lovable style) */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sage-200/80 bg-sage-50/50 px-4 dark:border-sage-800/80 dark:bg-[#151D16]/60">
        <div
          ref={tabsListRef}
          role="tablist"
          aria-label="Output Views"
          onKeyDown={handleKeyDown}
          className="no-scrollbar flex items-center gap-1 overflow-x-auto py-1"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelectTab(tab.id)}
                className={`relative inline-flex min-h-[36px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? "bg-white text-sage-950 shadow-2xs dark:bg-[#1E271F] dark:text-sage-100"
                    : "text-sage-600 hover:bg-white/60 hover:text-sage-900 dark:text-sage-400 dark:hover:bg-sage-900/40 dark:hover:text-sage-200"
                }`}
              >
                <tab.icon className="h-4 w-4" weight={isSelected ? "bold" : "regular"} />
                <span>{tab.label}</span>

                {tab.id === "fixes" && totalFixes > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      p0Count > 0
                        ? "bg-coral-500 text-white"
                        : "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                    }`}
                  >
                    {totalFixes}
                  </span>
                )}

                {isSelected && (
                  <motion.span
                    layoutId="active-tab-highlight"
                    className="absolute inset-0 rounded-xl border border-sage-300/80 dark:border-sage-700/80 pointer-events-none"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {/* Loading state */}
          {loading && (
            <div className="py-6">
              <LoadingStages stage={stage} />
            </div>
          )}

          {/* Error state */}
          {failure && !loading && (
            <div className="py-6">
              <ErrorPanel failure={failure} onRetry={onRetry} />
            </div>
          )}

          {/* Success state - active tab renderer */}
          {report && !loading && (
            <motion.div
              key={activeTab}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {activeTab === "overview" && (
                <>
                  <ScoreGauge
                    total={report.score.total}
                    readability={report.score.readability}
                    visibility={report.score.visibility}
                    technical={report.score.technical}
                    grade={report.score.grade}
                    fetchedAt={report.input.fetchedAt}
                    query={report.input.query}
                    querySource={report.input.querySource}
                    finalUrl={report.input.finalUrl || report.input.url}
                  />

                  <ExecutiveSummary
                    report={report}
                    onJumpToFixes={() => onSelectTab("fixes")}
                  />

                  <CategoryCards
                    readability={report.score.readability}
                    visibility={report.score.visibility}
                    technical={report.score.technical}
                    checks={report.checks}
                  />

                  <ConnectionBanner
                    summary={report.connection.summary}
                    correlation={report.connection.correlation}
                  />

                  <FetchAlerts report={report} />
                </>
              )}

              {activeTab === "fixes" && (
                <FixesList
                  fixes={report.fixes}
                  url={report.input.url}
                  finalUrl={report.input.finalUrl || report.input.url}
                  query={report.input.query}
                />
              )}

              {activeTab === "visibility" && (
                <VisibilityPanel report={report} />
              )}

              {activeTab === "readability" && (
                <ReadabilityPanel report={report} />
              )}

              {activeTab === "evidence" && (
                <>
                  {report.aiSummary && !report.aiSummary.generated && (
                    <div className="rounded-xl border border-sage-200 bg-sage-50/60 p-3.5 text-xs text-sage-700 dark:border-sage-800 dark:bg-sage-950/40 dark:text-sage-300">
                      Rule-based summary shown above. Configure a Gemini API Key under Settings to generate an LLM executive briefing.
                    </div>
                  )}
                  <RawEvidence report={report} />
                </>
              )}

              {/* Docked Export Bar */}
              <div className="pt-4 border-t border-sage-200/80 dark:border-sage-800/80">
                <ExportBar report={report} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
