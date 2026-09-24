import { BottomSheet } from '@expo/ui';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import { radius, spacing } from '@/theme';

import { Icon } from './icon';
import { IconButton } from './icon-button';

export interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Render a close (X) button in the header, next to the title.
   *
   * Dismissal is always available (drag, backdrop tap, Android back, Escape on
   * the web), but the explicit X suits the reference surfaces, so it stays
   * opt-in rather than automatic.
   */
  closeButton?: boolean;
  /**
   * Horizontal padding of the panel (dp), defaulting to `spacing.lg`.
   *
   * A sheet whose content wants the widest column it can get — the text sheet's
   * preview, which is a scale model of the canvas — loosens it; everything else
   * takes the default.
   */
  contentPadding?: number;
}

/** Fraction of the window the sheet body may grow to before the inner scrollers take over. */
const MAX_BODY_FRACTION = 0.82;

/**
 * Bottom sheet, the same on every OS. `@expo/ui`'s universal `BottomSheet`
 * renders the SwiftUI sheet on iOS, the Compose `ModalBottomSheet` on Android
 * and a Vaul dialog drawer on the web, so the platform owns presentation, the
 * drag-to-dismiss gesture, back-press/Escape dismissal, focus trapping, body
 * scroll lock and reduced motion — and the app owns the content (DESIGN.md §4).
 *
 * Everything inside is the app's own column: the pill handle, the title / close
 * row, then the caller's children. The column is bounded at 82% of the window
 * because the sheet auto-sizes to its content on every platform — without the
 * cap, a long list would size the whole sheet taller than the screen instead of
 * scrolling inside it. The old code achieved the same by capping the panel; the
 * cap just moved into the content.
 *
 * On the web the drawer stretches full-width by default, so `public/midad-web.css`
 * caps it at `layout.maxContent` and centres it — keeping the DESIGN.md §5 rule
 * that a wide display cannot stretch the panel across the window.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  closeButton,
  contentPadding = spacing.lg,
}: SheetProps) {
  const { colors: c } = useTheme();
  const { t, isRTL } = useT();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      showDragIndicator={false}
      containerColor={c.surface}
      contentPadding={0}
    >
      <View
        style={[
          styles.body,
          {
            paddingHorizontal: contentPadding,
            maxHeight: Math.round(windowHeight * MAX_BODY_FRACTION),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
        {closeButton ? (
          <View style={[styles.headerRow, rowStyle(isRTL)]}>
            {title ? (
              <Text style={[styles.title, styles.titleInRow, { color: c.ink }]}>
                {title}
              </Text>
            ) : null}
            <IconButton
              onPress={onClose}
              accessibilityLabel={t.common.close}
              size={32}
            >
              <Icon name="close" size={18} />
            </IconButton>
          </View>
        ) : title ? (
          <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
        ) : null}
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    // Bounded to the window rather than the sheet's (auto-sized) height, so the
    // inner `flexShrink: 1` scrollers bite exactly as they did against the old
    // panel's `maxHeight: '82%'` — and a short viewport scrolls instead of
    // clipping its Done button.
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  titleInRow: {
    marginBottom: 0,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
});
