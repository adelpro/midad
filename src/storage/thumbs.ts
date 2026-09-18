import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const THUMB_MAX_WIDTH_PX = 360;

const key = (id: string) => `midad:thumb:${id}`;
const fileName = (id: string) => `${id}.thumb.png`;

export function saveThumb(id: string, base64DataUri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.setItem(key(id), base64DataUri);
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    if (f.exists) f.delete();
    f.create();
    const raw = base64DataUri.includes(',')
      ? base64DataUri.split(',')[1]!
      : base64DataUri;
    f.write(raw, { encoding: 'base64' });
  })();
}

export function getThumb(id: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key(id));
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    return f.exists ? f.uri : null;
  })();
}

export function deleteThumb(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.removeItem(key(id));
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    if (f.exists) f.delete();
  })();
}
