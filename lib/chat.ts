/**
 * The chat wire contract: what the browser sends so a model can answer a
 * question about the report the user is looking at.
 *
 * The digest is the ONLY grounding the model gets, and it is built from data
 * the browser controls. So every field is capped here, and the route
 * re-validates the same limits with the schema below: a caller who builds their
 * own request body cannot make the prompt larger than these numbers.
 */

import { z } from "zod";
import type { AuditReport, AuditCheck, AuditFix, SerpEntry } from "./audit-types";

export const CHAT_LIMITS = {
  question: 1200,
  historyTurns: 8,
  checks: 60,
  fixes: 20,
  serpResults: 10,
  competitors: 6,
  fetchErrors: 8,
  field: 400,
  code: 700,
  excerpt: 900,
} as const;

export interface ChatSerpEntry {
  position: number | null;
  siteName: string;
  title: string;
  url: string;
  snippet: string;
}

export interface ChatDigest {
  input: {
    url: string;
    finalUrl: string;
    query: string;
    querySource: string;
    fetchedAt: string;
  };
  score: {
    total: number;
    readability: number;
    visibility: number;
    technical: number;
    grade: string;
  };
  page: {
    title: string;
    h1: string;
    description: string;
    wordCount: number;
    latencyMs: number;
    linkCount: number;
    imageLinkCount: number;
    redirected: boolean;
    textExcerpt: string;
  };
  search: {
    indexed: boolean;
    indexationQuery: string;
    indexationError: string;
    indexationTotalResults: number;
    rank: number | null;
    rankingQuery: string;
    rankingError: string;
    rankingTotalResults: number;
    results: ChatSerpEntry[];
    competitors: ChatSerpEntry[];
  };
  checks: AuditCheck[];
  fixes: Array<Pick<AuditFix, "priority" | "title" | "why" | "how" | "codeBefore" | "codeAfter">>;
  connection: { summary: string; correlation: string };
  fetchErrors: Array<{ url: string; error: string; status: number | null }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatRequestBody {
  question: string;
  history: ChatTurn[];
  digest: ChatDigest;
  tinyfishKey?: string | null;
  llmKey?: string | null;
  llmProvider?: string | null;
}

/**
 * Cap a free-text field so one long page title cannot crowd out the findings.
 * The ellipsis counts toward `max`, which keeps the result inside the schema
 * limit in the route rather than one character over it.
 */
function clip(value: string | undefined | null, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Coerce a count into the range the route will accept. The report is
 * client-supplied here, so a wild value must be clamped rather than rejected:
 * a rejected digest would silently cost the user their model answer.
 */
function num(value: number | undefined | null, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

/** A search position, or null when the entry was not ranked. */
function position(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(10_000, Math.max(0, Math.round(value)));
}

function serp(list: SerpEntry[] | undefined, max: number): ChatSerpEntry[] {
  return (list ?? []).slice(0, max).map((r) => ({
    position: position(r.position),
    siteName: clip(r.siteName, 120),
    title: clip(r.title, CHAT_LIMITS.field),
    url: clip(r.url, 300),
    snippet: clip(r.snippet, CHAT_LIMITS.field),
  }));
}

/**
 * Flatten a report into the smallest shape that still answers both a plain
 * question ("why is my score low?") and a deep technical one ("show me the
 * markup you based that on"), without shipping the whole payload twice.
 */
export function buildChatDigest(report: AuditReport): ChatDigest {
  const L = CHAT_LIMITS;
  return {
    input: {
      url: clip(report.input.url, 300),
      finalUrl: clip(report.input.finalUrl, 300),
      query: clip(report.input.query, 200),
      querySource: report.input.querySource === "auto" ? "auto" : "user",
      fetchedAt: clip(report.input.fetchedAt, 40),
    },
    score: {
      total: num(report.score.total, 100),
      readability: num(report.score.readability, 100),
      visibility: num(report.score.visibility, 100),
      technical: num(report.score.technical, 100),
      grade: clip(report.score.grade, 4),
    },
    page: {
      title: clip(report.fetch.html.title, L.field),
      h1: clip(report.fetch.html.h1, L.field),
      description: clip(report.fetch.html.description, L.field),
      wordCount: num(report.fetch.wordCount, 10_000_000),
      latencyMs: num(report.fetch.latencyMs, 600_000),
      linkCount: num(report.fetch.html.linkCount, 1_000_000),
      imageLinkCount: num(report.fetch.html.imageLinkCount, 1_000_000),
      redirected: report.fetch.redirected === true,
      textExcerpt: clip(report.fetch.markdown.excerpt, L.excerpt),
    },
    search: {
      indexed: report.search.indexation.indexed === true,
      indexationQuery: clip(report.search.indexation.query, 300),
      indexationError: clip(report.search.indexation.error, 120),
      indexationTotalResults: num(report.search.indexation.totalResults, 100_000_000),
      rank: position(report.search.ranking.rank),
      rankingQuery: clip(report.search.ranking.query, 300),
      rankingError: clip(report.search.ranking.error, 120),
      rankingTotalResults: num(report.search.ranking.totalResults, 100_000_000),
      results: serp(report.search.ranking.results, L.serpResults),
      competitors: serp(report.search.competitors, L.competitors),
    },
    checks: report.checks.slice(0, L.checks).map((c) => ({
      id: clip(c.id, 60),
      category: c.category,
      status: c.status,
      label: clip(c.label, L.field),
      detail: clip(c.detail, L.field),
      evidence: clip(c.evidence, L.field),
    })),
    fixes: report.fixes.slice(0, L.fixes).map((f) => ({
      priority: f.priority,
      title: clip(f.title, L.field),
      why: clip(f.why, L.field),
      how: clip(f.how, L.field),
      codeBefore: clip(f.codeBefore, L.code),
      codeAfter: clip(f.codeAfter, L.code),
    })),
    connection: {
      summary: clip(report.connection.summary, L.field),
      correlation: clip(report.connection.correlation, L.field),
    },
    fetchErrors: (report.raw?.fetchErrors ?? []).slice(0, L.fetchErrors).map((e) => ({
      url: clip(e.url, 300),
      error: clip(e.error, L.field),
      status:
        typeof e.status === "number" && Number.isFinite(e.status)
          ? Math.round(e.status)
          : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Server-side validation of the same shape. Mirrors CHAT_LIMITS exactly, so
// what the client may send is what the server will accept and nothing more.
// ---------------------------------------------------------------------------

const str = (max: number) => z.string().max(max);

const SerpSchema = z
  .object({
    position: z.number().int().min(0).max(10_000).nullable(),
    siteName: str(120),
    title: str(CHAT_LIMITS.field),
    url: str(300),
    snippet: str(CHAT_LIMITS.field),
  })
  .strict();

const DigestSchema = z
  .object({
    input: z
      .object({
        url: str(300),
        finalUrl: str(300),
        query: str(200),
        querySource: z.enum(["user", "auto"]),
        fetchedAt: str(40),
      })
      .strict(),
    score: z
      .object({
        total: z.number().min(0).max(100),
        readability: z.number().min(0).max(100),
        visibility: z.number().min(0).max(100),
        technical: z.number().min(0).max(100),
        grade: str(4),
      })
      .strict(),
    page: z
      .object({
        title: str(CHAT_LIMITS.field),
        h1: str(CHAT_LIMITS.field),
        description: str(CHAT_LIMITS.field),
        wordCount: z.number().min(0).max(10_000_000),
        latencyMs: z.number().min(0).max(600_000),
        linkCount: z.number().min(0).max(1_000_000),
        imageLinkCount: z.number().min(0).max(1_000_000),
        redirected: z.boolean(),
        textExcerpt: str(CHAT_LIMITS.excerpt),
      })
      .strict(),
    search: z
      .object({
        indexed: z.boolean(),
        indexationQuery: str(300),
        indexationError: str(120),
        indexationTotalResults: z.number().min(0).max(100_000_000),
        rank: z.number().int().min(0).max(10_000).nullable(),
        rankingQuery: str(300),
        rankingError: str(120),
        rankingTotalResults: z.number().min(0).max(100_000_000),
        results: z.array(SerpSchema).max(CHAT_LIMITS.serpResults),
        competitors: z.array(SerpSchema).max(CHAT_LIMITS.competitors),
      })
      .strict(),
    checks: z
      .array(
        z
          .object({
            id: str(60),
            category: z.enum(["readability", "visibility", "technical"]),
            status: z.enum(["pass", "warn", "fail"]),
            label: str(CHAT_LIMITS.field),
            detail: str(CHAT_LIMITS.field),
            evidence: str(CHAT_LIMITS.field),
          })
          .strict(),
      )
      .max(CHAT_LIMITS.checks),
    fixes: z
      .array(
        z
          .object({
            priority: z.enum(["P0", "P1", "P2"]),
            title: str(CHAT_LIMITS.field),
            why: str(CHAT_LIMITS.field),
            how: str(CHAT_LIMITS.field),
            codeBefore: str(CHAT_LIMITS.code),
            codeAfter: str(CHAT_LIMITS.code),
          })
          .strict(),
      )
      .max(CHAT_LIMITS.fixes),
    connection: z
      .object({ summary: str(CHAT_LIMITS.field), correlation: str(CHAT_LIMITS.field) })
      .strict(),
    fetchErrors: z
      .array(
        z
          .object({ url: str(300), error: str(CHAT_LIMITS.field), status: z.number().int().nullable() })
          .strict(),
      )
      .max(CHAT_LIMITS.fetchErrors),
  })
  .strict();

export const ChatBodySchema = z
  .object({
    question: z
      .string()
      .min(1, "question is required")
      .max(CHAT_LIMITS.question)
      // Control characters are what let a caller forge a new prompt turn.
      .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().max(CHAT_LIMITS.question),
          })
          .strict(),
      )
      .max(CHAT_LIMITS.historyTurns),
    digest: DigestSchema,
    tinyfishKey: z.string().min(8).max(2000).optional().nullable(),
    llmKey: z.string().min(8).max(2000).optional().nullable(),
    llmProvider: z.enum(["gemini", "none"]).optional().nullable(),
  })
  .strict();

export type ValidatedChatBody = z.infer<typeof ChatBodySchema>;
