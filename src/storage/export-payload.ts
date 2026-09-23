/**
 * Export payload classification — no imports, so
 * `scripts/check-export-payload.mjs` can transpile and evaluate it standalone.
 */

/**
 * The write encoding for a string payload.
 *
 * A **base64 data URI** is binary bytes and must be written with base64
 * decoding; everything else (SVG XML, JSON) is text and must be written as
 * UTF-8. Deciding by mime type is wrong: `image/svg+xml` is text, and treating
 * it as an image base64-decoded the XML and failed with "bad base-64".
 */
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
