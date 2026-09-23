import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { base64BodyOf, stringWriteEncoding } from '@/storage/export-payload';

import type { SharePayload } from './share-temp';

/**
 * Write a payload to the cache and hand it to the system share sheet.
 *
 * The file-system module is imported **statically**: a runtime `import()`
 * resolves through Expo's async-require in development, which fetches the
 * module from the dev server and fails with "could not load bundle" whenever
 * that server is unreachable — surfacing as an export failure.
 */
export async function writeTempAndShare({
  data,
  fileName,
  mimeType,
  uti,
  dialogTitle,
}: SharePayload): Promise<boolean> {
  const tmp = new File(Paths.cache, `share-${Date.now()}-${fileName}`);
  if (tmp.exists) {
    tmp.delete();
  }
  tmp.create();
  if (typeof data === 'string') {
    if (stringWriteEncoding(data) === 'base64') {
      tmp.write(base64BodyOf(data), { encoding: 'base64' });
    } else {
      // Text payloads (svg/json) are written as UTF-8, never base64-decoded.
      tmp.write(data);
    }
  } else if (data instanceof Uint8Array) {
    tmp.write(data);
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
