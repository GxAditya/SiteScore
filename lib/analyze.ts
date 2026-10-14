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
      /* invalid block - counted in jsonLdBlocks but not jsonLdValid */
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
      detail: "The page has no <title> tag, so search results and AI tools fall back to showing the raw URL.",
      evidence: "0 <title> tags found; title length is 0 chars (expected 50–60).",
    });
  } else if (facts.titleLength >= 50 && facts.titleLength <= 60) {
    checks.push({
      id: "r-title", category: "readability", status: "pass",
      label: "Title tag present (50–60 chars)",
      detail: "The title is a good length to display fully in search results and for AI tools to quote.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") - within 50–60.`,
    });
  } else if (facts.titleLength >= 30 && facts.titleLength <= 80) {
    checks.push({
      id: "r-title", category: "readability", status: "warn",
      label: "Title tag present (50–60 chars)",
      detail: "The title exists but will likely be cut off or rewritten in search results.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") - outside 50–60.`,
    });
  } else {
    checks.push({
      id: "r-title", category: "readability", status: "fail",
      label: "Title tag present (50–60 chars)",
      detail: "The title is far outside the length that fits on screen, so search engines will rewrite it.",
      evidence: `title is ${facts.titleLength} chars ("${clip(facts.title, 80)}") - expected 50–60.`,
    });
  }

  if (!facts.metaDescription) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "fail",
      label: "Meta description (120–160 chars)",
      detail: "No meta description, so search previews pick arbitrary text from the page.",
      evidence: "0 meta description tags found; length is 0 chars (expected 120–160).",
    });
  } else if (facts.metaDescriptionLength >= 120 && facts.metaDescriptionLength <= 160) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "pass",
      label: "Meta description (120–160 chars)",
      detail: "The meta description fits the search preview length.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars - within 120–160.`,
    });
  } else if (facts.metaDescriptionLength >= 50 && facts.metaDescriptionLength <= 220) {
    checks.push({
      id: "r-meta-description", category: "readability", status: "warn",
      label: "Meta description (120–160 chars)",
      detail: "At this length the meta description will be cut off or ignored.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars ("${clip(facts.metaDescription, 80)}") - outside 120–160.`,
    });
  } else {
    checks.push({
      id: "r-meta-description", category: "readability", status: "fail",
      label: "Meta description (120–160 chars)",
      detail: "The meta description is too long or too short to show as a search preview.",
      evidence: `meta description is ${facts.metaDescriptionLength} chars - expected 120–160.`,
    });
  }

  checks.push({
    id: "r-h1",
    category: "readability",
    status: facts.h1Count === 1 ? "pass" : facts.h1Count === 0 ? "fail" : "warn",
    label: "Single H1",
    detail:
      facts.h1Count === 1
        ? "Exactly one H1 tells search engines and AI tools what the page is about."
        : facts.h1Count === 0
          ? "No H1 heading, so AI tools must guess the topic from the body text."
          : "Multiple H1 headings split the topic signal.",
    evidence:
      facts.h1Count === 1
        ? `exactly 1 <h1> ("${clip(facts.h1Texts[0] ?? "", 80)}") - single H1 present.`
        : `${facts.h1Count} <h1> tags found${facts.h1Texts[0] ? ` (first: "${clip(facts.h1Texts[0], 60)}")` : " (none contain text)"} - expected exactly 1.`,
  });

  checks.push({
    id: "r-h2-hierarchy",
    category: "readability",
    status: facts.headingSkipsLevels ? "fail" : facts.h2Count >= 1 ? "pass" : "warn",
    label: "H2 section hierarchy",
    detail:
      facts.headingSkipsLevels
        ? "Heading levels skip around (e.g. H1 straight to H3), which breaks how tools split the page into sections."
        : facts.h2Count >= 1
          ? "H2 sections give AI tools clear passages to quote."
          : "No H2 sections, so the whole page reads as one long block of text.",
    evidence: `${facts.h2Count} <h2> tags; heading levels ${facts.headingSkipsLevels ? "SKIP (e.g. H1→H3)" : "are sequential (0 skips)"} across ${facts.h1Count + facts.h2Count} top-level headings.`,
  });

  checks.push({
    id: "r-word-count",
    category: "readability",
    status: facts.wordCount >= 600 ? "pass" : facts.wordCount >= 300 ? "warn" : "fail",
    label: "Readable body text (600+ words)",
    detail:
      facts.wordCount >= 600
        ? "Enough text for AI answers to quote this page."
        : facts.wordCount >= 300
          ? "Thin page - AI answers will prefer longer pages on the same topic."
          : "Too little text to rank or be quoted - search engines may flag it as thin content.",
    evidence: `a fresh fetch read ${facts.wordCount} words (pass ≥600, fail <300).`,
  });

  checks.push({
    id: "r-og-tags",
    category: "readability",
    status: facts.ogPresentCount === 3 ? "pass" : facts.ogPresentCount === 0 ? "fail" : "warn",
    label: "Open Graph tags (title/description/image)",
    detail: "Open Graph tags control the preview shown when the page is shared and help AI tools read its metadata.",
    evidence: `${facts.ogPresentCount}/3 OG tags present (og:title=${facts.ogTitle ? 1 : 0}, og:description=${facts.ogDescription ? 1 : 0}, og:image=${facts.ogImage ? 1 : 0}).`,
  });

  checks.push({
    id: "r-canonical",
    category: "readability",
    status: !facts.canonical ? "fail" : facts.canonicalIsAbsolute ? "pass" : "warn",
    label: "Canonical link",
    detail: !facts.canonical
      ? "No canonical tag, so duplicate and tracking-link versions of this page compete with it."
      : facts.canonicalIsAbsolute
        ? "The canonical points to one full URL, so ranking credit stays together."
        : "A relative canonical can break when other sites copy or mirror the page.",
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
      ? "The language is declared, so search engines label and display the page correctly."
      : "No language declared, so tools may misread or mislabel the page.",
    evidence: facts.lang
      ? `<html lang="${facts.lang}"> present (1 attribute).`
      : "0 lang attributes on <html> (expected 1, e.g. lang=\"en\").",
  });

  if (facts.altCoveragePct === null) {
    checks.push({
      id: "r-img-alt", category: "readability", status: "pass",
      label: "Image alt coverage",
      detail: "No images on the page, so nothing is missing a label.",
      evidence: "0 <img> tags found - 0 alt attributes needed (100% trivially covered).",
    });
  } else {
    checks.push({
      id: "r-img-alt",
      category: "readability",
      status: facts.altCoveragePct >= 90 ? "pass" : facts.altCoveragePct >= 50 ? "warn" : "fail",
      label: "Image alt coverage",
      detail: "Images without alt text are invisible to search and to AI tools that only read text.",
      evidence: `${facts.imgWithAlt}/${facts.imgTotal} <img> tags have non-empty alt (${facts.altCoveragePct}% coverage; pass ≥90%).`,
    });
  }

  checks.push({
    id: "r-schema",
    category: "readability",
    status: facts.jsonLdValid >= 1 ? "pass" : "fail",
    label: "JSON-LD structured data",
    detail: facts.jsonLdValid >= 1
      ? "Structured data hands AI tools clearly labeled facts to quote."
      : "No structured data, so AI tools only get plain prose with no labeled facts.",
    evidence: `${facts.jsonLdValid} valid JSON-LD blocks out of ${facts.jsonLdBlocks} script[type="application/ld+json"] tags (expected ≥1).`,
  });

  const hasAuthor = !!((input.author ?? "").trim() || facts.metaAuthor);
  const hasDate = !!((input.publishedDate ?? "").trim() || facts.hasPublishedMeta);
  checks.push({
    id: "r-authorship",
    category: "readability",
    status: hasAuthor && hasDate ? "pass" : hasAuthor || hasDate ? "warn" : "fail",
    label: "Author + publish date signals",
    detail: "Showing an author and a publish date builds trust with AI tools and helps freshness ranking.",
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
    label: "Page found in the search index",
    detail: exactIndexed
      ? "The exact URL shows up in a site: search, so it is indexed."
      : domainIndexed
        ? "The domain is indexed but this exact page did not appear - weak indexing."
        : "Neither this page nor the domain appeared - effectively invisible to search.",
    evidence: exactIndexed
      ? `1 exact-URL match in ${siteResults.length} site: results for "${clip((q || hostOf(input.url)) ?? "", 60)}".`
      : domainIndexed
        ? `0 exact-URL matches but ${siteResults.length} same-domain hits in site: results - this page is not indexed.`
        : `0 exact-URL matches across ${siteResults.length} site: results (the domain is not surfacing either).`,
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
    detail: "When your search title and preview repeat the words people search for, more of them click.",
    evidence: `${hits.length}/${terms.length} query terms matched in the search title + preview (${Math.round(coverage * 100)}% coverage; pass ≥50%).`,
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
      : "Competitors hold every visible search-result spot for the target query.",
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
    label: "No redirect hop",
    detail: !redirected
      ? "The URL you entered is the final URL - no extra hop for search engines."
      : sameHostRedirect
        ? "A same-site redirect adds a small delay and splits credit between two URLs."
        : "The page redirects to a different domain, so links and citations may credit the wrong URL.",
    evidence: redirected
      ? `requested ${clip(input.url, 80)} → final ${clip(input.finalUrl ?? input.url, 80)} (1 redirect hop${sameHostRedirect ? ", same host" : ", CROSS-HOST"}).`
      : `0 redirect hops: requested URL equals final URL (${clip(input.url, 80)}).`,
  });

  const latency = input.latencyMs;
  checks.push({
    id: "t-latency",
    category: "technical",
    status: latency === undefined || latency === null ? "warn" : latency <= 4000 ? "pass" : latency <= 8000 ? "warn" : "fail",
    label: "Fetch speed (under 4s)",
    detail: "Slow pages get cut off by AI tools and waste search engine crawling time.",
    evidence: latency === undefined || latency === null
      ? "latency not reported by the fetch (0 measurements) - treated as unknown risk."
      : `fetch time ${latency}ms (pass ≤4000ms, warn ≤8000ms).`,
  });

  checks.push({
    id: "t-viewport",
    category: "technical",
    status: facts.hasViewport ? "pass" : "fail",
    label: "Mobile viewport tag",
    detail: facts.hasViewport
      ? "Mobile rendering is set up correctly, which Google requires for mobile search."
      : "No viewport tag, so the page renders badly on phones and mobile search suffers.",
    evidence: facts.hasViewport
      ? `1 viewport meta found (content="${clip(facts.viewportContent ?? "", 60)}").`
      : "0 viewport meta tags found (expected 1).",
  });

  checks.push({
    id: "t-robots",
    category: "technical",
    status: facts.robotsBlocksIndexing ? "fail" : "pass",
    label: "Search engines may index the page",
    detail: facts.robotsBlocksIndexing
      ? "A noindex tag tells search engines to drop this page from results."
      : "Nothing is blocking search engines - the page is eligible for the index.",
    evidence: facts.robotsMeta
      ? `robots meta content="${clip(facts.robotsMeta, 60)}" (${facts.robotsBlocksIndexing ? "1 blocking directive found - BLOCKS indexing" : "0 blocking directives"}).`
      : "robots meta absent (0 blocking directives; defaults to index, follow).",
  });

  const err = (input.fetchError ?? "").trim();
  const blockingErr = /bot_blocked|login_required|empty_content|page_not_found/i.test(err);
  checks.push({
    id: "t-thin-risk",
    category: "technical",
    status: facts.wordCount < 300 || blockingErr ? "fail" : facts.wordCount < 600 || err ? "warn" : "pass",
    label: "Content access risk",
    detail: blockingErr
      ? `The fresh fetch reported "${err}" - search engines likely hit the same wall.`
      : facts.wordCount < 300
        ? "Under 300 words of readable text looks like thin content to search engines."
        : "The readable text clears the thin-content bar.",
    evidence: `read ${facts.wordCount} words with fetch error="${err || "none"}" (1 fetch attempt).`,
  });

  return checks;
}
