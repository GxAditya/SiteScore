import type { Check, Connection, Fix, QueryDerivation, Scores } from "./types";
import type { AnalyzeInput, PageFacts, SearchResultItem } from "./analyze";
import { buildChecks, hostOf, normalizeUrl, parsePageFacts, searchTitleFor } from "./analyze";
import { deriveQuery, domainFromUrl } from "./derive-query";
import { scoreFromChecks } from "./score";
import { buildFixes } from "./fixes";
import { buildConnection } from "./connect";

export interface EngineInput {
  url: string;
  finalUrl?: string;
  html?: string;
  markdownText?: string;
  imageLinks?: string[];
  latencyMs?: number;
  author?: string | null;
  publishedDate?: string | null;
  /** User-supplied query; empty/omitted triggers auto-derivation. */
  query?: string;
  siteResults?: SearchResultItem[];
  rankingResults?: SearchResultItem[];
  fetchError?: string | null;
  /** Title reported by the Fetch API, outside the parsed HTML. */
  reportedTitle?: string | null;
}

export interface EngineOutput {
  query: string;
  querySource: QueryDerivation["querySource"];
  facts: PageFacts;
  checks: Check[];
  scores: Scores;
  fixes: Fix[];
  connection: Connection;
}

/**
 * One-call composition for the API route: parse → derive query →
 * checks → scores → fixes → connection. Pure and deterministic.
 */
export function runAuditEngine(input: EngineInput): EngineOutput {
  // Same title corroboration buildChecks uses, so facts, checks, fixes and the
  // narrative never disagree about whether the page has a title.
  const facts = parsePageFacts(input.html ?? "", input.markdownText, {
    reportedTitle: input.reportedTitle,
    searchTitle: searchTitleFor(input.url, input.finalUrl, input.rankingResults, input.siteResults),
  });

  const derived = deriveQuery({
    query: input.query,
    title: facts.title || null,
    h1: facts.h1Texts[0] ?? null,
    metaDescription: facts.metaDescription || null,
    domain: domainFromUrl(input.url) ?? hostOf(input.url),
  });

  const analyzeInput: AnalyzeInput = {
    url: input.url,
    finalUrl: input.finalUrl,
    html: input.html,
    markdownText: input.markdownText,
    imageLinks: input.imageLinks,
    latencyMs: input.latencyMs,
    author: input.author,
    publishedDate: input.publishedDate,
    targetQuery: derived.query,
    siteResults: input.siteResults,
    rankingResults: input.rankingResults,
    fetchError: input.fetchError,
    reportedTitle: input.reportedTitle,
  };

  const checks = buildChecks(analyzeInput);
  const scores = scoreFromChecks(checks);
  const fixes = buildFixes({
    checks,
    facts,
    url: input.url,
    finalUrl: input.finalUrl,
    targetQuery: derived.query,
    rankingResults: input.rankingResults,
    fetchError: input.fetchError,
  });

  const normUrl = normalizeUrl(input.url);
  const normFinal = normalizeUrl(input.finalUrl ?? input.url);
  const indexed = (input.siteResults ?? []).some((r) => {
    const n = normalizeUrl(r.url);
    return n !== null && (n === normUrl || n === normFinal);
  });
  const ownEntry = (input.rankingResults ?? []).find((r) => {
    const n = normalizeUrl(r.url);
    return n !== null && (n === normUrl || n === normFinal);
  });
  const competitors = (input.rankingResults ?? []).filter((r) => {
    const a = hostOf(r.url);
    const b = hostOf(input.url);
    return a !== null && b !== null && a !== b;
  });
  const above = competitors
    .filter((c) => (c.position ?? 999) < (ownEntry?.position ?? 999))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const top = above[0] ?? competitors[0];

  const connection = buildConnection({
    facts,
    checks,
    targetQuery: derived.query,
    indexed,
    rankPosition: ownEntry?.position ?? null,
    resultCount: (input.rankingResults ?? []).length,
    competitorCount: competitors.length,
    topCompetitorTitle: top?.title ?? null,
    topCompetitorDomain: top ? hostOf(top.url) : null,
  });

  return { query: derived.query, querySource: derived.querySource, facts, checks, scores, fixes, connection };
}
