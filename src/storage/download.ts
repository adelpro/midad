import { Platform } from 'react-native';

/** Trigger a browser download for a Blob (or data URI). */
export function downloadBlob(data: string | Blob, fileName: string, mimeType: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const blob = typeof data === 'string' ? base64ToBlob(data, mimeType) : data;
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
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
