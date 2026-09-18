import { Export, PenNib, TextAa, type IconProps } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type OnboardingArtVariant = 'craft' | 'fonts' | 'share';
export type OnboardingArtSize = 'sm' | 'md' | 'lg';

/**
 * Professional onboarding illustrations.
 * A large Phosphor glyph inside a hairline circle on a tinted disk — cohesive,
 * crisp at any size, and identical across platforms (Phosphor + react-native-svg).
 *
 * The geometry is expressed as a size preset so the art can shrink on short
 * viewports instead of forcing the layout to clip.
 */

const GLYPHS: Record<OnboardingArtVariant, React.ComponentType<IconProps>> = {
  craft: PenNib,
  fonts: TextAa,
  share: Export,
};

const GEOMETRY: Record<
  OnboardingArtSize,
  { ring: number; disk: number; glyph: number }
> = {
  sm: { ring: 148, disk: 98, glyph: 60 },
  md: { ring: 200, disk: 132, glyph: 88 },
  lg: { ring: 236, disk: 156, glyph: 104 },
};

export function OnboardingArt({
  variant,
  size = 'md',
}: {
  variant: OnboardingArtVariant;
  size?: OnboardingArtSize;
}) {
  const { colors: c } = useTheme();
  const Glyph = GLYPHS[variant];
  const { ring, disk, glyph } = GEOMETRY[size];
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: c.border,
            backgroundColor: c.surfaceAlt,
          },
        ]}
      >
        <View
          style={[
            styles.disk,
            {
              width: disk,
              height: disk,
              borderRadius: disk / 2,
              backgroundColor: c.accentSoft,
            },
          ]}
        >
          <Glyph size={glyph} color={c.accent} weight="duotone" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disk: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
