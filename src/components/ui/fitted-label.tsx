import { Text, type TextProps } from 'react-native';

export interface FittedLabelProps extends Omit<
  TextProps,
  'children' | 'numberOfLines'
> {
  /** The caption to render on one line. */
  label: string;
  /**
   * The smallest fraction of the base size the label may shrink to. Below this
   * the platform stops scaling and the tail ellipsizes instead.
   */
  minimumFontScale?: number;
}

/**
 * A single-line caption that shrinks to fit its container instead of clipping.
 *
 * Fixed-width chrome — the tool rail's six tiles, the font picker's three
 * filters — cannot hold the longest Arabic label at a phone's narrowest width.
 * A plain `Text` with `numberOfLines={1}` either wraps past a fixed height (and
 * clips) or ellipsizes mid-word, both of which read as breakage. `Text`'s own
 * `adjustsFontSizeToFit` (Android/iOS) steps the size down until the label fits.
 *
 * On the web, react-native-web ignores `adjustsFontSizeToFit`, so the safe
 * fallback is `ellipsizeMode="tail"`: a clean ellipsis beats a clipped glyph.
 * Native is where the bug was reported and where the fit is expected.
 */
export function FittedLabel({
  label,
  minimumFontScale = 0.75,
  ...rest
}: FittedLabelProps) {
  return (
    <Text
      {...rest}
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={minimumFontScale}
    >
      {label}
    </Text>
  );
}
