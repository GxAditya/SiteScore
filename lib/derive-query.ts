import { load } from "cheerio";
import type { QueryDerivation } from "./types";

export interface DeriveQueryOptions {
  query?: string | null;
  title?: string | null;
  h1?: string | null;
  metaDescription?: string | null;
  domain?: string | null;
}

export const MAX_QUERY_LENGTH = 120;

/** Strip a trailing site-name suffix such as " | Acme" or " - Acme". */
export function stripSiteSuffix(title: string): string {
  const t = title.trim();
  const multi = [" | ", " — ", " – ", " :: ", " » ", " • ", " / ", " : ", " ~ ", " ｜ "];
  for (const sep of multi) {
    const i = t.indexOf(sep);
    if (i > 0) {
      const head = t.slice(0, i).trim();
      // Only strip when the head is a plausible standalone query.
      if (head.length >= 12) return head;
    }
  }
  // Bare-dash suffix ("Title - SiteName") only when the tail is short,
  // so "state-of-the-art guide" style titles are never mangled.
  for (const sep of [" - ", " – "]) {
    const i = t.lastIndexOf(sep);
    if (i > 0) {
      const head = t.slice(0, i).trim();
      const tail = t.slice(i + sep.length).trim();
      if (head.length >= 20 && tail.length > 0 && tail.split(/\s+/).length <= 4) {
        return head;
      }
    }
  }
  return t;
}

/** Collapse whitespace and cap at 120 chars on a word boundary. */
export function capQuery(s: string, max = MAX_QUERY_LENGTH): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

export function firstWords(text: string, n: number): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, n)
    .join(" ");
}

/**
 * Auto-derive the target search query when the user did not supply one.
 * Priority: user query > <title> (site suffix stripped) > H1 >
 * meta description (first 8 words) > domain. Always capped at 120 chars.
 */
export function deriveQuery(opts: DeriveQueryOptions): QueryDerivation {
  const user = (opts.query ?? "").replace(/\s+/g, " ").trim();
  if (user) return { query: capQuery(user), querySource: "user" };

  const title = stripSiteSuffix((opts.title ?? "").replace(/\s+/g, " ").trim());
  if (title) return { query: capQuery(title), querySource: "auto" };

  const h1 = (opts.h1 ?? "").replace(/\s+/g, " ").trim();
  if (h1) return { query: capQuery(h1), querySource: "auto" };

  const md8 = firstWords(opts.metaDescription ?? "", 8);
  if (md8) return { query: capQuery(md8), querySource: "auto" };

  const domain = (opts.domain ?? "").replace(/\s+/g, " ").trim();
  if (domain) return { query: capQuery(domain), querySource: "auto" };

  return { query: "", querySource: "auto" };
}

/** Convenience wrapper: parse title/H1/meta out of raw HTML, then derive. */
export function deriveQueryFromHtml(
  html: string,
  opts?: { query?: string | null; domain?: string | null }
): QueryDerivation {
  const $ = load(html ?? "");
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  return deriveQuery({
    query: opts?.query,
    title: title || null,
    h1: h1 || null,
    metaDescription: metaDescription || null,
    domain: opts?.domain,
  });
}

/** Best-effort hostname extraction; null when the URL does not parse. */
export function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
