import { pickPlacedImage } from '@/storage/placed-image';

/**
 * Background-image helpers.
 *
 * A design's background image is stored as raw bytes beside the document (see
 * `design-file.ts`), never as a base64 string inside it. The picker hands back
 * base64, so that is the currency here; the storage layer decodes it once, on
 * write, and rebuilds the in-memory `data:` URI on load.
 *
 * The picker itself is shared with placed images — see `placed-image.ts`, which
 * owns the platform permission handling, the `quality` budget and the
 * byte-sniffed MIME. This module keeps the background's own currency
 * (`base64` + `mime`) and the pure data-URI helper every renderer needs.
 */

/** The picked image, encoded, with the MIME read from its own bytes. */
export interface PickedImage {
  base64: string;
  mime: string;
}

/**
 * Strip the `data:<mime>;base64,` prefix from a data URI, returning the raw
 * base64 payload. Pure string logic — no imports, so it stays harness-testable.
 */
export function dataUriToBase64(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  return comma === -1 ? dataUri : dataUri.slice(comma + 1);
}

/**
 * Pick a background image: the shared picker, narrowed to the two fields a
 * background stores. `null` on cancel, denied permission or a failed pick.
 */
export async function pickBackgroundImage(): Promise<PickedImage | null> {
  const picked = await pickPlacedImage();
  return picked ? { base64: picked.base64, mime: picked.mime } : null;
}
