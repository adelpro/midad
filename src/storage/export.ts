import * as Sharing from 'expo-sharing';

import { downloadBlob } from '@/storage/download';
import { hasShareSheet } from '@/storage/platform';
import { saveImageToPhotoLibrary } from '@/storage/photo-library';

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
export async function saveImageToLibrary({
  data,
  format,
  fileName,
}: ExportOptions): Promise<boolean> {
  // Native: photo library (with permission). Web: browser download.
  return saveImageToPhotoLibrary({ data, format, fileName });
}

/**
 * Share an image. On native, opens the system share sheet. On web, uses the
 * Web Share API when available, otherwise falls back to a download.
 */
export async function shareImage({
  data,
  format,
  fileName,
}: ExportOptions): Promise<boolean> {
  if (hasShareSheet) {
    return writeTempAndShare({
      data,
      fileName: `${fileName ?? 'midad-design'}.${extensionFor(format)}`,
      mimeType: mimeFor(format),
      uti: format === 'png' ? 'public.png' : 'public.jpeg',
      dialogTitle: fileName ?? 'midad design',
    });
  }

  // Web share API.
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File(
        [data],
        `${fileName ?? 'midad-design'}.${extensionFor(format)}`,
        {
          type: mimeFor(format),
        },
      );
      const shareData = { files: [file] } as ShareData;
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch {
      // fall through to download
    }
  }

  downloadBlob(
    data,
    `${fileName ?? 'midad-design'}.${extensionFor(format)}`,
    mimeFor(format),
  );
  return true;
}

export interface FileShareOptions {
  data: string | Blob;
  fileName: string;
  mimeType: string;
  /** iOS UTI hint for the share sheet. */
  uti?: string;
  dialogTitle?: string;
}

/**
 * Share an arbitrary file (SVG, JSON, ...). Same platform behavior as
 * `shareImage`: native share sheet, Web Share API, or browser download.
 */
export async function shareFile({
  data,
  fileName,
  mimeType,
  uti,
  dialogTitle,
}: FileShareOptions): Promise<boolean> {
  if (hasShareSheet) {
    return writeTempAndShare({ data, fileName, mimeType, uti, dialogTitle });
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([data], fileName, { type: mimeType });
      const shareData = { files: [file] } as ShareData;
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch {
      // fall through to download
    }
  }
  downloadBlob(data, fileName, mimeType);
  return true;
}

interface SharePayload {
  data: string | Blob;
  fileName: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}

async function writeTempAndShare({
  data,
  fileName,
  mimeType,
  uti,
  dialogTitle,
}: SharePayload): Promise<boolean> {
  const { File, Paths } = await import('expo-file-system');
  const tmp = new File(Paths.cache, `share-${Date.now()}-${fileName}`);
  if (tmp.exists) {
    tmp.delete();
  }
  tmp.create();
  if (typeof data === 'string') {
    if (!mimeType.startsWith('image/')) {
      // Text payloads (svg/json) are written as UTF-8, not base64.
      tmp.write(data);
    } else {
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      tmp.write(base64, { encoding: 'base64' });
    }
  } else {
    tmp.write(new Uint8Array(await data.arrayBuffer()));
  }
  await Sharing.shareAsync(tmp.uri, {
    mimeType,
    dialogTitle: dialogTitle ?? fileName,
    UTI: uti,
  });
  return true;
}
