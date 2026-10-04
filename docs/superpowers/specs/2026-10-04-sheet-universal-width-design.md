# Sheet: one universal implementation, and a wider web sheet

**Status:** accepted 2026-10-04
**Files:** `src/components/ui/sheet.tsx`, `public/midad-web.css`, `DESIGN.md`,
`docs/editor-selection-bar.md`

## Problem

Two defects in the one shared sheet wrapper (`src/components/ui/sheet.tsx`),
which all eleven app sheets render through.

### 1. Android: sheet content does not fill the sheet

`@expo/ui`'s universal `BottomSheet` places its children in a Compose `Column`
that carries only padding — no `fillMaxWidth()`, and no `RNHostView` sizing:

```tsx
// node_modules/@expo/ui/src/universal/BottomSheet/index.android.tsx
<Column modifiers={contentModifiers}>{children}</Column>   // contentModifiers = [padding(...)]
```

Yoga does not run inside that native host (Expo UI docs, "Common questions":
flexbox applies to `Host` only), so our body's width is its **max-content**,
clamped by the sheet: `width = min(max-content, sheetWidth)`.

Measured on the emulator (1080px wide sheet, font picker open):

| layer | measured |
| --- | --- |
| sheet container | 0–1079 (full) |
| `styles.body` | 687–1079 = **393px** (~150dp) |
| inner list | 729–1037 = 308px |

The body is exactly its widest child plus its own padding. In RTL the slack
lands on the left, which is how the bug was noticed.

This also explains why the ornament sheet *looks* correct: its wrapping tile
grid (`TILE = 76`, twelve shapes) has a max-content (~950dp) larger than the
sheet, so the clamp returns the full sheet width. Same defect, masked by
content. Any sheet whose content is narrower than the sheet shows the gap.

Fixing the universal component is not possible from app code: its `modifiers`
escape hatch reaches the outer `ModalBottomSheet`, not that column. Setting a
width on the child was tried and **fails** — the body became 1080px inside a
393px slot and overflowed right, clipping the search box, the rows and the
title row.

### 2. Web: the sheet is too narrow

`public/midad-web.css` caps the Vaul drawer at `max-width: 480px`, mirroring
`layout.maxContent` (`src/theme/tokens.ts`) and the `DESIGN.md` §5 rule that a
wide display cannot stretch a surface. For a modal sheet 480px reads as
cramped, so the sheet gets its own, wider cap.

## Decision

Replace the primitive inside the single wrapper with
**`@expo/ui/community/bottom-sheet`** (`BottomSheet` + `BottomSheetView`) — the
universal sheet variant built for React Native content. Its Android path
already performs the sizing the universal one omits:

```tsx
// node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.android.tsx
const { width } = useWindowDimensions();
<Host style={{ position: 'absolute', width }} …>
  <ModalBottomSheet …>
    <RNHostView matchContents={fitToContents}>
      <View style={fitToContents ? { width } : { flexGrow: 1, height: 0 }}>
```

iOS remains a SwiftUI sheet; web remains a Vaul drawer. The `Sheet` props API
(`visible`, `onClose`, `title`, `closeButton`, `contentPadding`, `children`)
does not change, so **none of the eleven call sites change** and there is one
code path for every platform. A platform-split wrapper was rejected: it is not
one code path.

Web width policy: **sheet-only**, `min(720px, 92vw)`. Inline surfaces keep
`layout.maxContent`.

## Constraints

- One code path: no `Platform.OS` branching, no per-platform sheet files.
- `SheetProps` unchanged; all eleven call sites compile untouched.
- The pill handle, title/close row and the 82%-of-window cap stay in the app.
- Dismissal parity: swipe, Android back, scrim tap, web Escape.
- Web keeps radius 12, dimmed scrim, reduced-motion kill.
- `node scripts/verify.mjs` stays green.

## Behaviour after

| | Android | iOS | Web |
| --- | --- | --- | --- |
| primitive | Compose `ModalBottomSheet` | SwiftUI sheet | Vaul drawer |
| content width | window width (library) | sheet width | drawer width, capped `min(720px, 92vw)` |
| height | content, capped 82% of window by `styles.body` | same | same |

## Known limitation

On Android tablets/foldables Material caps the sheet at 640dp while the library
passes the full window width to the content; content could exceed the sheet.
This is upstream in `@expo/ui/community/bottom-sheet`; phones are unaffected.
Recorded, not worked around.

## Verification

No test runner exists, and this is layout — the repo's `check-*.mjs` scripts
cover data and logic, not pixels. Verification is therefore manual, with the
temporary debug colours (`sheet` container magenta, body orange,
search blue, list green) left in place until the swap is confirmed:

- Android: the row classifier must report no magenta and orange spanning the
  full width, on the font picker and on the ornament sheet.
- Dismissal parity re-checked by hand on Android and web.
- `node scripts/verify.mjs` → 16/16.
- `yarn build:check` (`expo export --platform web`) succeeds.
