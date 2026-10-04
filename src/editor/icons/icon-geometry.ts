/**
 * Resolving an Iconify icon body into drawable paths.
 *
 * Pure module — **no imports**, so `scripts/check-icons.mjs` can transpile and
 * evaluate it standalone.
 *
 * ## Why paths and not markup
 *
 * An icon arrives as an SVG body. The obvious move is to hand that markup to
 * Skia's SVG module, and it is the wrong one here: `Skia.SVG` is **not available
 * in the web build**, which renders through CanvasKit, so the PNG export would
 * have needed a second implementation for web. Resolving to paths instead means
 * every renderer — the live canvas, the PNG export, the SVG export — uses only
 * the core Skia Path API, which exists on both, and the SVG export stays a true
 * vector rather than a rasterised blob.
 *
 * `@iconify/utils` was considered and rejected: its parsed form is *still*
 * markup (`parseSVGContent` → `convertParsedSVG` yields a `body` string), so it
 * would add a dependency without removing the markup problem.
 *
 * ## What is refused, and why refusing beats approximating
 *
 * A closed set of shapes is handled: `<path>` elements, `<g>` wrappers, and an
 * `<svg>` root. Everything else — `<circle>`, `<rect>`, `<line>`, `<polygon>`,
 * any `transform` — returns `null`, and the picker shows the icon as unavailable
 * with that reason.
 *
 * That is deliberately harsh. A dropped `<circle>` is not a crash; it is a
 * picture that is subtly wrong, in a design the user then exports. A disabled row
 * costs a choice. A silently incomplete drawing costs the user's trust in every
 * export afterwards.
 */

/** One drawable path of an icon, in the icon's own viewBox units. */
export interface IconPath {
  /** SVG path data, passed to Skia or written into the SVG export verbatim. */
  d: string;
  fillRule: 'nonzero' | 'evenodd';
}

/** Elements that carry geometry this resolver cannot represent. */
const UNSUPPORTED = [
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'image',
  'text',
  'use',
];

/**
 * Resolve an Iconify icon body to its paths.
 *
 * Returns `null` when the body contains anything that cannot be drawn as a
 * filled path — see the module docblock.
 */
export function iconPathsFromBody(body: string): IconPath[] | null {
  if (typeof body !== 'string' || body.trim() === '') {
    return null;
  }

  // Any element this cannot represent makes the whole icon unavailable. Checked
  // before parsing so the reason is never partial output.
  for (const tag of UNSUPPORTED) {
    if (new RegExp(`<${tag}[\\s/>]`, 'i').test(body)) {
      return null;
    }
  }

  // A transform would move the geometry relative to the box everything else
  // measures against, and honouring it means implementing the whole transform
  // grammar. Refused rather than ignored.
  if (/transform\s*=/i.test(body)) {
    return null;
  }

  // Anything that is not a known-safe element is refused too — this is the
  // catch-all that keeps a new element type from slipping through as invisible.
  const unknown = body.matchAll(/<([a-zA-Z][\w-]*)[\s/>]/g);
  for (const match of unknown) {
    const tag = match[1].toLowerCase();
    if (tag === 'path' || tag === 'g' || tag === 'svg') {
      continue;
    }
    return null;
  }

  const paths: IconPath[] = [];

  // Walk `<path>` elements in document order, tracking the nearest enclosing
  // `<g>`'s fill-rule — a group is how these sets express a holed shape, and
  // losing it fills in the holes.
  const tagPattern = /<(\/?)(path|g)\b([^>]*)>/gi;
  const groupRules: ('nonzero' | 'evenodd')[] = [];
  let match;

  while ((match = tagPattern.exec(body)) !== null) {
    const [, closing, tag, attrs] = match;
    const name = tag.toLowerCase();

    if (name === 'g') {
      if (closing) {
        groupRules.pop();
      } else {
        groupRules.push(fillRuleOf(attrs) ?? 'nonzero');
      }
      continue;
    }

    if (closing) {
      continue;
    }

    const d = attrOf(attrs, 'd');
    if (!d) {
      // A path with no geometry draws nothing; skipping it silently would hide a
      // malformed icon, so the icon is refused.
      return null;
    }
    paths.push({
      d,
      fillRule:
        fillRuleOf(attrs) ?? groupRules[groupRules.length - 1] ?? 'nonzero',
    });
  }

  return paths.length > 0 ? paths : null;
}

/**
 * The filled rule an element declares, from either spelling these sets use.
 *
 * `clip-rule` is accepted as a synonym on purpose: a set that clips with
 * `evenodd` means the same thing about the hole it carved, and treating the two
 * differently would render one of them wrong.
 */
function fillRuleOf(attrs: string): 'nonzero' | 'evenodd' | null {
  const value = attrOf(attrs, 'fill-rule') ?? attrOf(attrs, 'clip-rule');
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase() === 'evenodd' ? 'evenodd' : 'nonzero';
}

/** Read one attribute's value from an element's attribute string. */
function attrOf(attrs: string, name: string): string | null {
  const quoted = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs);
  if (quoted) {
    return quoted[1];
  }
  const single = new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i').exec(attrs);
  return single ? single[1] : null;
}
