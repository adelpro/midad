/**
 * Platform-split module (`share-temp.native.ts` / `share-temp.web.ts`).
 * This file is types-only; Metro resolves the platform implementation.
 */
export interface SharePayload {
  /** Data URI (native image), raw text (SVG/JSON) or bytes (`.midad`). */
  data: string | Blob | Uint8Array;
  fileName: string;
  mimeType: string;
  /** iOS UTI hint for the share sheet. */
  uti?: string;
  dialogTitle?: string;
}

export declare function writeTempAndShare(
  payload: SharePayload,
): Promise<boolean>;
