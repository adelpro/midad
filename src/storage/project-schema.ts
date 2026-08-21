/**
 * Project file schema for midad designs.
 * A design is serialized as a `.midad.json` file. The schema is versioned so
 * future migrations can upgrade saved projects.
 */

export const PROJECT_FILE_EXT = 'midad';
export const PROJECT_FILE_VERSION = 1;

/** Transform of an object on the canvas (design units). */
export interface ObjectTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // degrees
  flipH: boolean;
  flipV: boolean;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background: {
    type: 'paper' | 'transparent' | 'image';
    color?: string;
    imageUri?: string;
  };
}

export type TextAlign = 'left' | 'center' | 'right';

export interface CalligraphyTextObject {
  id: string;
  type: 'text';
  text: string;
  fontKey: string; // one of calligraphyFonts keys
  fontSize: number;
  lineHeight: number;
  align: TextAlign;
  color: string;
  opacity: number;
  outline?: { color: string; width: number };
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

export interface GlyphObject {
  id: string;
  type: 'glyph';
  glyphKey: string; // one of the decorative ornament keys
  color: string;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

export interface ShapeObject {
  id: string;
  type: 'shape';
  shapeKey: 'circle' | 'square' | 'line' | 'star' | 'triangle' | 'ring';
  color: string;
  fill: boolean;
  strokeWidth: number;
  opacity: number;
  transform: ObjectTransform;
  zIndex: number;
  locked?: boolean;
}

export type DesignObject = CalligraphyTextObject | GlyphObject | ShapeObject;

export interface MidadProject {
  version: typeof PROJECT_FILE_VERSION;
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  canvas: CanvasConfig;
  objects: DesignObject[];
  gridEnabled: boolean;
}