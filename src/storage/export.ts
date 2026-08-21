import { Platform } from 'react-native';

import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { hasMediaLibrary, hasShareSheet } from '@/storage/platform';

export type ImageExportFormat = 'png' | 'jpeg';

export interface ExportOptions {
  /** Data URI (native) or Blob/ArrayBuffer (web) */
  data: string | Blob;
  format: ImageExportFormat;
  fileName?: string;
}

export interface ExportResult {
  savedToLibrary: boolean;
  shared: boolean;
}

function mimeFor(format: ImageExportFormat): string {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}

function extensionFor(format: ImageExportFormat): string {
  return format;
}

/**
 * Save an image. On native, writes to the photo library (with permission).
 * On web, triggers a browser download of the image.
 */
export async function saveImageToLibrary({ data, format, fileName }: ExportOptions): Promise<boolean> {
  if (!hasMediaLibrary) {
    // Web: browser download via Blob URL.
    downloadBlob(data, `${fileName ?? 'midad-design'}.${extensionFor(format)}`, mimeFor(format));
    return true;
  }

  // Native: write bytes to a temp file, then into the photo library.
  const { File, Paths } = await import('expo-file-system');
  const tmp = new File(Paths.cache, `${fileName ?? 'midad-design'}-${Date.now()}.${extensionFor(format)}`);
  if (tmp.exists) {
    tmp.delete();
  }
  tmp.create();
  if (typeof data === 'string') {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    tmp.write(base64, { encoding: 'base64' });
  } else {
    tmp.write(new Uint8Array(await data.arrayBuffer()));
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  await MediaLibrary.saveToLibraryAsync(tmp.uri);
  tmp.delete();
  return true;
}

/**
 * Share an image. On native, opens the system share sheet. On web, uses the
 * Web Share API when available, otherwise falls back to a download.
 */
export async function shareImage({ data, format, fileName }: ExportOptions): Promise<boolean> {
  if (hasShareSheet) {
    const { File, Paths } = await import('expo-file-system');
    const tmp = new File(Paths.cache, `share-${Date.now()}.${extensionFor(format)}`);
    if (tmp.exists) {
      tmp.delete();
    }
    tmp.create();
    if (typeof data === 'string') {
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      tmp.write(base64, { encoding: 'base64' });
    } else {
      tmp.write(new Uint8Array(await data.arrayBuffer()));
    }
    await Sharing.shareAsync(tmp.uri, {
      mimeType: mimeFor(format),
      dialogTitle: fileName ?? 'midad design',
      UTI: format === 'png' ? 'public.png' : 'public.jpeg',
    });
    return true;
  }

  // Web share API.
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([data], `${fileName ?? 'midad-design'}.${extensionFor(format)}`, {
        type: mimeFor(format),
      });
      const shareData = { files: [file] } as ShareData;
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch {
      // fall through to download
    }
  }

  downloadBlob(data, `${fileName ?? 'midad-design'}.${extensionFor(format)}`, mimeFor(format));
  return true;
}

/** Trigger a browser download for a Blob (or data URI). */
function downloadBlob(data: string | Blob, fileName: string, mimeType: string): void {
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