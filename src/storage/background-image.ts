import { dataUriToBase64 } from '@/storage/design-file';
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
 * byte-sniffed MIME. This module keeps only the background's own currency
 * (`base64` + `mime`).
 */

/** The picked image, encoded, with the MIME read from its own bytes. */
export interface PickedImage {
  base64: string;
  mime: string;
}

/**
 * Pick a background image: the shared picker, narrowed to the two fields a
 * background stores. `null` on cancel, denied permission or a failed pick.
 */
export async function pickBackgroundImage(): Promise<PickedImage | null> {
  const picked = await pickPlacedImage();
  return picked ? { base64: picked.base64, mime: picked.mime } : null;
}

/**
 * Re-exported for the renderers, which import it from here historically.
 *
 * It lives in `design-file.ts` now: it is pure string logic with no relation to
 * the background, and keeping it here made `placed-image.ts` → `background-image`
 * → `placed-image` a require cycle, which Metro warned about at boot
 * ("Require cycles are allowed, but can result in uninitialized values").
 */
export { dataUriToBase64 };
