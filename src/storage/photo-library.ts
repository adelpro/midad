import type { ExportOptions } from '@/storage/export';

/**
 * Platform-split module (`photo-library.native.ts` / `photo-library.web.ts`).
 * This file is types-only; Metro resolves the platform implementation.
 */
export declare function saveImageToPhotoLibrary(
  options: ExportOptions,
): Promise<boolean>;
