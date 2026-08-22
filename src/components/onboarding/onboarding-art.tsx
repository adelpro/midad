import { StyleSheet, View } from 'react-native';
import { PenNib, Sparkle, Export, TextAa, type IconProps } from 'phosphor-react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius, spacing } from '@/theme';

export type OnboardingArtVariant = 'craft' | 'fonts' | 'share';

/**
 * Professional onboarding illustrations.
 * A large Phosphor glyph inside a hairline circle on a tinted disk — cohesive,
 * crisp at any size, and identical across platforms (Phosphor + react-native-svg).
 */

const GLYPHS: Record<OnboardingArtVariant, React.ComponentType<IconProps>> = {
  craft: PenNib,
  fonts: TextAa,
  share: Export,
};

export function OnboardingArt({ variant }: { variant: OnboardingArtVariant }) {
  const { colors: c } = useTheme();
  const Glyph = GLYPHS[variant];
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
        <View style={[styles.disk, { backgroundColor: c.accentSoft }]}>
          <Glyph size={88} color={c.accent} weight="duotone" />
        </View>
        <Sparkle size={20} color={c.faint} style={styles.sparkle} weight="bold" />
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
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disk: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: 26,
    right: 30,
  },
});