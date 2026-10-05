/** Optional LLM summary (Task 5) — server-only. Never import from client code. */

import type { Check, Fix } from "./types";

export type AiSummaryProvider = "none" | "gemini";

export interface AiSummary {
  text: string;
  provider: AiSummaryProvider;
  generated: boolean;
  /** Present when generation was attempted but skipped/failed — never throws. */
  warning?: string;
}

export interface AiSummaryScores {
  total: number;
  readability: number;
  visibility: number;
  technical: number;
}

export interface AiSummaryInput {
  url: string;
  finalUrl: string;
  query: string;
}

export interface AiSummaryContext {
  checks: Pick<Check, "id" | "category" | "status" | "label" | "detail" | "evidence">[];
  fixes: Pick<Fix, "priority" | "title" | "why" | "how">[];
  scores: AiSummaryScores;
  input: AiSummaryInput;
}

export interface AiSummaryOptions {
  llmKey?: string | null;
  llmProvider?: string | null;
  /** Override for tests. Defaults to process.env.GEMINI_API_KEY. */
  envKey?: string | null;
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_PROMPT_CHECK_LINES = 40;

const SKIPPED: AiSummary = { text: "", provider: "none", generated: false };

function geminiEndpoint(key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
}

/** Compact, grounded context: measured values from the deterministic engine. */
function buildPrompt(ctx: AiSummaryContext): string {
  const checkLines = ctx.checks.slice(0, MAX_PROMPT_CHECK_LINES).map(
    (c) => `- [${c.status}/${c.category}] ${c.label}: ${c.detail} (evidence: ${c.evidence})`
  );
  const fixLines = ctx.fixes
    .slice(0, 10)
    .map((f) => `- ${f.priority} ${f.title}: ${f.why} — ${f.how}`);
  return [
    `You are summarizing an SEO/AI-readability audit for the site owner of ${ctx.input.finalUrl}.`,
    `Target query: "${ctx.input.query}". Scores: total ${ctx.scores.total} (readability ${ctx.scores.readability}, visibility ${ctx.scores.visibility}, technical ${ctx.scores.technical}).`,
    ``,
    `Rule findings (ground every claim in these measured values):`,
    ...checkLines,
    ``,
    `Prioritized fixes:`,
    ...fixLines,
    ``,
    `Write a 5-line executive summary followed by exactly 3 same-day actions.`,
    `Cite measured values (word counts, title/meta lengths, rank positions, latencies) from the findings above.`,
    `No generic tips ("improve SEO", "create great content") — every recommendation must reference a specific finding.`,
  ].join("\n");
}

function extractText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return "";
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : ""))
    .join("")
    .trim();
}

/**
 * Optional Gemini summary. Returns generated:false (never throws) when:
 * no/invalid key, provider is not "gemini", timeout, or any upstream failure.
 */
export async function getAiSummary(
  ctx: AiSummaryContext,
  opts: AiSummaryOptions
): Promise<AiSummary> {
  const provider = (opts.llmProvider ?? "").trim().toLowerCase();
  const bodyKey = (opts.llmKey ?? "").trim();
  const envKey = (opts.envKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  const key = bodyKey || (provider === "gemini" ? envKey : "");

  if (provider !== "gemini" || !key) return { ...SKIPPED };
  // Basic sanity: Gemini API keys are ~39 chars starting with "AIza".
  if (!/^AIza[0-9A-Za-z_-]{10,}$/.test(key)) {
    return { ...SKIPPED, warning: "LLM skipped: invalid Gemini key format." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(geminiEndpoint(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(ctx) }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ...SKIPPED,
        warning: `LLM summary unavailable (Gemini HTTP ${res.status}); showing rule-based summary instead.`,
      };
    }
    const text = extractText(await res.json());
    if (!text) {
      return {
        ...SKIPPED,
        warning: "LLM summary unavailable (empty Gemini response); showing rule-based summary instead.",
      };
    }
    return { text, provider: "gemini", generated: true };
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "timed out" : "request failed";
    return {
      ...SKIPPED,
      warning: `LLM summary unavailable (Gemini ${reason}); showing rule-based summary instead.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
