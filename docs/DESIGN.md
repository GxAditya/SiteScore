---
name: SiteScore
description: Check-run instrument landing for a live AI-search audit.
colors:
  run-green: "#5C7057"
  run-green-deep: "#4A5B46"
  run-ink: "#172116"
  chart-ink: "#101814"
  paper: "#F8FAF7"
  raised: "#FFFFFF"
  fail-coral: "#D97757"
  warn-amber: "#D97706"
  night: "#0E140F"
  night-raised: "#151D16"
typography:
  display:
    fontFamily: "Libre Franklin, Inter Tight, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Libre Franklin, Inter Tight, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter Tight, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Inter Tight, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.run-green}"
    textColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.run-green-deep}"
    textColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.run-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  run-row:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.run-ink}"
    rounded: "{rounded.lg}"
    padding: "14px 20px"
  status-pass:
    backgroundColor: "{colors.run-green}"
    textColor: "{colors.raised}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  status-fail:
    backgroundColor: "{colors.fail-coral}"
    textColor: "{colors.raised}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: SiteScore

## Overview

**Creative North Star: "The Green Build"**

Every surface is a check run being printed live. Paper ground, ink log type, one vertical run axis: the run trigger at top, the receipt below, the close at the end. Sage means pass and carries the run action. Coral marks a failing check and nothing else — priority is metadata in neutral ink, never a verdict color. There is no decoration to remove because none was added: hairline rules, status pills, tabular numerals, and whitespace do all the work.

Density is log-dense but paced: one document column (48rem) per viewport, 80px section separation, tight rows within. Headings speak without kickers. Motion is a single receipt stamp on scroll, guarded for reduced motion; everything else is instant and legible. Night is the same instrument after hours — deep ink ground, pale sage passes — never a different product.

**Key Characteristics:**
- One run column per viewport; the receipt is the page, not a picture of one.
- Mono is measurement only: check ids, statuses, microlines, footnotes.
- Status colors are verdicts: sage pass, amber warn, coral fail — priority tags stay neutral.
- Proof over claims: every number is measured by the product's own code or it does not ship.

## Colors

Sage-led instrument palette: ink carries the surface, sage signals pass and action, warm hues are verdicts only.

### Primary
- **Run Green** (#5C7057): primary actions, pass pills, healthy states. Carries the run trigger and the close action.
- **Run Ink** (#172116): body text and numerals on paper in light mode.
- **Paper** (#F8FAF7): page ground in light mode; sheets sit one step brighter (#FFFFFF).

### Secondary
- **Deep Sage** (#4A5B46): hover states, secondary text on paper that must still pass 4.5:1, placeholder text.
- **Pale Sage** (#D1EDD3): pass pill grounds in light mode, selection fill.

### Tertiary
- **Fail Coral** (#D97757): failing checks and nothing else. Never priority, never emphasis, never brand.
- **Warn Amber** (#D97706): warn rows only; the rarest color on the page.

### Neutral
- **Raised** (#FFFFFF): sheets, input panel, receipt rows in light mode.
- **Night** (#0E140F): page ground in dark mode.
- **Night Raised** (#151D16): sheets and rows in dark mode.
- **Hairlines** (sage-700 at 10–20% light, sage-300 at 10–15% dark): the only dividers used.

### Named Rules
**The Verdict-Color Rule.** Sage, amber, and coral are test verdicts. Priority tags, emphasis, and brand moments stay in neutral ink — a P1 is metadata, not a failure.
**The Daylight Rule.** Light or dark is picked from the use scene — an indie owner at a bright desk — so the default ground is paper, and night is the same instrument after hours, not a neon terminal.

## Typography

**Display Font:** Libre Franklin 700/800 (self-hosted via next/font, with Inter Tight fallback)
**Body Font:** Inter Tight (with system sans fallback — shared with the report UI)
**Label/Mono Font:** JetBrains Mono 400–700, tabular numerals (with ui-monospace fallback)

**Character:** A precise grotesk for headlines with instrument-tablet weight, the product's own workhorse sans for reading, and a mono that only ever speaks measurements.

### Hierarchy
- **Display** (800, clamp(2.25rem, 5vw, 3.75rem), 1.05, -0.025em): hero and close headlines only.
- **Headline** (700, clamp(1.5rem, 3vw, 2.5rem), 1.1): section titles; carry their own weight with no kicker above.
- **Title** (700, 0.9375rem, 1.4): fix titles and row emphasis.
- **Body** (400, 0.875rem, 1.6): reading copy; measure held near 65–75ch via 48rem column.
- **Label** (600, 0.6875rem, 0.14em, uppercase): check ids, statuses, microlines, footnotes — mono only.

### Named Rules
**The No-Kicker Rule.** No eyebrow label above any heading, ever. Run metadata lives in rules and footers, not above headlines.
**The Mono-Measures Rule.** Mono appears for ids, statuses, counts, and captions. Prose and promises are never set in mono.

## Layout

One 48rem run column on the vertical axis: hero trigger, receipt, readers table, close. The hero is headline, one subcopy line, and the full-width run trigger — nothing competes. Proof is a single receipt document, never a grid. Comparisons are real tables (560px minimum with scroll). Fixes are a plain list under the receipt. Sections separate by 80–112px with visibly more space above a heading than below it. Below 768px everything is already single-column; tables scroll with captions intact.

## Elevation & Depth

Depth is nearly absent by design: hairline borders declare every edge, and one soft shadow lifts only the hero input panel and primary sheets.

### Shadow Vocabulary
- **Builder lift** (`0 20px 40px -15px rgba(27, 33, 26, 0.12)`): hero input panel only.
- **Card rest** (`0 1px 2px rgba(15, 20, 15, 0.05), 0 4px 14px -8px rgba(15, 20, 15, 0.08)`): receipt container at rest.

### Named Rules
**The Border-First Rule.** Edges are 1px hairlines; shadows appear only on the run trigger panel. A 1px border under a wide soft shadow is the ghost card — this system never ships one.

## Shapes

Quiet survey corners: 16px receipt container, 12–16px input panel, pills only for small controls, statuses, and tags. No other geometry exists — no contours, no hatch, no gradients, no masks. The form language is the rule, the pill, and the row.

## Components

### Buttons
Confident and alone: one primary per sheet in Run Green with white bold text; hover deepens toward Deep Sage; press scales to 0.98; disabled drops to 40% (Audit disabled until the URL validates is correct state handling). Minimum touch height 44–48px on primary actions.
- **Shape:** 12px radius on the run trigger, pills on small actions
- **Primary:** Run Green bg (#5C7057) + white text, 12px 28px padding
- **Hover / Focus:** bg toward Deep Sage; visible 2px accent outline offset 2px on focus
- **Ghost:** 1px ink-at-25% bordered pill, hover fills sage-100

### Chips
Sample prompts: bordered pills, 12px semibold text, border firms and wash fills on hover. Labeled by a mono "Try live" key. Audit triggers, not decoration.

### Cards / Containers
The receipt: 16px radius container, 1px hairline border, raised ground, rows divided by 10%-opacity hairlines. No shadow stacking, no nested cards.
- **Corner Style:** container 16px, input panel 12–16px
- **Background:** raised ground, plain — texture never ships
- **Shadow Strategy:** rest shadow on the container; Builder lift on the hero panel only
- **Border:** 1px ink at 15–25%
- **Internal Padding:** 14–20px rows, 8–12px panel padding

### Inputs / Fields
The run trigger: raised panel with mono field label, large medium entry text, icon action, and a footer rule carrying the hint plus the query control.
- **Style:** 1px ink border, raised ground, 12–16px radius
- **Focus:** border firms to accent (no glow needed; the panel already lifts)
- **Error / Disabled:** coral border with inline recovery text under role=alert; disabled Audit at 40% until valid

### Navigation
Quiet instrument bar: sticky, surface with blur for legibility, brand left, plain semibold links center, API-keys pill plus theme disc right. Mobile collapses to actions only.

### Run Row
The signature component: status pill, mono check id, one evidence line citing a measured value. Pass in sage, warn in amber, fail in coral — text verdicts, never color alone.

### Readers Table
Real table with mono uppercase headers, aspect column in mono, browser column in secondary body, AI column in medium weight. Scrolls horizontally under 560px with an sr-only caption.

## Do's and Don'ts

Concrete guardrails from the built system.

### Do:
- **Do** print proof only from the product's own code paths, labeled with source URL, date, and scope — search rows and scores ship only from full runs.
- **Do** keep status colors as verdicts and priority tags neutral — a P1 is metadata, not a failure.
- **Do** give the hero to the audit box alone: headline, one subcopy line, trigger, microline.
- **Do** use the mono voice for ids, statuses, counts, and footnotes — tabular numerals always.
- **Do** theme browser surfaces from the palette: sage-tinted selection, scrollbars, focus rings, underline offsets.

### Don't:
- **Don't** put a kicker or eyebrow above any heading.
- **Don't** structure a section as same-size icon-plus-heading-plus-text cards, and don't split a comparison into two equal cards — log, table, or list instead.
- **Don't** invent testimonials, customers, benchmarks, pricing, scores, or probe results; the only numbers on the page are measured or labeled illustrative.
- **Don't** decorate: no contours, hatch, gradients, gradient text, glass, hard shadows, sparklines, or rings.
- **Don't** set prose in mono or use unicode glyphs and emoji as icons.
