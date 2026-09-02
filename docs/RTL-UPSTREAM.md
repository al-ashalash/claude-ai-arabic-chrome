# RTL readiness of claude.ai's shipped CSS: measurements and a migration path

**Audience:** Anthropic front-end engineers.
**Source of all facts:** the publicly served CSS bundles of claude.ai, snapshot taken 2026-09-02.
**Produced by:** the open-source project [claude-ai-arabic-chrome](https://github.com/al-ashalash/claude-ai-arabic-chrome), a Chrome extension that Arabizes the claude.ai interface, with analysis tooling written with Claude Code.

---

## Why this document exists

An extension that gives claude.ai an Arabic, right-to-left interface has to solve the same problem a native RTL rollout would: identify every direction-dependent style in the shipped CSS and provide its mirror. We built a parser and generator that does this automatically, and in the process produced a complete, measured inventory of the direction debt in the current bundles. That inventory — and what an automated pass proved is mechanically fixable — seems more useful shared than kept.

The headline is encouraging: the codebase is already mid-migration. Of the 1,718 direction-dependent declarations shipped today, **721 (42%) are already logical properties** (`margin-inline-start`, `border-start-start-radius`, …), the CDS design system already ships `:dir(rtl)` rules and `rtl:` variant utilities that activate the moment `dir="rtl"` is set on the root, and 86% of the remaining physical declarations convert to logical equivalents by mechanical class-level rewriting. Finishing the migration would make native RTL support nearly free.

## Current state

Bundles analyzed (2026-09-02, hashed names as served that day):

| File | Bytes | Rules | Physical decls | Logical decls |
|---|---:|---:|---:|---:|
| `c6a992d55-CH1PzgeX.css` (main app, Tailwind v4) | 1,072,403 | 9,718 | 912 | 712 |
| `shared-styles-CHIpVNc7.css` (CDS design system) | 72,013 | 585 | 85 | 9 |
| `cc2f6279b-BLcf6DLy.css`, `shared-frame-CGJiCevB.css` | — | 3 | 0 | 0 |
| **Total** | | **10,306** | **997** | **721** |

10,306 rules, 16,137 declarations overall. Cascade layers, in order: `properties`, `cds-card`, `theme`, `base`, `components`, `utilities`.

The 997 physical (direction-dependent, left/right-anchored) declarations by property:

| Property | Decls | | Property | Decls |
|---|---:|---|---|---:|
| `transform: translateX(…)` | 148 | | `inset` (directional) | 10 |
| `padding-left` | 124 | | `border-right-width` | 9 |
| `left` | 111 | | `border-left-color` | 9 |
| `margin-left` | 106 | | `border-right-style` | 8 |
| `padding-right` | 95 | | `text-align: left\|right` | 5 |
| `right` | 89 | | `float: left\|right` | 4 |
| `margin-right` | 70 | | `direction` | 3 |
| `border-top-left-radius` | 41 | | gradients `to left\|right` | 2 |
| `border-top-right-radius` | 39 | | `box-shadow` (h-offset) | 2 |
| `border-bottom-left-radius` | 33 | | `clear: left\|right` | 1 |
| `border-bottom-right-radius` | 31 | | `border-right-color` | 1 |
| `border-radius` (asymmetric) | 27 | | `object-position: left\|right` | 1 |
| `border-left-style` | 13 | | `border-left` (shorthand) | 1 |
| `border-left-width` | 13 | | `border-right` (shorthand) | 1 |

Where the debt lives: the newer CDS design system is almost fully logical (85 physical declarations in `shared-styles`, most of them corner radii; 9 logical — but its component rules that matter already use `:dir()`). The physical debt concentrates in older Tailwind utilities (`ml-*`, `pl-*`, `left-*`, `rounded-l-*`, `border-l-*`, …) and in a handful of hand-written components. The heaviest single classes:

| Class | Physical decls | Sample |
|---|---:|---|
| `.dframe-root` | 34 | `margin-left: calc(var(--df-trigger-right, …) - …)` |
| `.epitaxy-root` | 7 | `padding-left: 4px`, `left: …`, asymmetric `border-radius` |
| `.tiptap` | 4 | `float: left`, `direction`, `padding-left` |
| `.sheet-card-*` | 7 | `left: var(--sheet-card-x, 0px)` |

Note the custom-property pattern: `--df-trigger-right` and `--sheet-card-x` carry *physical semantics in their values*, set from JS. These are the cases a CSS-only pass cannot fix (see recommendations 2–3).

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

- **Seven `rtl:` variant utilities**, compiled by Tailwind to `:where(:dir(rtl),[dir=rtl],[dir=rtl] *)` guards: `rtl:-scale-x-100`, `rtl:[--_meter-dir:1]`, two `rtl:…:-translate-x-full` sheet-closing variants, `rtl:…translate-x-full` for drilled sheets, and two `rtl:motion-safe:animate-[cds-slide-in-start|end…]` animations. The keyframes themselves are named logically (`cds-slide-in-start` / `cds-slide-in-end`).
- **A native `:dir(rtl)` rule in CDS** for composer attachments (`.cds-root [data-cds-composer-attachments] [data-cds-attachment]:where(:dir(rtl),[dir=rtl] *)`).
- **Arbitrary `[direction:ltr]` / `[direction:rtl]` utilities** used to pin direction on specific islands.
- **721 already-logical declarations**, led by `padding-inline` (133), `padding-block` (116), `margin-inline` (80), `margin-block` (77), and including the full logical corner-radius family.

All of these activate correctly the moment `dir="rtl"` is set on the document root. Nothing new needs to be invented — the existing patterns just need to be finished.

## What an automated pass proves

Our generator parses the shipped bundles (preserving `@layer` / `@media` context), classifies every declaration, and emits a logical-property override sheet. Results on the 2026-09-02 snapshot:

- **868 of the 997 physical declarations (87%) auto-flipped** into logical-property overrides, deduplicated, with no human intervention. Generation plus validation runs in well under a second.
- **Only 28 declarations are structurally unflippable** by class-level rewriting, each disclosed with a reason code:
  - 17 shorthands whose value contains a **bare `var()`** — the space-toggle idiom (e.g. `--_prose-noscope`, declared as a lone space) means a bare `var()` may legally resolve to whitespace, so both `calc(… * -1)` negation and slot-expansion of the shorthand are unsafe (a space toggle makes even the shorthand's *value count* untrustworthy),
  - 6 `transform` chains composing translation with rotation/skew (rotation does not commute, so flipping only the translation yields neither the original nor its mirror),
  - 2 standalone `translate` values passing a bare `var()`,
  - 2 numeric position x-offsets in absolute lengths (a `px` x-offset cannot be mirrored without knowing the reference box; percentage x-offsets *are* flipped as `100% − x`),
  - 1 `box-shadow` with a horizontal offset (deliberately skipped: shadows have no layout impact).
- The remaining ~101 are horizontally symmetric values needing no flip. Separately, 19 `@keyframes` animations carrying literal x-translations are counted and disclosed rather than flipped — animations belong to author-side `rtl:` variants, and the bundle's own `cds-slide-in-start/end` naming is exactly the right pattern.
- Output: a 386 KB stylesheet in four precedence bands — 686 neutralizer rules, 2,325 logical-replacement and identity rules, verbatim boosted copies of all 8 of the site's own RTL-conditioned rules (so the author's explicit `rtl:` values always beat the mechanical flips on elements that carry both), and 107 `!important`-carrying overrides in an early-declared cascade layer — that mirrors the entire application.

The point of these numbers: **the migration is overwhelmingly mechanical.** A codemod over utility class names plus a small hand-audit of the 28 exception sites covers the stylesheet side entirely.

## Design lessons from running this in production

1. **Logical properties beat selector-mirroring.** The rtlcss-style approach (generate `[dir=rtl] .foo { margin-right: … }` mirrors) breaks inside embedded LTR content. With logical properties, the *same* declaration resolves correctly everywhere: inside `direction: ltr` islands (`code`, `pre`) and inside `dir="auto"` paragraphs that Unicode-resolve to LTR (English text in a chat), the override renders back to the original LTR layout with zero special-casing. Correctness is emergent from the browser's own direction resolution — there is no second codepath to maintain.

2. **Order alone cannot sequence an override sheet — specificity must be flattened first.** Our first design put all physical neutralizers (`margin-left: unset` etc.) before all logical replacements and relied on source order; adversarial testing refuted it, because the site's selectors span specificities from `(0,1,0)` utilities to `(0,9,1)` components, and specificity resolves before order. The working design wraps every original selector in `:where()` (zeroing its specificity) and encodes our own precedence as a uniform ladder of `:not(#a#b…)` prefixes: neutralizers < replacements < the site's own RTL-conditioned rules. Within one rung, source order — sorted by the site's layer rank — reproduces the site's cascade exactly. An element carrying `.ml-2.mr-4` composes correctly *structurally*, not accidentally.

3. **Cascade layers flatten for third-party overrides; natively they don't — and `!important` inverts them.** Un-layered author styles beat all `@layer`ed styles for normal declarations, so an override sheet stays un-layered and re-encodes layer order as sort order (safe once specificity is uniform, per lesson 2). But for `!important` declarations the rules invert: *layered beats un-layered, and earlier layers beat later ones*. The 17 `!important` physical declarations inside the site's layers would silently defeat un-layered `!important` overrides; the fix is to declare your own cascade layer *first* (the override sheet loads at `document_start`) and emit `!important`-carrying overrides inside it. All of this bookkeeping vanishes if logical properties ship in the site's own layers.

3b. **Symmetric declarations become collateral damage unless re-emitted.** A neutralizer for one utility (`border-top-left-radius: unset` from `.rounded-l-none`) outranks the site's *untouched, symmetric* `border-radius` on the same element and erases it. The override sheet therefore re-emits identity copies of symmetric/already-logical declarations whose physical slots are contested — at their layer-sorted positions — so the site's own cascade outcome is reproduced. This is the clearest illustration of why an override layer can never be as simple as it first looks, and why native adoption is the real fix.

4. **Flip Tailwind translations at the declaration, never the usage.** Tailwind v4 funnels `translate-x-*` through `--tw-translate-x` custom properties consumed by a shared `translate` rule. Negate the *declaration* (`--tw-translate-x: calc(0.5rem * -1)`), never the consuming `var()` — negating the usage double-flips every utility at once. And never `calc()`-negate a bare `var()` value: the space-toggle idiom means it may legally resolve to whitespace.

5. **Inline JS-computed positioning is the hard boundary.** CSS overrides must never touch element-level inline styles — they encode runtime measurements. Popovers, sheets, and draggable cards that set `left: <px>` from `getBoundingClientRect()` need direction-aware JS: either write `insetInlineStart`, or branch on `getComputedStyle(el).direction`. In the current bundle this surface is small and localized (the `--sheet-card-x` / `--df-trigger-right` custom-property carriers, plus anchored-popover positioning).

## Migration recommendations

Ordered by leverage per unit of effort:

1. **Stop the bleeding: lint against new physical utilities.** Tailwind has shipped `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/`rounded-s-*`/`border-s-*` since v3.3. An ESLint/Stylelint rule (or a Tailwind plugin denylisting the physical forms) freezes the debt at today's 997 declarations. This is a one-day change.

2. **Migrate the component hotspots and their custom-property contracts.** `.dframe-root` (34 physical declarations), `.epitaxy-root`, `.tiptap`, and the `sheet-card` family account for the densest hand-written debt. Their custom properties carry physical semantics in the name and the value (`--df-trigger-right`, `--sheet-card-x`); rename to logical semantics (`--df-trigger-inline-end`) and have the JS writers supply direction-resolved values. This is the only part of the migration that crosses the CSS/JS boundary.

3. **Audit JS inline positioning.** Grep for writes to `style.left`, `style.right`, and `translateX` string-building in component code; convert to `insetInlineStart` or branch on resolved direction. The extension deliberately leaves this surface untouched, and it is the residual gap after any CSS-side pass.

4. **Handle `translate-x` at the `--tw-translate-x` declaration.** For the 148 `translateX` declarations, the seven existing `rtl:` variants show the pattern the codebase already uses; alternatively a build-time pass can emit `:dir(rtl)` counterparts negating the custom property. Either way, per lesson 4, operate on declarations and treat bare-`var()` values as untouchable-by-calc.

5. **Set `dir` per-locale and let the existing rules work.** The `rtl:` variants and CDS `:dir()` rules in the shipped bundle activate today the moment `dir="rtl"` is set on `<html>`. Once 1–4 land, that attribute (plus `lang`) *is* the RTL rollout — no parallel stylesheet, no runtime flipping layer, roughly zero bytes of new CSS.

The 87%-automatable figure suggests most of step 1's backlog (the utility classes) is codemod-able in the source: the physical utility names map one-to-one to their logical counterparts, and only the 28 exception sites plus the component hotspots need human eyes.

## Appendix: methodology

- **Snapshot:** publicly served CSS of claude.ai fetched 2026-09-02. Bundle names are content-hashed and rotate on deploy; our tooling records SHA-256 of each bundle to detect staleness, so all numbers here are pinned to the named files above.
- **Parser:** a purpose-built tokenizer-level CSS parser (`cml-rtl.js` in the extension repo) that preserves `@layer` statements, nested at-rule context (`@media`, `@supports`, `@container`), and `!important` flags; every declaration is classified as flippable-physical, structurally-unflippable-physical, already-logical, or direction-neutral. The measured inventory is emitted as JSON by the same toolchain that generates the override stylesheet, so the analysis and the shipped artifact cannot drift apart.
- **Verification:** the generated 386 KB override sheet runs in production in the extension behind an `html[data-cml-rtl="v2"]` gate, with an in-extension "doctor" that re-fetches the live bundles, re-runs the classification, and reports any declaration the shipped overrides no longer cover. The generator self-checks on every run: its output must re-parse cleanly, every emitted rule must sit behind the gate, and re-flipping its own output must produce zero flips (structural idempotence). The design additionally survived a dedicated adversarial review — three independent reviewers attacking cascade correctness, double-flip/islands claims, and parser robustness against the real bundles — whose confirmed findings (specificity non-uniformity, layered-`!important` inversion, symmetric collateral damage, space-toggle shorthands, translation-in-rotation chains) drove the current design and are reflected in the lessons above.
- **Scope discipline:** everything in this document derives from publicly served static assets. No non-public information about Anthropic's frontend was used or inferred.
- **Project:** [github.com/al-ashalash/claude-ai-arabic-chrome](https://github.com/al-ashalash/claude-ai-arabic-chrome). The analysis and this document were produced with Claude Code. Questions and corrections are welcome via the repo's issue tracker.
