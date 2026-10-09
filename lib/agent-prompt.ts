import type { AuditFix } from "./audit-types";

/** Page context threaded into every agent prompt. */
export interface AgentPromptContext {
  url: string;
  finalUrl: string;
  query: string;
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

function pageUrl(ctx: AgentPromptContext): string {
  return ctx.finalUrl || ctx.url || "(page URL unavailable)";
}

function requestedUrl(ctx: AgentPromptContext): string {
  return ctx.url || ctx.finalUrl || "(page URL unavailable)";
}

/** First non-empty line of a snippet - used as a searchable marker. */
function markerOf(code: string): string {
  const line =
    code
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? "";
  return line.slice(0, 80) || "(snippet below)";
}

/**
 * Self-contained fix prompt for a zero-context coding agent.
 * Plain markdown, no emojis, ~150-250 words.
 */
export function buildFixPrompt(
  fix: AuditFix,
  ctx: AgentPromptContext,
): string {
  const page = pageUrl(ctx);
  const requested = requestedUrl(ctx);
  const query = ctx.query || "(unknown query)";
  const before = fix.codeBefore?.trim() ?? "";
  const after = fix.codeAfter?.trim() ?? "";
  const marker = after ? markerOf(after) : markerOf(fix.how);

  const lines: string[] = [];
  lines.push(`## Fix [${fix.priority}] - ${fix.title}`);
  lines.push("");
  lines.push(`Task: ${fix.how}`);
  lines.push("");
  lines.push(`Page: ${page} (requested URL: ${requested}).`);
  lines.push(
    `Verify: fetch the URL, or open view-source:${page} and inspect the relevant markup. Target query for this audit: "${query}".`,
  );
  lines.push("");
  lines.push(`Evidence (measured): "${fix.why}"`);
  lines.push("");
  lines.push("Current code:");
  lines.push("```html");
  lines.push(before || "<!-- not present - add it -->");
  lines.push("```");
  lines.push("");
  lines.push("Required end-state - write exactly:");
  lines.push("```html");
  lines.push(after || fix.how);
  lines.push("```");
  lines.push("");
  lines.push("Acceptance checks:");
  lines.push(
    `1. Presence: view-source:${page} contains \`${marker}\` from the snippet above.`,
  );
  lines.push(
    before
      ? "2. Count: exactly one instance of the new snippet exists; the old snippet no longer appears verbatim."
      : "2. Count: exactly one instance of the new snippet exists in the page source.",
  );
  lines.push(
    "3. Length: any text introduced above meets the length stated in the Task (re-measure character/word counts); re-fetch the page (expect HTTP 200) and confirm nothing else changed.",
  );
  lines.push("");
  lines.push(
    "Constraint: minimal diff - edit only the snippet above. Do not touch unrelated markup, styles, scripts, or dependencies.",
  );
  return lines.join("\n");
}

/** Full repair brief: P0 fixes first, then P1/P2, separated for pasting. */
export function buildFullRepairBrief(
  fixes: AuditFix[],
  ctx: AgentPromptContext,
): string {
  const page = pageUrl(ctx);
  const query = ctx.query || "(unknown query)";
  const sorted = [...fixes].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );
  const header = [
    `# Repair brief - ${page}`,
    "",
    `Target query: "${query}". Apply the fixes below in order (P0 first). Keep every diff minimal; verify each fix against its acceptance checks before moving on.`,
  ];
  const bodies = sorted.map((fix) => buildFixPrompt(fix, ctx));
  return [header.join("\n"), ...bodies].join("\n\n---\n\n");
}
