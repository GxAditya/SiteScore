"use client";

import {
  ClipboardText,
  DownloadSimple,
  Printer,
} from "@phosphor-icons/react";
import type { AuditReport } from "@/lib/audit-types";
import { buildAuditMarkdown } from "@/lib/report-markdown";
import { copyText, useToast } from "@/lib/ui";
import { Term } from "./report/Term";

export default function ExportBar({ report }: { report: AuditReport }) {
  const { toast } = useToast();

  async function handleCopyMarkdown() {
    const ok = await copyText(buildAuditMarkdown(report));
    toast(
      ok
        ? "Report copied. Paste it anywhere that takes text"
        : "Copy failed - your browser blocked clipboard access",
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
      toast("Saved the full data file");
    } catch {
      toast("Download failed in this browser");
    }
  }

  return (
    <section id="export" aria-label="Export report" className="no-print w-full">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div>
          <h3 className="text-sm font-semibold leading-snug tracking-tight">
            Take this with you
          </h3>
          <p className="panel-sub mt-0.5">
            Copy it into a doc, hand it to a developer, or keep the{" "}
            <Term k="html">raw data</Term> for your own tools.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleCopyMarkdown} className="btn-primary">
            <ClipboardText className="h-4 w-4" aria-hidden="true" weight="bold" />
            <span className="text-sm">Copy the report</span>
          </button>
          <button type="button" onClick={handleDownloadJson} className="btn-secondary">
            <DownloadSimple className="h-4 w-4" aria-hidden="true" weight="bold" />
            <span className="text-sm">Download the data</span>
          </button>
          <button type="button" onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" aria-hidden="true" weight="bold" />
            <span className="text-sm">Print or save as PDF</span>
          </button>
        </div>
      </div>
    </section>
  );
}
