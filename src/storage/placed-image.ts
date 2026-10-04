import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { Skia } from '@shopify/react-native-skia';

import { dataUriToBase64 } from '@/storage/background-image';
import { sniffImageMime } from '@/storage/design-file';

/**
 * Picking an image to *place* on the canvas.
 *
 * The background flow and this one are one picker with two consumers, so the
 * picker itself lives here and `background-image.ts` delegates: the permission
 * handling, the `quality: 0.8` budget and the byte-sniffed MIME are decided once.
 * A placed image additionally needs its intrinsic size — the object's box follows
 * the picture's aspect, and nothing downstream has a decode step to ask (`the SVG
 * export in particular has no decoder at all), so it is read here, once, at pick
 * time.
 */

/** A picked image: encoded, with the MIME and size read from its own bytes. */
export interface PlacedImage {
  base64: string;
  mime: string;
  width: number;
  height: number;
}

/**
 * Launch the system image picker and return the chosen image as base64, its real
 * MIME, and its pixel size; or `null` if the user cancels, permission is denied,
 * the picker fails, or the bytes cannot be decoded.
 */
export async function pickPlacedImage(): Promise<PlacedImage | null> {
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
    const size = intrinsicSize(asset.base64);
    if (!size) {
      return null;
    }
    return {
      base64: asset.base64,
      mime: sniffImageMime(asset.base64),
      width: size.width,
      height: size.height,
    };
  } catch {
    return null;
  }
}

/**
 * The image's pixel size, decoded once through Skia.
 *
 * `asset.width`/`asset.height` exist on the picker's own type, but they are the
 * picker's claim about the asset rather than the decoded truth, and every other
 * dimension in this app comes from bytes (see `docs/storage-format.md` on
 * `sniffImageMime`). Skia is already loaded wherever this runs.
 */
function intrinsicSize(
  base64: string,
): { width: number; height: number } | null {
  try {
    const data = Skia.Data.fromBase64(dataUriToBase64(base64));
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      return null;
    }
    const width = image.width();
    const height = image.height();
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}
