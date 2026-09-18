# RTL readiness of claude.ai's shipped CSS: measurements and a migration path

**Audience:** anyone working on right-to-left support for claude.ai or for comparable Tailwind-based applications.
**Source of all facts:** the publicly served CSS bundles of claude.ai, snapshot taken 2026-09-18 (this revision replaces the 2026-09-02 figures of the first edition; what moved between the two is summarized under *Current state*).
**Produced by:** the open-source project [claude-ai-arabic-chrome](https://github.com/al-ashalash/claude-ai-arabic-chrome), a Chrome extension that Arabizes the claude.ai interface, with analysis tooling written with Claude Code.

---

## Why this document exists

An extension that gives claude.ai an Arabic, right-to-left interface has to solve the same problem a native RTL rollout would: identify every direction-dependent style in the shipped CSS and provide its mirror. We built a parser and generator that does this automatically, and in the process produced a complete, measured inventory of the direction debt in the current bundles. That inventory — and what an automated pass proved is mechanically fixable — seems more useful shared than kept.

The headline is encouraging: the codebase is already mid-migration. Of the 1,992 direction-dependent declarations shipped today, **838 (42%) are already logical properties** (`margin-inline-start`, `border-start-start-radius`, …), the CDS design system already ships `:dir(rtl)` rules and `rtl:` variant utilities that activate the moment `dir="rtl"` is set on the root, and 88% of the remaining physical declarations convert to logical equivalents by mechanical class-level rewriting. Finishing the migration would make native RTL support nearly free.

## Current state

Bundles analyzed (2026-09-18, hashed names as served that day). The inventory tables in this section keep the same four bundle roles as the first edition of this document (2026-09-02), so every comparison is like-for-like; four lazily loaded sheets found this time are listed after the table.

| File | Bytes | Rules | Physical decls | Logical decls |
|---|---:|---:|---:|---:|
| `c6a992d55-BWCo8uYN.css` (main app, Tailwind v4) | 1,333,734 | 11,543 | 1,043 | 834 |
| `shared-styles-BIknQx1U.css` (CDS design system + hand-written components) | 80,075 | 630 | 111 | 4 |
| `cc2f6279b-BLcf6DLy.css` (byte-identical to 2026-09-02), `shared-frame--1WLhtwS.css` | 416 + 203 | 3 | 0 | 0 |
| **Total** | | **12,176** | **1,154** | **838** |

12,176 rules, 19,393 declarations overall. Cascade layers, in order (unchanged since 2026-09-02): `properties`, `cds-card`, `theme`, `base`, `components`, `utilities`.

Four further stylesheets are loaded lazily by route or feature. They were surfaced this time by grepping the entry script and its 53 preloaded chunks (the 2026-09-02 pass sampled six chunks and missed them):

| File | Bytes | What it is | Physical decls | Logical decls |
|---|---:|---|---:|---:|
| `c19e90103-B6esh4pG.css` | 8,402 | markdown renderer (`epitaxy-markdown`), split out of the main bundle | 6 | 17 |
| `cf1a02a1a-DdTz_5PL.css` | 26,372 | KaTeX (third-party) | 29 | 0 |
| `c49d37e5f-C9zUtDE0.css` | 6,413 | onboarding component (CSS modules) | 4 | 0 |
| `cbd6c85c8-U_Wl89zJ.css` | 5,004 | mobile-upsell component (CSS modules) | 6 | 0 |

They carry no `@layer`, no `:dir()` rule and no `rtl:` variant. They are **excluded** from the four-role inventory tables in this section and **included** in the generator's input under *What an automated pass proves*; all eight files together hold 12,595 rules, 20,474 declarations, 1,199 physical and 855 logical declarations (41.6% logical).

The 1,154 physical (direction-dependent, left/right-anchored) declarations by property:

| Property | Decls | | Property | Decls |
|---|---:|---|---|---:|
| `transform: translateX(…)` | 178 | | `inset` (directional) | 11 |
| `padding-left` | 141 | | `border-right-width` | 10 |
| `margin-left` | 125 | | `border-left-color` | 9 |
| `padding-right` | 114 | | `border-right-style` | 9 |
| `left` | 112 | | `text-align: left\|right` | 6 |
| `right` | 102 | | gradients `to left\|right` | 5 |
| `margin-right` | 92 | | `float: left\|right` | 4 |
| `border-top-left-radius` | 45 | | `direction` | 3 |
| `border-top-right-radius` | 42 | | `box-shadow` (h-offset) | 3 |
| `border-bottom-left-radius` | 38 | | `border-left` (shorthand) | 3 |
| `border-bottom-right-radius` | 34 | | `border-right` (shorthand) | 2 |
| `border-radius` (asymmetric) | 34 | | `border-right-color` | 1 |
| `border-left-style` | 15 | | `object-position: left\|right` | 1 |
| `border-left-width` | 15 | | | |

(`clear: left|right`, one declaration on 2026-09-02, is gone: the bundle's only `clear` is now `inline-start|end`.)

Where the debt lives: the physical debt concentrates in older Tailwind utilities (`ml-*`, `pl-*`, `left-*`, `rounded-l-*`, `border-l-*`, …) in the main bundle, and in a handful of hand-written components that ship in `shared-styles` (111 physical declarations there against 4 logical — 41 of them bare `left`, only 5 corner radii, and 85 of the 111 in one component family, `dframe-*`/`df-*`). Note that `shared-styles` itself carries no `@layer`, no `:dir()` rule and no `rtl:` variant: the CDS rules that already handle RTL are compiled into the main bundle. The heaviest single classes:

| Class | Physical decls | Sample |
|---|---:|---|
| `.dframe-root` | 41 | `left: calc(var(--df-trigger-right, 180px) + 8px)` |
| `.df-session-list` | 10 | `margin-left: 4px` |
| `.sheet-card-hash` + `.sheet-card-zip` (the `sheet-card-*` family holds 15) | 7 | `left: var(--sheet-card-x, 0px)` |
| `.tiptap` | 4 | `float: left`, `direction`, `padding-left` |
| `.epitaxy-root` | 3 | `padding-left: 20px`, asymmetric `border-radius` |
| `.dframe-pane-drag-label` | 3 | `left: 0`, `transform` |

(`.epitaxy-root` carried 7 on 2026-09-02; its markdown rules now ship in the lazily loaded `epitaxy-markdown` sheet, which is logical-first — 17 logical declarations against 6 physical.)

Note the custom-property pattern: `--df-trigger-right` and `--sheet-card-x` carry *physical semantics in their values*, set from JS. These are the cases a CSS-only pass cannot fix (see recommendations 2–3). The contract is starting to turn, though: every direction-bearing `--df-*` name introduced since 2026-09-05 is logical (`--df-reveal-end`, `--df-chrome-bar-pad-start`, `--df-chrome-bar-end-gutter`) — the one physical-named newcomer, `--df-dot-x`, is the indicator-mask property that is re-resolved under `:dir(rtl)` (see below) — the logical names already in place are the ones growing (`--df-leading-slot` 21 → 33 uses, `--df-pane-trailing-gutter` 10 → 16, `--df-content-gutter-start` 11 → 14 between 2026-09-05 and 2026-09-18), and the physical ones (`--df-trigger-right`, `--df-collapsed-left`, `--df-sidebar-left`) barely moved.

**What changed since 2026-09-02.** Three snapshots of the same four bundle roles — 2026-09-02, 2026-09-05 and 2026-09-18 — put the logical share of direction-dependent declarations at 42.0%, 41.4% and 42.1% (721 of 1,718; 723 of 1,745; 838 of 1,992), or 30.1% → 31.7% counting inline-axis properties only. The share is static: nothing in the existing physical-utility stock has been codemodded, and both stocks grew in step with a main bundle 24% larger by bytes (physical +157, logical +117 in sixteen days; the biggest physical movers are the codemod-able `margin-*`/`padding-*` utilities and `translateX`, and the hand-written `dframe` family, `.dframe-root` 34 → 41). What moved is the quality of new code: direction-conditioned rules went from 8 to 28, the first `ltr:` variants and direction-aware custom properties appeared, the bundle's only `clear` became logical, the inline-axis logical longhands grew fastest (`margin-inline-end` +18, `margin-inline-start` +14, `padding-inline-end` +14), and roughly half of the utility classes added between 2026-09-05 and 2026-09-18 are logical (60 of 118 by our count) against a stock that is 24% logical. Two regressions worth naming: `shared-styles` lost logical declarations (9 → 4), and the two new CSS-modules components in the lazily loaded sheets are authored entirely physically — code a Tailwind-utility lint would not see.

## The mapping table

Every physical pattern in the bundle has a logical equivalent, with two caveats noted below. Browser support for everything in this table is universal in evergreen browsers as of 2026 (the newest entry, `float: inline-start`, landed in Chrome 118, October 2023).

| Physical (as shipped) | Logical equivalent |
|---|---|
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `border-left-{width,style,color}` | `border-inline-start-{width,style,color}` |
| `border-right-{width,style,color}` | `border-inline-end-{width,style,color}` |
| `border-left` / `border-right` (shorthand) | `border-inline-start` / `border-inline-end` |
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |
| `border-radius` (asymmetric 4-corner shorthand) | four `border-*-*-radius` longhands (no logical shorthand exists) |
| `inset` (shorthand, directional values) | `inset-block` + `inset-inline` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `float: left` / `right` | `float: inline-start` / `inline-end` (Chrome 118+) |
| `clear: left` / `right` | `clear: inline-start` / `inline-end` |
| `object-position: left` / `right` | no logical keyword yet; pair with a `:dir(rtl)` override |
| `linear-gradient(to left\|right, …)` | no logical direction yet; pair with a `:dir(rtl)` override |
| `transform: translateX(…)` | no logical transform; negate the X value under RTL (see lessons below) |
| `box-shadow` horizontal offset | no logical form; usually acceptable unmirrored (no layout impact) |

The Tailwind side of the same table — all available since Tailwind v3.3, and in the v4 the site already uses:

| Physical utility | Logical utility |
|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `rounded-l-*` / `rounded-r-*` / corner forms | `rounded-s-*` / `rounded-e-*` / `rounded-ss-*` etc. |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |

## What is already RTL-ready in the bundle

This is not a greenfield problem; the bundle already contains deliberate RTL work:

- **Eighteen `rtl:` and six `ltr:` variant utilities** (seven `rtl:` and no `ltr:` on 2026-09-02), compiled by Tailwind to `:where(:dir(rtl),[dir=rtl],[dir=rtl] *)` guards. The original seven are all still there — `rtl:-scale-x-100`, `rtl:[--_meter-dir:1]`, two `rtl:…:-translate-x-full` sheet-closing variants, `rtl:…translate-x-full` for drilled sheets, and two `rtl:motion-safe:animate-[cds-slide-in-start|end…]` animations — and the seventeen added since cover scroll-edge fade masks (`ltr:`/`rtl:scroll-fade-hide-left|right`, toggling `--cds-scroll-fade-left|right-on`), `transform-origin` (`ltr:origin-left` / `rtl:origin-right`), `background-position` corners for table headers (`[&_th:first-child]`/`[&_th:last-child]` pairs) and for first/last children (`ltr:first:`/`rtl:last:`), pinned-row shadows (`rtl:shadow-[calc(var(--spacing)*±2)_0_0_0_…]`), a comment-card gradient (`rtl:bg-[linear-gradient(to_left,…)]`), sheet enter/exit translation (`rtl:data-[ending-style]:translate-x-full`) and a mirrored `clip-path`. The keyframes themselves are named logically (`cds-slide-in-start` / `cds-slide-in-end`).
- **A native `:dir(rtl)` rule for CDS composer attachments** (`.cds-root [data-cds-composer-attachments] [data-cds-attachment]:where(:dir(rtl),[dir=rtl] *)`, compiled into the main bundle), plus three `[&:dir(rtl)]` rules — new since 2026-09-02 — that re-resolve the indicator-mask properties `--btn-dot-x`, `--df-dot-x` and `--seg-dot-x` for RTL while their consumer (`mask-image: radial-gradient(circle at var(--btn-dot-x) …)`) stays untouched. That makes 28 direction-conditioned rules in the bundle, up from 8.
- **Arbitrary `[direction:ltr]` / `[direction:rtl]` utilities** used to pin direction on specific islands.
- **838 already-logical declarations**, led by `padding-inline` (146), `padding-block` (123), `margin-inline` (88), `margin-block` (80), and including the full logical corner-radius family — and, new since 2026-09-02, the bundle's first `float: inline-start|end` and `clear: inline-start|end` sites and its first `border-inline-start-color`.

All of these activate correctly the moment `dir="rtl"` is set on the document root. Nothing new needs to be invented — the existing patterns just need to be finished.

## What an automated pass proves

Our generator parses the shipped bundles (preserving `@layer` / `@media` context), classifies every declaration, and emits a logical-property override sheet. Its input is all eight files — the four bundles of the inventory tables plus the four lazily loaded sheets — so the totals below are eight-file totals (the lazy sheets contribute 45 of the 1,199 physical declarations). Results on the 2026-09-18 snapshot:

- **1,059 physical declarations auto-flipped** into logical-property overrides, deduplicated, with no human intervention — 88% of the 1,199 the inventory counts across the eight files (the four core bundles alone give the same ratio: 1,011 of 1,154). Generation plus validation runs in well under a second.
- **Only 26 declarations are structurally unflippable** by class-level rewriting, each disclosed with a reason code:
  - 19 shorthands whose value contains a **bare `var()`** — the space-toggle idiom (e.g. `--_prose-noscope`, declared as a lone space) means a bare `var()` may legally resolve to whitespace, so both `calc(… * -1)` negation and slot-expansion of the shorthand are unsafe (a space toggle makes even the shorthand's *value count* untrustworthy),
  - 3 `transform` values: one chain composing translation with rotation (rotation does not commute, so flipping only the translation yields neither the original nor its mirror) and two translations passing a bare `var()` (`--df-pop-x`, `--df-phone-sheet-drag`), unsafe to negate for the same space-toggle reason,
  - 3 standalone `translate` values passing a bare `var()`,
  - 1 `box-shadow` with a horizontal offset (deliberately skipped: shadows have no layout impact).

  The generator discloses one further class under a reason code of its own: 46 gradients drawn at an explicit angle (`linear-gradient(120deg, …)` and the like). The inventory does not count these as physical, and no class-level rewrite can mirror an angle; they belong with the author-side `:dir(rtl)` counterparts of recommendation 4.
- The remaining ~114 are horizontally symmetric values needing no flip (the tilde: this is the inventory count less the flipped and unflippable sets, and the two classifiers draw the edge of "physical" slightly differently). Separately, 27 animation blocks carrying literal x-translations — 26 `@keyframes` (25 in the main bundle, one in `shared-styles`) plus one `@starting-style` entry transition in the main bundle, none in the lazy sheets — are counted and disclosed rather than flipped — animations belong to author-side `rtl:` variants, and the bundle's own `cds-slide-in-start/end` naming is exactly the right pattern.
- Output: a 540 KB stylesheet in four precedence bands — 822 neutralizer rules, 2,825 logical-replacement and identity rules, verbatim boosted copies of all 22 of the site's own RTL-conditioned rules (so the author's explicit `rtl:` values always beat the mechanical flips on elements that carry both; the site's six `ltr:` rules are left untouched), and 112 `!important`-carrying overrides in an early-declared cascade layer — that mirrors the entire application, lazily loaded sheets included.

The point of these numbers: **the migration is overwhelmingly mechanical.** A codemod over utility class names plus a small hand-audit of the 26 exception sites (and the 46 angled gradients) covers the stylesheet side entirely.

## Design lessons from running this in production

1. **Logical properties beat selector-mirroring.** The rtlcss-style approach (generate `[dir=rtl] .foo { margin-right: … }` mirrors) breaks inside embedded LTR content. With logical properties, the *same* declaration resolves correctly everywhere: inside `direction: ltr` islands (`code`, `pre`) and inside `dir="auto"` paragraphs that Unicode-resolve to LTR (English text in a chat), the override renders back to the original LTR layout with zero special-casing. Correctness is emergent from the browser's own direction resolution — there is no second codepath to maintain.

2. **Order alone cannot sequence an override sheet — specificity must be flattened first.** Our first design put all physical neutralizers (`margin-left: unset` etc.) before all logical replacements and relied on source order; adversarial testing refuted it, because the site's selectors span specificities from `(0,1,0)` utilities to `(0,9,1)` components, and specificity resolves before order. The working design wraps every original selector in `:where()` (zeroing its specificity) and encodes our own precedence as a uniform ladder of `:not(#a#b…)` prefixes: neutralizers < replacements < the site's own RTL-conditioned rules. Within one rung, source order — sorted by the site's layer rank — reproduces the site's cascade exactly. An element carrying `.ml-2.mr-4` composes correctly *structurally*, not accidentally.

3. **Cascade layers flatten for third-party overrides; natively they don't — and `!important` inverts them.** Un-layered author styles beat all `@layer`ed styles for normal declarations, so an override sheet stays un-layered and re-encodes layer order as sort order (safe once specificity is uniform, per lesson 2). But for `!important` declarations the rules invert: *layered beats un-layered, and earlier layers beat later ones*. The `!important` physical declarations inside the site's layers (14 in this snapshot, counted with the extension's own classifier) would silently defeat un-layered `!important` overrides; the fix is to declare your own cascade layer *first* (the override sheet loads at `document_start`) and emit `!important`-carrying overrides inside it. All of this bookkeeping vanishes if logical properties ship in the site's own layers.

3b. **Symmetric declarations become collateral damage unless re-emitted.** A neutralizer for one utility (`border-top-left-radius: unset` from `.rounded-l-none`) outranks the site's *untouched, symmetric* `border-radius` on the same element and erases it. The override sheet therefore re-emits identity copies of symmetric/already-logical declarations whose physical slots are contested — at their layer-sorted positions — so the site's own cascade outcome is reproduced. This is the clearest illustration of why an override layer can never be as simple as it first looks, and why native adoption is the real fix.

4. **Flip Tailwind translations at the declaration, never the usage.** Tailwind v4 funnels `translate-x-*` through `--tw-translate-x` custom properties consumed by a shared `translate` rule. Negate the *declaration* (`--tw-translate-x: calc(0.5rem * -1)`), never the consuming `var()` — negating the usage double-flips every utility at once. And never `calc()`-negate a bare `var()` value: the space-toggle idiom means it may legally resolve to whitespace.

5. **Inline JS-computed positioning is the hard boundary.** CSS overrides must never touch element-level inline styles — they encode runtime measurements. Popovers, sheets, and draggable cards that set `left: <px>` from `getBoundingClientRect()` need direction-aware JS: either write `insetInlineStart`, or branch on `getComputedStyle(el).direction`. In the current bundle this surface is small and localized (the `--sheet-card-x` / `--df-trigger-right` custom-property carriers, plus anchored-popover positioning).

## Migration recommendations

Ordered by leverage per unit of effort:

1. **Stop the bleeding: lint against new physical utilities.** Tailwind has shipped `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/`rounded-s-*`/`border-s-*` since v3.3. An ESLint/Stylelint rule (or a Tailwind plugin denylisting the physical forms) freezes the debt at today's 1,154 declarations. This is a one-day change.

2. **Migrate the component hotspots and their custom-property contracts.** `.dframe-root` (41 physical declarations; the `dframe-*`/`df-*` family accounts for 85 of the 111 in `shared-styles`), `.df-session-list`, `.tiptap`, and the `sheet-card` family account for the densest hand-written debt (`.epitaxy-root` is down to 3 now that its markdown rules ship in a lazily loaded, logical-first sheet). Their custom properties carry physical semantics in the name and the value (`--df-trigger-right`, `--sheet-card-x`); rename to logical semantics (`--df-trigger-inline-end`), as the newer `--df-*` names already do, and have the JS writers supply direction-resolved values. This is the only part of the migration that crosses the CSS/JS boundary.

3. **Audit JS inline positioning.** Grep for writes to `style.left`, `style.right`, and `translateX` string-building in component code; convert to `insetInlineStart` or branch on resolved direction. The extension deliberately leaves this surface untouched, and it is the residual gap after any CSS-side pass.

4. **Handle `translate-x` at the `--tw-translate-x` declaration.** For the 178 `translateX` declarations, the eighteen existing `rtl:` variants show the pattern the codebase already uses; alternatively a build-time pass can emit `:dir(rtl)` counterparts negating the custom property — and, for the 46 angled gradients the generator discloses, counterparts with the mirrored angle. Either way, per lesson 4, operate on declarations and treat bare-`var()` values as untouchable-by-calc.

5. **Set `dir` per-locale and let the existing rules work.** The `rtl:` variants and CDS `:dir()` rules in the shipped bundle activate today the moment `dir="rtl"` is set on `<html>`. Once 1–4 land, that attribute (plus `lang`) *is* the RTL rollout — no parallel stylesheet, no runtime flipping layer, roughly zero bytes of new CSS.

The 88%-automatable figure suggests most of step 1's backlog (the utility classes) is codemod-able in the source: the physical utility names map one-to-one to their logical counterparts, and only the 26 exception sites, the 46 angled gradients and the component hotspots need human eyes.

## Appendix: methodology

- **Snapshot:** publicly served CSS of claude.ai fetched 2026-09-18. The three stylesheets linked from the document head plus the icon-font sheet referenced from JS are the four bundle roles of the inventory tables — the same roles as the first edition of this document (2026-09-02), so the trend is like-for-like. Grepping the entry script and its 53 preloaded chunks also surfaced four lazily loaded sheets — the markdown renderer (`c19e90103-B6esh4pG.css`), KaTeX (`cf1a02a1a-DdTz_5PL.css`) and two CSS-modules components (`c49d37e5f-C9zUtDE0.css`, `cbd6c85c8-U_Wl89zJ.css`) — which the generator processes as well: generator totals in this document cover all eight files, inventory tables the four. Bundle names are content-hashed and rotate on deploy; our tooling records SHA-256 of each bundle to detect staleness, so all numbers here are pinned to the named files above.
- **Parser:** a purpose-built tokenizer-level CSS parser (`cml-rtl.js` in the extension repo) that preserves `@layer` statements, nested at-rule context (`@media`, `@supports`, `@container`), and `!important` flags; every declaration is classified as flippable-physical, structurally-unflippable-physical, already-logical, or direction-neutral. The measured inventory is emitted as JSON by the same toolchain that generates the override stylesheet, so the analysis and the shipped artifact cannot drift apart.
- **Verification:** the generated 540 KB override sheet runs in production in the extension behind an `html[data-cml-rtl="v2"]` gate, with an in-extension "doctor" that re-fetches the live bundles, re-runs the classification, and reports any declaration the shipped overrides no longer cover. The generator self-checks on every run: its output must re-parse cleanly, every emitted rule must sit behind the gate, and re-flipping its own output must produce zero flips (structural idempotence). The design additionally survived a dedicated adversarial review — three independent reviewers attacking cascade correctness, double-flip/islands claims, and parser robustness against the real bundles — whose confirmed findings (specificity non-uniformity, layered-`!important` inversion, symmetric collateral damage, space-toggle shorthands, translation-in-rotation chains) drove the current design and are reflected in the lessons above.
- **Scope discipline:** everything in this document derives from publicly served static assets. No non-public information about Anthropic's frontend was used or inferred.
- **Project:** [github.com/al-ashalash/claude-ai-arabic-chrome](https://github.com/al-ashalash/claude-ai-arabic-chrome). The analysis and this document were produced with Claude Code. Questions and corrections are welcome via the repo's issue tracker.
