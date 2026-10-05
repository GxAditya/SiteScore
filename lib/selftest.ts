/**
 * SiteScore audit-engine self-test.
 * Run:  npx -y tsx lib/selftest.ts   (or: node lib/selftest.ts on Node ≥22)
 * Checks: good page outscores thin page, ≥5 fixes each, every fix `why`
 * cites a measured value, query derivation works, scoring is deterministic.
 */
import assert from "node:assert/strict";
import { runAuditEngine } from "./index.js";
import { deriveQuery } from "./derive-query.js";
import { scoreFromChecks } from "./score.js";

const GOOD_MD =
  "Sourdough bread baking is a slow fermentation craft that rewards patience with deep flavor and an open crumb. " +
  "This complete beginner guide walks through starter maintenance, dough mixing, bulk fermentation, shaping, and baking in a home oven. ";
const goodMarkdown = Array(70).fill(GOOD_MD).join(" "); // ~2000+ words

const GOOD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<title>The Complete Beginner Sourdough Bread Baking Guide</title>
<meta name="description" content="Learn sourdough bread baking from starter to loaf: mixing, bulk fermentation, shaping and baking schedules for beginners.">
<link rel="canonical" href="https://example.com/sourdough-guide">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<meta property="og:title" content="The Complete Beginner Sourdough Bread Baking Guide">
<meta property="og:description" content="From starter to loaf: schedules, ratios and shaping for beginners.">
<meta property="og:image" content="https://example.com/og-sourdough.png">
<meta name="author" content="Jane Baker">
<meta property="article:published_time" content="2026-03-01">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Sourdough guide"}</script>
</head>
<body>
<h1>Sourdough Bread Baking for Beginners</h1>
<h2>Maintaining your starter</h2><p>Feed daily…</p>
<h2>Mixing and bulk fermentation</h2><p>Autolyse…</p>
<h2>Shaping and baking</h2><p>Score and bake…</p>
<img src="/crumb.jpg" alt="Open sourdough crumb with air holes">
<img src="/starter.jpg" alt="Bubbly sourdough starter in a jar">
<a href="/flour-guide">Flour guide</a><a href="/schedule">Schedule</a><a href="https://example.com/tools">Tools</a>
</body>
</html>`;

const THIN_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="robots" content="noindex, nofollow">
</head>
<body>
<h2>Welcome</h2>
<h2>More</h2>
<h2>Even more</h2>
<img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg">
</body>
</html>`;
const thinMarkdown = "Welcome to our page. Contact us for more info today. ".repeat(6); // ~60 words

const good = runAuditEngine({
  url: "https://example.com/sourdough-guide",
  finalUrl: "https://example.com/sourdough-guide",
  html: GOOD_HTML,
  markdownText: goodMarkdown,
  latencyMs: 900,
  author: "Jane Baker",
  publishedDate: "2026-03-01",
  siteResults: [
    { url: "https://example.com/sourdough-guide", title: "Sourdough guide", snippet: "Sourdough bread baking beginner guide", position: 1 },
  ],
  rankingResults: [
    { url: "https://example.com/sourdough-guide", title: "The Complete Beginner Sourdough Bread Baking Guide", snippet: "Learn sourdough bread baking from starter to loaf for beginners", position: 1, site_name: "Example" },
    { url: "https://rival.com/sourdough", title: "Sourdough basics", snippet: "bread baking", position: 2, site_name: "Rival" },
  ],
});

const thin = runAuditEngine({
  url: "http://example.com/thin?utm_source=x",
  finalUrl: "https://other-cdn.net/thin",
  html: THIN_HTML,
  markdownText: thinMarkdown,
  latencyMs: 9200,
  siteResults: [],
  rankingResults: [
    { url: "https://rival.com/sourdough", title: "Sourdough basics", snippet: "bread baking guide", position: 1 },
    { url: "https://rival2.com/bread", title: "Bread guide", snippet: "baking bread", position: 2 },
    { url: "https://rival3.com/loaf", title: "Loaf guide", snippet: "how to bake", position: 3 },
    { url: "https://rival4.com/crust", title: "Crust tips", snippet: "crusty bread", position: 4 },
  ],
  fetchError: "empty_content",
});

// 1. Score ordering + sane bands
assert.ok(good.scores.total > thin.scores.total, `good (${good.scores.total}) should outscore thin (${thin.scores.total})`);
assert.ok(good.scores.total >= 70, `good page should score ≥70, got ${good.scores.total}`);
assert.ok(thin.scores.total < 50, `thin page should score <50, got ${thin.scores.total}`);

// 2. ≥5 fixes on both, ordered P0→P2
for (const [name, r] of [["good", good], ["thin", thin]] as const) {
  assert.ok(r.fixes.length >= 5, `${name}: expected ≥5 fixes, got ${r.fixes.length}`);
  const order = { P0: 0, P1: 1, P2: 2 } as const;
  for (let i = 1; i < r.fixes.length; i++) {
    assert.ok(
      order[r.fixes[i].priority] >= order[r.fixes[i - 1].priority],
      `${name}: fixes not ordered P0→P2 at index ${i}`
    );
  }
  // 3. Every fix cites a measured value (digit) and ships code snippets
  for (const f of r.fixes) {
    assert.match(f.why, /\d/, `${name}: fix "${f.title}" cites no measured value: ${f.why}`);
    assert.ok(f.how.length > 20, `${name}: fix "${f.title}" has no actionable how`);
    assert.ok(f.codeBefore.length > 0 && f.codeAfter.length > 0, `${name}: fix "${f.title}" missing code snippets`);
  }
  // 4. Every check evidence cites a measured value
  for (const c of r.checks) {
    assert.match(c.evidence, /\d/, `${name}: check ${c.id} evidence cites no value: ${c.evidence}`);
  }
}

// 5. Query derivation
const d1 = deriveQuery({ query: "  best sourdough recipe  " });
assert.deepEqual(d1, { query: "best sourdough recipe", querySource: "user" });
const d2 = deriveQuery({ title: "Best Sourdough Recipe for Beginners | King Arthur Baking", h1: "H1", metaDescription: "meta words here", domain: "example.com" });
assert.equal(d2.query, "Best Sourdough Recipe for Beginners");
assert.equal(d2.querySource, "auto");
assert.ok(d2.query.length <= 120, "derived query capped at 120 chars");
const d3 = deriveQuery({ title: "", h1: "", metaDescription: "", domain: "example.com" });
assert.equal(d3.query, "example.com");

// 6. Determinism: identical input → identical output
const again = runAuditEngine({
  url: "https://example.com/sourdough-guide",
  finalUrl: "https://example.com/sourdough-guide",
  html: GOOD_HTML,
  markdownText: goodMarkdown,
  latencyMs: 900,
  author: "Jane Baker",
  publishedDate: "2026-03-01",
  siteResults: [
    { url: "https://example.com/sourdough-guide", title: "Sourdough guide", snippet: "Sourdough bread baking beginner guide", position: 1 },
  ],
  rankingResults: [
    { url: "https://example.com/sourdough-guide", title: "The Complete Beginner Sourdough Bread Baking Guide", snippet: "Learn sourdough bread baking from starter to loaf for beginners", position: 1, site_name: "Example" },
    { url: "https://rival.com/sourdough", title: "Sourdough basics", snippet: "bread baking", position: 2, site_name: "Rival" },
  ],
});
assert.deepEqual(scoreFromChecks(again.checks), good.scores);
assert.deepEqual(again.checks, good.checks);

// ---- Example output ----
console.log("GOOD:", JSON.stringify(good.scores), `checks=${good.checks.length} fixes=${good.fixes.length} query="${good.query}"(${good.querySource})`);
console.log("THIN:", JSON.stringify(thin.scores), `checks=${thin.checks.length} fixes=${thin.fixes.length} query="${thin.query}"(${thin.querySource})`);
console.log("THIN top fix:", `[${thin.fixes[0].priority}] ${thin.fixes[0].title} :: ${thin.fixes[0].why}`);
console.log("LINK:", thin.connection.correlation);
console.log("SELFTEST PASS");
