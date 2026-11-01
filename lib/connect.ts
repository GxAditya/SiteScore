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
  // Head-level markup we never received is not the same as a tag that is absent.
  const sawHead = facts.headObserved;
  if (facts.titleSource === "html") canRead.push(`title (${facts.titleLength} chars)`);
  else if (facts.title)
    cantRead.push(
      `no <title> in the fetched copy (${facts.titleLength}-char title visible only in ${facts.titleSource === "search" ? "search results" : "the fetch metadata"})`
    );
  else if (sawHead) cantRead.push("no <title> (0 chars)");
  else cantRead.push("title not in the fetched copy (0 head-level tags read)");
  if (facts.metaDescription) canRead.push(`meta description (${facts.metaDescriptionLength} chars)`);
  else if (sawHead) cantRead.push("no meta description (0 chars)");
  else cantRead.push("meta description not in the fetched copy (0 head-level tags read)");
  if (facts.h1Count === 1) canRead.push(`1 H1 ("${clip(facts.h1Texts[0] ?? "", 50)}")`);
  else cantRead.push(`${facts.h1Count} H1s (expected 1)`);
  canRead.push(`${facts.wordCount} body words`);
  if (facts.jsonLdValid >= 1) canRead.push(`${facts.jsonLdValid} valid JSON-LD blocks`);
  else cantRead.push("0 valid JSON-LD blocks");

  const rankState =
    input.rankPosition !== null
      ? `ranks #${input.rankPosition} of ${input.resultCount}`
      : `does not appear in the ${input.resultCount} results we saw`;
  const indexState = input.indexed ? "is indexed" : "is not found by its exact URL";

  const titlePhrase = facts.title
    ? `a ${facts.titleLength}-char title${facts.titleSource === "html" ? "" : " that only " + (facts.titleSource === "search" ? "search results" : "the fetch metadata") + " shows"}`
    : sawHead
      ? "no title"
      : "a title the fetched copy did not expose";
  const metaPhrase = facts.metaDescription
    ? `a ${facts.metaDescriptionLength}-char meta description`
    : sawHead
      ? "no meta description"
      : "a meta description the fetched copy did not expose";

  const summary =
    `A fresh fetch read ${facts.wordCount} words under ${facts.h1Count + facts.h2Count} top-level headings with ` +
    `${titlePhrase} and ` +
    `${metaPhrase}. ` +
    `AI tools CAN read: ${canRead.join("; ")}.` +
    (cantRead.length > 0 ? ` They CANNOT use: ${cantRead.join("; ")}.` : ` No readability blockers found.`) +
    ` In search, the page ${indexState} and ${rankState} for "${clip(q, 60)}" against ${input.competitorCount} competing pages.`;

  const snippetStatus = statusOf(checks, "v-snippet-match");
  const snippetNote =
    snippetStatus === "pass"
      ? "your search listing title and preview already contain the search terms"
      : snippetStatus === "warn"
        ? "the search preview contains only some of the search terms"
        : "the search preview falls back to random page text with no overlap with the search terms";
  const competitorNote =
    input.rankPosition !== null && input.topCompetitorTitle
      ? ` while "${clip(input.topCompetitorTitle, 60)}" (${input.topCompetitorDomain ?? "competitor"}) holds a higher spot`
      : input.rankPosition === null && input.topCompetitorTitle
        ? ` while "${clip(input.topCompetitorTitle, 60)}" (${input.topCompetitorDomain ?? "competitor"}) holds the visible results`
        : ` with ${input.competitorCount} competing pages chasing the same search intent`;
  const schemaNote =
    facts.jsonLdValid >= 1
      ? `${facts.jsonLdValid} valid JSON-LD block(s) give AI tools clearly labeled facts to quote`
      : "0 valid JSON-LD blocks means AI tools only get plain prose and cite structured competitors first";

  const correlation =
    `Because a fresh fetch reads ${facts.wordCount} words with ${facts.h1Count === 1 ? "a single H1" : `${facts.h1Count} H1s`} and ` +
    `${metaPhrase}, ${snippetNote}. ` +
    `That readability profile shows up directly in the search outcome: the page ${rankState} for "${clip(q, 60)}"${competitorNote}. ` +
    `Fix the on-page reading side first - ${schemaNote} - then re-check ranking, since ${facts.wordCount < 300 ? `${facts.wordCount} words cannot beat longer pages for citations` : `every added structured fact raises citation odds without new backlinks`}.`;

  return { summary, correlation };
}
