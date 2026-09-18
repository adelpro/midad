import { downloadBlob } from '@/storage/download';

import type { ExportOptions } from '@/storage/export';

/** Web: no photo library — trigger a browser download of the image. */
export async function saveImageToPhotoLibrary({
  data,
  format,
  fileName,
}: ExportOptions): Promise<boolean> {
  downloadBlob(
    data,
    `${fileName ?? 'midad-design'}.${format}`,
    `image/${format}`,
  );
  return true;
}
