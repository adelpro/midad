/**
 * Native host: Skia is always available on iOS/Android, so the screen is
 * imported directly (no CanvasKit bridge needed).
 */
export { EditorScreen as default } from '@/editor/EditorScreen';
