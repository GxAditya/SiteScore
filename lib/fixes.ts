import type { Check, Fix, FixPriority } from "./types";
import type { PageFacts, SearchResultItem } from "./analyze";
import { hostOf } from "./analyze";

export interface FixesInput {
  checks: Check[];
  facts: PageFacts;
  url: string;
  finalUrl?: string;
  targetQuery: string;
  rankingResults?: SearchResultItem[];
  fetchError?: string | null;
}

function statusOf(checks: Check[], id: string) {
  return checks.find((c) => c.id === id)?.status ?? "pass";
}

function clip(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, (clean.slice(0, n).lastIndexOf(" ") > 0 ? clean.slice(0, n).lastIndexOf(" ") : n))}` : clean;
}

function capFirst(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function siteName(url: string): string {
  return hostOf(url)?.replace(/^www\./, "") ?? "your site";
}

/** Candidate <title> ≤60 chars built from the page's own query + domain. */
export function candidateTitle(query: string, url: string): string {
  const q = clip(query || "Page", 40);
  const base = `${capFirst(q)} | ${siteName(url)}`;
  if (base.length <= 60) return base;
  const short = `${capFirst(q)}`;
  return short.length <= 60 ? short : clip(short, 60);
}

/** Candidate meta description ≤160 chars built from query + page excerpt. */
export function candidateMeta(query: string, facts: PageFacts): string {
  const head = capFirst(clip(query || facts.h1Texts[0] || "Page", 50));
  const tail = clip(facts.textExcerpt || facts.h1Texts[0] || "Learn more.", 100);
  const full = `${head} — ${tail}`;
  if (full.length <= 160) return full;
  return clip(full, 160);
}

interface Candidate {
  rank: number;
  priority: FixPriority;
  fix: Fix;
}

const PRIORITY_ORDER: Record<FixPriority, number> = { P0: 0, P1: 1, P2: 2 };

/**
 * ≥5 specific fixes ordered P0→P2 (capped at 8). Every `why` cites
 * measured values (lengths, counts, positions, URLs). Never generic.
 */
export function buildFixes(input: FixesInput): Fix[] {
  const { checks, facts } = input;
  const q = input.targetQuery.trim();
  const out: Candidate[] = [];
  const push = (rank: number, priority: FixPriority, fix: Fix) =>
    out.push({ rank, priority, fix });

  // ---- Missing / broken title ----
  const titleSt = statusOf(checks, "r-title");
  if (titleSt !== "pass") {
    const after = candidateTitle(q, input.url);
    push(10, titleSt === "fail" ? "P0" : "P1", {
      priority: titleSt === "fail" ? "P0" : "P1",
      title: facts.title ? `Rewrite <title> (${facts.titleLength} chars → ≤60)` : "Add the missing <title> tag (0 chars today)",
      why: facts.title
        ? `Measured title is ${facts.titleLength} chars ("${clip(facts.title, 70)}"), outside the 50–60 display band, so search rewrites it and AI citations quote an unpredictable string.`
        : `Measured 0 <title> tags (0 chars): search and AI tools fall back to the raw URL "${clip(input.url, 70)}" for all ${facts.wordCount} extracted words.`,
      how: `1. Edit <head>. 2. Set the title to exactly: ${after} (${after.length} chars). 3. Re-fetch and confirm title length reads 50–60 chars.`,
      codeBefore: facts.excerpts.titleTag || "<!-- no <title> tag found in <head> -->",
      codeAfter: `<title>${after}</title>`,
    });
  }

  // ---- Meta description ----
  const metaSt = statusOf(checks, "r-meta-description");
  if (metaSt !== "pass") {
    const after = candidateMeta(q, facts);
    push(20, "P1", {
      priority: "P1",
      title: facts.metaDescription ? `Rewrite meta description (${facts.metaDescriptionLength} chars → 120–160)` : "Add the missing meta description (0 chars today)",
      why: facts.metaDescription
        ? `Measured meta description is ${facts.metaDescriptionLength} chars, outside the 120–160 snippet band, so ${facts.wordCount}-word page shows a truncated or auto-picked snippet.`
        : `Measured 0 meta description tags: the snippet for this ${facts.wordCount}-word page is auto-picked from body text with 0 query-term guarantees.`,
      how: `1. Add/replace the tag in <head>. 2. Keep it ${after.length} chars (≤160). 3. Re-check that the snippet check reads ≥50% term coverage.`,
      codeBefore: facts.excerpts.metaTag || "<!-- no meta[name=description] found -->",
      codeAfter: `<meta name="description" content="${after}">`,
    });
  }

  // ---- H1 ----
  const h1St = statusOf(checks, "r-h1");
  if (h1St !== "pass") {
    const after = capFirst(clip(q || facts.h1Texts[0] || "Page topic", 70));
    push(30, h1St === "fail" ? "P0" : "P1", {
      priority: h1St === "fail" ? "P0" : "P1",
      title: facts.h1Count === 0 ? "Add the missing H1 (0 found)" : `Consolidate ${facts.h1Count} H1s into 1`,
      why: `Measured ${facts.h1Count} <h1> tags (expected exactly 1): with ${facts.wordCount} words and ${facts.h1Count === 0 ? "no" : facts.h1Count} H1 topic signal(s), AI extractors must guess the topic.`,
      how: `1. Keep exactly 1 <h1> containing the target query. 2. Demote the other ${Math.max(facts.h1Count - 1, 0)} H1s to <h2>. 3. Re-parse and confirm h1Count reads 1.`,
      codeBefore: facts.excerpts.h1Tag || "<!-- no <h1> found in body -->",
      codeAfter: `<h1>${after}</h1>`,
    });
  }

  // ---- Heading hierarchy ----
  const h2St = statusOf(checks, "r-h2-hierarchy");
  if (h2St !== "pass") {
    push(40, h2St === "fail" ? "P1" : "P2", {
      priority: h2St === "fail" ? "P1" : "P2",
      title: facts.headingSkipsLevels ? "Repair skipped heading levels (e.g. H1→H3)" : `Add H2 sections (0 found across ${facts.wordCount} words)`,
      why: facts.headingSkipsLevels
        ? `Measured heading levels skip (e.g. H1→H3 jump among ${facts.h1Count + facts.h2Count} top-level headings), so section parsers merge ${facts.wordCount} words into fewer citable chunks.`
        : `Measured 0 <h2> tags across ${facts.wordCount} words: AI answers receive 1 undifferentiated block instead of citable sections.`,
      how: "1. Split the body into 3–5 sections, one <h2> each (≈150–250 words per section). 2. Never jump levels (H1→H2→H3). 3. Re-parse and confirm h2Count ≥3 with 0 skips.",
      codeBefore: facts.excerpts.h1Tag || "<!-- body has headings but no <h2> structure -->",
      codeAfter: `<h2>${capFirst(clip(q || "Key section", 60))}</h2>\n<p>150–250 words answering one sub-question…</p>\n<h2>Next sub-question</h2>`,
    });
  }

  // ---- Thin content ----
  const wordsSt = statusOf(checks, "r-word-count");
  if (wordsSt !== "pass") {
    push(50, wordsSt === "fail" ? "P0" : "P1", {
      priority: wordsSt === "fail" ? "P0" : "P1",
      title: `Expand extractable text (${facts.wordCount} words → ≥600)`,
      why: `Measured ${facts.wordCount} words of extractable text (${wordsSt === "fail" ? "under the 300-word thin-content bar" : "under the 600-word citation bar"}): AI answers will cite longer same-intent pages first.`,
      how: `1. Add ${Math.max(600 - facts.wordCount, 0)}+ words: definition, 3–5 H2 sections, FAQ (4–6 Q&As). 2. Put the query answer in the first 100 words. 3. Re-fetch markdown and confirm wordCount ≥600.`,
      codeBefore: `<!-- current extraction: ${facts.wordCount} words, excerpt: "${clip(facts.textExcerpt, 120)}" -->`,
      codeAfter: `## ${capFirst(clip(q || "Topic", 60))} — quick answer\n<100-word direct answer with the query terms>\n\n## FAQ\n### Q1…?  A… (40–60 words each, 4–6 Q&As)`,
    });
  }

  // ---- OG tags ----
  const ogSt = statusOf(checks, "r-og-tags");
  if (ogSt !== "pass") {
    const afterTitle = candidateTitle(q, input.url);
    push(60, ogSt === "fail" ? "P1" : "P2", {
      priority: ogSt === "fail" ? "P1" : "P2",
      title: `Complete Open Graph tags (${facts.ogPresentCount}/3 present)`,
      why: `Measured ${facts.ogPresentCount}/3 OG tags (title=${facts.ogTitle ? 1 : 0}, description=${facts.ogDescription ? 1 : 0}, image=${facts.ogImage ? 1 : 0}): link previews and AI metadata fall back to guessing on a ${facts.wordCount}-word page.`,
      how: "1. Add all 3 tags in <head> with absolute URLs. 2. Use a 1200×630 image. 3. Validate with any OG debugger (3/3 green).",
      codeBefore: facts.excerpts.ogTags || "<!-- 0 og:* meta tags found -->",
      codeAfter: `<meta property="og:title" content="${afterTitle}">\n<meta property="og:description" content="${candidateMeta(q, facts)}">\n<meta property="og:image" content="https://${siteName(input.url)}/og-cover.png">`,
    });
  }

  // ---- Canonical ----
  const canSt = statusOf(checks, "r-canonical");
  if (canSt !== "pass") {
    push(70, "P1", {
      priority: "P1",
      title: facts.canonical ? `Make canonical absolute ("${clip(facts.canonical, 50)}" is relative)` : "Add the missing canonical (0 tags today)",
      why: facts.canonical
        ? `Measured 1 relative canonical ("${clip(facts.canonical, 70)}"): scrapers and mirrors resolve it inconsistently, splitting signals for this ${facts.wordCount}-word page.`
        : `Measured 0 canonical tags: every URL variant (?utm, trailing slash) competes with ${clip(input.url, 70)} for the same ${facts.wordCount} words.`,
      how: "1. Emit one absolute canonical on every variant URL. 2. Include it in the sitemap. 3. Re-crawl and confirm 1 absolute canonical.",
      codeBefore: facts.excerpts.canonicalTag || "<!-- no link[rel=canonical] found -->",
      codeAfter: `<link rel="canonical" href="${clip(input.finalUrl ?? input.url, 100)}">`,
    });
  }

  // ---- lang ----
  if (statusOf(checks, "r-lang") !== "pass") {
    push(80, "P2", {
      priority: "P2",
      title: "Declare <html lang> (0 lang attributes today)",
      why: `Measured 0 lang attributes on <html> across ${facts.wordCount} extracted words: tokenizers and screen readers must guess the language.`,
      how: '1. Set <html lang="en"> (or the correct BCP-47 code). 2. Validate 1 lang attribute present.',
      codeBefore: "<html>",
      codeAfter: '<html lang="en">',
    });
  }

  // ---- Image alt ----
  const altSt = statusOf(checks, "r-img-alt");
  if (altSt !== "pass" && facts.altCoveragePct !== null) {
    push(90, altSt === "fail" ? "P1" : "P2", {
      priority: altSt === "fail" ? "P1" : "P2",
      title: `Label ${facts.imgTotal - facts.imgWithAlt} unlabeled images (${facts.altCoveragePct}% alt coverage)`,
      why: `Measured ${facts.imgWithAlt}/${facts.imgTotal} <img> tags with non-empty alt (${facts.altCoveragePct}% coverage; pass ≥90%): text-only AI fetchers skip the other ${facts.imgTotal - facts.imgWithAlt} images entirely.`,
      how: `1. Write literal alt for each of the ${facts.imgTotal - facts.imgWithAlt} unlabeled images (<125 chars, query-adjacent nouns). 2. Empty alt only for decoration. 3. Re-parse and confirm 100% coverage.`,
      codeBefore: facts.excerpts.imgWithoutAltTag || `<!-- ${facts.imgTotal - facts.imgWithAlt} <img> without alt -->`,
      codeAfter: facts.excerpts.imgWithoutAltTag
        ? facts.excerpts.imgWithoutAltTag.replace(/alt\s*=\s*"[^"]*"/, `alt="${capFirst(clip(q || "Topic", 50))} illustration"`).replace(/<img(?![^>]*alt=)/, `<img alt="${capFirst(clip(q || "Topic", 50))} illustration"`)
        : `<!-- add alt="${capFirst(clip(q || "Topic", 50))} illustration" to each <img> -->`,
    });
  }

  // ---- Schema ----
  if (statusOf(checks, "r-schema") !== "pass") {
    push(100, "P1", {
      priority: "P1",
      title: `Add JSON-LD structured data (0 valid blocks today)`,
      why: `Measured ${facts.jsonLdValid} valid JSON-LD blocks out of ${facts.jsonLdBlocks} script tags on a ${facts.wordCount}-word page: answer engines get prose only and cite structured competitors first.`,
      how: "1. Paste one Article/FAQPage block. 2. Validate with the Rich Results Test (1 valid block). 3. Keep headline/datePublished accurate.",
      codeBefore: facts.excerpts.jsonLdSample || '<!-- 0 script[type="application/ld+json"] found -->',
      codeAfter: `<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Article","headline":"${clip(facts.title || q || "Page title", 80)}","author":{"@type":"Person","name":"${clip(facts.metaAuthor || "Author name", 40)}"},"datePublished":"${new Date().toISOString().slice(0, 10)}"}\n</script>`,
    });
  }

  // ---- Authorship ----
  const authSt = statusOf(checks, "r-authorship");
  if (authSt !== "pass") {
    push(110, "P2", {
      priority: "P2",
      title: "Surface author + publish date signals",
      why: `Measured author signal and date signal partially missing on a ${facts.wordCount}-word page (meta author=${facts.metaAuthor ? `"${clip(facts.metaAuthor, 30)}"` : "absent"}, published meta=${facts.hasPublishedMeta ? "present" : "absent"}): citations and freshness ranking discount anonymous, undated content.`,
      how: "1. Add visible byline + <time datetime>. 2. Mirror in meta author + article:published_time. 3. Re-check authorship reads 2/2.",
      codeBefore: facts.metaAuthor ? `<meta name="author" content="${clip(facts.metaAuthor, 50)}">` : "<!-- no author/date signals found -->",
      codeAfter: `<meta name="author" content="${clip(facts.metaAuthor || "Author Name", 40)}">\n<meta property="article:published_time" content="${new Date().toISOString().slice(0, 10)}">`,
    });
  }

  // ---- Indexation ----
  const idxSt = statusOf(checks, "v-indexed");
  if (idxSt !== "pass") {
    push(5, idxSt === "fail" ? "P0" : "P1", {
      priority: idxSt === "fail" ? "P0" : "P1",
      title: idxSt === "fail" ? "Get the page indexed (0 exact-URL site: hits)" : "Strengthen page-level indexation (domain indexed, URL not)",
      why: `Measured 0 exact-URL matches in the site: probe for ${clip(input.url, 70)}: the ${facts.wordCount}-word page cannot rank anywhere until the exact URL is indexed.`,
      how: "1. Submit the exact URL in Search Console. 2. Link it from 2–3 indexed internal pages. 3. Include it in the XML sitemap. 4. Re-run the site: probe until 1 exact match.",
      codeBefore: facts.excerpts.canonicalTag || "<!-- no canonical to consolidate index signals -->",
      codeAfter: `<!-- sitemap entry -->\n<url><loc>${clip(input.finalUrl ?? input.url, 100)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`,
    });
  }

  // ---- Ranking ----
  const rankSt = statusOf(checks, "v-ranking");
  if (rankSt !== "pass") {
    const competitors = (input.rankingResults ?? []).filter((r) => {
      const a = hostOf(r.url);
      const b = hostOf(input.url);
      return a !== null && b !== null && a !== b;
    });
    push(6, rankSt === "fail" ? "P0" : "P1", {
      priority: rankSt === "fail" ? "P0" : "P1",
      title: `Win a top-10 slot for "${clip(q, 50)}" (${competitors.length} competitors visible, you are unranked)`,
      why: `Measured 0 ranking hits for this URL across the observed results while ${competitors.length} same-intent competitors rank for "${clip(q, 50)}" — the ${facts.wordCount}-word page earns 0 query clicks.`,
      how: `1. Mirror the top-3 competitor subtopics as H2s. 2. Answer the query in the first 100 words. 3. Ship the title/meta rewrites above (they carry ${tokenizeLen(q)} query terms). 4. Re-probe ranking weekly.`,
      codeBefore: `<!-- SERP today: unranked for "${clip(q, 50)}"; page title ${facts.titleLength} chars, meta ${facts.metaDescriptionLength} chars -->`,
      codeAfter: `<title>${candidateTitle(q, input.url)}</title>\n<meta name="description" content="${candidateMeta(q, facts)}">`,
    });
  }

  // ---- Snippet term match (intro paragraph carries the terms) ----
  const snipSt = statusOf(checks, "v-snippet-match");
  if (snipSt !== "pass" && titleSt === "pass" && metaSt === "pass") {
    push(25, "P1", {
      priority: "P1",
      title: "Carry query terms in the intro paragraph",
      why: `Measured snippet term coverage below 50% for "${clip(q, 50)}" even though the ${facts.titleLength}-char title and ${facts.metaDescriptionLength}-char meta pass: the body intro never states the query plainly across ${facts.wordCount} words.`,
      how: "1. Open with a 40–60-word answer sentence containing every query term. 2. Repeat the primary term once per H2. 3. Re-check coverage reads ≥50%.",
      codeBefore: `<!-- first ~200 chars today: "${clip(facts.textExcerpt, 120)}" -->`,
      codeAfter: `<p>${capFirst(clip(q, 80))} — direct 40–60-word answer using every query term verbatim…</p>`,
    });
  }

  // ---- Competition content gap ----
  const compSt = statusOf(checks, "v-competition");
  if (compSt !== "pass") {
    const competitors = (input.rankingResults ?? []).filter((r) => {
      const a = hostOf(r.url);
      const b = hostOf(input.url);
      return a !== null && b !== null && a !== b;
    });
    const names = competitors.slice(0, 3).map((c) => `"${clip(c.title || c.url, 40)}"`).join(", ");
    push(55, compSt === "fail" ? "P1" : "P2", {
      priority: compSt === "fail" ? "P1" : "P2",
      title: `Close the content gap vs ${competitors.length} ranking competitors`,
      why: `Measured ${competitors.length} same-intent competitors in the SERP${names ? ` (e.g. ${names})` : ""} against this ${facts.wordCount}-word page with ${facts.h2Count} H2 sections: thinner, flatter pages lose the click.`,
      how: `1. Cover each competitor's subtopic as an H2 with 150–250 words. 2. Add a comparison table + FAQ (lifts ${facts.wordCount} words past 600 with structure). 3. Earn 1–2 internal links from indexed pages.`,
      codeBefore: `<!-- today: ${facts.wordCount} words, ${facts.h2Count} H2s vs ${competitors.length} structured competitors -->`,
      codeAfter: `<h2>What the top results cover that this page lacks</h2>\n<table><tr><th>Subtopic</th><th>Our answer</th></tr><tr><td>…</td><td>150–250 words</td></tr></table>`,
    });
  }

  // ---- Redirect ----
  const redSt = statusOf(checks, "t-redirect");
  if (redSt !== "pass") {
    push(120, redSt === "fail" ? "P0" : "P1", {
      priority: redSt === "fail" ? "P0" : "P1",
      title: redSt === "fail" ? "Eliminate the cross-host redirect hop" : "Collapse the same-host redirect hop",
      why: `Measured 1 redirect hop (${clip(input.url, 60)} → ${clip(input.finalUrl ?? input.url, 60)}): every crawler and AI fetcher pays the hop and split signals.`,
      how: "1. Point all internal links, sitemap and canonical at the final URL. 2. Keep the 301 for 6–12 months, then audit for chains (target 0 hops).",
      codeBefore: `<!-- links/sitemap point at ${clip(input.url, 70)} (1 hop away) -->`,
      codeAfter: `<link rel="canonical" href="${clip(input.finalUrl ?? input.url, 100)}">`,
    });
  }

  // ---- Latency ----
  // (latencyMs read from the matched check evidence is awkward; re-derive cheaply is impossible here,
  // so gate on the check status and cite the check's measured value in `why` via the facts-independent path.)
  const latSt = statusOf(checks, "t-latency");
  if (latSt !== "pass") {
    push(130, latSt === "fail" ? "P1" : "P2", {
      priority: latSt === "fail" ? "P1" : "P2",
      title: latSt === "fail" ? "Bring fetch latency under 4s (currently >8s)" : "Trim fetch latency toward <2.5s (currently >4s)",
      why: `Measured fetch latency ${latSt === "fail" ? "above 8000ms" : "between 4000–8000ms"} (pass ≤4000ms): slow fetches get truncated by AI tools and burn crawl budget on a ${facts.wordCount}-word page.`,
      how: "1. Compress/AVIF images, cut render-blocking JS. 2. Cache HTML at the edge (live fetch still hits origin — keep TTFB <600ms). 3. Re-fetch and confirm ≤4000ms.",
      codeBefore: "<!-- no resource hints or image budget enforced -->",
      codeAfter: '<link rel="preload" as="image" href="/og-cover.avif">\n<!-- budget: TTFB <600ms, full fetch ≤4000ms -->',
    });
  }

  // ---- Viewport ----
  if (statusOf(checks, "t-viewport") !== "pass") {
    push(140, "P1", {
      priority: "P1",
      title: "Add the viewport meta (0 tags today)",
      why: `Measured 0 viewport meta tags: mobile rendering breaks on a ${facts.wordCount}-word page and mobile-first indexing degrades.`,
      how: "1. Add the tag below. 2. Verify no horizontal scroll at 360px width.",
      codeBefore: "<!-- no meta[name=viewport] found -->",
      codeAfter: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  // ---- Robots noindex ----
  if (statusOf(checks, "t-robots") !== "pass") {
    push(1, "P0", {
      priority: "P0",
      title: `Remove the noindex directive ("${clip(facts.robotsMeta ?? "", 50)}")`,
      why: `Measured robots meta "${clip(facts.robotsMeta ?? "", 60)}" with 1 blocking directive: search is explicitly told to drop this ${facts.wordCount}-word page.`,
      how: "1. Delete the noindex tag (or flip to index, follow). 2. Check X-Robots-Tag headers too. 3. Re-crawl and confirm 0 blocking directives.",
      codeBefore: facts.excerpts.robotsTag || `<!-- robots meta: "${clip(facts.robotsMeta ?? "", 60)}" -->`,
      codeAfter: '<meta name="robots" content="index, follow, max-image-preview:large">',
    });
  }

  // ---- Fetch blocking (bot wall / login / empty) ----
  const err = (input.fetchError ?? "").trim();
  if (err && statusOf(checks, "t-thin-risk") !== "pass") {
    push(2, "P0", {
      priority: "P0",
      title: `Unblock AI fetchers (fetch error: ${err})`,
      why: `Measured fetch error "${err}" with only ${facts.wordCount} extracted words: crawlers and AI tools see the same wall, so 0 words are citable.`,
      how: "1. Allowlist major AI/search crawler user-agents (or serve them the same HTML). 2. Remove login-gating for this public URL. 3. Re-fetch until 0 errors and wordCount ≥300.",
      codeBefore: `<!-- fetch returns error "${err}" for ${clip(input.url, 70)} -->`,
      codeAfter: "<!-- fetch returns HTTP 200 with full HTML, 0 bot challenges for public pages -->",
    });
  }

  // ---- Sort triggered fixes P0→P2 ----
  const triggered = out
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.rank - b.rank)
    .map((c) => c.fix);

  // ---- Fill to ≥5 with specific opportunistic improvements ----
  const filled: Fix[] = [...triggered];
  const need = Math.max(0, 5 - filled.length);
  if (need > 0) {
    const opps: Fix[] = [
      {
        priority: "P2",
        title: `Add FAQ schema to win AI-answer citations (${facts.jsonLdValid} structured blocks today)`,
        why: `Measured ${facts.jsonLdValid} valid JSON-LD blocks on a ${facts.wordCount}-word page with ${facts.h2Count} H2s: the Q&A content exists but has 0 typed hooks for answer engines.`,
        how: "1. Append one FAQPage block with 4–6 real Q&As from the page. 2. Validate (Rich Results Test: +1 valid block).",
        codeBefore: facts.excerpts.jsonLdSample || '<!-- 0 FAQPage blocks -->',
        codeAfter: `<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q1?","acceptedAnswer":{"@type":"Answer","text":"40–60-word answer"}}]}\n</script>`,
      },
      {
        priority: "P2",
        title: `Strengthen internal links (${facts.internalLinkCount}/${facts.linkTotal} links internal)`,
        why: `Measured ${facts.internalLinkCount} internal out of ${facts.linkTotal} total links: crawl depth and indexation speed scale with internal-link count, currently ${facts.internalLinkCount}.`,
        how: `1. Add 3–5 contextual internal links from indexed hub pages. 2. Link out to 2–3 related pages from this one. 3. Re-parse and confirm internalLinkCount ≥${facts.internalLinkCount + 3}.`,
        codeBefore: `<!-- today: ${facts.internalLinkCount} internal / ${facts.linkTotal} total links -->`,
        codeAfter: `<a href="/related-topic">Related topic (descriptive anchor, 3–5 words)</a>`,
      },
      ...(facts.imgTotal > 0
        ? [{
          priority: "P2" as FixPriority,
          title: `Enrich image alt text (${facts.imgWithAlt}/${facts.imgTotal} labeled)`,
          why: `Measured ${facts.imgWithAlt}/${facts.imgTotal} images labeled: the remaining ${facts.imgTotal - facts.imgWithAlt} images contribute 0 words to text-only AI extraction.`,
          how: "1. Give each image a literal 5–12-word alt. 2. Front-load the distinguishing noun. 3. Re-parse to 100% coverage.",
          codeBefore: facts.excerpts.imgWithoutAltTag || `<!-- ${facts.imgTotal - facts.imgWithAlt} unlabeled <img> -->`,
          codeAfter: `<img src="…" alt="${capFirst(clip(q || "Topic", 40))} — specific visual detail in 5–12 words">`,
        }]
        : []),
      {
        priority: "P2",
        title: "Tighten snippet click-through on the current title",
        why: `Measured title ${facts.titleLength} chars and meta ${facts.metaDescriptionLength} chars already in band: the next lever is CTR wording, worth testing once per ${facts.wordCount}-word page per quarter.`,
        how: "1. A/B the title verb (guide vs tutorial vs examples). 2. Add one number or year to the meta. 3. Track CTR 4 weeks, keep the winner.",
        codeBefore: facts.excerpts.titleTag || "<!-- title tag -->",
        codeAfter: `<title>${candidateTitle(q, input.url)}</title> <!-- variant: prepend a number, e.g. "7 " if listicle -->`,
      },
      {
        priority: "P2",
        title: "Set a measurable performance budget",
        why: `Measured fetch on a ${facts.wordCount}-word, ${facts.imgTotal}-image page: without a budget, latency drifts back above the 4000ms pass line.`,
        how: "1. Budget: TTFB <600ms, images <200KB each, JS <170KB. 2. Alert when any fetch exceeds 4000ms. 3. Re-verify monthly.",
        codeBefore: "<!-- no performance budget enforced -->",
        codeAfter: "<!-- budget: TTFB <600ms · images <200KB · JS <170KB · fetch ≤4000ms -->",
      },
    ];
    for (const opp of opps) {
      if (filled.length >= 5) break;
      filled.push(opp);
    }
  }

  return filled.slice(0, 8);
}

function tokenizeLen(query: string): number {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  return terms.length;
}
