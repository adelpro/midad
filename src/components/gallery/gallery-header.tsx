import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark, Icon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import { fontRoles, radius, spacing, typeScale } from '@/theme';

/** Content height of the expanded header (status-bar inset added by the screen). */
export const GALLERY_HEADER_LARGE = 64;
const CONTENT_COMPACT = 56;
const RANGE = GALLERY_HEADER_LARGE - CONTENT_COMPACT;

export interface GalleryHeaderProps {
  /** Shared scroll offset from the gallery list. */
  scrollY: SharedValue<number>;
  /** Pluralized count caption, e.g. "3 designs" / "3 تصاميم". */
  count: string;
  /** Wide layout shows labeled actions; phones get icons only. */
  isWide: boolean;
  onImport: () => void;
  onCreate: () => void;
}

/**
 * Collapsible brand header: the calligraphic midad mark + actions when
 * expanded; on scroll the bar compacts and the item count fades in where
 * a title would sit. Actions show labels on wide screens, icons only on
 * phones. Absolutely positioned — the list scrolls beneath it.
 */
export function GalleryHeader({
  scrollY,
  count,
  isWide,
  onImport,
  onCreate,
}: GalleryHeaderProps) {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const insets = useSafeAreaInsets();
  // Explicit bidi direction for texts — `forceRTL` alone is unreliable on web,
  // and mixed Latin/Arabic content needs an anchored writing direction.
  const dir = { writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) };

  const containerStyle = useAnimatedStyle(() => ({
    height:
      insets.top +
      interpolate(
        scrollY.value,
        [0, RANGE],
        [GALLERY_HEADER_LARGE, CONTENT_COMPACT],
        'clamp',
      ),
  }));

  const countStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [RANGE * 0.4, RANGE], [0, 1], 'clamp'),
    transform: [
      { translateY: interpolate(scrollY.value, [0, RANGE], [6, 0], 'clamp') },
    ],
  }));

  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [RANGE * 0.5, RANGE], [0, 1], 'clamp'),
  }));

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: c.paper,
          paddingTop: insets.top,
          paddingHorizontal: spacing.xl,
        },
        containerStyle,
      ]}
    >
      <View style={[styles.topRow, rowStyle(isRTL)]}>
        <View style={[styles.brand, rowStyle(isRTL)]}>
          <BrandMark height={isWide ? 38 : 34} />
          {isWide && (
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.brandName,
                { fontFamily: fonts.displayBold, color: c.ink },
                dir,
              ]}
            >
              {t.appName}
            </Text>
          )}
        </View>
        <View style={[styles.actions, rowStyle(isRTL)]}>
          {isWide ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.gallery.importDesigns}
                onPress={onImport}
                style={({ pressed }) => [
                  styles.pill,
                  styles.pillSecondary,
                  rowStyle(isRTL),
                  { borderColor: c.border },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="download" size={18} color={c.ink} />
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    styles.pillLabel,
                    { color: c.ink, fontFamily: fonts.uiSemibold },
                    dir,
                  ]}
                >
                  {t.gallery.importDesigns}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.gallery.newDesign}
                onPress={onCreate}
                style={({ pressed }) => [
                  styles.pill,
                  rowStyle(isRTL),
                  { backgroundColor: c.ink },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="plus" size={18} color={c.onInk} />
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    styles.pillLabel,
                    { color: c.onInk, fontFamily: fonts.uiSemibold },
                    dir,
                  ]}
                >
                  {t.gallery.newDesign}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.gallery.importDesigns}
                onPress={onImport}
                style={({ pressed }) => [
                  styles.roundGhost,
                  { borderColor: c.border },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="download" size={20} color={c.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.gallery.newDesign}
                onPress={onCreate}
                style={({ pressed }) => [
                  styles.roundAction,
                  { backgroundColor: c.ink },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="plus" size={20} color={c.onInk} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Count surfaces only once the header has collapsed. */}
      <Animated.View
        style={[styles.compactCountWrap, countStyle, { pointerEvents: 'none' }]}
      >
        <Text
          style={[
            styles.compactCount,
            { fontFamily: fonts.uiSemibold, color: c.muted },
            dir,
          ]}
        >
          {count}
        </Text>
      </Animated.View>

      {/* Hairline appears once collapsed (content scrolls beneath). */}
      <Animated.View
        style={[styles.hairline, { backgroundColor: c.border }, hairlineStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandName: {
    fontSize: 26,
    lineHeight: 34,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  pillSecondary: {
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },
  roundGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  roundAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: radius.pill,
  },
  pillLabel: {
    fontSize: typeScale.small.size,
  },
  pressed: {
    opacity: 0.85,
  },
  compactCountWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md + 8,
  },
  compactCount: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
