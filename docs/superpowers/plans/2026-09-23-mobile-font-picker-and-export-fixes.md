# Mobile Font Picker + Export Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's cramped inline font grid with a mobile-first font field + full-height picker, and fix the two export failures (SVG "bad base-64", image "could not load bundle").

**Architecture:** The Text sheet stops rendering the font catalogue and shows a single `FontField` row (current face + chevron). Tapping it opens `FontPickerSheet`: a **bottom sheet on native, a centred modal on web** (the platform-correct form for each), with a scrollable list of large specimens; the selected family expands inline to reveal its variant chips. Export fixes are independent: the share writer chooses base64 vs UTF-8 by inspecting the payload (not the mime type), and the file-system module is imported statically via a platform split instead of a runtime `import()`.

**Tech Stack:** React Native 0.86.3 / Expo SDK 57, TypeScript, the repo's `Sheet`, `Button`, `AnimatedPressable`, `TextInputStub`, `Icon`, `useTheme`/`useT`, `spacing`/`radius`/`typeScale`/`fontRoles` tokens, `expo-file-system` + `expo-sharing`. No test runner — verification is `node scripts/verify.mjs`, a new `check-export-payload.mjs`, and on-device checks.

**Spec:** `docs/superpowers/specs/2026-09-23-editor-font-family-picker-design.md` (the family/variant model this builds on). The picker UX here supersedes that spec's §6 "family grid" layout — this plan is the newer authority for the picker.

## Global Constraints

- **Discard the uncommitted stopgap.** The working tree currently holds an uncommitted wrapping-grid edit to `src/editor/font-picker.tsx`; this plan replaces that file's contents entirely. Do not preserve the grid.
- **`src/storage/export-payload.ts` declares no imports.** The check script transpiles and evaluates it standalone (`new Function`) — a value import breaks it silently, the same trap documented for `shortcuts.ts`, `help/catalog.ts`, `i18n/strings.ts`.
- **The share writer must not branch on `mimeType`.** `image/svg+xml` is a text payload; only a **base64 data URI** is binary.
- **Native-only modules go in `.native.ts` siblings** (`photo-library.native.ts` is the precedent), so web/SSR bundles never pull `expo-file-system`/`expo-sharing`.
- **The picker must not depend on a runtime `import()`** — that is the image-export failure mode.
- **Platform-correct picker presentation:** `presentation="bottom"` on native, `presentation="modal"` on web. The bottom sheet's drag-to-dismiss is a touch gesture; on web it can capture the list's scroll and has no mouse affordance, so web uses the centred modal (which disables the pan in `Sheet`).
- **Touch targets ≥ 44dp; selection exposed via `accessibilityState.selected`, not colour alone.**
- **Adding `check-export-payload.mjs` updates `scripts/verify.mjs`'s header count and `AGENTS.md` in the same commit.**
- **Run `node scripts/verify.mjs` before every commit.**

## Review Focus

1. **Export an SVG of a design with text.** Expect a real `.svg` file to open — not `فشل التصدير: … bad base-64`.
2. **Export an image (share) with the dev server stopped.** Expect the share sheet, not `could not load bundle`.
3. **Open the picker on a family with no variant (Qahiri/Rakkas/Katibeh/Jomhuria/Vibes/Amiri Quran).** Expect no expandable chip area and **no layout shift** when moving between families.
4. **Open the picker, then rotate / use a small phone.** Expect the list to scroll and `Done` to stay reachable.
5. **A project saved with `Cairo` (not in the registry).** Expect the FontField to show a sensible label and the picker not to falsely mark a family selected.
6. **Open the picker in a desktop browser.** Expect a centred modal (not a bottom sheet), the list to scroll with the mouse wheel without dismissing, `Esc`/the X to close, and search to accept typed input.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/storage/export-payload.ts` | Create | Pure: payload-is-base64 decision + base64 body |
| `src/storage/export.ts` | Modify | Use the helper in `writeTempAndShare` |
| `src/storage/share-temp.native.ts` | Create | Native file write + share, static imports |
| `src/storage/share-temp.ts` | Create | Web/no-share stub |
| `scripts/check-export-payload.mjs` | Create | Pin the payload decision |
| `src/editor/font-picker-sheet.tsx` | Create | Full-height picker sheet (list + inline variants) |
| `src/editor/font-picker.tsx` | Rewrite | `FontField` row (current face + chevron) |
| `src/editor/EditorScreen.tsx` | Modify | Wire the field + sheet, drop the inline grid |
| `src/i18n/strings.ts` | Modify | `editor.chooseFont`, `editor.searchFont`, `editor.noFontResults` |
| `scripts/verify.mjs`, `AGENTS.md` | Modify | Register the new check; bump the count |

---

## Phase 1 — Export fixes

### Task 1: Choose the write encoding by payload, not mime

**Files:**
- Create: `src/storage/export-payload.ts`, `scripts/check-export-payload.mjs`
- Modify: `src/storage/export.ts:145-157`, `scripts/verify.mjs`, `AGENTS.md`

**Interfaces:**
- Produces: `stringWriteEncoding(payload: string): 'base64' | 'utf8'`, `base64BodyOf(payload: string): string` — consumed by `export.ts`.

- [ ] **Step 1: Write the failing check**

Create `scripts/check-export-payload.mjs`:

```js
/**
 * Standalone verification for the export write-encoding decision.
 *
 * The share writer used to pick base64 whenever the mime type started with
 * `image/`, which base64-decoded raw SVG XML and failed with "bad base-64".
 * This pins the decision to the payload shape instead.
 *
 * Run: node scripts/check-export-payload.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'storage', 'export-payload.ts'),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const shim = { exports: {} };
new Function('exports', 'module', outputText)(shim.exports, shim);
const { base64BodyOf, stringWriteEncoding } = shim.exports;

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL: ${m}`);
};
const eq = (label, got, want) => {
  if (got !== want) fail(`${label}: got ${got}, want ${want}`);
};

const png = 'data:image/png;base64,AAAABBBB';
eq('png data URI is base64', stringWriteEncoding(png), 'base64');
eq('png body drops the prefix', base64BodyOf(png), 'AAAABBBB');

// The regression: an SVG is a text string, whether or not its mime is image/*.
const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>';
eq('svg text is utf8', stringWriteEncoding(svg), 'utf8');
eq('svg is not a data URI', stringWriteEncoding(svg), 'utf8');

// A non-base64 data URI is still text.
eq(
  'plaintext data URI is utf8',
  stringWriteEncoding('data:text/plain,hello'),
  'utf8',
);
eq('json text is utf8', stringWriteEncoding('{"a":1}'), 'utf8');

if (failures > 0) {
  console.error(`\ncheck-export-payload: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-export-payload: OK');
```

- [ ] **Step 2: Run it to watch it fail**

Run: `node scripts/check-export-payload.mjs`
Expected: FAIL — `src/storage/export-payload.ts` does not exist (the read throws).

- [ ] **Step 3: Write the pure helper**

Create `src/storage/export-payload.ts`:

```ts
/**
 * Export payload classification — no imports, so `scripts/check-export-payload.mjs`
 * can transpile and evaluate it standalone.
 */

/** True when a string payload is a base64 data URI (binary bytes). */
export function stringWriteEncoding(payload: string): 'base64' | 'utf8' {
  return payload.startsWith('data:') && payload.includes(';base64,')
    ? 'base64'
    : 'utf8';
}

/** The base64 body of a data URI, or the payload unchanged when it has no comma. */
export function base64BodyOf(payload: string): string {
  const comma = payload.indexOf(',');
  return comma === -1 ? payload : payload.slice(comma + 1);
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node scripts/check-export-payload.mjs`
Expected: `check-export-payload: OK`.

- [ ] **Step 5: Use it in the share writer**

In `src/storage/export.ts`, add the import and replace the string branch:

```ts
import { base64BodyOf, stringWriteEncoding } from '@/storage/export-payload';
```
```ts
  if (typeof data === 'string') {
    if (stringWriteEncoding(data) === 'base64') {
      tmp.write(base64BodyOf(data), { encoding: 'base64' });
    } else {
      // Text payloads (svg/json) are written as UTF-8, never base64-decoded.
      tmp.write(data);
    }
  } else if (data instanceof Uint8Array) {
```

- [ ] **Step 6: Register the check**

In `scripts/verify.mjs`, add after the `fonts` entry:
```js
  { id: 'export-payload', command: [join(here, 'check-export-payload.mjs')] },
```
Bump `eight \`check-*\` scripts` → `nine \`check-*\` scripts`. In `AGENTS.md`, add the line to the individual-checks list and `all eight checks` → `all nine checks`.

- [ ] **Step 7: Commit**

```bash
git add src/storage/export-payload.ts src/storage/export.ts scripts/check-export-payload.mjs scripts/verify.mjs AGENTS.md
git commit -m "fix(export): choose write encoding by payload, not mime"
```

---

### Task 2: Stop runtime-importing the file system in the share path

**Files:**
- Create: `src/storage/share-temp.native.ts`, `src/storage/share-temp.ts`
- Modify: `src/storage/export.ts`

**Interfaces:**
- Consumes: `base64BodyOf`/`stringWriteEncoding` (Task 1).
- Produces: `writeTempAndShare(payload): Promise<boolean>` from `@/storage/share-temp`.

- [ ] **Step 1: Move the native share writer to a static-import module**

Create `src/storage/share-temp.native.ts` with the body currently inline in `export.ts` (`writeTempAndShare`), importing at the top instead of dynamically:

```ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { base64BodyOf, stringWriteEncoding } from '@/storage/export-payload';

export interface SharePayload {
  data: string | Blob | Uint8Array;
  fileName: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}

export async function writeTempAndShare({
  data,
  fileName,
  mimeType,
  uti,
  dialogTitle,
}: SharePayload): Promise<boolean> {
  const tmp = new File(Paths.cache, `share-${Date.now()}-${fileName}`);
  if (tmp.exists) {
    tmp.delete();
  }
  tmp.create();
  if (typeof data === 'string') {
    if (stringWriteEncoding(data) === 'base64') {
      tmp.write(base64BodyOf(data), { encoding: 'base64' });
    } else {
      tmp.write(data);
    }
  } else if (data instanceof Uint8Array) {
    tmp.write(data);
  } else {
    tmp.write(new Uint8Array(await data.arrayBuffer()));
  }
  await Sharing.shareAsync(tmp.uri, {
    mimeType,
    dialogTitle: dialogTitle ?? fileName,
    UTI: uti,
  });
  return true;
}
```

Create `src/storage/share-temp.ts` (web / no share sheet) so the module resolves everywhere:

```ts
export interface SharePayload {
  data: string | Blob | Uint8Array;
  fileName: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}

/** Web has no temp-file share path; callers use the Web Share API or a download. */
export async function writeTempAndShare(): Promise<boolean> {
  return false;
}
```

- [ ] **Step 2: Point `export.ts` at it**

In `src/storage/export.ts`, delete the local `writeTempAndShare`, the `SharePayload` interface and the `expo-file-system` dynamic import; import the shared one:

```ts
import { writeTempAndShare } from '@/storage/share-temp';
```

Keep the `hasShareSheet` branches in `shareImage`/`shareFile` unchanged.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src --cache --cache-location .eslintcache`
Expected: PASS.

- [ ] **Step 4: Manual device check**

Export an image, then export an SVG, then export a `.midad` file. Each must open the share sheet. To prove the fix bites, repeat an export with the dev server stopped — it must still work.

- [ ] **Step 5: Commit**

```bash
git add src/storage/share-temp.native.ts src/storage/share-temp.ts src/storage/export.ts
git commit -m "fix(export): static file-system import via platform split"
```

---

## Phase 2 — Mobile font picker

### Task 3: Strings

**Files:**
- Modify: `src/i18n/strings.ts`

- [ ] **Step 1: Add the copy**

In the `editor` block, after `variant` (ar + en objects, and the type declaration):

```ts
    /** Opens the full-height font picker. */
    chooseFont: string;
    /** Placeholder for the picker's search field. */
    searchFont: string;
    /** Shown when a search matches no family. */
    noFontResults: string;
```
Arabic: `chooseFont: 'اختيار الخط'`, `searchFont: 'ابحث عن خط'`, `noFontResults: 'لا توجد نتائج'`.
English: `chooseFont: 'Choose font'`, `searchFont: 'Search fonts'`, `noFontResults: 'No fonts found'`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/strings.ts
git commit -m "feat(i18n): font picker copy"
```

---

### Task 4: The full-height picker sheet

**Files:**
- Create: `src/editor/font-picker-sheet.tsx`

**Interfaces:**
- Consumes: `fontFamilies`, `familyForVariant`, theme tokens, `Sheet`, `Button`, `AnimatedPressable`, `TextInputStub`.
- Produces: `FontPickerSheet({ visible, value, onChange, onClose })`, where `value: string` is the current `fontKey` and `onChange(fontKey)` sets the draft.

- [ ] **Step 1: Write the component**

Create `src/editor/font-picker-sheet.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Button, Sheet } from '@/components/ui';
import { TextInputStub } from '@/editor/text-style-controls';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  familyForVariant,
  fontFamilies,
  fontRoles,
  radius,
  spacing,
  typeScale,
} from '@/theme';

/** A real phrase, so a row shows the face's letterforms rather than its name. */
const SPECIMEN = 'بسم الله';

export interface FontPickerSheetProps {
  visible: boolean;
  /** The current `fontKey`. */
  value: string;
  onChange: (fontKey: string) => void;
  onClose: () => void;
}

/**
 * Full-height font picker: a scrollable list of large specimens. The selected
 * family expands **inline** to reveal its variant chips, so the list never
 * reflows and single-variant families simply have no chip row.
 */
export function FontPickerSheet({
  visible,
  value,
  onChange,
  onClose,
}: FontPickerSheetProps) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const uiFont = fontRoles[language].ui;
  const [query, setQuery] = useState('');
  const activeKey = familyForVariant(value)?.key;

  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fontFamilies;
    return fontFamilies.filter(
      (f) =>
        f.labelEn.toLowerCase().includes(q) ||
        f.labelAr.includes(q) ||
        f.styleTagEn.toLowerCase().includes(q) ||
        f.styleTagAr.includes(q),
    );
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.editor.fontFamily}
      closeButton
      // Native: bottom sheet. Web: centred modal — the bottom sheet's drag
      // gesture is a touch affordance and can swallow the list's scroll.
      presentation={Platform.OS === 'web' ? 'modal' : 'bottom'}
    >
      <TextInputStub
        value={query}
        onChange={setQuery}
        placeholder={t.editor.searchFont}
      />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listBody}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {matches.map((family) => {
          const selected = family.key === activeKey;
          return (
            <View key={family.key}>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label(
                  family.labelAr,
                  family.labelEn,
                )}, ${label(family.styleTagAr, family.styleTagEn)}`}
                onPress={() => onChange(family.defaultVariant)}
                style={[
                  styles.row,
                  {
                    borderColor: selected ? c.ink : c.border,
                    backgroundColor: selected ? c.surfaceAlt : c.surface,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.specimen,
                    { color: c.ink, fontFamily: family.defaultVariant },
                  ]}
                >
                  {SPECIMEN}
                </Text>
                <Text
                  style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}
                >
                  {label(family.labelAr, family.labelEn)} ·{' '}
                  {label(family.styleTagAr, family.styleTagEn)}
                </Text>
              </AnimatedPressable>

              {selected && family.variants.length > 1 && (
                <View style={styles.chips}>
                  {family.variants.map((variant) => {
                    const on = variant.key === value;
                    return (
                      <AnimatedPressable
                        key={variant.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={label(
                          variant.labelAr,
                          variant.labelEn,
                        )}
                        onPress={() => onChange(variant.key)}
                        style={[
                          styles.chip,
                          {
                            borderColor: on ? c.ink : c.border,
                            backgroundColor: on ? c.ink : c.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: on ? c.onInk : c.ink,
                            fontFamily: uiFont,
                            fontSize: typeScale.caption.size,
                          }}
                        >
                          {label(variant.labelAr, variant.labelEn)}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {matches.length === 0 && (
          <Text style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}>
            {t.editor.noFontResults}
          </Text>
        )}
      </ScrollView>

      <Button label={t.common.done} onPress={onClose} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { flexShrink: 1 },
  listBody: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  specimen: { fontSize: 26 },
  meta: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

Confirm `TextInputStub` is exported from `@/editor/text-style-controls`; if not, import it from wherever `EditorScreen.tsx` imports it.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src --cache --cache-location .eslintcache`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/editor/font-picker-sheet.tsx
git commit -m "feat(editor): full-height font picker sheet"
```

---

### Task 5: The FontField row and wiring

**Files:**
- Rewrite: `src/editor/font-picker.tsx`
- Modify: `src/editor/EditorScreen.tsx`

**Interfaces:**
- Consumes: `FontPickerSheet` (Task 4).
- Produces: `FontField({ value, onPress })`.

- [ ] **Step 1: Rewrite `font-picker.tsx` as the field**

Replace the whole file:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, DirectionIcon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { familyForVariant, fontRoles, radius, spacing, typeScale, variantFor } from '@/theme';

export interface FontFieldProps {
  /** The current `fontKey`. */
  value: string;
  onPress: () => void;
}

/**
 * A single Font row for the Text sheet. Shows the current face in its own face
 * and opens the full-height picker; the catalogue itself lives in
 * `FontPickerSheet` so it never crowds this sheet.
 */
export function FontField({ value, onPress }: FontFieldProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const uiFont = fontRoles[language].ui;
  const family = familyForVariant(value);
  const variant = variantFor(value);
  const name = family
    ? `${language === 'ar' ? family.labelAr : family.labelEn} · ${
        language === 'ar' ? variant?.labelAr : variant?.labelEn
      }`
    : value;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.muted, fontFamily: uiFont }]}>
        {t.editor.fontFamily}
      </Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${t.editor.chooseFont}: ${name}`}
        onPress={onPress}
        style={[styles.field, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
      >
        <Text
          numberOfLines={1}
          style={[styles.specimen, { color: c.ink, fontFamily: value }]}
        >
          بسم الله
        </Text>
        <View style={styles.right}>
          <Text style={[styles.name, { color: c.muted, fontFamily: uiFont }]}>
            {name}
          </Text>
          {/* RTL-aware chevron — points the way the reading direction expects. */}
          <DirectionIcon isRTL={isRTL} size={18} color={c.muted} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  specimen: { fontSize: 22, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: typeScale.caption.size },
});
```

Confirm the icon name for a chevron in `src/components/ui/icon.tsx` (the gallery used `chevron`/`arrow`); adjust to an existing name.

- [ ] **Step 2: Wire it into the Text sheet**

In `src/editor/EditorScreen.tsx`:
- Add `const [fontPickerOpen, setFontPickerOpen] = useState(false);`.
- Replace `<FontPicker value={draftFont} onChange={setDraftFont} />` with:
```tsx
            <FontField value={draftFont} onPress={() => setFontPickerOpen(true)} />
```
- Render the sheet next to the other sheets:
```tsx
        <FontPickerSheet
          visible={fontPickerOpen}
          value={draftFont}
          onChange={setDraftFont}
          onClose={() => setFontPickerOpen(false)}
        />
```
- Update imports: `FontField` from `@/editor/font-picker`, `FontPickerSheet` from `@/editor/font-picker-sheet`; drop the old `FontPicker`.

- [ ] **Step 3: Typecheck, lint, full suite**

Run: `node scripts/verify.mjs`
Expected: typecheck, lint and all nine checks PASS.

- [ ] **Step 4: Manual device check**

Open the Text sheet → one Font row. Tap → the picker opens near full height. Scroll the list: every family is reachable as a large specimen. Select a multi-variant family → its chips expand inline; select a single-variant family → no chips and no height change. Type in search → the list filters. Done returns to the Text sheet with the face applied.

**Web:** open the same app in a browser. The picker must appear as a **centred modal**; the mouse wheel scrolls the list without dismissing it; the X / `Esc` closes; search accepts typed Arabic; the selected face still renders its specimen.

- [ ] **Step 5: Commit**

```bash
git add src/editor/font-picker.tsx src/editor/EditorScreen.tsx
git commit -m "feat(editor): font field + full-height picker replaces inline grid"
```

---

## Phase 3 — Final verification

- [ ] **Step 1:** `node scripts/verify.mjs` → all green.
- [ ] **Step 2:** Review Focus 1–6 on device/emulator **and in a desktop browser** (web uses the centred modal, Phase 2).
- [ ] **Step 3:** Commit any fixes; report size/UX outcome.
