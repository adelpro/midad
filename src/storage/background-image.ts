import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { sniffImageMime } from '@/storage/design-file';

/**
 * Background image helpers.
 *
 * A design's background image is stored as raw bytes beside the document (see
 * `design-file.ts`), never as a base64 string inside it. The picker hands back
 * base64, so that is the currency here; the storage layer decodes it once, on
 * write, and rebuilds the in-memory `data:` URI on load.
 */

/** The picked image, encoded, with the MIME read from its own bytes. */
export interface PickedImage {
  base64: string;
  mime: string;
}

/**
 * Strip the `data:<mime>;base64,` prefix from a data URI, returning the raw
 * base64 payload. Pure string logic — no imports, so it stays harness-testable.
 */
export function dataUriToBase64(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  return comma === -1 ? dataUri : dataUri.slice(comma + 1);
}

/**
 * Launch the system image picker and return the chosen image as base64 plus its
 * real MIME, or `null` if the user cancels, permission is denied, or the picker
 * fails.
 *
 * `quality: 0.8` keeps JPEGs a reasonable size for embedding in the project
 * file; PNGs pass through at full size (a known, acceptable trade-off).
 */
export async function pickBackgroundImage(): Promise<PickedImage | null> {
  try {
    // Web has no permission gate — the browser owns the picker.
    // Android's system photo picker grants access to the selected image and
    // does not require broad photo-library read permission. iOS still needs
    // its photo-library authorization before opening the picker.
    if (Platform.OS === 'ios') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return null;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) {
      return null;
    }
    const asset = result.assets[0];
    if (!asset?.base64) {
      return null;
    }
    return { base64: asset.base64, mime: sniffImageMime(asset.base64) };
  } catch {
    return null;
  }
}
