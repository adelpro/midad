import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import {
  PROJECT_FILE_VERSION,
  type MidadProject,
} from '@/storage/project-schema';

/**
 * The `.midad` container: a ZIP holding the document and, when the design has
 * one, its background image as raw bytes.
 *
 * The image is the reason this format exists. It used to ride inside
 * `design.json` as a base64 `data:` URI, which cost ~33% of the image in
 * padding and made every autosave re-stringify a multi-megabyte document. Here
 * it is a sibling entry, so the document stays small and the bytes stay bytes.
 *
 * `design.json` is DEFLATE-compressed; the image entry is stored, because JPEG
 * and PNG are already compressed and deflating them only burns CPU.
 */

/** The document entry. The only entry a reader needs by name. */
export const DESIGN_ENTRY = 'design.json';

export interface ImagePayload {
  bytes: Uint8Array;
  mime: string;
}

/**
 * A background image after it has been written: the reference that goes into
 * `design.json`, plus the in-memory data URI the renderers consume.
 */
export interface StoredImage {
  imageFile: string;
  imageMime: string;
  imageUri: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

/** The entry name the image is stored under, derived from its MIME. */
export function imageEntryName(mime: string): string {
  return `background.${EXT_BY_MIME[mime] ?? 'jpg'}`;
}

/**
 * The image MIME, read from the encoded bytes rather than trusted from the
 * picker.
 *
 * `expo-image-picker` can report a type that disagrees with the file it hands
 * back (a JPEG labelled `image/tiff`), and that label ends up in the `data:`
 * URI the SVG export embeds — where a viewer that trusts it can refuse the
 * image. The base64 prefix is the file's own signature, so this cannot drift.
 */
export function sniffImageMime(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('Qk')) return 'image/bmp';
  return 'image/jpeg';
}

/**
 * The document as it is written: the in-memory `imageUri` is dropped, leaving
 * only the reference to the stored image. Every write goes through this, so the
 * data URI can never leak back into the file.
 */
export function toPersisted(project: MidadProject): MidadProject {
  const { imageUri: _imageUri, ...background } = project.canvas.background;
  return {
    ...project,
    canvas: { ...project.canvas, background },
  };
}

/** Pack a document and its image into one `.midad`. */
export function packDesign(
  project: MidadProject,
  image: ImagePayload | null,
): Uint8Array {
  const files: Zippable = {
    [DESIGN_ENTRY]: strToU8(JSON.stringify(toPersisted(project))),
  };
  if (image) {
    files[imageEntryName(image.mime)] = [image.bytes, { level: 0 }];
  }
  return zipSync(files);
}

export interface UnpackedDesign {
  project: MidadProject;
  image: ImagePayload | null;
}

/**
 * Read a `.midad` container.
 *
 * Returns `null` for anything that is not a current-version container — a
 * legacy `.midad.json`, a corrupt archive, or a document from another version.
 * There is deliberately no fallback: v2 is the format, and an unreadable file
 * is reported rather than guessed at.
 */
export function unpackDesign(data: Uint8Array): UnpackedDesign | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    return null;
  }
  const design = files[DESIGN_ENTRY];
  if (!design) {
    return null;
  }
  let project: MidadProject;
  try {
    project = JSON.parse(strFromU8(design)) as MidadProject;
  } catch {
    return null;
  }
  if (
    project?.version !== PROJECT_FILE_VERSION ||
    !project.canvas?.background
  ) {
    return null;
  }
  const background = project.canvas.background;
  let image: ImagePayload | null = null;
  if (background.type === 'image' && background.imageFile) {
    const bytes = files[background.imageFile];
    if (bytes) {
      image = { bytes, mime: background.imageMime ?? 'image/jpeg' };
    }
  }
  return { project, image };
}
