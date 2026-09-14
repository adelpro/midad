/**
 * Project file schema for midad designs.
 * A design is serialized as a `.midad.json` file. The schema is versioned so
 * future migrations can upgrade saved projects.
 */

export const PROJECT_FILE_EXT = "midad";
export const PROJECT_FILE_VERSION = 1;

/** Transform of an object on the canvas (design units). */
export interface ObjectTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // degrees
  flipH: boolean;
  flipV: boolean;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background: {
    type: "paper" | "transparent" | "image";
    color?: string;
    imageUri?: string;
  };
}

export type TextAlign = "left" | "center" | "right";

/**
 * Identifies a text object as one part of a word that was split into
 * independently editable pieces.
 *
 * Parts are ordinary text objects — the document model stays flat, with no
 * nesting — so hit-testing, gestures, rendering and export all keep working
 * untouched. This ref only records provenance: it is what lets the editor group
 * the parts for navigation and re-compose them into one object again.
 */
export interface TextPartRef {
  /** Id of the text object the parts were split from. */
  rootId: string;
  /** 0-based position in reading order. */
  index: number;
  /** Total number of parts in the group. */
  count: number;
  /**
   * Whitespace and zero-width characters that preceded this part in the source
   * string. Kept so re-joining can rebuild the original text exactly.
   */
  gapBefore?: string;
}

/** A soft drop shadow painted behind a text object's glyphs. */
export interface TextShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

/**
 * A named look applied to a text object by the Style navigator.
 *
 * The resolved styling always lives in the object's own properties (`fontKey`,
 * `color`, `opacity`, `lineHeight`, `shadows`); `key` is only a hint so the UI
 * can highlight which preset is active.
 */
export interface TextPresentation {
  key: string;
}

export interface CalligraphyTextObject {
  id: string;
  type: "text";
  text: string;
  fontKey: string; // one of calligraphyFonts keys
  fontSize: number;
  lineHeight: number;
  /**
   * Fixed wrap width in the object's local design units (before transform
   * scale). Set by dragging a horizontal resize handle so the glyphs re-flow.
   * `null`/absent means auto: the text hugs its content and only wraps at the
   * canvas edge.
   */
  wrapWidth?: number | null;
  align: TextAlign;
  color: string;
  opacity: number;
  outline?: { color: string; width: number };
  /**
   * Drop shadows behind the glyphs, painted in order. Rendered on the canvas and
   * in the PNG export through Skia's text shadows; the SVG export emits an
   * equivalent drop-shadow filter. Two entries give an engraved look.
   */
  shadows?: TextShadow[];
  /** Set when this object is one part of a split word. See `TextPartRef`. */
  part?: TextPartRef;
  /** The look last applied by the Style navigator. See `TextPresentation`. */
  presentation?: TextPresentation;
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

export interface GlyphObject {
  id: string;
  type: "glyph";
  glyphKey: string; // one of the decorative ornament keys
  color: string;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

/**
 * The shape family.
 *
 * Lives beside the object that persists the key rather than in the renderer:
 * the Skia renderer, the imperative PNG path, the SVG serializer and the
 * library UI all switch on it, and they must never disagree about the set.
 */
export type ShapeKey =
  | "circle"
  | "square"
  | "line"
  | "star"
  | "triangle"
  | "ring"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "crescent"
  | "arch";

export interface ShapeObject {
  id: string;
  type: "shape";
  shapeKey: ShapeKey;
  color: string;
  fill: boolean;
  strokeWidth: number;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

export type DesignObject = CalligraphyTextObject | GlyphObject | ShapeObject;

export interface MidadProject {
  version: typeof PROJECT_FILE_VERSION;
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  canvas: CanvasConfig;
  objects: DesignObject[];
  gridEnabled: boolean;
}
