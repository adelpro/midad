/**
 * A placed image, rendered into a `0..size` box like a shape or a glyph.
 *
 * The object kind's own module rather than a branch inside `EditorCanvas`, for
 * the same reason `shape-geometry.ts` and `glyph-shape.tsx` are their own: the
 * live canvas, the imperative PNG path and the SVG serializer must agree about
 * how an asset maps onto its box, and one constant is how they agree.
 */

/**
 * Base box size (design units) a placed asset is rendered into before its
 * transform. It matches `SHAPE_BASE_SIZE` so a freshly inserted image sits at the
 * same visual weight as a shape; the object's `aspect` scales the width only.
 */
export const IMAGE_BASE_SIZE = 120;
