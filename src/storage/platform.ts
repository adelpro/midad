import { Platform } from 'react-native';

/**
 * Platform capability flags.
 * Web has no filesystem / media-library / share-sheet, so we branch on these.
 */
export const isWeb = Platform.OS === 'web';

export const hasNativeFileSystem = !isWeb;
export const hasMediaLibrary = !isWeb;
export const hasShareSheet = !isWeb;
export const hasWebShareApi = isWeb && typeof navigator !== 'undefined' && 'share' in navigator;

/** Read the Skia canvasKit wasm URL used on web. */
export function canvaskitWasmUrl(): string {
  // Served from the app root (copied from `public/canvaskit.wasm`).
  return '/canvaskit.wasm';
}