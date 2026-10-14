# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: indie site owners, solo founders, and bloggers. Situation: they publish on the open web and suspect AI answers (Perplexity, SearchGPT, Gemini, assistants) skip or mis-cite them. Job: paste a live URL and learn in one run whether AI tools can read, index, and cite the page — and what to fix today.

## Product Purpose

SiteScore audits whether AI search and fetch tools can actually read and understand a live page, and how that ties to SEO and ranking. Success is an audit a site owner can act on the same day: a 0–100 score with concrete P0 fixes citing measured values (lengths, counts, URLs), not generic tips.

## Positioning

Unlike traditional SEO checkers that score static HTML and backlinks, SiteScore probes the AI-reading path live: TinyFish Fetch (HTML + Markdown, ttl=0) for what an agent extracts, plus TinyFish Search (site: indexation + natural query ranking) for whether the page surfaces. The engine is deterministic; an optional Gemini summary is an extra, never the audit.

## Operating Context

Single-page Next.js app: landing form → 2-panel BuilderWorkspace report. Workflow: enter URL (+ optional target query) → live audit up to ~2 min → Overview / Fixes / Visibility / Readability / Evidence tabs. Recent audits persist locally (5, localStorage, one-click re-run). Export as Markdown, JSON, print. BYOK keys in Advanced/Settings modal, never persisted. Deployed on Vercel Hobby free.

## Capabilities and Constraints

- Confirmed functionality: POST /api/audit {url, query?, tinyfishKey?, llmKey?, llmProvider?}; 2 Fetch + 2 Search calls per audit; no-store, ttl=0, live pages only; private hosts blocked; deterministic rule engine in lib/ (analyze → score → fixes → connect).
- Landing must drive one action: run an instant audit with lowest friction. Hero carries the audit box only — no competing proof block. Audit flow, report tabs, history, dark mode, and API contract stay intact; landing copy and sections are free to restructure.
- Technical constraints: Next.js 14 App Router + TypeScript + Tailwind v4; free-tier TinyFish limits (Search 30 req/min, Fetch 150 URLs/min); 120s server maxDuration, 150s client abort.
- Undecided: target-query derivation UX beyond auto-derivation; pricing/positioning claims.

## Brand Commitments

Name: SiteScore — AI Search Auditor. Voice: direct, technical, proof-led. User-pinned constraint: keep the sage-led color palette; additions/deletions/replacements allowed only to fix it. Round 2 learning (confirmed): no imported metaphors in copy — the page speaks in the product's own world (fetch, extraction, indexation, checks, fixes). No eyebrow kickers over headings.

## Evidence on Hand

- Real: PRD.md (requirements 1–8), README.md setup/API/troubleshooting, tasks.md contract shape, QA.md test matrix, lib/ engine + selftest, app/api/audit/route.ts live ttl=0 + no-store.
- Live proof: actual audit output for any public URL (score, fetch markdown/HTML diff, search probes, latencyMs, fetchedAt Live badge).
- Absences future work must not fabricate: no testimonials, customers, benchmarks, pricing, or ranking guarantees. Sample numbers on the landing must come from a real audit run, labeled with URL and fetch date — never invented.

## Product Principles

1. Live proof over claims — every finding cites a measured value from a real fetch or search probe.
2. One paste to value — the fastest path from URL to actionable fix wins over explanation.
3. Deterministic first, LLM second — rules decide the score; AI summaries never override them.
4. Same-day fixable — prioritize blocking readability/indexation failures with copy-paste prompts.
5. Private by default — keys in memory only, history local only, no server-side caching.

## Accessibility & Inclusion

Known: labeled inputs with inline help, polite loading announcements, role=alert errors, keyboard-navigable report tabs, persisted dark mode with no flash, prefers-reduced-motion respected. No product-specific standard beyond WCAG-minded defaults.
