"use client";

import {
  ClipboardText,
  DownloadSimple,
  Printer,
} from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";
import { buildAuditMarkdown } from "@/lib/report-markdown";
import { cn, copyText, useToast } from "@/lib/ui";

const SECONDARY_BUTTON =
  "border border-sage-200 bg-white/70 text-sage-800 hover:bg-sage-100 dark:border-sage-800 dark:bg-transparent dark:text-sage-200 dark:hover:bg-sage-900";

export default function ExportBar({ report }: { report: AuditReport }) {
  const { toast } = useToast();

  async function handleCopyMarkdown() {
    const ok = await copyText(buildAuditMarkdown(report));
    toast(
      ok
        ? "Markdown copied to clipboard"
        : "Copy failed — your browser blocked clipboard access",
    );
  }

  function handleDownloadJson() {
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const host = (() => {
        try {
          return new URL(report.input.finalUrl || report.input.url).hostname;
        } catch {
          return "audit";
        }
      })();
      a.href = url;
      a.download = `sitescore-${host}-audit.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("JSON downloaded");
    } catch {
      toast("Download failed in this browser");
    }
  }

  return (
    <section
      id="export"
      aria-label="Export report"
      className="no-print w-full"
    >
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-sage-50/70 p-3.5 backdrop-blur-md dark:bg-[#161D17]/80 sm:p-4">
        <div>
          <h3 className="eyebrow text-sage-900 dark:text-sage-100">
            Export Audit Report
          </h3>
          <p className="body-secondary mt-0.5 text-sage-500 dark:text-sage-400">
            Download or copy formatted findings for client reports or coding agents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors",
              "bg-sage-500 text-white hover:bg-sage-600 active:scale-[0.98]",
              "dark:bg-sage-200 dark:text-sage-950 dark:hover:bg-sage-100",
            )}
          >
            <ClipboardText className="h-3.5 w-3.5" aria-hidden="true" weight="bold" />
            Copy Markdown
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]",
              SECONDARY_BUTTON,
            )}
          >
            <DownloadSimple className="h-3.5 w-3.5" aria-hidden="true" weight="bold" />
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]",
              SECONDARY_BUTTON,
            )}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" weight="bold" />
            Print / PDF
          </button>
        </div>
      </div>
    </section>
  );
}
