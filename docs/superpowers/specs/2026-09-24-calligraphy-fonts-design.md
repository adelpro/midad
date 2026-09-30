# Calligraphy Fonts (Thuluth + Nastaliq) — Design Spec

**Date:** 2026-09-24
**Status:** Approved for planning (scope confirmed by partner)

## Goal

Add four bundled calligraphic faces to midad's font catalogue — two true
Thuluth faces and two Urdu Nastaliq faces — so the picker and editor can
render scripts the current roster does not cover.

## Scope

All four faces ship. One family each, single weight (400), matching the
existing single-variant families (Rakkas, Katibeh, Jomhuria, …).

| Family (slug)        | `fontAssets` key    | Label (en / ar)          | Style tag (en / ar)      | Source | Bytes |
| -------------------- | ------------------- | ------------------------ | ------------------------ | ------ | ----- |
| `amoshref-thulth`    | `AMoshrefThulth`    | AMoshref Thulth / أمشرف ثلث | Thuluth / ثلث            | `raw.githubusercontent.com/mokhtarbsaid/rare-arabic-fonts/main/amoshref-thulth/amoshref-thulth.ttf` | 402,572 |
| `layla-thuluth`      | `LaylaThuluth`      | Layla Thuluth / ليلى الثلث | Traditional Thuluth / ثلث تقليدي | `fontlibrary.org/assets/fonts/layla-thuluth/…/LaylaThuluthRegular.ttf` | 188,812 |
| `gulzar`             | `Gulzar`            | Gulzar / گلزار           | Nastaliq / نستعليق       | `raw.githubusercontent.com/google/fonts/main/ofl/gulzar/Gulzar-Regular.ttf` | 963,496 |
| `noto-nastaliq-urdu` | `NotoNastaliqUrdu`  | Noto Nastaliq Urdu / نوتو نستعليق أردو | Urdu Nastaliq / نستعليق أردو | `raw.githubusercontent.com/google/fonts/main/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf` | 690,304 |

Added bundle weight: **~2.24 MB** (roughly doubles the current `assets/fonts` total).

## Architecture

The font system needs no structural change. A face is:

1. an asset in `assets/fonts/<slug>-arabic-400.ttf`,
2. a keyed entry in `src/theme/fonts.ts` (`fontAssets`),
3. a family record in `src/theme/font-families.ts`.

`src/editor/skia/text.ts` registers every `fontAssets` key with the
`TypefaceFontProvider`; `font-picker-sheet.tsx` lists every `fontFamilies`
entry; `src/editor/export/svg.ts` embeds the face named by `fontKey`. **All
three consume the registries — none need code changes.** `scripts/check-fonts.mjs`
enforces the registry invariants and is the task-level test.

## Key decisions

- **Noto Nastaliq Urdu uses the upstream variable file**, not a static subset.
  The stack pins `fontStyle: { weight: 400 }` (`skia/text.ts`) and `expo-font`
  renders the default instance, so the `wght` 400–700 axis is intentionally
  unused. The variable file is chosen because it is a single file with full
  Latin + Arabic coverage — the one-file-per-key model — whereas the static
  alternatives are Arabic-only subsets that would drop Latin coverage every
  existing bundled face has. Documented as a comment beside the entry; the
  default instance of the upstream font is 400.
- **AMoshref Thulth comes from a third-party OFL mirror**, not the designer's
  site. OFL permits redistribution; the mirror is a stable raw URL with a
  pinned byte length. Provenance is recorded in `assets/fonts/LICENSES.md`.
- **One license record.** `assets/fonts/LICENSES.md` is created and populated
  as each face lands: author/copyright, license, source URL, byte length, and
  the OFL 1.1 text once. This closes the existing gap where no bundled face's
  license is recorded in-repo.

## Risks / review focus

- A variable font loaded through `expo-font` and `MakeFreeTypeFaceFromData`
  must render at its default 400 instance on iOS, Android and web.
- Nastaliq is a tall, overhang-heavy script; the picker's single-line 26 px
  specimen and the editor's auto-width box/ink math (`docs/editor-text-engine.md`
  §3, §9) need visual verification.
- Latin text set in any of the four faces must render (no tofu), particularly
  Noto Nastaliq Urdu where Latin comes from the variable file.
- An exported SVG using a new face must embed that face and name it correctly.
- Cold start / memory: `loadParagraphFonts()` loads every asset eagerly; +2.24 MB
  is measurable but acceptable.

## Non-goals

- No bold/weight variants (matches existing Thuluth/Nastaliq-style families).
- No changes to Skia shaping, the picker, the SVG exporter, or the storage schema.
- No lazy font loading (noted as a future concern, not this change).
- No retroactive license record for the pre-existing faces (only the four new ones).
