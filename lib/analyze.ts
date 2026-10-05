import { load } from "cheerio";
import type { Check } from "./types";

export interface SearchResultItem {
  url: string;
  title?: string;
  snippet?: string;
  position?: number;
  site_name?: string;
}

export interface AnalyzeInput {
  url: string;
  finalUrl?: string;
  html?: string;
  /** Markdown/text extraction from the Fetch API (used for word counts). */
  markdownText?: string;
  /** `image_links` from the Fetch API (supplementary to <img> parsing). */
  imageLinks?: string[];
  latencyMs?: number;
  /** Author / publish date reported by the Fetch API (outside the HTML). */
  author?: string | null;
  publishedDate?: string | null;
  targetQuery: string;
  /** Results for the `site:<domain> "<slug>"` indexation probe. */
  siteResults?: SearchResultItem[];
  /** Results for the target-query ranking probe. */
  rankingResults?: SearchResultItem[];
  /** Fetch error code (bot_blocked, login_required, empty_content, …). */
  fetchError?: string | null;
}

export interface PageFacts {
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  headingSkipsLevels: boolean;
  wordCount: number;
  textExcerpt: string;
  ogTitle: boolean;
  ogDescription: boolean;
  ogImage: boolean;
  ogPresentCount: number;
  canonical: string | null;
  canonicalIsAbsolute: boolean;
  lang: string | null;
  imgTotal: number;
  imgWithAlt: number;
  /** Null when the page has no <img> tags. */
  altCoveragePct: number | null;
  jsonLdBlocks: number;
  jsonLdValid: number;
  metaAuthor: string | null;
  hasPublishedMeta: boolean;
  hasViewport: boolean;
  viewportContent: string | null;
  robotsMeta: string | null;
  robotsBlocksIndexing: boolean;
  linkTotal: number;
  internalLinkCount: number;
  excerpts: {
    titleTag: string;
    metaTag: string;
    h1Tag: string;
    canonicalTag: string;
    ogTags: string;
    viewportTag: string;
    robotsTag: string;
    imgWithoutAltTag: string;
    jsonLdSample: string;
  };
}

/** Count words after stripping markdown/HTML punctuation. Deterministic. */
export function countWords(text: string): number {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<![^>]*>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[#>*_`~|[\]()!-]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
}

/** Normalize a URL for comparison: lower host, drop fragment + trackers. */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }
    const paramKeys: string[] = [];
    u.searchParams.forEach((_v, k) => paramKeys.push(k));
    for (const key of paramKeys) {
      if (/^(utm_|fbclid|gclid|msclkid|mc_|yclid|_hs)/i.test(key)) u.searchParams.delete(key);
    }
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${path}${u.search}`;
  } catch {
    return null;
  }
}

export function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with",
  "vs", "best", "top", "how", "what", "why", "get", "buy",
]);

/** Lowercase alphanumeric query terms (len > 2, stopwords dropped). */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function clip(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n)}…` : clean;
}

function outer($: ReturnType<typeof load>, selector: string): string {
  const el = $(selector).first();
  if (el.length === 0) return "";
  try {
    return clip($.html(el) ?? "", 300);
  } catch {
    return "";
  }
}

export function parsePageFacts(
  html: string,
  markdownText?: string
): PageFacts {
  const $ = load(html ?? "");

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDescription = ($('meta[name="description"]').attr("content") ?? "").trim();

  const h1Texts = $("h1")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const h2Count = $("h2").length;
  const levels = $("h1,h2,h3,h4,h5,h6")
    .map((_, el) => parseInt((el.tagName || "h1").slice(1), 10))
    .get();
  let headingSkipsLevels = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      headingSkipsLevels = true;
      break;
    }
  }

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const sourceText = (markdownText ?? "").trim() ? (markdownText as string) : bodyText;
  const wordCount = countWords(sourceText);
  const textExcerpt = clip(sourceText, 200);

  const og = (prop: string) => ($(`meta[property="${prop}"]`).attr("content") ?? "").trim();
  const ogTitle = og("og:title").length > 0;
  const ogDescription = og("og:description").length > 0;
  const ogImage = og("og:image").length > 0;

  const canonical = ($('link[rel="canonical"]').attr("href") ?? "").trim() || null;

  const images = $("img").toArray();
  const imgTotal = images.length;
  const imgWithAlt = images.filter((el) =>
    (($(el).attr("alt") ?? "").trim().length > 0)
  ).length;

  let jsonLdValid = 0;
  const jsonLdBlocks = $('script[type="application/ld+json"]').length;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      JSON.parse($(el).text());
      jsonLdValid++;
    } catch {
      /* invalid block — counted in jsonLdBlocks but not jsonLdValid */
    }
  });

  const metaAuthor =
    ($('meta[name="author"]').attr("content") ??
      $('meta[property="article:author"]').attr("content") ??
      "").trim() || null;
  const hasPublishedMeta =
    ($('meta[property="article:published_time"]').attr("content") ??
      $('meta[name="date"]').attr("content") ??
      $('meta[name="publish_date"]').attr("content") ??
      "").trim().length > 0 || $("time[datetime]").length > 0;

  const viewportContent = ($('meta[name="viewport"]').attr("content") ?? "").trim() || null;
  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").trim() || null;
  const robotsBlocksIndexing = /noindex|none/i.test(robotsMeta ?? "");

  const links = $("a[href]").toArray();
  const internalLinkCount = links.filter((el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#")) return true;
    if (href.startsWith("/") && !href.startsWith("//")) return true;
    return false;
  }).length;

  const firstImgWithoutAlt = images.find(
    (el) => (($(el).attr("alt") ?? "").trim().length === 0)
  );
  let imgWithoutAltTag = "";
  if (firstImgWithoutAlt) {
    try {
      imgWithoutAltTag = clip($.html(firstImgWithoutAlt) ?? "", 300);
    } catch {
      imgWithoutAltTag = "";
    }
  }

  return {
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    h1Count: h1Texts.length,
    h1Texts: h1Texts.slice(0, 5),
    h2Count,
    headingSkipsLevels,
    wordCount,
    textExcerpt,
    ogTitle,
    ogDescription,
    ogImage,
    ogPresentCount: [ogTitle, ogDescription, ogImage].filter(Boolean).length,
    canonical,
    canonicalIsAbsolute: !!canonical && /^https?:\/\//i.test(canonical),
    lang: ($("html").attr("lang") ?? "").trim() || null,
    imgTotal,
    imgWithAlt,
    altCoveragePct: imgTotal === 0 ? null : Math.round((imgWithAlt / imgTotal) * 100),
    jsonLdBlocks,
    jsonLdValid,
    metaAuthor,
    hasPublishedMeta,
    hasViewport: viewportContent !== null,
    viewportContent,
    robotsMeta,
    robotsBlocksIndexing,
    linkTotal: links.length,
    internalLinkCount,
    excerpts: {
      titleTag: outer($, "title"),
      metaTag: outer($, 'meta[name="description"]'),
      h1Tag: outer($, "h1"),
      canonicalTag: outer($, 'link[rel="canonical"]'),
      ogTags: ["og:title", "og:description", "og:image"]
        .map((p) => outer($, `meta[property="${p}"]`))
        .filter(Boolean)
        .join("\n"),
      viewportTag: outer($, 'meta[name="viewport"]'),
      robotsTag: outer($, 'meta[name="robots"]'),
      imgWithoutAltTag,
      jsonLdSample: outer($, 'script[type="application/ld+json"]'),
    },
  };
}

/**
 * Build the full check list (readability 40 / visibility 35 / technical 25).
 * Pure: same input → same output. Every evidence string cites measured values.
 */
export function buildChecks(input: AnalyzeInput): Check[] {
  const facts = parsePageFacts(input.html ?? "", input.markdownText);
  const checks: Check[] = [];
  const q = (input.targetQuery ?? "").trim();

  // ---------- Readability ----------
  if (!facts.title) {
    checks.push({
      id: "r-title", category: "readability", status: "fail",
      label: "Title tag present (50–60 chars)",
      detail: "The page has no <title> — AI tools and search results fall back to the URL.",
      evidence: "0 <title> tags found; title length is 0 chars (expected 50–60).",
    });
  } else if (facts.titleLength >= 50 && facts.titleLength <= 60) {
    checks.push({
      id: "r-title", category: "readability", status: "pass",
      label: "Title tag present (50–60 chars)",
      detail: "Title length is in the ideal band for SERP display and AI citation.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") — within 50–60.`,
    });
  } else if (facts.titleLength >= 30 && facts.titleLength <= 80) {
    checks.push({
      id: "r-title", category: "readability", status: "warn",
      label: "Title tag present (50–60 chars)",
      detail: "Title exists but will likely be truncated or rewritten in results.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") — outside 50–60.`,
    });
  } else {
    checks.push({
      id: "r-title", category: "readability", status: "fail",
      label: "Title tag present (50–60 chars)",
      detail: "Title is far outside the displayable band and will be rewritten.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") — expected 50–60.`,
    });
  }

  if (!facts.metaDescription) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "fail",
      label: "Meta description (120–160 chars)",
      detail: "No meta description — snippets fall back to arbitrary page text.",
      evidence: "0 meta description tags found; length is 0 chars (expected 120–160).",
    });
  } else if (facts.metaDescriptionLength >= 120 && facts.metaDescriptionLength <= 160) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "pass",
      label: "Meta description (120–160 chars)",
      detail: "Meta description fits the snippet band.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars — within 120–160.`,
    });
  } else if (facts.metaDescriptionLength >= 50 && facts.metaDescriptionLength <= 220) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "warn",
      label: "Meta description (120–160 chars)",
      detail: "Meta description will be truncated or ignored at this length.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars ("${clip(facts.metaDescription, 80)}") — outside 120–160.`,
    });
  } else {
    checks.push({
      id: "r-meta-description", category: "readability", status: "fail",
      label: "Meta description (120–160 chars)",
      detail: "Meta description length is unusable for snippets.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars — expected 120–160.`,
    });
  }

  checks.push({
    id: "r-h1",
    category: "readability",
    status: facts.h1Count === 1 ? "pass" : facts.h1Count === 0 ? "fail" : "warn",
    label: "Single H1",
    detail:
      facts.h1Count === 1
        ? "Exactly one H1 gives AI extractors a clear topic signal."
        : facts.h1Count === 0
          ? "No H1 — AI tools must guess the page topic from body text."
          : "Multiple H1s split the topic signal for AI extractors.",
    evidence:
      facts.h1Count === 1
        ? `exactly 1 <h1> ("${clip(facts.h1Texts[0] ?? "", 80)}") — single H1 present.`
        : `${facts.h1Count} <h1> tags found${facts.h1Texts[0] ? ` (first: "${clip(facts.h1Texts[0], 60)}")` : " (none contain text)"} — expected exactly 1.`,
  });

  checks.push({
    id: "r-h2-hierarchy",
    category: "readability",
    status: facts.headingSkipsLevels ? "fail" : facts.h2Count >= 1 ? "pass" : "warn",
    label: "H2 section hierarchy",
    detail:
      facts.headingSkipsLevels
        ? "Heading levels skip (e.g. H1 straight to H3), breaking section parsing."
        : facts.h2Count >= 1
          ? "H2 sections give AI tools citable chunks."
          : "No H2 sections — long extracts come back as one undifferentiated block.",
    evidence: `${facts.h2Count} <h2> tags; heading levels ${facts.headingSkipsLevels ? "SKIP (e.g. H1→H3)" : "are sequential (0 skips)"} across ${facts.h1Count + facts.h2Count} top-level headings.`,
  });

  checks.push({
    id: "r-word-count",
    category: "readability",
    status: facts.wordCount >= 600 ? "pass" : facts.wordCount >= 300 ? "warn" : "fail",
    label: "Extractable body text (≥600 words)",
    detail:
      facts.wordCount >= 600
        ? "Enough extractable text for AI answers to cite this page."
        : facts.wordCount >= 300
          ? "Thin extract — AI answers will prefer longer same-intent pages."
          : "Too thin to rank or be cited — likely flagged as thin content.",
    evidence: `fetch extraction yields ${facts.wordCount} words (pass ≥600, fail <300).`,
  });

  checks.push({
    id: "r-og-tags",
    category: "readability",
    status: facts.ogPresentCount === 3 ? "pass" : facts.ogPresentCount === 0 ? "fail" : "warn",
    label: "Open Graph tags (title/description/image)",
    detail: "OG tags control link previews and feed AI tools structured metadata.",
    evidence: `${facts.ogPresentCount}/3 OG tags present (og:title=${facts.ogTitle ? 1 : 0}, og:description=${facts.ogDescription ? 1 : 0}, og:image=${facts.ogImage ? 1 : 0}).`,
  });

  checks.push({
    id: "r-canonical",
    category: "readability",
    status: !facts.canonical ? "fail" : facts.canonicalIsAbsolute ? "pass" : "warn",
    label: "Canonical link",
    detail: !facts.canonical
      ? "No canonical — duplicate/parameter URLs compete with this page."
      : facts.canonicalIsAbsolute
        ? "Absolute canonical consolidates ranking signals."
        : "Relative canonical is fragile across scrapers and mirrors.",
    evidence: facts.canonical
      ? `canonical href="${clip(facts.canonical, 100)}" (${facts.canonicalIsAbsolute ? "absolute, 1 tag" : "relative, 1 tag"}).`
      : "0 canonical link tags found (expected 1 absolute URL).",
  });

  checks.push({
    id: "r-lang",
    category: "readability",
    status: facts.lang ? "pass" : "fail",
    label: "<html lang> attribute",
    detail: facts.lang
      ? "Language declared — correct tokenization and snippet language."
      : "No language declared — AI tools may mistokenize or mislabel the page.",
    evidence: facts.lang
      ? `<html lang="${facts.lang}"> present (1 attribute).`
      : "0 lang attributes on <html> (expected 1, e.g. lang=\"en\").",
  });

  if (facts.altCoveragePct === null) {
    checks.push({
      id: "r-img-alt", category: "readability", status: "pass",
      label: "Image alt coverage",
      detail: "No images to label — nothing for AI vision fallback to miss.",
      evidence: "0 <img> tags found — 0 alt attributes needed (100% trivially covered).",
    });
  } else {
    checks.push({
      id: "r-img-alt",
      category: "readability",
      status: facts.altCoveragePct >= 90 ? "pass" : facts.altCoveragePct >= 50 ? "warn" : "fail",
      label: "Image alt coverage",
      detail: "Missing alt text makes images invisible to text-only AI fetchers.",
      evidence: `${facts.imgWithAlt}/${facts.imgTotal} <img> tags have non-empty alt (${facts.altCoveragePct}% coverage; pass ≥90%).`,
    });
  }

  checks.push({
    id: "r-schema",
    category: "readability",
    status: facts.jsonLdValid >= 1 ? "pass" : "fail",
    label: "JSON-LD structured data",
    detail: facts.jsonLdValid >= 1
      ? "Structured data feeds AI answer engines typed facts."
      : "No structured data — AI tools get prose only, no typed entities.",
    evidence: `${facts.jsonLdValid} valid JSON-LD blocks out of ${facts.jsonLdBlocks} script[type="application/ld+json"] tags (expected ≥1).`,
  });

  const hasAuthor = !!((input.author ?? "").trim() || facts.metaAuthor);
  const hasDate = !!((input.publishedDate ?? "").trim() || facts.hasPublishedMeta);
  checks.push({
    id: "r-authorship",
    category: "readability",
    status: hasAuthor && hasDate ? "pass" : hasAuthor || hasDate ? "warn" : "fail",
    label: "Author + publish date signals",
    detail: "Authorship and recency feed AI citations and freshness ranking.",
    evidence: `author signal=${hasAuthor ? 1 : 0}, publish-date signal=${hasDate ? 1 : 0} (2/2 needed for pass; meta author=${facts.metaAuthor ? `"${clip(facts.metaAuthor, 40)}"` : "absent"}).`,
  });

  // ---------- Visibility ----------
  const normUrl = normalizeUrl(input.url);
  const normFinal = normalizeUrl(input.finalUrl ?? input.url);
  const siteResults = input.siteResults ?? [];
  const rankingResults = input.rankingResults ?? [];
  const exactIndexed = siteResults.some((r) => {
    const n = normalizeUrl(r.url);
    return n !== null && (n === normUrl || n === normFinal);
  });
  const domainIndexed = siteResults.some((r) => {
    const a = hostOf(r.url);
    const b = hostOf(input.url);
    return a !== null && b !== null && a === b;
  });
  checks.push({
    id: "v-indexed",
    category: "visibility",
    status: exactIndexed ? "pass" : domainIndexed ? "warn" : "fail",
    label: "Page indexed (site: probe)",
    detail: exactIndexed
      ? "The exact URL surfaces in a site: query — it is indexed."
      : domainIndexed
        ? "The domain is indexed but this exact URL did not surface — weak indexation."
        : "Neither the URL nor the domain surfaced — effectively invisible.",
    evidence: exactIndexed
      ? `1 exact-URL match in ${siteResults.length} site: results for "${clip((q || hostOf(input.url)) ?? "", 60)}".`
      : domainIndexed
        ? `0 exact-URL matches but ${siteResults.length} same-domain hits in site: results — page-level indexation missing.`
        : `0 exact-URL matches across ${siteResults.length} site: results (domain not surfacing either).`,
  });

  const ownEntry = rankingResults.find((r) => {
    const n = normalizeUrl(r.url);
    return n !== null && (n === normUrl || n === normFinal);
  });
  const rankPos = ownEntry?.position ?? null;
  checks.push({
    id: "v-ranking",
    category: "visibility",
    status: rankPos !== null && rankPos <= 10 ? "pass" : rankPos !== null ? "warn" : "fail",
    label: "Ranks top-10 for target query",
    detail: rankPos !== null
      ? `The page ranks #${rankPos} for the target query.`
      : "The page does not rank for the target query in the observed results.",
    evidence: rankPos !== null
      ? `ranked #${rankPos} of ${rankingResults.length} results for "${clip(q, 60)}".`
      : `0 ranking hits for this URL across ${rankingResults.length} results for "${clip(q, 60)}".`,
  });

  const terms = tokenizeQuery(q);
  const hay = `${ownEntry?.title ?? facts.title} ${ownEntry?.snippet ?? facts.metaDescription}`.toLowerCase();
  const hits = terms.filter((t) => hay.includes(t));
  const coverage = terms.length === 0 ? 0 : hits.length / terms.length;
  checks.push({
    id: "v-snippet-match",
    category: "visibility",
    status: terms.length === 0 ? "warn" : coverage >= 0.5 ? "pass" : hits.length >= 1 ? "warn" : "fail",
    label: "Title/snippet matches query terms",
    detail: "Term overlap between query and SERP title/snippet drives click-through.",
    evidence: `${hits.length}/${terms.length} query terms matched in SERP title+snippet (${Math.round(coverage * 100)}% coverage; pass ≥50%).`,
  });

  const competitors = rankingResults.filter((r) => {
    const a = hostOf(r.url);
    const b = hostOf(input.url);
    return a !== null && b !== null && a !== b;
  });
  const above = rankPos !== null
    ? competitors.filter((c) => (c.position ?? 999) < rankPos).length
    : competitors.length;
  checks.push({
    id: "v-competition",
    category: "visibility",
    status: rankPos !== null && above === 0 ? "pass" : above <= 3 ? "warn" : "fail",
    label: "Competitor gap",
    detail: rankPos !== null
      ? `${above} same-intent competitor page(s) outrank this result.`
      : "Competitors own the whole SERP for the target query.",
    evidence: `${above} competitor pages rank above vs position ${rankPos ?? "unranked"} across ${rankingResults.length} results (${competitors.length} same-intent competitors total).`,
  });

  // ---------- Technical ----------
  const redirected = normUrl !== null && normFinal !== null && normUrl !== normFinal;
  const sameHostRedirect =
    redirected && hostOf(input.url) !== null && hostOf(input.url) === hostOf(input.finalUrl ?? input.url);
  checks.push({
    id: "t-redirect",
    category: "technical",
    status: !redirected ? "pass" : sameHostRedirect ? "warn" : "fail",
    label: "No redirect dilution",
    detail: !redirected
      ? "Requested URL is the final URL — no hop for crawlers."
      : sameHostRedirect
        ? "Same-host redirect leaks a little crawl budget and latency."
        : "Cross-host redirect — signals and citations may land on the wrong URL.",
    evidence: redirected
      ? `requested ${clip(input.url, 80)} → final ${clip(input.finalUrl ?? input.url, 80)} (1 redirect hop${sameHostRedirect ? ", same host" : ", CROSS-HOST"}).`
      : `0 redirect hops: requested URL equals final URL (${clip(input.url, 80)}).`,
  });

  const latency = input.latencyMs;
  checks.push({
    id: "t-latency",
    category: "technical",
    status: latency === undefined || latency === null ? "warn" : latency <= 4000 ? "pass" : latency <= 8000 ? "warn" : "fail",
    label: "Fetch latency (<4s)",
    detail: "Slow fetches get truncated by AI tools and hurt crawl budget.",
    evidence: latency === undefined || latency === null
      ? "latency not reported by fetch (0 measurements) — assumed unknown, treat as risk."
      : `fetch latency ${latency}ms (pass ≤4000ms, warn ≤8000ms).`,
  });

  checks.push({
    id: "t-viewport",
    category: "technical",
    status: facts.hasViewport ? "pass" : "fail",
    label: "Viewport meta (mobile)",
    detail: facts.hasViewport
      ? "Mobile rendering declared — mobile-first indexing safe."
      : "No viewport — mobile rendering and mobile-first indexing suffer.",
    evidence: facts.hasViewport
      ? `1 viewport meta found (content="${clip(facts.viewportContent ?? "", 60)}").`
      : "0 viewport meta tags found (expected 1).",
  });

  checks.push({
    id: "t-robots",
    category: "technical",
    status: facts.robotsBlocksIndexing ? "fail" : "pass",
    label: "Robots indexability",
    detail: facts.robotsBlocksIndexing
      ? "A noindex directive tells search engines to drop this page."
      : "No blocking robots directive — page is eligible for indexing.",
    evidence: facts.robotsMeta
      ? `robots meta content="${clip(facts.robotsMeta, 60)}" (${facts.robotsBlocksIndexing ? "1 blocking directive found — BLOCKS indexing" : "0 blocking directives"}).`
      : "robots meta absent (0 blocking directives; defaults to index, follow).",
  });

  const err = (input.fetchError ?? "").trim();
  const blockingErr = /bot_blocked|login_required|empty_content|page_not_found/i.test(err);
  checks.push({
    id: "t-thin-risk",
    category: "technical",
    status: facts.wordCount < 300 || blockingErr ? "fail" : facts.wordCount < 600 || err ? "warn" : "pass",
    label: "Crawlable content risk",
    detail: blockingErr
      ? `Fetch reported "${err}" — crawlers likely see the same wall.`
      : facts.wordCount < 300
        ? "Sub-300-word extracts look like thin content to crawlers."
        : "Fetchable content clears the thin-content bar.",
    evidence: `extracted ${facts.wordCount} words with fetch error="${err || "none"}" (1 fetch attempt).`,
  });

  return checks;
}
