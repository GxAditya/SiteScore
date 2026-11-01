"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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

/** Tab labels are written for a first-time reader, not an SEO. */
const TABS = [
  { id: "overview" as ReportTabId, label: "Summary", icon: Gauge },
  { id: "fixes" as ReportTabId, label: "Fixes", icon: Wrench },
  { id: "visibility" as ReportTabId, label: "Search", icon: ChartLineUp },
  { id: "readability" as ReportTabId, label: "Reading", icon: FileText },
  { id: "evidence" as ReportTabId, label: "Proof", icon: Code },
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
  const reduce = useReducedMotion();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [technical, setTechnical] = useState(false);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
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
      tabsRef.current?.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
    });
  }

  const p0Count = report ? report.fixes.filter((f) => f.priority === "P0").length : 0;
  const totalFixes = report ? report.fixes.length : 0;

  return (
    <section
      aria-label="Audit report"
      className="flex h-full w-full flex-col bg-[var(--surface)]"
    >
      {/* Tab strip with the technical-detail switch */}
      <div className="flex h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] bg-[var(--landing-card)] px-2.5 sm:px-4">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Report sections"
          onKeyDown={handleKeyDown}
          className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-1"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelectTab(tab.id)}
                className="seg-tab"
              >
                <tab.icon
                  className="h-4 w-4"
                  weight={selected ? "bold" : "regular"}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {tab.id === "fixes" && totalFixes > 0 && (
                  <span
                    className={`seg-count ${p0Count > 0 ? "seg-count--alert" : ""}`}
                  >
                    {totalFixes}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label
          className="switch-row hidden md:inline-flex"
          title="Show the measured values and technical names behind every finding"
        >
          <span>Technical detail</span>
          <input
            type="checkbox"
            className="sr-only"
            checked={technical}
            onChange={(e) => setTechnical(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className={`switch ${technical ? "switch--on" : ""}`}
          >
            <span className="switch__knob" />
          </span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {loading && <LoadingStages stage={stage} />}

          {!loading && failure && <ErrorPanel failure={failure} onRetry={onRetry} />}

          {report && !loading && (
            <motion.div
              key={activeTab}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
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
                    technicalDetail={technical}
                  />

                  <ConnectionBanner
                    summary={report.connection.summary}
                    correlation={report.connection.correlation}
                  />

                  <FetchAlerts report={report} technicalDetail={technical} />
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
                <VisibilityPanel report={report} technicalDetail={technical} />
              )}

              {activeTab === "readability" && (
                <ReadabilityPanel report={report} technicalDetail={technical} />
              )}

              {activeTab === "evidence" && (
                <>
                  {!report.aiSummary.generated && (
                    <div className="inset px-3.5 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
                      The summary above is produced by the scoring rules, which
                      run the same way every time. Adding a Google Gemini key in
                      settings also produces a written briefing.
                    </div>
                  )}
                  <RawEvidence report={report} />
                </>
              )}

              <div className="pt-2">
                <ExportBar report={report} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
