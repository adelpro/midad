import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, Kbd, type IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import { fontRoles, radius, spacing, typeScale } from '@/theme';

export interface HelpRowProps {
  /** The control's name, already resolved for the current language. */
  label: string;
  /** What it does, in one sentence. */
  role: string;
  /**
   * Omitted where the icon depends on direction, or where the surface does not
   * carry glyphs at all.
   */
  icon?: IconName;
  /**
   * The chord, e.g. "⇧T". Omitting it — or passing `""`, which is what the
   * native stub returns — leaves the row without a key badge, so no surface can
   * advertise a key the platform cannot press.
   */
  keys?: string;
  /** Draw a hairline above this row. Every row but the first in its group. */
  divided?: boolean;
}

/**
 * One control's name and role, as the reference lists it.
 *
 * Extracted from `help-sheet.tsx` because a second reading surface needs the
 * same markup: learn mode opens the selection bar's `⋯` as a reference list of
 * the controls it hides. A row that repeated the same idea in a different shape
 * would be a second rendering of the reference rather than the same one.
 *
 * The props are **resolved strings rather than a catalog entry**, because the
 * callers already hold the copy for what they are rendering — the help sheet
 * resolves an entry, the overflow sheet a `SelectionAction`. Nothing here needs
 * to know which of the two it is drawing.
 */
export function HelpRow({ label, role, icon, keys, divided }: HelpRowProps) {
  const { language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];

  return (
    <View
      style={[
        styles.row,
        rowStyle(isRTL),
        divided && { borderTopWidth: 1, borderColor: c.border },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Icon name={icon} size={16} color={c.inkSoft} />
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <View style={[styles.rowHead, rowStyle(isRTL)]}>
          <Text
            style={[
              styles.rowLabel,
              { fontFamily: fonts.uiBold, color: c.ink },
            ]}
          >
            {label}
          </Text>
          {keys ? <Kbd>{keys}</Kbd> : null}
        </View>
        <Text
          style={[styles.rowRole, { fontFamily: fonts.ui, color: c.muted }]}
        >
          {role}
        </Text>
      </View>
    </View>
  );
}

export type HelpCardProps = PropsWithChildren;

/**
 * The grouped container the rows sit in: one card per group, hairlines between
 * rows. `overflow: "hidden"` is safe here for the reason it is banned on the
 * selection rail — nothing inside a reference row opens a tooltip.
 */
export function HelpCard({ children }: HelpCardProps) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowHead: { alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowLabel: {
    flexShrink: 1,
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  rowRole: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
});
