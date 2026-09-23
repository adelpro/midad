import { downloadBlob } from '@/storage/download';
import { saveImageToPhotoLibrary } from '@/storage/photo-library';
import { hasShareSheet } from '@/storage/platform';
import { writeTempAndShare } from '@/storage/share-temp';

export type ImageExportFormat = 'png' | 'jpeg';

export interface ExportOptions {
  /** Data URI (native) or Blob/ArrayBuffer (web) */
  data: string | Blob;
  format: ImageExportFormat;
  fileName?: string;
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
  /** Text (SVG/JSON), bytes (a `.midad` container), or a Blob. */
  data: string | Blob | Uint8Array;
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
      const file = new File([data as BlobPart], fileName, { type: mimeType });
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
