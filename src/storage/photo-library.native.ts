import type { ExportOptions } from '@/storage/export';

/**
 * Native: write bytes to a temp file, then into the photo library
 * (with permission). Lives in a `.native.ts` file so web/SSR bundles
 * never load `expo-media-library` (it crashes at import time in Node).
 */
export async function saveImageToPhotoLibrary({
  data,
  format,
  fileName,
}: ExportOptions): Promise<boolean> {
  const { File, Paths } = await import('expo-file-system');
  const tmp = new File(
    Paths.cache,
    `${fileName ?? 'midad-design'}-${Date.now()}.${format}`,
  );
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

  const MediaLibrary = await import('expo-media-library');
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    tmp.delete();
    return false;
  }
  await MediaLibrary.saveToLibraryAsync(tmp.uri);
  tmp.delete();
  return true;
}
