# Landing Page Overhaul Implementation Plan

## Repository Research

**Current state:**
- Framework: Next.js 16 (App Router) + React 19 + TypeScript
- Styling: Tailwind CSS 4 with custom theme tokens in `app/globals.css`
- Animation: `motion/react` (Framer Motion v14) already installed
- Icons: `@phosphor-icons/react`
- Page structure lives entirely in `app/page.tsx` (single file, ~680 lines) — contains nav, hero, recent audits, "receipt" sample, "two readers" comparison, CTA, footer
- Hero input component at `components/HeroChatInput.tsx` — functional but visually utilitarian (hard box borders, monospace micro-copy, terminal aesthetic)
- Color palette already sage-based (good foundation — `--color-sage-*` + accent tokens mapped to sage)
- Surface tokens use flat `--surface`/`--surface-raised`/`--surface-sunken` with basic CSS variables for light/dark
- Existing typography uses "font-display" + monospace for labels — feels more CLI/dev-tool than premium product

**User requirements:**
1. Full visual overhaul — change everything from current version
2. Keep sage-based palette as primary (free to refine shades/tokens)
3. Keep the "chat input as hero CTA" concept — but redesign the input (current is "ugly")
4. Overhaul ALL section copy — replace jargon-heavy/terminal-style language with marketing/benefit-driven prose
5. Apple-like aesthetic: clean, minimal, spacious, production-grade
6. Tasteful animations and micro-interactions (not flashy)

## Files and Modules

| File | Expected Change |
|------|-----------------|
| `app/globals.css` | Refine design tokens: expand sage palette gradients, add translucent/glass surface variants, tweak typography tokens for premium feel, add Apple-like easing curves, new utility classes for glass/noise/subtle patterns |
| `components/HeroChatInput.tsx` | Full rewrite: Apple-inspired pill-shaped chat input with icon, graceful focus/hover states, animated submit button (spinner → check), refined sample prompts (chip style), inline hint text with better tone, remove monospace labels, add subtle depth/shadow transitions |
| `app/page.tsx` | Full rewrite (~95% of content changes): new nav (thinner, translucent, refined brandmark), restructure hero (centered, spacious, animated headline reveal, soft background gradient), rewrite all marketing copy (benefit-first, conversational), add new sections: (1) How it works (3-step), (2) Feature highlights (cards), (3) Sample report preview (premium card not terminal receipt), (4) "Why AI visibility" narrative (replace two-readers table), (5) Trust/signals strip, (6) Final CTA block. Apply scroll-triggered motion, section fade-ins, card hover-lift micro-interactions, refined footer |
| `lib/ui.tsx` | (If needed) Minor tweaks to BrandMark sizing / ThemeToggle polish to match new aesthetic |

## Implementation Steps

### Step 1 — Refine design tokens (`app/globals.css`)
- **Palette polish**: Keep the sage 50–950 scale but adjust mid-tones for more sophistication (make `sage-500`/`accent` a touch more muted and warm like Apple's "mint" meets forest). Add gradient tokens: `--gradient-hero` (sage-50 → surface soft radial), `--gradient-glow` (accent radial for focus states).
- **Surfaces**: Add `--surface-glass` (translucent with backdrop-blur), `--surface-elevated` (higher shadow tier), and tweak borders to use softer alpha-based colors instead of hard `--surface-border` where it makes sense (e.g., nav, cards).
- **Typography**: Widen the type scale — make display headlines slightly larger with tighter tracking, introduce `--tracking-display-tight` and improved leading. Keep `font-sans` as primary; de-emphasize monospace to only diagnostic UI (not marketing copy).
- **Motion**: Add `--ease-spring` (0.34, 1.56, 0.64, 1) for micro-bounces on button press, `--dur-hero` (600ms) for entry reveals. Keep `prefers-reduced-motion` honored.
- **Shadows**: Refine to a 5-tier scale (flat → card → lift → glow → modal) that feels closer to Apple's deep-but-soft shadows (more vertical offset, wider blur, lower opacity).
- **Radius**: Normalize around `12px` for cards, `999px` for pills/buttons/inputs, `8px` for secondary UI.
- **Utilities**: Add `.glass-card` (border + translucent bg + blur), `.text-gradient` (sage gradient text for headline accents), `.hover-lift` (transform + shadow transition).

### Step 2 — Redesign `HeroChatInput.tsx`
- **Shape & structure**: Single pill-shaped container (`rounded-full`) instead of a box. Integrated URL field + submit button in one unified shape.
- **Input area**: Globe icon prefix (left-aligned, muted sage tint), URL input with no visible label inside field (label moves to floating or sr-only). Placeholder: "Paste your URL — e.g., linear.app"
- **Submit button**: Sage-filled pill nested inside the main input container (right-aligned). Arrow right icon + "Audit" label. On click/submit: smoothly morph arrow to a `CircleNotch` spinner, then to check mark on success (if we can detect success from parent — or keep spinner during loading).
- **Focus/hover states**: Input container grows a soft sage glow ring (`shadow-accent-ring` + scale 1.005) on focus-within. Submit button darkens slightly on hover, presses down (scale 0.97) on active.
- **Hint row**: Below input, small 13px text with the URL validation hint — use regular font, not monospace. Color adapts: muted (idle/note), brick-600 (error).
- **Sample prompts**: Replace boxy buttons with rounded pill-chips (`px-4 py-1.5 rounded-full`). Label changes from "Try live" to more natural "Start with an example:". Chip hover = background darkens + slight lift.
- **Query input**: If visible (add target query), render as a secondary chip-style row below the main input with a search icon prefix and smooth expand animation.
- **Settings (Faders)**: Move from inside the input pill to a subtle icon-only button to the right of the sample prompts row (or keep as tiny icon inside right edge of pill if space allows on desktop).

### Step 3 — Rewrite `app/page.tsx` (full overhaul)
Preserve all **functional logic** unchanged (history/localStorage, runAudit, workspace state, settings modal). Replace only the rendered structure and copy.

#### 3.1 Nav (`header`)
- Height: 56px (from 56 — keep), background: `--surface-glass` with `backdrop-blur-xl` and 0.8 opacity border (not solid).
- Brandmark: Keep, but add 2px spacing + reintroduce wordmark with slightly increased weight tracking.
- Nav links: Replace "Receipt / Two readers / TinyFish docs" with "How it works / What you get / Docs". Smooth underline on hover.
- Right side: Move "API keys" button into ThemeToggle group as a subtle icon button (gear) or keep as small pill. If report exists, "Open report" button gets a chevron + smaller pill shape with more padding.

#### 3.2 Hero (`section`)
- **Background**: Soft sage radial gradient (center-top) + very subtle grid pattern (via `linear-gradient` lines or `.bg-grid` utility). Full-width with generous padding (`py-28 sm:py-36`).
- **Copy rewrite**:
  - Eyebrow: Replace "AI VISIBILITY AUDIT" with a benefit eyebrow — e.g. "Your page, as AI actually reads it."
  - Headline h1: Replace "What AI search actually fetches" with more Apple-like, emotional copy. Two-line center-aligned: "Make your site unmissable. For AI, too." (with "For AI, too." in `.text-gradient` sage tint).
  - Subhead p: Replace "Live HTML extraction… P0 fixes" with marketing prose: "Paste any URL. In under two minutes, SiteScore shows you exactly what AI search engines and assistants see — and exactly what to fix first, ranked by impact."
- **Layout**: Centered narrow column (max-w-2xl) for headline + subhead, then hero input sits below at max-w-xl centered.
- **Micro-animation**: On mount, headline animates up 12px → 0 with fade (motion), subhead staggers in 120ms later, input staggers 240ms later with a subtle scale(0.98)→1 pop.
- **Remove** the quick-stats module box (move stats to a separate trust bar below).

#### 3.3 Trust / Signals strip (new section, replaces quick stats box)
- Immediately under hero, bordered separator or full bleed. 4–5 stats:
  - "0–100 Score"
  - "14+ HTML checks"
  - "8 Search probes"
  - "Live in ~90s"
  - "No signup needed"
- Style: Pill chips or spaced items with dot dividers. Fade in on scroll.

#### 3.4 How it works (new section, replaces Recent Audits placement order)
- Headline: "Three steps. Zero complexity."
- Subhead: "SiteScore runs a live audit against your page — no screenshots, no synthetic mocks."
- 3-column grid (1-col mobile, 3-col sm+):
  1. **Paste your URL** — Step 1, icon (Globe), short copy.
  2. **We run live probes** — Step 2, icon (ChartBar/MagnifyingGlass), short copy.
  3. **Fix what matters** — Step 3, icon (CheckCircle/Sparkle), short copy.
- Visual: Each step is a `.glass-card` with hover-lift and a numbered badge in the top-right. Cards animate in on scroll (staggered left-to-right).

#### 3.5 Recent Audits (if history.length > 0)
- Keep functionality, but style as cards instead of a harsh table. Each entry: rounded card, score displayed as a soft sage pill with large numerals, URL + date, buttons restyled as subtle icon buttons + "Rerun" pill.
- Title replaces "RECENT AUDITS" (mono, uppercase) with "Recent runs" — regular font weight.

#### 3.6 What you get (replaces "A run receipt, printed just now.")
- **Headline**: "Everything you need. Nothing you don't."
- **Subhead**: "A single report with prioritized fixes — so you can stop guessing and start shipping."
- **3 feature cards** (grid, each `.glass-card` with hover-lift + icon):
  1. **A clear, honest score** — 0–100 with grade letter. See exactly where you stand at a glance.
  2. **Evidence, not opinions** — Every check links to the raw HTML. No vague "improve SEO" advice.
  3. **Prioritized fixes first** — P0, P1, P2 ranked by impact on AI visibility. Ship the changes that move the needle.
- **Then**: A sample report preview. Instead of the terminal-style `RECEIPT_CHECKS` list, show a single premium card (sample audit) with:
  - Top: Sample URL header (tailwindcss.com) with score "78" + grade "B" in a badge.
  - Middle: 3 check-rows (pass/warn/fail) each with a clean icon, check title, and short evidence.
  - Bottom: A "3 suggested fixes" strip with priority labels.
  - Style: rounded, white (raised), soft shadow, subtle internal dividers.
- CTA button below: "Run your URL" → scrolls to hero input.

#### 3.7 Why AI visibility matters (replaces "Two readers. Only one cites you.")
- **Headline**: "Browsers see pixels. Assistants read code."
- **Subhead**: "The thing building your next customer's answer isn't scrolling your hero carousel."
- Replace the table with a side-by-side narrative (two `.glass-card`s).
  - Left card (Browser): List 3 bullet points (with check icons) of what browsers care about (visual layout, speed, backlinks).
  - Right card (AI Reader): List 3 bullet points (with warning/fire icons) of what AI readers care about (structured data, alt text, no timeout/login walls, canonical URLs).
- Or use a single comparison grid with icons instead of a raw `<table>`. Animate both cards sliding in from opposite sides on scroll.

#### 3.8 Final CTA block
- **Headline**: "See what AI sees. In two minutes."
- **Subhead**: "Free to run. No signup, no credit card, no watermarks."
- **Buttons**:
  1. Primary: "Start an audit" → `href="#audit"` (or scroll to hero input). Sage-filled, pill-shaped, arrow right.
  2. Secondary: "Read the docs" → TinyFish docs, outlined pill, external link icon.
- Wrap the whole block in a soft sage gradient card that pops from the page background.

#### 3.9 Footer
- Simplify. Logo + wordmark left, "Built with TinyFish Search + Fetch" right, link to Docs. Remove monospace micro-copy. Add a subtle "© 2026 SiteScore" if needed. Center on mobile, split on desktop.

### Step 4 — Polish micro-interactions and motion (across page)
- All section titles: `motion.div` with `initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, ease: "easeOut" }}`.
- Cards: `hover={{ y: -4, transition: { duration: 0.2 } }}` — lift on hover.
- Buttons: `whileTap={{ scale: 0.97 }}` — press effect.
- Links: Underline from center on hover (or subtle color shift + translateX).
- Scroll-triggered staggering for feature grids.
- Sample report check-marks "pop in" with a delay per row.

### Step 5 — Validate
- `npm run build` — TypeScript + build errors resolved.
- `npm run dev` start dev server.
- Browser check: nav, hero input (focus/hover/validation), all sections visible, dark mode toggle works, recent audits renders if history present, motion respects reduced preference.
- Open preview and verify Apple-like clean/minimal aesthetic.

## Dependencies and Considerations
- **No new packages needed** — Already have `motion/react` (Framer Motion), Phosphor icons, Tailwind 4. All animation/styling achievable within existing deps.
- **Functional behavior must be preserved**:
  - `runAudit()` flow (idle → loading → success/error)
  - LocalStorage history read/write/clear
  - `SettingsModal` open/close and BYOK key passthrough
  - `BuilderWorkspace` open/close when audit runs
  - Keyboard shortcuts (Enter to submit)
  - URL validation (`hintFor()`) — keep logic, update copy tone.
- **Copy changes must be self-contained**: Do not touch lib/analyze, api/audit, or any non-landing files.
- **Dark mode**: All new color references must use the existing `--var()` tokens so `.dark` class continues to work. Test both modes.
- **Accessibility**: Keep aria-labels, sr-only labels, `focus-visible` rings, keyboard order intact.
- **Responsive**: Test md+ (nav links show), sm (stacked), xs (hero input fits, chips wrap).

## Validation
1. **Static**: `npm run build` exits 0 (no TS, ESLint, or Next build errors).
2. **Runtime**: `npm run dev` loads on `localhost:3000` without console errors.
3. **Visual check (via browser preview)**:
   - Hero headline/subhead centered + styled with gradient accent
   - HeroChatInput: pill-shaped, unified container, focus glow, sample prompt chips
   - All section copy rewritten (no "RECEIPT", no mono section titles, no "Two readers table jargon")
   - Feature cards, sample report card, how-it-works steps all present
   - Sage color is primary throughout; buttons, links, accents match
   - Hover: cards lift, buttons press, links highlight
   - Motion: sections fade/translate-in on scroll (staggered), hero enters staged
   - Dark mode: Toggle works, all tokens shift correctly
   - Workspace still opens correctly after pasting URL + submit
4. **Functional regression**: Run an audit (or submit a URL) — workspace opens, loading stage works, no runtime crash. Clear/remove history works.

## Risks
| Risk | Handling / Fallback |
|------|---------------------|
| ~680-line `page.tsx` rewrite could introduce a subtle functional regression in history/audit flow | Keep all state variables, hooks (`useSyncExternalStore` for history), and `runAudit` function 100% verbatim. Only change JSX inside returns. Copy JSX carefully and diff after. |
| `.dark` mode new classes / tokens might not map | Every new color reference uses `var(--surface-*)` / `var(--text-*)` / `var(--accent-*)` already defined in both `:root` and `.dark`. Avoid raw hex in new components/classes. Test dark mode before declaring done. |
| Hero input pill shape might feel cramped on mobile | Use responsive sizing: on `<sm` pad tighter, reduce icon sizes, sample prompts wrap to 2 rows. Input `min-h-[56px]` on md, `min-h-[52px]` on sm. |
| Motion too heavy / not tasteful | Keep all translate animations < 24px, durations 200–600ms, easeOut. Only stagger 3+ item grids, max 80ms per item. Honor `prefers-reduced-motion` via Framer's `useReducedMotion` (already imported) and disable whileInView animations when true. |
| Design tokens in globals.css break BuilderWorkspace (non-landing) UI | Keep existing token names and values stable. Only **add** new tokens (glass, gradients, refined shadows); do not **change** the raw values of `--surface`, `--text`, `--accent` by more than a small perceptual tweak. If adjusting core sage mid-tone, verify it in both modes against existing panels. |
