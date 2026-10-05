import type { Check, Connection } from "./types";
import type { PageFacts } from "./analyze";

export interface ConnectionInput {
  facts: PageFacts;
  checks: Check[];
  targetQuery: string;
  indexed: boolean;
  rankPosition: number | null;
  resultCount: number;
  competitorCount: number;
  topCompetitorTitle?: string | null;
  topCompetitorDomain?: string | null;
}

function statusOf(checks: Check[], id: string): string {
  return checks.find((c) => c.id === id)?.status ?? "warn";
}

function clip(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n)}…` : clean;
}

/**
 * 2–4 sentence rule-based summary + correlation tying readability
 * evidence to the visibility outcome. Every sentence cites measured values.
 */
export function buildConnection(input: ConnectionInput): Connection {
  const { facts, checks, targetQuery } = input;
  const q = targetQuery || "(no query derived)";

  const canRead: string[] = [];
  const cantRead: string[] = [];
  if (facts.title) canRead.push(`title (${facts.titleLength} chars)`);
  else cantRead.push("no <title> (0 chars)");
  if (facts.metaDescription) canRead.push(`meta description (${facts.metaDescriptionLength} chars)`);
  else cantRead.push("no meta description (0 chars)");
  if (facts.h1Count === 1) canRead.push(`1 H1 ("${clip(facts.h1Texts[0] ?? "", 50)}")`);
  else cantRead.push(`${facts.h1Count} H1s (expected 1)`);
  canRead.push(`${facts.wordCount} body words`);
  if (facts.jsonLdValid >= 1) canRead.push(`${facts.jsonLdValid} valid JSON-LD blocks`);
  else cantRead.push("0 valid JSON-LD blocks");

  const rankState =
    input.rankPosition !== null
      ? `ranks #${input.rankPosition} of ${input.resultCount}`
      : `is unranked across ${input.resultCount} observed results`;
  const indexState = input.indexed ? "is indexed" : "shows no exact-URL indexation";

  const summary =
    `Live fetch extracts ${facts.wordCount} words across ${facts.h1Count + facts.h2Count} top-level headings with ` +
    `${facts.title ? `a ${facts.titleLength}-char title` : "no title"} and ` +
    `${facts.metaDescription ? `a ${facts.metaDescriptionLength}-char meta description` : "no meta description"}. ` +
    `AI tools CAN read: ${canRead.join("; ")}.` +
    (cantRead.length > 0 ? ` They CANNOT use: ${cantRead.join("; ")}.` : ` No blocking readability gaps were measured.`) +
    ` In search, the page ${indexState} and ${rankState} for "${clip(q, 60)}" against ${input.competitorCount} same-intent competitors.`;

  const snippetStatus = statusOf(checks, "v-snippet-match");
  const snippetNote =
    snippetStatus === "pass"
      ? "so the SERP title/snippet already carries the query terms"
      : snippetStatus === "warn"
        ? "so the SERP snippet carries only part of the query vocabulary"
        : "so the search snippet falls back to arbitrary page text with no query-term overlap";
  const competitorNote =
    input.rankPosition !== null && input.topCompetitorTitle
      ? ` while "${clip(input.topCompetitorTitle, 60)}" (${input.topCompetitorDomain ?? "competitor"}) holds a higher slot`
      : input.rankPosition === null && input.topCompetitorTitle
        ? ` while "${clip(input.topCompetitorTitle, 60)}" (${input.topCompetitorDomain ?? "competitor"}) owns the visible SERP`
        : ` with ${input.competitorCount} competing pages contesting the same intent`;
  const schemaNote =
    facts.jsonLdValid >= 1
      ? `${facts.jsonLdValid} valid JSON-LD block(s) give answer engines typed facts to cite`
      : "0 valid JSON-LD blocks mean answer engines get prose only and cite structured competitors first";

  const correlation =
    `Because the fetch yields ${facts.wordCount} words with ${facts.h1Count === 1 ? "a single H1" : `${facts.h1Count} H1s`} and ` +
    `${facts.metaDescription ? `a ${facts.metaDescriptionLength}-char meta description` : "no meta description"}, ${snippetNote}. ` +
    `That readability profile converts directly into the visibility outcome: the page ${rankState} for "${clip(q, 60)}"${competitorNote}. ` +
    `Fix the extraction side first — ${schemaNote} — and re-probe ranking, since ${facts.wordCount < 300 ? `${facts.wordCount} words cannot out-cite longer pages` : `every added structured fact raises citation odds without new backlinks`}.`;

  return { summary, correlation };
}
