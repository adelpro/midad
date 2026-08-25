/**
 * Route shell only. The editor body statically imports `@shopify/react-native-skia`
 * transitively; on web it must be evaluated after CanvasKit loads, which
 * EditorScreenHost.web handles via WithSkiaWeb. Do not add skia-reaching
 * static imports here.
 */
export { default } from '@/editor/EditorScreenHost';
