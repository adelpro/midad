import {
  Skia,
  vec,
  type DataModule,
  type SkParagraph,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { Platform as SkiaPlatform } from '@shopify/react-native-skia/lib/module/Platform';
import { useEffect, useState } from 'react';

import { getLoadedBundledFontKeys } from '@/storage/bundled-font-registry';
import { useLoadedBundledFontKeys } from '@/hooks/use-loaded-bundled-fonts';
import { useInstalledRemoteFontKeys } from '@/hooks/use-installed-remote-fonts';
import type { MidadProject } from '@/storage/project-schema';
import {
  bytesForRemoteFont,
  listInstalledRemoteFonts,
} from '@/storage/remote-font-cache';
import { refreshInstalledRemoteFonts } from '@/storage/remote-font-registry';
import { coreFontAssets, displayFontAssets } from '@/theme';

/**
 * Arabic text rendering via the Skia Paragraph API.
 *
 * The ParagraphBuilder uses HarfBuzz shaping, so Arabic renders with correct
 * contextual forms (initial/medial/final), lam-alef ligatures, and RTL
 * direction. The simple Skia `<Text>` component does NOT shape Arabic, so this
 * is the only correct path.
 */

/**
 * Normalize a Metro font asset for Skia's useFonts.
 * On native, require() returns a numeric asset id (RNModule). On web it
 * resolves to a URI string, which Skia's resolveAsset cannot handle directly —
 * wrap it in a { uri } asset object (MetroAsset shape).
 */
function toFontSource(asset: unknown): DataModule {
  if (typeof asset === 'string') {
    return { uri: asset, width: 0, height: 0 };
  }
  return asset as DataModule;
}

/**
 * The families the *latest* built provider registered — the core faces, the
 * display faces loaded so far, and the installed remote faces.
 *
 * `buildParagraph` resolves a text object's family through this mirror instead
 * of `Object.hasOwn(fontAssets, …)`: a remote face becomes renderable the
 * moment a provider built with it lands, and a remote key that is *not* on this
 * device falls back to Amiri rather than crashing — the missing-font banner
 * owns the re-download prompt for those. The mirror is swapped only after a
 * load completes, so a failed load leaves the previous set (and its decisions)
 * intact.
 *
 * It starts at the **core** faces, not at every bundled key. Before this
 * provider existed nothing was registered, so claiming thirty-seven families
 * only bought a paragraph that asked for an absent face and got Skia's default
 * instead of the deliberate Amiri fallback. Core-only is the same rendering and
 * an honest mirror.
 *
 * Only `publishParagraphFonts` writes it, and only ever with the set of a build
 * its caller has **accepted**. That is not ceremony: two builds of this hook can
 * be in flight at once (the remote snapshot and the bundled snapshot both
 * trigger one), they complete out of order, and the slower one is the one whose
 * output the state was told to discard. If a discarded build could still write
 * here, the mirror would end up describing a build nobody renders with, while
 * the cover gate — which reads the *accepted* set — reported the face ready. The
 * cover would lift and every paragraph in that face would fall back to Amiri,
 * silently, for the rest of the session.
 */
let registeredFamilies: ReadonlySet<string> = new Set(
  Object.keys(coreFontAssets),
);

/**
 * A paragraph provider paired with the family names it actually registered.
 *
 * The set is the honest answer to "can this provider draw `fontKey`?", which is
 * the question the ensure-then-open gate asks before it lets the editor render.
 * Shipping the two together means a caller can never hold a provider and
 * consult a *different* set — the module mirror is a separate, swapped-on-load
 * thing, whereas this set travels with the provider it describes.
 */
export interface ParagraphFontSet {
  fonts: SkTypefaceFontProvider;
  families: ReadonlySet<string>;
}

/**
 * Every distinct `fontKey` the document's text objects name, in first-seen
 * order. Unknown and remote keys are included — narrowing to what can actually
 * be drawn is the caller's job (`bundledDisplayKeysFor`), and a key that stops
 * being drawable later still has to be visible to the gate that asks.
 */
export function projectFontKeys(project: MidadProject): string[] {
  const seen = new Set<string>();
  for (const obj of project.objects) {
    if (obj.type === 'text') {
      seen.add(obj.fontKey);
    }
  }
  return [...seen];
}

/**
 * Build the ParagraphBuilder typeface provider outside React.
 *
 * Registers the **core** faces, plus the display faces actually loaded this
 * session, plus every installed remote face. A display face is absent until
 * `ensureBundledFonts` loads it, which is the whole point: opening a design no
 * longer drags in the other twenty-eight calligraphic faces. The cover gate in
 * `EditorScreen` holds the screen until the document's own faces are in, so a
 * face missing here is never painted — `buildParagraph`'s Amiri fallback is the
 * safety net, not the normal path.
 *
 * Kept separate from the hook because the gallery needs the same provider for
 * a single one-off render, after it has loaded CanvasKit on demand — see
 * `renderImportedThumbnail`. The provider is a native/WASM handle, so a one-off
 * caller should `dispose()` it when the render is done.
 */
export async function loadParagraphFonts(): Promise<ParagraphFontSet> {
  const provider = Skia.TypefaceFontProvider.Make();
  const added: string[] = [];

  // Core faces ship with the app; a display face joins only once expo-font has
  // actually loaded it. Read the snapshot once — it cannot change under us
  // mid-loop, and `publish` replaces the reference rather than mutating.
  const loaded = getLoadedBundledFontKeys();
  const bundled = [
    ...Object.entries(coreFontAssets),
    ...Object.entries(displayFontAssets).filter(([family]) =>
      loaded.has(family),
    ),
  ].map(async ([family, asset]) => {
    const data = await Skia.Data.fromURI(
      SkiaPlatform.resolveAsset(toFontSource(asset)),
    );
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (typeface) {
      provider.registerFont(typeface, family);
      added.push(family);
    }
  });

  // Installed remote faces register under their `remote:<id>:<weight>` key —
  // the same name a design stores in its `fontKey` — so the canvas renders
  // them with no further lookup. `bytesForRemoteFont` re-resolves the CORS-open
  // CDN URL on web and reads the cached file on native.
  const remote = (await listInstalledRemoteFonts()).map(async (fontKey) => {
    const bytes = await bytesForRemoteFont(fontKey);
    if (!bytes) {
      return;
    }
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(
      Skia.Data.fromBytes(bytes),
    );
    if (typeface) {
      provider.registerFont(typeface, fontKey);
      added.push(fontKey);
    }
  });

  await Promise.all([...bundled, ...remote]);

  // Returned, **not** published. This build may yet be discarded — superseded by
  // a later one, or unmounted before it lands — and a discarded build must not
  // leave its answer behind in the mirror. The caller publishes once it has
  // decided to keep the build (see `publishParagraphFonts`).
  return { fonts: provider, families: new Set(added) };
}

/**
 * Adopt a built set as the render-time family mirror.
 *
 * Call this **only** after deciding to keep the build, and publish the state
 * update in the same breath: the mirror and the provider the renderer holds must
 * always describe the same build. `useParagraphFonts` does both under its `active`
 * guard; the one-off import thumbnail publishes because nothing else will.
 */
export function publishParagraphFonts(set: ParagraphFontSet): void {
  registeredFamilies = set.families;
}

/**
 * The editor's live provider hook.
 *
 * Rebuilds whenever the installed remote-face snapshot changes (a face was
 * downloaded) **or a bundled display face finishes loading**, so the canvas
 * re-shapes with the new face — the set's identity already feeds
 * `useTextLayouts`' memo and the cover gate's `families.has(…)` check. It
 * reconciles expo-font first (`refreshInstalledRemoteFonts`), then builds the
 * Skia provider from the same reconciled snapshot, so the two registrations can
 * never drift: the RN `<Text>` paths and the Skia canvas always agree on what
 * is installed.
 */
export function useParagraphFonts(): ParagraphFontSet | null {
  const remoteFonts = useInstalledRemoteFontKeys();
  const loadedBundled = useLoadedBundledFontKeys();
  const [paragraphFonts, setParagraphFonts] = useState<ParagraphFontSet | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    (async () => {
      await refreshInstalledRemoteFonts();
      if (!active) {
        return;
      }
      const next = await loadParagraphFonts();
      if (!active) {
        return;
      }
      // Mirror and state together, under the one guard that decides this build is
      // kept. Splitting them is what let a superseded build win the mirror.
      publishParagraphFonts(next);
      setParagraphFonts(next);
    })().catch(() => {
      // A failed load leaves text unrendered rather than crashing the screen;
      // callers already treat a missing provider as "fonts not loaded yet".
    });
    return () => {
      active = false;
    };
    // `remoteFonts` and `loadedBundled` are the rebuild triggers. The body reads
    // the live cache via `refreshInstalledRemoteFonts` and the live loaded set
    // via `getLoadedBundledFontKeys`, so each snapshot's *identity* is the only
    // thing that must change to re-run this effect.
  }, [remoteFonts, loadedBundled]);
  return paragraphFonts;
}

export interface TextLayoutSpec {
  text: string;
  fontKey: string; // family name as registered (e.g. 'Amiri')
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  color: string;
  opacity: number;
  /**
   * Explicit wrap width (set by a horizontal resize). When null/absent the
   * width is auto: the box stretches to fit the text, capped at `maxWidth`.
   */
  wrapWidth?: number | null;
  /** Ceiling for auto width — normally the canvas width. Ignored when wrapping. */
  maxWidth: number;
  /** Drop shadows behind the glyphs, painted in order (outermost first). */
  shadows?: { color: string; offsetX: number; offsetY: number; blur: number }[];
}

export interface RenderedParagraph {
  paragraph: SkParagraph;
  /**
   * The width the paragraph was shaped at, which is exactly the object's box
   * width. Painting uses this so the glyphs can never disagree with the box.
   */
  width: number;
  height: number;
  /**
   * The tight ink box of the drawn glyphs, in the object's local
   * (origin-centred) frame — absent when the text wraps to more than one rect.
   *
   * The `width`/`height` above are the advance/line box, which includes side
   * bearings and line leading. Consumers that must hug the glyphs (hit-testing
   * and the selection chrome for a split word's parts) use this instead.
   */
  ink?: ParagraphInk;
}

/** Tight glyph box for one laid-out paragraph, in its local frame. */
export interface ParagraphInk {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Probe width for auto sizing: wide enough that nothing soft-wraps, so the
 * first pass can read the text's intrinsic width.
 */
const AUTO_TEXT_WIDTH = 100000;
/** Floor for a resolved width, so an empty paragraph stays selectable. */
const MIN_TEXT_WIDTH = 1;

/** Shape a paragraph at an explicit width. */
function buildParagraph(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
  width: number,
): SkParagraph {
  const family = registeredFamilies.has(spec.fontKey) ? spec.fontKey : 'Amiri';
  const isArabic = /[\u0600-\u06FF]/.test(spec.text);

  // TextAlign enum: Left=0, Right=1, Center=2, Justify=3, Start=4, End=5
  const align = spec.align === 'center' ? 2 : spec.align === 'right' ? 1 : 0;
  // TextDirection enum: RTL=0, LTR=1
  const direction = isArabic ? 0 : 1;

  // The typeface provider is mandatory on web (no system font manager) and
  // guarantees the bundled calligraphy fonts are used on native as well.
  const builder = Skia.ParagraphBuilder.Make(
    {
      textAlign: align,
      textDirection: direction,
    },
    fonts,
  );

  // Optional keys must be *absent*, not `undefined`. The native style reader
  // guards every field with `hasProperty`, which is true for a key that exists
  // and holds `undefined`, and it then converts that value as an object — which
  // throws "Value is undefined, expected an Object". Most text objects carry no
  // shadows (`shadows` is optional, and the Classic preset clears it), so
  // passing the key through unconditionally broke shaping on native. CanvasKit
  // tolerates the `undefined`, which is why this only ever failed on device.
  const style: SkTextStyle = {
    fontFamilies: [family],
    fontSize: spec.fontSize,
    heightMultiplier: spec.lineHeight > 0 ? spec.lineHeight / spec.fontSize : 1,
    color: Skia.Color(spec.color),
    fontStyle: { weight: 400 },
  };
  if (spec.shadows?.length) {
    style.shadows = spec.shadows.map((s) => ({
      color: Skia.Color(s.color),
      offset: vec(s.offsetX, s.offsetY),
      blurRadius: s.blur,
    }));
  }
  builder.pushStyle(style);
  builder.addText(spec.text);

  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

/**
 * Width a text object should lay out at.
 *
 * A manual wrap width always wins. Otherwise the text is measured unwrapped so
 * the box hugs the text exactly, then capped at the canvas so an over-long line
 * wraps at the canvas edge instead of running off it.
 *
 * The result is rounded UP: Skia truncates the layout width to an integer, so
 * shaping at a width taken straight from `getLongestLine()` (a float) collapses
 * to `floor(width)` and wraps the very line it was measured from — which showed
 * up as every auto-width text sitting on two lines inside a box that looked too
 * narrow.
 */
function resolveTextWidth(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
): number {
  if (spec.wrapWidth != null) {
    return Math.max(MIN_TEXT_WIDTH, spec.wrapWidth);
  }
  const probe = buildParagraph(spec, fonts, AUTO_TEXT_WIDTH);
  const intrinsic = probe.getLongestLine();
  probe.dispose();
  return Math.max(
    MIN_TEXT_WIDTH,
    Math.ceil(Math.min(intrinsic, spec.maxWidth)),
  );
}

/**
 * Build a shaped, laid-out paragraph for a text object.
 *
 * The width is resolved first and the paragraph is shaped at exactly that
 * width, so `getLongestLine()` never has to stand in for the box: previously
 * the box was measured at the canvas width while the glyphs were laid out at
 * the box width, which let centred text sit off-centre and let the measured
 * height drift from the painted one.
 *
 * Callers should `paragraph.dispose()` when the render frame is done.
 */
export function layoutArabicText(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
): RenderedParagraph | null {
  const width = resolveTextWidth(spec, fonts);
  const paragraph = buildParagraph(spec, fonts, width);
  const height = paragraph.getHeight();
  return {
    paragraph,
    width,
    height,
    ink: paragraphInk(paragraph, spec.text, width, height),
  };
}

/**
 * The tight ink box of a paragraph's full text, in the object's local frame, or
 * `undefined` when there is no single rect to measure.
 *
 * A soft wrap yields one rect per line, and a part never wraps (split refuses a
 * wrapped cluster), so more than one rect means "not a shape we can hug" and the
 * caller keeps its advance box. The result can never throw: a missing Skia query
 * on an exotic backend just yields no ink.
 */
function paragraphInk(
  paragraph: SkParagraph,
  text: string,
  width: number,
  height: number,
): ParagraphInk | undefined {
  if (text.length === 0) {
    return undefined;
  }
  try {
    const rects = paragraph.getRectsForRange(0, text.length);
    if (!rects || rects.length !== 1) {
      return undefined;
    }
    const rect = rects[0];
    if (!(rect.width > 0) || !(rect.height > 0)) {
      return undefined;
    }
    return {
      // The paragraph is painted at x/y = −box/2, so a rect in the paragraph's
      // own coordinates becomes an offset from the object origin here.
      cx: rect.x + rect.width / 2 - width / 2,
      cy: rect.y + rect.height / 2 - height / 2,
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return undefined;
  }
}

/**
 * Split a laid-out paragraph into its visual lines, soft wraps included.
 *
 * Line offsets come back as UTF-16 code-unit indices. We verify that slicing
 * the source string with them reproduces the text before trusting the result;
 * when the check fails (offset units differ on some platform) we return null so
 * callers can fall back to the object's explicit newlines.
 */
function paragraphLines(paragraph: SkParagraph, text: string): string[] | null {
  try {
    const metrics = paragraph.getLineMetrics();
    if (!metrics || metrics.length === 0) {
      return null;
    }
    const lines = metrics.map((m) =>
      text.slice(m.startIndex, m.endExcludingWhitespaces ?? m.endIndex),
    );
    const strip = (s: string) => s.replace(/\s+/g, '');
    if (strip(lines.join('')) !== strip(text)) {
      return null;
    }
    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
  } catch {
    return null;
  }
}

/**
 * Visual line breaks for every text object in a project, keyed by object id.
 * Used by the SVG export, which cannot re-flow text on its own.
 */
export function textLineBreaks(
  project: MidadProject,
  fonts: SkTypefaceFontProvider,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const obj of project.objects) {
    if (obj.type !== 'text') {
      continue;
    }
    const rendered = layoutArabicText(
      {
        text: obj.text,
        fontKey: obj.fontKey,
        fontSize: obj.fontSize,
        lineHeight: obj.lineHeight,
        align: obj.align,
        color: obj.color,
        opacity: obj.opacity,
        wrapWidth: obj.wrapWidth,
        maxWidth: project.canvas.width,
      },
      fonts,
    );
    if (!rendered) {
      continue;
    }
    const lines = paragraphLines(rendered.paragraph, obj.text);
    rendered.paragraph.dispose();
    if (lines) {
      out[obj.id] = lines;
    }
  }
  return out;
}
