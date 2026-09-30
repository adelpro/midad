# Pro Entitlement and Export Watermark — Design Spec

> **Provenance.** This document was reconstructed on 2026-09-27 from
> [`../plans/2026-09-26-pro-gate.md`](../plans/2026-09-26-pro-gate.md), which
> cited an original spec at this path that was never committed. Everything below
> is drawn from that plan's stated decisions, rationale and review notes; where
> the plan was silent, the gap is recorded as an open question rather than
> invented. Treat §7 as the part most likely to need revisiting.

> **Revised 2026-09-30 — a pricing session, not an implementation one.** A
> later discussion changed three things: **ads were proposed and rejected**
> (§2.4), **Google Fonts moved into the gate as a five-face allowance**
> (§2.2), and **export quality** replaced cleanliness as the headline Pro
> benefit (§2.3). §2.5 keeps the original table so the change is legible.
> **No code was written in that session and none of it is approved yet** —
> §7 carries the questions still open, and the implementation plan beside this
> file is stale against §2.

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

## 2. The tiers

> **Revised 2026-09-30.** This section replaced a single-gate table. The
> original reasoning it rested on survives verbatim in §2.5.

Three gates, applied in three places: the exported artefact carries a mark
(§5), the remote font catalogue is metered (§2.2), and export *quality* is
withheld (§2.3).

### 2.1 The table

| | Free | Pro |
|---|---|---|
| Editor, canvas, collections, text, glyphs, shapes | full | full |
| Bundled families (22) | full | full |
| **Google Fonts (2,100+)** | **5 faces** | unlimited (LRU 30) |
| PNG export | watermarked, **2048 px** | clean, **up to 4096 px** |
| JPEG / transparent PNG | no | yes |
| SVG | no | yes |
| PDF | — | — *(not built; §7.5)* |
| `.midad` project file | yes | yes |
| Undo history | 50 steps | unlimited |

The editor is identical on both tiers. That is deliberate: a free user must be
able to judge the product, and must never hit a wall they cannot see past.

### 2.2 The Google Fonts allowance

**This gate was added on 2026-09-30, reversing the position that Google Fonts
should be ungated.** Two reasons ended the argument:

- **The gate is soft.** The catalogue stays fully browsable — all ~2,100
  names, the Arabic/no-Arabic badge and every weight chip remain visible.
  Only the download is blocked, so the upsell lands at the moment of peak
  intent rather than at a wall.
- **It is the cheapest gate in the app to build.** Every remote face is
  installed through one call site (`font-picker-sheet.tsx` → `onInstall` →
  `downloadRemoteFont(id, weight)`). No artefact to mark, no export path to
  intercept, no project-schema change.

**Five faces**, metered, **device-local**, and counted as *currently
installed* rather than lifetime downloads. A lifetime tally drifts out of sync
the moment the LRU evicts and the number disagrees with the list.

No new store is needed: the ledger is the cache index that already exists
(`midad:remote-fonts:v1`, a `Record<fontKey, …>`), and the count is
`Object.keys(index).length`.

**The allowance forces a management UI, and at 5 that is mandatory rather than
polish.** The existing 30-face LRU evicts silently; at 30 that is a rare edge
case, but at 5 it becomes routine, and an evicted face breaks any design that
names it (fallback to Amiri plus the missing-font banner). So the two tiers
get different eviction policies:

- **Free — 5, manual removal only. Never auto-evicts.** The five are
  deliberate; the app does not silently take them away.
- **Pro — 30, LRU auto-evict.** Unchanged from today.

At the limit, tapping an uninstalled chip opens a small replace sheet listing
the five with a remove control each, and the Google section header shows
`n / 5` so users manage *before* they hit the wall. This stays inside the
picker — no settings screen, no new route, until there is evidence it needs one.

**Copy must not be a bare "Google Fonts · Pro."** `filterBundledDuplicates`
(`theme/remote-fonts.ts`) deliberately *keeps* a Google row when Google offers
a weight the bundle lacks, so four bundled families appear in both sections —
Kufam, Lateef, El Messiri, Mirza. A free user who already has Kufam at 400
will search Kufam and meet a lock on a font they can already use. The claim
has to be the true one — *"unlock 2,100+ fonts and every weight"* — because
the bare version is false against that overlap.

### 2.3 Export quality is the headline, not cleanliness

Cleanliness alone sells weakly. The thing a real user is short of does not
exist yet: **every PNG export is hard-coded to 2048 px** and there is no
resolution control anywhere in the app; `jpeg` is in the type system but no UI
offers it. That gap is the strongest monetization lever available, it costs
nothing per export, and it is what makes a one-time price legible.

The watermark stays as the free tier's visible cost. It is cheap to ship and
reversible, which is what makes it a safe first gate.

### 2.4 Ads were proposed and rejected

Ads with a Pro unlock to remove them were proposed on 2026-09-30 and turned
down. Recorded so it is not relitigated:

1. **The payout does not reach this app's scale.** AdMob's threshold is $100;
   MENA banner eCPM is roughly $0.06–$0.10 per thousand impressions, which at
   a few impressions per session per user needs on the order of thousands of
   daily actives to clear one payout in a month. A one-time unlock earns more
   from a few hundred installs.
2. **Ads tax the growth loop.** midad spreads by exporting and posting. A
   watermark rides every shared image; a banner in the editor does the
   opposite, and one-star reviews are lethal with no ratings to average.
3. **"Pro removes ads" is the weakest available pitch** — it asks the user to
   care about the publisher's revenue rather than their own output.
4. **It costs the best asset the app has.** "Your design data never leaves
   your device" is a true, defensible claim in the privacy policy, the storage
   contract and the About copy. AdMob reverses it into an ad-tracking identity
   on a user base that does not exist yet.

If it is ever revisited, the cost is real and was scoped: an ATT prompt, a UMP
consent flow, `com.google.android.gms.permission.AD_ID` (against a deliberate
`permissions: []` in `app.json`), a Play Console "contains ads" declaration, an
App Store privacy-label rewrite, and a config plugin with open compatibility
bugs against recent Expo SDKs. Ads on the **web** build only is the narrowest
version worth considering.

### 2.5 The original table, kept for the record

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

**Extended on 2026-09-30 for the revised tiers.** `pro.ts` grows from two
functions to the full rule set, all pure so `check-entitlement.mjs` can pin
them: the font allowance per tier, whether a remote install is permitted at a
given installed count, the export resolution cap, and the undo cap. The
allowance's *ledger* is not new — it is the existing remote-font cache index,
so nothing is added to `storage/` for the count itself.

**The purchase flow is not in this architecture**, and that is an open
question rather than a decision (§7.6). It needs a client module for
`expo-iap` and a restore path; whether that lives beside `entitlement.ts` or
in its own spec is undecided.

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

`PRO_GATE_ENABLED` is a compile-time constant, so turning the gate on is a
**release** decision, not a runtime switch — which makes *when* worth doing it
a real question rather than a detail. §7.3 leaves it open; the working
position is that a gate switched on at near-zero installs earns nothing and
spends the goodwill of everyone who finds the app in its first weeks.

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

> **Restructured 2026-09-30.** Split into what is settled and what is not, so a
> later session resumes from the right place. Nothing marked *open* has been
> approved; the implementation plan beside this file is stale against §2 and
> must not be executed as written.

### 7.1 Settled on 2026-09-30

| | Decision |
|---|---|
| Ads | **Rejected.** See §2.4. |
| Google Fonts in the gate | **Yes** — five faces, not a hard lock. See §2.2. |
| The allowance's ledger | The existing remote-font cache index; no new store. |
| Free-tier eviction | **Manual only, never LRU.** Pro keeps LRU at 30. |
| Counted quantity | Currently installed faces, not lifetime downloads. |
| Reset on data clear | Accepted. On native the reset is an uninstall, which also destroys the user's projects, so it is far costlier than the web equivalent. |
| The watermark | Retained as the free tier's visible cost, still shipping behind a flag that is off. |

### 7.2 Open — the entitlement

1. **Restore, or device-local only?** The plan as written has no restore, which
   means a user who pays and switches phones has no recourse and the app will
   collect "I paid and lost it" reviews before it has any ratings. Both stores
   expect restore, and `expo-iap` exposes `getAvailablePurchases`, so this looks
   like a bug rather than a decision — but it is not written down anywhere and
   changes `entitlement.ts`. *Recommended: restore, entitlement stays
   device-local as the cache and the store handle re-granting.*
2. **Does a purchase travel with the file?** Unchanged from the original spec.
   A `.midad` carries no entitlement, so reimporting elsewhere is free. Correct
   if Pro is per-device; wrong if a user expects to move paid capability with
   their work. **Must be decided before Task 5** — it changes the storage design
   and there is no cheap migration afterwards.
3. **What is the price?** A one-time unlock, not a subscription: the app has no
   recurring value to bill for, and this niche's users explicitly ask for
   one-time over subscription. The figure is unchosen. Also undecided: whether
   one purchase covers both stores.

### 7.3 Open — launch and gate timing

4. **When does the gate turn on?** It is a compile-time constant, so this is a
   release decision. Working position: not at launch, once there are enough
   installs for a paywall to get impressions at all. No threshold has been set.

### 7.4 Open — the Google Fonts allowance

5. **What happens when a user removes a font a saved design is using?** This can
   strand them permanently: the design references the face, they delete it to
   make room, the missing-font banner offers a re-download, and the re-download
   costs quota they do not have. Two fixes — **(A)** the repair path bypasses
   the quota, which makes stranding impossible at the cost of a soft cap
   (someone importing a `.midad` that names 20 faces ends up with 20, bounded
   by the existing 30-face LRU); or **(B)** protect faces in use, which is
   correct on paper but needs a global scan — today's scan
   (`EditorScreen.tsx`) is per-document — on every picker open.
   *Recommended: A.* **Unanswered when this was written.**
6. **The allowance is metered per tier — does Pro get 30, or the same five plus
   something else?** 30 is today's number and the recommendation, but it was
   not explicitly agreed.

### 7.5 Open — the exported artefact

7. **Is 0.32 the right opacity?** Unchanged. Never reviewed against real
   artwork; it needs a look against light, dark and photographic canvases
   before the gate is ever turned on.
8. **PDF is in the tier table but does not exist.** Selling a listed feature
   that is not built is a refund waiting to happen. Build it (`expo-print` is
   available in this SDK) or drop the row. The recommendation is to drop it —
   §2.3's resolution and transparency options carry more value for less work —
   but this was not agreed.
9. **Is the 4096 px ceiling the right Pro ceiling?** A guess. Print work may
   want more, and the cost per export is not obviously zero on low-end devices.

### 7.6 Open — process

10. **One spec or two?** The purchase flow is the piece carrying external
    dependency risk (`expo-iap`, App Store Connect product setup, restore,
    refunds) and has no dependency on the rest of the gate. Splitting it lets
    the store work be timed independently. Undecided.

---

## 7a. Superseded

The original four questions, kept only so the change is traceable. Each has
moved: purchase-travels-with-the-file and price are §7.2 items 2 and 3;
PDF-not-built is §7.5 item 8; watermark opacity is §7.5 item 7.

1. ~~Does a purchase travel with the file?~~
2. ~~What is the price, and what does it buy across platforms?~~
3. ~~SVG and PDF are listed as Pro-only but not built.~~
4. ~~Is the 0.32 opacity right in practice?~~

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

**Added 2026-09-30, from the revised tiers in §2.2 and §2.3:**

6. **Stranding a user at the allowance limit** — removing a face a saved design
   names, then finding the repair re-download is itself blocked by the quota.
   Whether §7.4 option A or B is chosen, one of these must be provably false:
   the user is never left unable to open their own work. This is the single
   worst outcome the allowance can produce.
7. **The counter disagreeing with the list** — a lifetime tally out of step with
   the cache index after an eviction. The count must be
   `Object.keys(index).length`, read fresh, never cached separately.
8. **A lock on a font the user already has** — the `filterBundledDuplicates`
   overlap (Kufam, Lateef, El Messiri, Mirza) means a bundled face can appear
   in the gated section. Pinned as an assertion that a bundled family is never
   presented as locked.
9. **Free-tier auto-eviction** — if the free tier ever inherits the 30-face LRU,
   the allowance silently destroys work. Asserted negatively: the LRU does not
   run for a free entitlement.
10. **The resolution gate drifting** — a Pro user getting 2048 px, or a free
    user getting 4096. Pinned on the pure predicate, not on the call site.

## 9. Verification

No test runner. `scripts/check-entitlement.mjs` is the executable spec: it
transpiles the three pure modules standalone and pins the source union, the gate
flag, the full truth table for `exportWatermarked`, the brand viewBox and
aspect-fit transform, and the watermark box across six canvas shapes — plus
source assertions that the PNG renderer draws the mark and the SVG exporter
contains no watermark.

`node scripts/verify.mjs` runs it alongside the other thirteen checks. This spec
and its plan describe the fourteenth.

**The revised tiers add rules to the same script, not new scripts** — the
allowance predicate, the resolution ceiling and the undo cap are all pure
functions in `pro.ts` and pin there for free. What cannot be checked this way
is the allowance's interaction with the cache index and the picker, which is
manual-pass territory and is called out in the plan.
