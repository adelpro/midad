import type { SharePayload } from './share-temp';

/**
 * Web has no temp-file share path — callers use the Web Share API or a browser
 * download (`shareImage`/`shareFile` only reach this on native).
 */
export async function writeTempAndShare(
  _payload: SharePayload,
): Promise<boolean> {
  return false;
}
