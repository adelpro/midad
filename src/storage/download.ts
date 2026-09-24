import { Platform } from 'react-native';

import { base64BodyOf, stringWriteEncoding } from '@/storage/export-payload';

/**
 * Trigger a browser download for bytes, a Blob, or a base64 data URI.
 *
 * A `string` payload is not automatically base64: SVG XML and JSON are text.
 * The encoding decision is the shared `stringWriteEncoding`, the same one the
 * native writer makes, so an SVG download cannot base64-decode raw XML (which
 * throws "String contains an invalid character").
 */
export function downloadBlob(
  data: string | Blob | Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const blob =
    typeof data === 'string'
      ? stringWriteEncoding(data) === 'base64'
        ? base64ToBlob(data, mimeType)
        : new Blob([data], { type: mimeType })
      : data instanceof Uint8Array
        ? new Blob([data as BlobPart], { type: mimeType })
        : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convert a base64 data URI (e.g. `data:image/png;base64,...`) to a Blob. */
function base64ToBlob(dataUri: string, mimeType: string): Blob {
  const binary = atob(base64BodyOf(dataUri));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
