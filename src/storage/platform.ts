import { Platform } from 'react-native';

/**
 * Platform capability flags.
 * Web has no share sheet, so we branch on this.
 */
export const isWeb = Platform.OS === 'web';

export const hasMediaLibrary = !isWeb;
export const hasShareSheet = !isWeb;

/** Read the Skia canvasKit wasm URL used on web. */
export function canvaskitWasmUrl(): string {
  // Served from the app root (copied from `public/canvaskit.wasm`).
  return '/canvaskit.wasm';
}
