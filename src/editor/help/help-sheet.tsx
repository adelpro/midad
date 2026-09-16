import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Sheet } from "@/components/ui";
import type { ShortcutId } from "@/editor/shortcuts";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { fontRoles, spacing, typeScale } from "@/theme";

import {
  HELP_GROUPS,
  helpEntry,
  helpGroupEntries,
  helpGroupLabel,
  helpLabel,
  helpRole,
} from "./catalog";
import { HelpCard, HelpRow } from "./help-list";

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
      closeButton
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
            <HelpCard>
              {helpGroupEntries(group.key).map((entry, index) => (
                <HelpRow
                  key={entry.key}
                  label={helpLabel(entry.label, t, language)}
                  role={helpRole(entry, language)}
                  icon={entry.icon}
                  // Deliberately through `chord` rather than off the binding
                  // table: the native stub returns "" so this surface can never
                  // advertise a key it cannot press.
                  keys={entry.shortcutId ? chord(entry.shortcutId) : ""}
                  divided={index > 0}
                />
              ))}
            </HelpCard>
          </View>
        ))}
      </ScrollView>
    </Sheet>
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
});
