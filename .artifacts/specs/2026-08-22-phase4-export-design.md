# Phase 4 — Export & Share Design

**Date:** 2026-08-22
**Status:** Approved (design reviewed in chat; user approved scope + share-first UX)

## Goal

Complete the midad export story: render designs to PNG offscreen, share/save
images, export vector SVG, transfer `.midad` project files in/out, and show
gallery thumbnails — all platform-aware (native share sheet / web download).

## Scope (user-approved: "full set but add SVG")

1. Offscreen PNG renderer (render core)
2. Share-first image export from the editor
3. Gallery thumbnails (generated on save)
4. `.midad.json` project file export **and** import
5. SVG export (document-model serializer with embedded fonts)

## Key decisions

- **Share-first UX** (user choice): one Share action → native system share
  sheet (`expo-sharing`), Web Share API when available on web, browser download
  fallback. No media-library permission.
- **SVG approach**: RN Skia has no scene→SVG exporter and no public glyph-path
  API (verified in `node_modules` typings). We therefore serialize our own
  document model to SVG: background rect + shapes as native SVG primitives,
  text as `<text>` elements with `@font-face` embedding used fonts as base64.
  Caveat: shaping is perfect wherever `@font-face` is honored (all browsers);
  some desktop design tools substitute fonts.
- **Thumbnails**: rendered at ~360px width on save; stored natively as
  `<id>.thumb.png` under `midad-projects/thumbs/`, on web under separate
  localStorage keys (`midad:thumb:<id>`) so index JSON stays small.
- Every export first saves the project, so exported artifacts match disk state.

## Architecture

### New modules

```
src/editor/render/offscreen.ts   renderProjectToPng(project, {maxWidthPx}) → {base64, width, height}
src/editor/export/svg.ts         projectToSvg(project) → string
src/storage/thumbs.ts            saveThumb(id, base64) / getThumb(id) → uri|dataURL|null / deleteThumb(id)
```

### Render core

`Skia.Surface.MakeOffscreen(w*s, h*s)` → imperative draw of the document
(background per canvas.background, objects sorted by zIndex, transforms via
canvas.save/translate/rotate/scale) → `makeImageSnapshot().encodeToBytes()`.
Text paragraphs rebuilt imperatively via existing `layoutArabicText()`;
shapes drawn from extracted pure geometry helpers shared with `shapes.tsx`.
EditorCanvas stays untouched (declarative); duplication is contained to the
offscreen module and covered by visual verification.

### SVG serializer

Pure string builder from `MidadProject`: viewBox = canvas size; paper color or
transparent bg; shapes → circle/rect/polygon/path; text → `<text>` with
transform matrix, font-family, direction=rtl, @font-face for each used font.
No raster fallback inside the SVG.

### Storage integration

- `thumbs.ts` mirrors `projects.ts` platform split (expo-file-system vs
  AsyncStorage/localStorage).
- Gallery gains `listProjectsWithThumbs()` usage: cards prefer thumbnail,
  fall back to calligraphic glyph placeholder.
- Import: native `expo-document-picker` (JSON type), web hidden file input;
  validate `version === 1`, regenerate id on collision, save, refresh list.

### Editor UI

Top bar: Save icon becomes disk-style save (existing behavior), new Export
button opens a bottom sheet:

- Share image (PNG) — `storage/export.ts#shareImage`
- Export SVG — same pipeline, mime `image/svg+xml`
- Export project file — native shares persisted `.midad.json` URI; web
  downloads JSON blob

## Error handling

- Offscreen surface allocation failure → surfaced as thrown error caught by
  export sheet UI → inline error state (no crash).
- Import validation failure → alert with reason (bad version/shape).
- Missing thumb → placeholder path (already default).
- Web Share API absent → automatic downloadBlob fallback (existing code).

## Testing & verification

No test framework in repo; verification = `tsc --noEmit` + `eslint src` clean
each step, plus user's manual web/Android checks:
PNG/SVG open correctly, thumbnails appear after save, import round-trips,
share sheet opens (device), download works (web).

## Out of scope (later phases)

Media-library direct save, PDF export, multi-select gestures polish,
ornaments/glyphs library UI (Phase 5), print sizing presets.
