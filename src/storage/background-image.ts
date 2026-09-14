import * as ImagePicker from "expo-image-picker";

import { isWeb } from "@/storage/platform";

/**
 * Background image helpers.
 *
 * A design's background image is stored as a base64 data URI in
 * `CanvasConfig.background.imageUri`. Embedding the bytes in the project JSON
 * keeps `.midad.json` files self-contained: export/import carries the image
 * with the design, and every renderer (live canvas, PNG, SVG) can consume the
 * data URI directly.
 */

/**
 * Strip the `data:<mime>;base64,` prefix from a data URI, returning the raw
 * base64 payload. Pure string logic — no imports, so it stays harness-testable.
 */
export function dataUriToBase64(dataUri: string): string {
  const comma = dataUri.indexOf(",");
  return comma === -1 ? dataUri : dataUri.slice(comma + 1);
}

/**
 * Launch the system image picker and return the chosen image as a base64 data
 * URI, or `null` if the user cancels, permission is denied, or the picker
 * fails. The caller stores the result in `background.imageUri`.
 *
 * `quality: 0.8` keeps JPEGs a reasonable size for embedding in the project
 * file; PNGs pass through at full size (a known, acceptable trade-off).
 */
export async function pickBackgroundImage(): Promise<string | null> {
  try {
    // Web has no permission gate — the browser owns the picker.
    if (!isWeb) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return null;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
    const mime = asset.mimeType ?? "image/jpeg";
    return `data:${mime};base64,${asset.base64}`;
  } catch {
    return null;
  }
}
