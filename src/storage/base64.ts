/**
 * The one place base64 text becomes bytes.
 *
 * The web store and the native store both receive base64 from the picker
 * (`expo-image-picker` hands it back base64) and must turn it into a
 * `Uint8Array`; keeping the decode here means the two stores cannot disagree
 * about it.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
