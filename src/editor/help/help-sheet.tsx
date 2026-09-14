import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Icon, Kbd, Sheet } from "@/components/ui";
import type { ShortcutId } from "@/editor/shortcuts";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import { fontRoles, radius, spacing, typeScale } from "@/theme";

import {
  HELP_GROUPS,
  helpEntry,
  helpGroupEntries,
  helpGroupLabel,
  helpLabel,
  helpRole,
  type HelpEntry,
} from "./catalog";

export interface HelpSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Chord text for one action; empty where the platform has no keyboard. */
  chord: (id: ShortcutId) => string;
  /** Leave the sheet and turn on learn mode. */
  onStartLearn: () => void;
}

/**
 * The complete reference: every control in the editor, grouped, with its role
 * and — on the web, where a key can actually be pressed — its chord.
 *
 * Presented as a centred modal rather than a bottom sheet for two reasons. The
 * list is long enough to scroll, and `Sheet` only enables its drag-to-dismiss
 * pan for the bottom presentation; a modal has no such gesture, so the inner
 * `ScrollView` owns vertical drags outright instead of fighting the sheet.
 */
export function HelpSheet({
  visible,
  onClose,
  chord,
  onStartLearn,
}: HelpSheetProps) {
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const learn = helpEntry("topBar.learn");

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.editor.helpTitle}
      presentation="modal"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { fontFamily: fonts.ui, color: c.muted }]}>
          {t.editor.helpIntro}
        </Text>

        <Button
          label={helpLabel(learn.label, t, language)}
          variant="secondary"
          onPress={onStartLearn}
          accessibilityLabel={helpLabel(learn.label, t, language)}
          accessibilityHint={helpRole(learn, language)}
        />

        {HELP_GROUPS.map((group) => (
          <View key={group.key} style={styles.section}>
            <Text
              style={[
                styles.sectionLabel,
                { fontFamily: fonts.uiBold, color: c.muted },
              ]}
            >
              {helpGroupLabel(group, language)}
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: c.surfaceAlt, borderColor: c.border },
              ]}
            >
              {helpGroupEntries(group.key).map((entry, index) => (
                <HelpRow
                  key={entry.key}
                  entry={entry}
                  chord={chord}
                  divided={index > 0}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function HelpRow({
  entry,
  chord,
  divided,
}: {
  entry: HelpEntry;
  chord: (id: ShortcutId) => string;
  /** Draw a hairline above this row. Every row but the first in its group. */
  divided: boolean;
}) {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  // Deliberately through `chord` rather than off the binding table: the native
  // stub returns "" so this surface can never advertise an unpressable key.
  const keys = entry.shortcutId ? chord(entry.shortcutId) : "";

  return (
    <View
      style={[
        styles.row,
        rowStyle(isRTL),
        divided && { borderTopWidth: 1, borderColor: c.border },
      ]}
    >
      {entry.icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Icon name={entry.icon} size={16} color={c.inkSoft} />
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
            {helpLabel(entry.label, t, language)}
          </Text>
          {keys ? <Kbd>{keys}</Kbd> : null}
        </View>
        <Text
          style={[styles.rowRole, { fontFamily: fonts.ui, color: c.muted }]}
        >
          {helpRole(entry, language)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  scrollBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  intro: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowHead: { alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
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
