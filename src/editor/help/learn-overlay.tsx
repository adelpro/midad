import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Icon, IconButton, Reveal } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import {
  elevationStyle,
  fontRoles,
  radius,
  shadows,
  spacing,
  typeScale,
} from "@/theme";

import {
  helpEntry,
  helpGroup,
  helpGroupEntries,
  helpGroupLabel,
  helpLabel,
  helpRole,
  type HelpKey,
} from "./catalog";

export interface LearnOverlayProps {
  /** The control the user inspected last, or null before the first tap. */
  activeKey: HelpKey | null;
  onExit: () => void;
  onOpenHelp: () => void;
}

/** Fixed column for gesture names so the roles line up as a table. */
const LEGEND_LABEL_WIDTH = 92;

/**
 * The learn-mode surfaces.
 *
 * Both cards sit **inside** the canvas box rather than in the column flow, so
 * turning learn mode on cannot resize the canvas and re-run its fit-to-view —
 * the failure mode DESIGN.md §5 reserved the context rail to avoid. Floating
 * over the canvas is normally banned for the opposite reason (chrome between
 * the finger and the selection handles), and that does not apply here: object
 * gestures are off while the mode is on, so there is nothing to grab. The
 * legend is what explains those frozen gestures instead.
 */
export function LearnOverlay({
  activeKey,
  onExit,
  onOpenHelp,
}: LearnOverlayProps) {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const active = activeKey ? helpEntry(activeKey) : null;
  const gestures = helpGroupEntries("canvas");
  const gestureGroup = helpGroup("canvas");

  return (
    <View style={[styles.overlay, { pointerEvents: "box-none" }]}>
      <Reveal
        style={[
          styles.banner,
          { backgroundColor: c.surface, borderColor: c.borderStrong },
          elevationStyle(c, shadows.float),
        ]}
      >
        <View style={[styles.bannerHead, rowStyle(isRTL)]}>
          <View style={styles.bannerText}>
            <Text
              style={[
                styles.bannerLabel,
                { fontFamily: fonts.uiBold, color: c.ink },
              ]}
            >
              {active
                ? helpLabel(active.label, t, language)
                : t.editor.helpTitle}
            </Text>
            <Text
              style={[
                styles.bannerRole,
                { fontFamily: fonts.ui, color: c.inkSoft },
              ]}
            >
              {active ? helpRole(active, language) : t.editor.learnHint}
            </Text>
          </View>
          <IconButton
            onPress={onExit}
            accessibilityLabel={t.common.done}
            hint={t.common.done}
          >
            <Icon name="close" size={18} />
          </IconButton>
        </View>
        <Button
          label={t.editor.helpAllTools}
          variant="ghost"
          onPress={onOpenHelp}
        />
      </Reveal>

      <Reveal
        style={[
          styles.legend,
          { backgroundColor: c.surface, borderColor: c.border },
          elevationStyle(c, shadows.float),
        ]}
      >
        <Text
          style={[
            styles.legendTitle,
            { fontFamily: fonts.uiBold, color: c.ink },
          ]}
        >
          {helpGroupLabel(gestureGroup, language)}
        </Text>
        <Text
          style={[styles.legendNote, { fontFamily: fonts.ui, color: c.faint }]}
        >
          {t.editor.learnPaused}
        </Text>
        <ScrollView
          style={styles.legendScroll}
          contentContainerStyle={styles.legendBody}
          showsVerticalScrollIndicator={false}
        >
          {gestures.map((entry) => (
            <View key={entry.key} style={[styles.legendRow, rowStyle(isRTL)]}>
              <Text
                style={[
                  styles.legendLabel,
                  { fontFamily: fonts.uiBold, color: c.ink },
                ]}
              >
                {helpLabel(entry.label, t, language)}
              </Text>
              <Text
                style={[
                  styles.legendRole,
                  { fontFamily: fonts.ui, color: c.muted },
                ]}
              >
                {helpRole(entry, language)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    // Inset by the canvas wrapper's own padding so both cards align with the
    // canvas card edge instead of the border box.
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    justifyContent: "space-between",
    gap: spacing.sm,
    zIndex: 20,
  },
  banner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerHead: { alignItems: "flex-start", gap: spacing.sm },
  bannerText: { flex: 1, gap: 2 },
  bannerLabel: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
  },
  bannerRole: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  // Shrinks rather than overflows when the canvas box is short (landscape), so
  // the legend scrolls instead of pushing the banner off the top.
  legend: {
    flexShrink: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  legendTitle: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  legendNote: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
  legendScroll: { flexShrink: 1, marginTop: spacing.xs },
  legendBody: { gap: spacing.sm },
  legendRow: { alignItems: "flex-start", gap: spacing.sm },
  legendLabel: {
    width: LEGEND_LABEL_WIDTH,
    flexShrink: 0,
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  legendRole: {
    flex: 1,
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
});
