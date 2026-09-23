import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

import type { ExportOptions } from '@/storage/export';

/**
 * Native: write bytes to a temp file, then into the photo library
 * (with permission). Lives in a `.native.ts` file so web/SSR bundles
 * never load `expo-media-library` (it crashes at import time in Node), and
 * imports **statically** — a runtime `import()` resolves through Expo
 * async-require in development and fails with "could not load bundle" when the
 * dev server is unreachable.
 */
export async function saveImageToPhotoLibrary({
  data,
  format,
  fileName,
}: ExportOptions): Promise<boolean> {
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

  // Write-only: saving needs the "add to library" permission, not read access.
  // `Asset.create` and the top-level `requestPermissionsAsync` are the current
  // API — the `MediaLibrary.*` namespace methods are legacy and throw at
  // runtime on SDK 57.
  const { status } = await requestPermissionsAsync(true, ['photo']);
  if (status !== 'granted') {
    tmp.delete();
    return false;
  }
  try {
    await Asset.create(tmp.uri);
  } finally {
    tmp.delete();
  }
  return true;
}
