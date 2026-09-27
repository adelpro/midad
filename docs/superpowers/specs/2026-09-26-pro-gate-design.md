# Pro Entitlement and Export Watermark — Design Spec

> **Provenance.** This document was reconstructed on 2026-09-27 from
> [`../plans/2026-09-26-pro-gate.md`](../plans/2026-09-26-pro-gate.md), which
> cited an original spec at this path that was never committed. Everything below
> is drawn from that plan's stated decisions, rationale and review notes; where
> the plan was silent, the gap is recorded as an open question rather than
> invented. Treat §7 as the part most likely to need revisiting.

## 1. The problem

midad is free while it is being built. That is the right posture for an
unfinished product, but it is not a posture that survives contact with a store:
there is no way to fund the work, and no seam in the code where money would
enter if there were.

The temptation is to bolt a paywall onto the editor. The design constraint is
that the *editor* is the product. Gating editing would gate the thing people
came for, and would mean rewriting the editor to enforce it. So the gate goes on
the one artefact that leaves the device and is trivially re-creatable otherwise:
**the exported image**.

## 2. The single gate

One decision, applied in one place:

| | Free | Pro |
|---|---|---|
| Editor, canvas, collections, text | full | full |
| PNG export (Share image, Save to Photos) | **watermarked** | clean |
| `.midad` project file | yes | yes |
| SVG / PDF export | no | yes |
| Google Fonts | no | yes |

Two consequences worth stating outright, because they are choices and not
oversights:

- **SVG is Pro-only, not watermarked.** An SVG is editable source. A watermark
  in an SVG is a `<path>` the user can delete in any text editor, so marking it
  would cost real users the ability to do their job while stopping nobody. SVG
  is therefore withheld rather than marked.
- **`.midad` is never watermarked.** It is the editable document, and it is
  already plain data. Watermarking it would corrupt the format.

The editor is identical on both tiers. That is deliberate: a free user must be
able to judge the product, and must never hit a wall they cannot see past.

## 3. Architecture

Four new modules, split along the line that keeps the rules testable:

| Module | Role | Why it is pure |
|---|---|---|
| `src/theme/pro.ts` | the gate rules | no state, no I/O — the whole decision is two functions |
| `src/theme/brand.ts` | the mark's vector geometry | shared by the in-app logo and the exporter so they cannot drift |
| `src/editor/render/watermark.ts` | the mark's box in design units | takes the aspect as a parameter so it needs no import |
| `src/storage/entitlement.ts` | device-local zustand store | the only stateful piece; the only thing payments will call |

The first three declare **no value imports**. This is not stylistic: the repo
has no test runner, and the `check-*.mjs` scripts transpile their subject and
evaluate it standalone. A value import would silently break the check rather
than fail loudly. The same rule already governs `theme/remote-fonts.ts`,
`theme/font-pins.ts` and `editor/shortcuts.ts`.

`brand.ts` exists because the brand mark's path currently lives inside
`components/ui/brand-mark.tsx` as a private constant. Extracting it means the
logo and the watermark draw from one source, so a future change to the mark
cannot update one and miss the other.

## 4. The gate ships OFF

```ts
export const PRO_GATE_ENABLED = false; // early access
```

The watermark code merges, but nothing is marked, because the flag is false and
the app behaves as Pro for everyone. This is the central decision of the design
and it is worth being explicit about why:

- The risky code can land and be reviewed dark, instead of behind a flag that
  every tester then has to remember to turn on.
- Nothing can regress a paying user's export during early access, because there
  are none.
- The revenue decision stays reversible. Turning the gate on is a one-constant
  change in a later release; turning it off after users have paid is not.

The read is `__DEV__ && devGateOverride != null ? devGateOverride : PRO_GATE_ENABLED`.
A dev override is persisted so QA does not re-toggle it on every launch, and it
is ignored outside `__DEV__` so a dev build's choice can never leak into a
release.

## 5. The watermark

- **PNG export only.** Not the canvas, not gallery thumbnails, not `.midad`, not
  the import render.
- **Colour is `DEFAULT_INK` (`#111111`)**, the canonical content ink — never the
  UI theme's `ink`, which changes with dark mode and would make exports depend
  on an app setting.
- **Height is 8% of the canvas's short side; the margin is 4%.** Driven off the
  short side so the mark is a consistent visual weight in a square, a story
  canvas or a wide banner.
- **Anchored to the physical bottom-right**, not the logical one. In Arabic the
  layout mirrors, and a logical anchor would put the mark bottom-*left*. The
  watermark is a mark on an artefact, not UI, so it should not move with the
  language.
- **Opacity 0.32.** Acknowledged limit: on same-coloured art the mark can be
  hard to see. Accepted rather than solved, because a watermark strong enough to
  survive that stops being unobtrusive.
- Drawn last, in design units, from the shared brand geometry via an aspect-fit
  transform — so it matches the design at any export resolution and stays fully
  on-canvas for extreme aspect ratios.

## 6. Trust model

**This is client-side deterrence, not a security boundary.** Anyone can patch
the flag or call the store directly. The web build is the weakest surface by
some distance, since its JavaScript is trivially editable.

Stated plainly so nobody later mistakes it for enforcement: a determined user
removes the watermark in under a minute. The gate raises the cost of casual
redistribution and gives payments something to call. Server-side receipt
validation is a later spec, and until it exists, no revenue figure derived from
this gate should be treated as audited.

## 7. Open questions

1. **Does a purchase travel with the file?** The entitlement is device-local
   (`midad:entitlement:v1`), so an exported `.midad` carries no entitlement —
   reimporting on another device is free. Correct if Pro is per-device; wrong if
   a user expects to move their paid capability with their work. **Decide before
   Task 5**, because the answer changes the storage design and there is no cheap
   migration afterwards.
2. **What is the price, and what does it buy across platforms?** The tier table
   in §2 is a placeholder until the actual offer is decided. In particular,
   whether a single purchase covers both stores.
3. **SVG and PDF are listed as Pro-only but not built.** That gating belongs to
   the purchase-flow spec, not this one.
4. **Is the 0.32 opacity right in practice?** It has not been reviewed against
   real artwork. It needs a look against light, dark and photographic canvases
   before the gate is ever turned on.

## 8. Failure modes to watch

The spec implies inputs that no happy path exercises. Each is tied to the module
that owns the code:

1. **Gate off, no entitlement** — the default. Every export must be unmarked and
   the app must behave exactly as it does today. This is the state that ships.
2. **Export before hydration** — `persist` reads AsyncStorage asynchronously, so
   a cold start can reach an export against the store's defaults. The launch gate
   is held until hydration lands, rather than papering over it with a post-mount
   redirect.
3. **Extreme canvas aspect** — a very wide, very tall or tiny canvas must keep
   the mark fully on-canvas. Pinned for square, portrait, landscape, story, tiny
   and wide-banner cases.
4. **A dev override leaking into a release** — the `__DEV__` guard is the only
   thing preventing it, and it is load-bearing.
5. **A regression that marks SVG, PDF or `.midad`** — caught by asserting the SVG
   exporter contains no watermark symbol at all.

## 9. Verification

No test runner. `scripts/check-entitlement.mjs` is the executable spec: it
transpiles the three pure modules standalone and pins the source union, the gate
flag, the full truth table for `exportWatermarked`, the brand viewBox and
aspect-fit transform, and the watermark box across six canvas shapes — plus
source assertions that the PNG renderer draws the mark and the SVG exporter
contains no watermark.

`node scripts/verify.mjs` runs it alongside the other thirteen checks. This spec
and its plan describe the fourteenth.
