import { StyleSheet, Text } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import {
  AnimatedPressable,
  Icon,
  type IconName,
  type IconProps,
} from '@/components/ui';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

import { ACTION_W } from './swipe';

export interface RowActionProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Icon + label colour, chosen by the parent that owns the row's state. */
  color: string;
  /** `fill` marks a pinned row; `regular` is the default. */
  weight?: IconProps['weight'];
  /** Reachable by screen reader/keyboard only while its row is open. */
  focusable: boolean;
}

/**
 * One swipe action behind a gallery row: a glyph over its label.
 *
 * Press feedback is the shared `usePressFeedback` behaviour, matching `Card` and
 * `IconButton`: the press lands on touch-down (opacity + scale), the release
 * settles by spring. That is what makes the red delete panel read as a physical
 * control you have already pressed, rather than something that only reacts once
 * the finger has gone. Reduce motion keeps the opacity change and drops the
 * scale — the feedback stays, the vestibular motion does not.
 */
export function RowAction({
  icon,
  label,
  onPress,
  color,
  weight = 'regular',
  focusable,
}: RowActionProps) {
  const { language } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(() => ({
    opacity: press.pressed.value ? 0.7 : 1,
    transform: [{ scale: press.scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The animated style reaches the Pressable directly — see `pressable.tsx`
      // for why a `({ pressed }) => …` style function never updates.
      style={[styles.action, animStyle]}
    >
      <Icon name={icon} size={18} color={color} weight={weight} />
      <Text
        numberOfLines={1}
        style={[styles.label, { color, fontFamily: fonts.ui }]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  label: {
    fontSize: typeScale.micro.size,
  },
});
