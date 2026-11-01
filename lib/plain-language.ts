/**
 * Plain-language layer for the audit report.
 *
 * The engine (lib/analyze.ts, lib/fixes.ts) measures the page and owns the
 * finding sentences. This module owns the human framing around them: what each
 * check is actually about, why a site owner should care, what the priority
 * tiers mean in a working week, and a glossary for every term a non-SEO reader
 * will bounce on. Nothing here re-states a measurement.
 */

import type { CheckCategory, CheckStatus, FixPriority } from "./audit-types";

/* ---------------------------------------------------------------- */
/* The three axes                                                   */
/* ---------------------------------------------------------------- */

export interface AxisCopy {
  key: CheckCategory;
  /** The question this section answers, in the owner's words. */
  question: string;
  /** Short label used in dense rows. */
  short: string;
  /** One sentence on what moves this number. */
  note: string;
  weight: string;
}

export const AXES: Record<CheckCategory, AxisCopy> = {
  readability: {
    key: "readability",
    question: "Can a machine read this page?",
    short: "Reading",
    note: "Whether a program can tell what the page is about, section by section.",
    weight: "40% of your score",
  },
  visibility: {
    key: "visibility",
    question: "Can anyone actually find it?",
    short: "Finding",
    note: "Whether the page is in the index and shows up for the phrase you want.",
    weight: "35% of your score",
  },
  technical: {
    key: "technical",
    question: "Is the plumbing in order?",
    short: "Plumbing",
    note: "Speed, mobile display, and settings that can quietly block a page.",
    weight: "25% of your score",
  },
};

export const AXIS_ORDER: CheckCategory[] = ["readability", "visibility", "technical"];

/* ---------------------------------------------------------------- */
/* Status and priority, in working language                         */
/* ---------------------------------------------------------------- */

export const STATUS_COPY: Record<CheckStatus, { word: string; plain: string }> = {
  pass: { word: "Good", plain: "This one is fine. Nothing to do." },
  warn: { word: "Almost", plain: "It works, but it is weak enough to cost you." },
  fail: { word: "Broken", plain: "This is actively hiding something from readers." },
};

export interface PriorityCopy {
  label: string;
  when: string;
  note: string;
}

export const PRIORITY_COPY: Record<FixPriority, PriorityCopy> = {
  P0: {
    label: "Fix today",
    when: "today",
    note: "Until these are done, AI tools and search cannot quote this page properly.",
  },
  P1: {
    label: "Do this week",
    when: "this week",
    note: "These are the changes that bring the most extra traffic for the least work.",
  },
  P2: {
    label: "When you can",
    when: "later",
    note: "Worth doing once the top two groups are clear. Small wins that add up.",
  },
};

/* ---------------------------------------------------------------- */
/* Per-check human framing, keyed by the engine's stable check ids   */
/* ---------------------------------------------------------------- */

export interface PlainCheck {
  /** What to call this thing without jargon. */
  topic: string;
  /** Why a site owner should care, in one sentence. */
  why: string;
  /** Glossary keys worth expanding inline. */
  terms?: string[];
}

export const CHECK_PLAIN: Record<string, PlainCheck> = {
  "r-title": {
    topic: "The name shown in search results",
    why: "This is the blue line people click. Without a good one, your link shows up as a raw URL.",
    terms: ["title-tag"],
  },
  "r-meta-description": {
    topic: "The short preview under the link",
    why: "It is the one line of pitch you control in the results list, so do not let a machine invent it.",
    terms: ["meta-description"],
  },
  "r-h1": {
    topic: "The main title on the page",
    why: "One clear main title tells a machine what the whole page is about. Two of them split the signal.",
    terms: ["h1"],
  },
  "r-h2-hierarchy": {
    topic: "Section headings",
    why: "Headings chop the page into passages an AI can lift and quote. A wall of text gives it nothing to pick.",
    terms: ["h2", "heading-structure"],
  },
  "r-word-count": {
    topic: "How much text is really here",
    why: "Short pages rarely get quoted. An answer engine picks the page that actually answers.",
    terms: ["thin-content"],
  },
  "r-og-tags": {
    topic: "The card people see when the link is shared",
    why: "This is the picture and headline that appear when someone pastes your link into a chat or post.",
    terms: ["open-graph"],
  },
  "r-canonical": {
    topic: "Which web address is the real one",
    why: "The same page can be reached several ways. Without one chosen address, your popularity gets split between them.",
    terms: ["canonical"],
  },
  "r-lang": {
    topic: "The language the page is written in",
    why: "Stating the language keeps readers, translators, and search tools from guessing wrong.",
    terms: ["lang-attribute"],
  },
  "r-img-alt": {
    topic: "Labels on your pictures",
    why: "A machine reads a description of an image, never the image itself. Unlabeled pictures are blank to it.",
    terms: ["alt-text"],
  },
  "r-schema": {
    topic: "A labeled fact sheet about the page",
    why: "This is how you hand an AI the who, what, and when in a form it trusts. Pages with it get quoted first.",
    terms: ["json-ld", "structured-data"],
  },
  "r-authorship": {
    topic: "Who wrote it and when",
    why: "A name and a date are the fastest trust signals an answer engine looks for before it cites you.",
    terms: ["freshness"],
  },
  "v-indexed": {
    topic: "Whether search knows this page exists",
    why: "If the page is not in the index, nothing else on this report matters. Nobody can find it.",
    terms: ["index"],
  },
  "v-ranking": {
    topic: "Where you land for the phrase you want",
    why: "Page two of results is an empty room. This is the spot you actually get for the search you picked.",
    terms: ["rank", "target-query"],
  },
  "v-snippet-match": {
    topic: "Whether your preview repeats what people search",
    why: "When your listing uses the same words as the search, more people click it.",
    terms: ["snippet"],
  },
  "v-competition": {
    topic: "Who is beating you for that phrase",
    why: "These are the pages taking the clicks you wanted. The report shows what they cover that you do not.",
    terms: ["competitor"],
  },
  "t-redirect": {
    topic: "Extra hops before the page loads",
    why: "Every hop is a small delay, and it can send your hard-earned links to the wrong address.",
    terms: ["redirect"],
  },
  "t-latency": {
    topic: "How long the page takes to answer",
    why: "Slow pages get given up on. Readers leave, and AI tools move on to the next source.",
    terms: ["latency"],
  },
  "t-viewport": {
    topic: "How it looks on a phone",
    why: "Most people arrive on a phone, and search ranks you on the phone version of the page.",
    terms: ["viewport"],
  },
  "t-robots": {
    topic: "Whether you have told search to stay away",
    why: "One leftover setting can hide an entire page from search results. This checks you did not do that by accident.",
    terms: ["noindex"],
  },
  "t-thin-risk": {
    topic: "Whether a machine could get in at all",
    why: "If the reader gets blocked, so does every AI tool. This is the difference between an invisible page and a visible one.",
    terms: ["bot-protection"],
  },
  fetch_error_bot_blocked: {
    topic: "Your bot protection blocked the reader",
    why: "The security that keeps scrapers out also keeps AI assistants out. They arrive as well-behaved bots.",
    terms: ["bot-protection"],
  },
  fetch_error_login_required: {
    topic: "The page asked for a sign-in",
    why: "Behind a login, a machine reads nothing but the sign-in form.",
    terms: ["login-wall"],
  },
  fetch_error_empty_content: {
    topic: "The page arrived with no text",
    why: "If the words are only built by scripts after loading, a reader that does not run scripts sees an empty page.",
    terms: ["client-render"],
  },
  fetch_error_page_not_found: {
    topic: "That address has nothing on it",
    why: "A typo, a moved page, or a deleted one. Either way, nothing can rank there.",
    terms: ["404"],
  },
  fetch_error_slow_response: {
    topic: "The page took too long to answer",
    why: "The reader gave up before the page finished. AI tools do the same thing.",
    terms: ["latency"],
  },
};

/** Fallback for check ids this layer has not seen yet. */
export function plainFor(id: string): PlainCheck | null {
  return CHECK_PLAIN[id] ?? null;
}

/* ---------------------------------------------------------------- */
/* Verdict: the one paragraph a busy owner reads                     */
/* ---------------------------------------------------------------- */

export interface Verdict {
  /** Headline, e.g. "AI can read this page." */
  headline: string;
  /** The single next move, in plain words. */
  move: string;
  tone: CheckStatus;
}

export function verdictFor(
  total: number,
  p0Count: number,
  p1Count: number,
  indexed: boolean,
): Verdict {
  if (!indexed) {
    return {
      headline: "Search cannot find this page yet",
      move: "Start with the indexing fix. Until search knows the page exists, the other changes cannot pay off.",
      tone: "fail",
    };
  }

  if (p0Count > 0) {
    return {
      headline: "AI can see the page but cannot use it properly",
      move: `Clear the ${p0Count} ${p0Count === 1 ? "blocker" : "blockers"} first. Each one is stopping an answer engine from quoting you.`,
      tone: "fail",
    };
  }

  if (total >= 85) {
    return {
      headline: "This page is ready to be quoted",
      move:
        p1Count > 0
          ? `Nothing is broken. ${p1Count} ${p1Count === 1 ? "improvement" : "improvements"} left would push you ahead of thinner pages.`
          : "Nothing is blocking you. Keep the page fast and keep the headings honest.",
      tone: "pass",
    };
  }

  if (total >= 70) {
    return {
      headline: "AI can read this page, with gaps",
      move:
        p1Count > 0
          ? `Work through the ${p1Count} ${p1Count === 1 ? "item" : "items"} marked "do this week". That is where the extra traffic sits.`
          : "No blockers. Tighten the section headings and the preview line to climb further.",
      tone: "warn",
    };
  }

  return {
    headline: "This page is hard for machines to read",
    move: "Fix the items marked today, then re-run. The score should move as soon as the basics are in place.",
    tone: "warn",
  };
}

/* ---------------------------------------------------------------- */
/* Glossary                                                          */
/* ---------------------------------------------------------------- */

export interface GlossaryEntry {
  /** The word as it should be shown. */
  label: string;
  /** Two plain sentences: what it is, then what it does for you. */
  body: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  "title-tag": {
    label: "title tag",
    body: "The page name that appears in the browser tab and as the blue link in search results. It is the first thing both people and machines read.",
  },
  "meta-description": {
    label: "meta description",
    body: "The one or two lines shown under the link in search results. Write it and search uses it. Skip it and search picks a random sentence off your page.",
  },
  h1: {
    label: "H1",
    body: "The main heading of the page, the biggest title at the top. A page should have exactly one, so a machine knows what the page is about.",
  },
  h2: {
    label: "H2",
    body: "Subheadings that break the page into sections. They let an answer engine lift one passage out of your page and quote it accurately.",
  },
  "heading-structure": {
    label: "heading order",
    body: "Headings should step down without jumping, main title, then sections, then sub-points. Jumping levels makes a machine read your page as one flat block.",
  },
  "alt-text": {
    label: "alt text",
    body: "A short written description attached to an image. Machines never see the picture itself, only this description.",
  },
  canonical: {
    label: "canonical address",
    body: "A note in the page that says which web address is the real one when the same content can be reached several ways. Without it, links and rankings get split between copies.",
  },
  "json-ld": {
    label: "JSON-LD",
    body: "A small block of labeled facts in the page, written for machines rather than people. It is how you tell an AI the author, the date, the price, or the question your page answers.",
  },
  "structured-data": {
    label: "structured data",
    body: "Information on your page that is labeled by type instead of being plain sentences. Answer engines trust it because they do not have to guess what it means.",
  },
  "open-graph": {
    label: "share card tags",
    body: "The picture, title, and summary that appear when someone pastes your link into Slack, X, or a chat app.",
  },
  index: {
    label: "the index",
    body: "Search engines keep a giant catalogue of pages they have already read. Being in the index means you can be found at all.",
  },
  rank: {
    label: "ranking",
    body: "Your position in the list of results for a search. Anything past the first page gets almost no clicks.",
  },
  "target-query": {
    label: "target phrase",
    body: "The search you want to win. You can type one in, or SiteScore picks the most likely one from the page.",
  },
  snippet: {
    label: "search preview",
    body: "The title and short text a search shows for your page. It is the ad you get to write for free.",
  },
  competitor: {
    label: "competing pages",
    body: "The sites already holding the results for your phrase. The report lists them so you can see what they cover that you do not.",
  },
  redirect: {
    label: "redirect",
    body: "Sending an address to another address automatically. Useful when you move a page, but each hop adds delay and can split your authority across two URLs.",
  },
  latency: {
    label: "load time",
    body: "How long the server takes to hand over the page. Past a few seconds, readers leave and AI tools stop waiting.",
  },
  viewport: {
    label: "mobile setting",
    body: "One line in the page that tells a phone how wide to render it. Without it, the page shows up tiny and zoomed out.",
  },
  noindex: {
    label: "noindex",
    body: "An instruction that tells search engines to leave this page out of results. Useful for private pages, a mistake on everything else.",
  },
  "bot-protection": {
    label: "bot protection",
    body: "Security that challenges automated visitors. AI assistants arrive as automated visitors, so protection that is too tight hides you from them too.",
  },
  "login-wall": {
    label: "login wall",
    body: "Content only visible after signing in. Machines that cannot log in read nothing but the sign-in form.",
  },
  "client-render": {
    label: "built after loading",
    body: "A page that starts empty and fills itself in with scripts. Anything that does not run scripts, including many AI readers, never sees the content.",
  },
  "404": {
    label: "not found",
    body: "The address points at nothing. Usually a typo, a moved page, or a deleted one.",
  },
  "thin-content": {
    label: "thin page",
    body: "A page with so little on it that search assumes it cannot answer anyone's question.",
  },
  freshness: {
    label: "freshness",
    body: "How recently a page was written or updated. Search and AI tools both favor pages that look current.",
  },
  "lang-attribute": {
    label: "language setting",
    body: "A marker saying what language the page is in, so tools translate and label it correctly instead of guessing.",
  },
  markdown: {
    label: "Markdown",
    body: "Plain text with light formatting marks. It is what most AI tools are handed instead of the page's HTML.",
  },
  html: {
    label: "HTML",
    body: "The markup that builds your page. It is the only part an AI reader can actually see.",
  },
  "ai-answer": {
    label: "AI answer engine",
    body: "Tools like ChatGPT, Perplexity, and Gemini that write an answer for a question instead of a list of links. They quote pages they can read cleanly.",
  },
  citation: {
    label: "citation",
    body: "When an AI answer names your page as its source. This is the new version of a click.",
  },
  serp: {
    label: "search results page",
    body: "The list a search engine shows back. Shortened in reports to SERP.",
  },
  "crawl-time": {
    label: "crawl budget",
    body: "How much attention search engines can spare for your site. Slow or messy pages waste it.",
  },
  seo: {
    label: "SEO",
    body: "The practice of getting a page found by search engines.",
  },
  byok: {
    label: "bring your own key",
    body: "You supply your own service credential instead of ours, so usage bills your account and nothing is stored on our side.",
  },
};

export function glossaryFor(key: string): GlossaryEntry | null {
  return GLOSSARY[key] ?? null;
}

/* ---------------------------------------------------------------- */
/* Score in words                                                   */
/* ---------------------------------------------------------------- */

export function scoreInWords(total: number): string {
  if (total >= 85) return "Strong";
  if (total >= 70) return "Workable";
  if (total >= 50) return "Patchy";
  return "Needs work";
}

/** Plain reading of a 0-100 subscore, for the three axes. */
export function axisVerdict(value: number): { word: string; tone: CheckStatus } {
  if (value >= 80) return { word: "Clear", tone: "pass" };
  if (value >= 55) return { word: "Gaps", tone: "warn" };
  return { word: "Blocked", tone: "fail" };
}
