/**
 * Shaping-aware segmentation of a string into connected glyph clusters.
 *
 * Why this exists
 * ---------------
 * Arabic letters change shape according to their neighbours (isolated /
 * initial / medial / final). Splitting a word per Unicode code point would
 * detach each letter from its neighbours and change how it renders.
 *
 * A *cluster* here is a maximal run of letters that the shaper joins into one
 * continuous stroke. The property that makes splitting safe: the first letter of
 * a connected run is always in initial form and the last is always in final
 * form — which is exactly what HarfBuzz picks when that same run is shaped on
 * its own. So a cluster rendered as a standalone string produces identical glyph
 * forms to the original word, and no glyph-path access is needed.
 *
 * Example: `مدرسة` → `مد` | `ر` | `سة`.
 */

/** Unicode joining behaviour of a code point. */
export type JoiningType =
  /** Dual-joining: connects to both neighbours. */
  | "D"
  /** Right-joining: connects only to the preceding letter. */
  | "R"
  /** Join-causing: tatweel and ZWJ force a connection. */
  | "C"
  /** Transparent: combining marks, which never affect joining. */
  | "T"
  /** Non-joining: whitespace, digits, punctuation, Latin, ZWNJ. */
  | "U";

export interface TextCluster {
  /** Inclusive UTF-16 index into the source string. */
  start: number;
  /** Exclusive UTF-16 index into the source string. */
  end: number;
  /** The cluster's exact source slice. */
  text: string;
  /**
   * Whitespace that preceded this cluster in the source. Kept so the parts can
   * be re-composed into the original string without losing separators.
   */
  gapBefore: string;
}

type Range = readonly [number, number];

const isIn = (cp: number, ranges: readonly Range[]): boolean => {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) {
      return true;
    }
    if (cp < lo) {
      break; // ranges are sorted
    }
  }
  return false;
};

/** Combining marks and other transparent code points. */
const TRANSPARENT: readonly Range[] = [
  [0x0300, 0x036f], // combining diacriticals (Latin etc.)
  [0x0483, 0x0489],
  [0x0591, 0x05c7], // Hebrew points
  [0x0610, 0x061a], // Arabic signs
  [0x064b, 0x065f], // harakat
  [0x0670, 0x0670], // superscript alef
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x0711, 0x0711],
  [0x0730, 0x074a],
  [0x07a6, 0x07b0],
  [0x07eb, 0x07f3],
  [0x0816, 0x082d],
  [0x0859, 0x085b],
  [0x08d3, 0x08ff],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f], // variation selectors
  [0xfe20, 0xfe2f],
  [0x1f3fb, 0x1f3ff], // emoji skin tones
];

/**
 * Arabic letters that connect only to the preceding letter. Everything else in
 * the Arabic blocks is treated as dual-joining.
 *
 * Unknown letters therefore default to D, which is the safe failure mode: two
 * genuinely connected letters stay together. A wrong split would visibly break
 * the shape, while a conservative merge merely produces a larger part.
 */
const RIGHT_JOINING: readonly Range[] = [
  [0x0622, 0x0625], // آ أ ؤ إ
  [0x0627, 0x0627], // ا
  [0x0629, 0x0629], // ة
  [0x062f, 0x0632], // د ذ ر ز
  [0x0648, 0x0649], // و ى
  [0x0671, 0x0677], // ٱ ٲ ٳ ٵ ٶ ٷ
  [0x0688, 0x0699], // dal/reh/zain families with dots
  [0x06c0, 0x06c0],
  [0x06c3, 0x06cb], // ة ۄ ۅ ۆ ۇ ۈ ۉ ۊ ۋ
  [0x06cd, 0x06cd],
  [0x06cf, 0x06cf],
  [0x06d2, 0x06d3], // ے ۓ
  [0x06d5, 0x06d5],
  [0x0759, 0x075b],
  [0x076b, 0x076c],
  [0x0771, 0x0774],
  [0x0778, 0x0779],
];

/** Arabic code points that behave as letters for joining purposes. */
const ARABIC_LETTERS: readonly Range[] = [
  [0x0620, 0x0620],
  // 0x0621 (hamza) is deliberately absent: it never joins.
  [0x0622, 0x063f],
  [0x0641, 0x064a],
  [0x066e, 0x06d3],
  [0x06d5, 0x06d5],
  [0x06e5, 0x06e6],
  [0x06ee, 0x06ef],
  [0x06fa, 0x06fc],
  [0x06ff, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08d2],
];

/** Tatweel and ZWJ: they force the neighbours to connect. */
const JOIN_CAUSING = new Set([0x0640, 0x200d]);

function joiningType(cp: number): JoiningType {
  if (isIn(cp, TRANSPARENT)) {
    return "T";
  }
  if (JOIN_CAUSING.has(cp)) {
    return "C";
  }
  if (isIn(cp, RIGHT_JOINING)) {
    return "R";
  }
  if (isIn(cp, ARABIC_LETTERS)) {
    return "D";
  }
  return "U";
}

const canJoinForward = (t: JoiningType): boolean => t === "D" || t === "C";
const canJoinBackward = (t: JoiningType): boolean =>
  t === "D" || t === "R" || t === "C";

/**
 * Whitespace plus zero-width / formatting code points. These affect where a
 * break happens (ZWNJ in particular exists to *prevent* a join) but draw
 * nothing, so they can never be a part in their own right. They are carried in
 * `gapBefore` instead, which keeps Rejoin exact.
 */
const INVISIBLE_CHARS =
  /[\s\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/gu;

/** Whether a slice would actually put ink on the canvas. */
const rendersInk = (slice: string): boolean =>
  slice.replace(INVISIBLE_CHARS, "").length > 0;

interface Unit {
  type: JoiningType;
  /** UTF-16 index range of this code point. */
  start: number;
  end: number;
}

interface Group {
  units: Unit[];
  /** The last non-transparent unit, or null while only marks have been seen. */
  base: Unit | null;
}

function tokenize(text: string): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i) as number;
    const size = cp > 0xffff ? 2 : 1;
    units.push({ type: joiningType(cp), start: i, end: i + size });
    i += size;
  }
  return units;
}

/**
 * Split `text` into connected clusters, in logical (reading) order.
 *
 * Runs that draw no ink — whitespace and zero-width/formatting characters such
 * as ZWNJ — are not returned as clusters; their text is carried into the
 * `gapBefore` of the following cluster so the parts can be re-joined losslessly.
 */
export function segmentClusters(text: string): TextCluster[] {
  const groups: Group[] = [];

  for (const unit of tokenize(text)) {
    const current = groups[groups.length - 1];
    if (!current) {
      groups.push({ units: [unit], base: unit.type === "T" ? null : unit });
      continue;
    }
    if (unit.type === "T") {
      // Marks always stay with the base they decorate. A leading mark run keeps
      // `base` null so the first real letter still joins it.
      current.units.push(unit);
      continue;
    }
    const joins =
      current.base === null ||
      (canJoinForward(current.base.type) && canJoinBackward(unit.type));
    if (joins) {
      current.units.push(unit);
      current.base = unit;
    } else {
      groups.push({ units: [unit], base: unit });
    }
  }

  const clusters: TextCluster[] = [];
  let gap = "";
  for (const group of groups) {
    const start = group.units[0].start;
    const end = group.units[group.units.length - 1].end;
    const raw = text.slice(start, end);
    if (!rendersInk(raw)) {
      // Whitespace or a zero-width break character: carry it forward so Rejoin
      // can rebuild the original string.
      gap += raw;
      continue;
    }
    clusters.push({ start, end, text: raw, gapBefore: gap });
    gap = "";
  }
  return clusters;
}

/** Whether a text object can be broken into independently movable parts. */
export function canSplitIntoClusters(text: string): boolean {
  return segmentClusters(text).length >= 2;
}
