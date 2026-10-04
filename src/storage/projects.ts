import type { StoredImage } from '@/storage/design-file';
import type { MidadProject } from '@/storage/project-schema';

/**
 * Platform-split module (`projects.native.ts` / `projects.web.ts`).
 * This file is types-only; Metro resolves the platform implementation.
 *
 * A design is a **package**: a small document plus, when it has one, its
 * background image as raw bytes. On native that is a folder per design; on web
 * it is a key per file, because `localStorage` is string-only. `saveProject`
 * writes the document only — the image is written once, when it is picked or
 * imported — which is what keeps autosave cheap.
 */
export declare function listProjects(): Promise<MidadProject[]>;
export declare function loadProject(id: string): Promise<MidadProject | null>;
export declare function saveProject(
  project: MidadProject,
  options?: SaveOptions,
): Promise<void>;

/**
 * Ids a reachable undo/redo step still references, so a save does not delete
 * their bytes.
 *
 * The editor passes the ids held by its history when it saves. Without this the
 * sweep cannot tell "the user deleted this" from "the user deleted this and can
 * still undo", and a 1-second autosave debounce makes the difference decisive:
 * deleting an image, pausing, then undoing would restore an object whose bytes
 * were already gone.
 */
export interface SaveOptions {
  retainObjectIds?: readonly string[];
}
export declare function deleteProject(id: string): Promise<void>;

/** Write the picked image and return its reference. Replaces any previous one. */
export declare function writeBackgroundImage(
  id: string,
  base64: string,
  mime: string,
): Promise<StoredImage>;

/** Write image bytes (import path) and return their reference. */
export declare function writeBackgroundBytes(
  id: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage>;

/** Read the raw image bytes, for packing an exported `.midad`. */
export declare function readBackgroundBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null>;

/**
 * Write one placed object's image bytes. The file is keyed by the object id, so
 * a replacement overwrites and a delete leaves an orphan to be swept on save.
 */
export declare function writeAssetBytes(
  id: string,
  objectId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage>;

/** Read one placed object's raw bytes, for packing or rebuilding its URI. */
export declare function readAssetBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null>;
