import 'react-native';

declare module 'react-native' {
  interface ViewStyle {
    touchAction?: string;
    userSelect?: string;
  }
}
