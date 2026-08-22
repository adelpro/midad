/**
 * Native host: Skia is always available on iOS/Android, so the canvas is
 * imported directly (no CanvasKit bridge needed).
 */
export { EditorCanvas as EditorCanvasHost } from '@/editor/EditorCanvas';
