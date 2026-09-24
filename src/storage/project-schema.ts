/**
 * Project file schema for midad designs.
 *
 * A design is a `.midad` container: a ZIP holding `design.json` plus the raw
 * background image bytes. The document itself is this JSON; the image travels
 * beside it rather than inside it, so a photo does not bloat the document or
 * the autosave. The schema is versioned, and v2 is the only version this code
 * reads — there is no v1 path.
 */

export const PROJECT_FILE_EXT = 'midad';
export const PROJECT_FILE_VERSION = 2;

/** Transform of an object on the canvas (design units). */
export interface ObjectTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // degrees
  flipH: boolean;
  flipV: boolean;
}

export interface CanvasBackground {
  type: 'paper' | 'transparent' | 'image';
  color?: string;
  /**
   * Name of the stored image inside the design's package. Persisted, and only
   * meaningful for `type: 'image'`.
   */
  imageFile?: string;
  /** MIME type of the stored image. Persisted. */
  imageMime?: string;
  /**
   * Data URI rebuilt from the stored bytes when the design is loaded. It is
   * **in-memory only** and stripped before the document is written — that is
   * what keeps the image out of `design.json`.
   */
  imageUri?: string;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background: CanvasBackground;
}

export type TextAlign = 'left' | 'center' | 'right';

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

/**
 * Membership of an object in a group.
 *
 * A group is a set of objects the editor treats as one element: tapping any
 * member selects them all, and they move, duplicate, reorder and restyle
 * together. Like `TextPartRef`, membership is a plain field on the object
 * rather than a container type, so the document model stays flat and
 * hit-testing, gestures, rendering and export keep working untouched.
 *
 * The editor also holds one invariant on top of this field: a selection is
 * always a union of *whole* groups, so a group can never be half-selected.
 */
export interface GroupMember {
  /**
   * Id of the group this object belongs to. Absent when the object stands
   * alone, which is the state every object is created in.
   */
  groupId?: string;
}

export interface CalligraphyTextObject extends GroupMember {
  id: string;
  type: 'text';
  text: string;
  /**
   * Bundled variant key (e.g. `'Amiri-Bold'`) or a remote Google Font face
   * (`'remote:<fontsource-id>:<weight>'`, e.g. `'remote:markazi-text:400'`).
   * Remote faces are downloaded on demand; a document that names one is
   * rendered in Amiri until it is installed on the device — see
   * `docs/editor-remote-fonts.md`.
   */
  fontKey: string;
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
}

export interface GlyphObject extends GroupMember {
  id: string;
  type: 'glyph';
  glyphKey: string; // one of the decorative ornament keys
  color: string;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
}

/**
 * The shape family.
 *
 * Lives beside the object that persists the key rather than in the renderer:
 * the Skia renderer, the imperative PNG path, the SVG serializer and the
 * library UI all switch on it, and they must never disagree about the set.
 */
export type ShapeKey =
  | 'circle'
  | 'square'
  | 'line'
  | 'star'
  | 'triangle'
  | 'ring'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'crescent'
  | 'arch';

export interface ShapeObject extends GroupMember {
  id: string;
  type: 'shape';
  shapeKey: ShapeKey;
  color: string;
  fill: boolean;
  strokeWidth: number;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
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
