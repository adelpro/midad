import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnimatedPressable, Button, Sheet } from '@/components/ui';
import { useInstalledRemoteFontKeys } from '@/hooks/use-installed-remote-fonts';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  filterRemoteFontFamilies,
  getRemoteFontCatalog,
} from '@/storage/remote-font-catalog';
import { downloadRemoteFont } from '@/storage/remote-font-registry';
import {
  familyForVariant,
  fontFamilies,
  fontRoles,
  radius,
  spacing,
  typeScale,
} from '@/theme';
import { remoteFontKey, type RemoteFontFamily } from '@/theme/remote-fonts';

/** A real phrase, so a row shows the face's letterforms rather than its name. */
const SPECIMEN = 'بسم الله';
/** Debounce before the remote catalog search runs per keystroke. */
const REMOTE_SEARCH_DEBOUNCE_MS = 200;
/** Cap on remote rows shown at once (the bundled list has ~22 families). */
const REMOTE_RESULT_LIMIT = 30;

type RemoteSearchState = 'idle' | 'loading' | 'ready' | 'error';

export interface FontPickerSheetProps {
  visible: boolean;
  /** The current `fontKey`. */
  value: string;
  onChange: (fontKey: string) => void;
  onClose: () => void;
}

/**
 * Full-height font picker: a scrollable list of large specimens. The selected
 * family expands **inline** to reveal its variant chips, so the list never
 * reflows and single-variant families simply have no chip row.
 *
 * Native presents as a bottom sheet; web as a centred modal — the bottom sheet's
 * drag-to-dismiss is a touch affordance and can swallow the list's scroll.
 */
export function FontPickerSheet({
  visible,
  value,
  onChange,
  onClose,
}: FontPickerSheetProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const uiFont = fontRoles[language].ui;
  const [query, setQuery] = useState('');
  const activeKey = familyForVariant(value)?.key;
  /** Remote faces registered this session — drives the chips' installed state. */
  const installedRemote = useInstalledRemoteFontKeys();

  // Google Fonts search state. The catalog (~2100 families) is fetched once and
  // cached by `remote-font-catalog`, so after the first read this is a local
  // filter per keystroke.
  const [remoteState, setRemoteState] = useState<RemoteSearchState>('idle');
  const [remoteFamilies, setRemoteFamilies] = useState<RemoteFontFamily[]>([]);
  /** The family row whose weight chips are expanded. */
  const [openRemoteId, setOpenRemoteId] = useState<string | null>(null);
  /** The face currently downloading (one at a time keeps the chips calm). */
  const [installing, setInstalling] = useState<{
    id: string;
    weight: number;
  } | null>(null);
  /** A face whose download failed — its chip turns into a retry. */
  const [installErrorKey, setInstallErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    // All state writes happen inside the timer callback (an async context),
    // never synchronously in the effect body — the sheet must not cascade a
    // render the moment the query changes. An empty query schedules a 0ms
    // reset; anything else runs the debounced catalog search.
    const timer = setTimeout(
      async () => {
        setRemoteState('loading');
        if (!q) {
          setRemoteState('idle');
          setRemoteFamilies([]);
          setInstallErrorKey(null);
          return;
        }
        try {
          const catalog = await getRemoteFontCatalog();
          if (cancelled) {
            return;
          }
          setRemoteFamilies(
            filterRemoteFontFamilies(catalog, q, REMOTE_RESULT_LIMIT),
          );
          setRemoteState('ready');
        } catch {
          if (!cancelled) {
            setRemoteState('error');
          }
        }
      },
      q ? REMOTE_SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const installFace = useCallback(
    async (id: string, weight: number) => {
      setInstalling({ id, weight });
      setInstallErrorKey(null);
      try {
        await downloadRemoteFont(id, weight);
        onChange(remoteFontKey(id, weight));
      } catch {
        setInstallErrorKey(remoteFontKey(id, weight));
      } finally {
        setInstalling(null);
      }
    },
    [onChange],
  );

  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Clear on close so reopening always shows the full catalogue, not the last
  // search term (the sheet stays mounted while hidden).
  const closeSheet = () => {
    setQuery('');
    setOpenRemoteId(null);
    onClose();
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fontFamilies;
    return fontFamilies.filter(
      (f) =>
        f.labelEn.toLowerCase().includes(q) ||
        f.labelAr.includes(q) ||
        f.styleTagEn.toLowerCase().includes(q) ||
        f.styleTagAr.includes(q),
    );
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={closeSheet}
      title={t.editor.fontFamily}
      closeButton
      presentation={Platform.OS === 'web' ? 'modal' : 'bottom'}
    >
      <View
        style={[
          styles.search,
          { backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.editor.searchFont}
          placeholderTextColor={c.muted}
          accessibilityLabel={t.editor.searchFont}
          style={[
            styles.searchInput,
            {
              color: c.ink,
              fontFamily: uiFont,
              writingDirection: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listBody}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {matches.map((family) => {
          const selected = family.key === activeKey;
          return (
            <View key={family.key}>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label(
                  family.labelAr,
                  family.labelEn,
                )}, ${label(family.styleTagAr, family.styleTagEn)}`}
                onPress={() => onChange(family.defaultVariant)}
                style={[
                  styles.row,
                  {
                    borderColor: selected ? c.ink : c.border,
                    backgroundColor: selected ? c.surfaceAlt : c.surface,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.specimen,
                    { color: c.ink, fontFamily: family.defaultVariant },
                  ]}
                >
                  {SPECIMEN}
                </Text>
                <Text
                  style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}
                >
                  {label(family.labelAr, family.labelEn)} ·{' '}
                  {label(family.styleTagAr, family.styleTagEn)}
                </Text>
              </AnimatedPressable>

              {selected && family.variants.length > 1 && (
                <View style={styles.chips}>
                  {family.variants.map((variant) => {
                    const on = variant.key === value;
                    return (
                      <AnimatedPressable
                        key={variant.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={label(
                          variant.labelAr,
                          variant.labelEn,
                        )}
                        onPress={() => onChange(variant.key)}
                        style={[
                          styles.chip,
                          {
                            borderColor: on ? c.ink : c.border,
                            backgroundColor: on ? c.ink : c.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: on ? c.onInk : c.ink,
                            fontFamily: uiFont,
                            fontSize: typeScale.caption.size,
                          }}
                        >
                          {label(variant.labelAr, variant.labelEn)}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Google Fonts — the on-demand section. It appears only while typing,
            so the picker's search box doubles as its search field; the catalog
            is searched by display name, and each family row expands to weight
            chips with a download state machine (download → spinner → installed
            / retry). */}
        {!!query.trim() && (
          <>
            <View style={styles.sectionHead}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: c.ink, fontFamily: uiFont },
                ]}
              >
                {t.editor.googleFonts}
              </Text>
              <Text
                style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}
              >
                {t.editor.googleFontsHint}
              </Text>
            </View>

            {remoteState === 'loading' && (
              <ActivityIndicator
                color={c.muted}
                style={styles.remoteLoading}
                accessibilityLabel={t.common.loading}
              />
            )}
            {remoteState === 'error' && (
              <Text
                style={[styles.meta, { color: c.danger, fontFamily: uiFont }]}
              >
                {t.editor.fontCatalogFailed}
              </Text>
            )}

            {remoteState === 'ready' &&
              remoteFamilies.map((family) => {
                const open = family.id === openRemoteId;
                const hasArabic = family.subsets.includes('arabic');
                const badge = hasArabic
                  ? t.editor.supportsArabic
                  : t.editor.noArabicSupport;
                return (
                  <View key={family.id}>
                    <AnimatedPressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`${family.family}, ${badge}`}
                      onPress={() => {
                        setOpenRemoteId(open ? null : family.id);
                        setInstallErrorKey(null);
                      }}
                      style={[
                        styles.row,
                        {
                          borderColor: open ? c.ink : c.border,
                          backgroundColor: open ? c.surfaceAlt : c.surface,
                        },
                      ]}
                    >
                      <View style={styles.remoteRowMain}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.remoteName,
                            { color: c.ink, fontFamily: uiFont },
                          ]}
                        >
                          {family.family}
                        </Text>
                        <Text
                          style={[
                            styles.remoteBadge,
                            {
                              color: hasArabic ? c.ink : c.muted,
                              fontFamily: uiFont,
                            },
                          ]}
                        >
                          {badge}
                        </Text>
                      </View>
                    </AnimatedPressable>

                    {open && (
                      <View style={styles.chips}>
                        {family.weights.map((weight) => {
                          const key = remoteFontKey(family.id, weight);
                          const selected = key === value;
                          const installed = installedRemote.has(key);
                          const busy =
                            installing?.id === family.id &&
                            installing.weight === weight;
                          const failed = installErrorKey === key;
                          // 400/700 get the bundled registry's عادي/عريض
                          // vocabulary; rarer weights keep their number.
                          const weightName =
                            weight === 400
                              ? t.editor.fontWeightRegular
                              : weight === 700
                                ? t.editor.fontWeightBold
                                : String(weight);
                          const chipLabel = busy
                            ? t.editor.downloadingFont
                            : failed
                              ? t.editor.retryDownload
                              : installed && !selected
                                ? `✓ ${weightName}`
                                : weightName;
                          return (
                            <AnimatedPressable
                              key={key}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected,
                                busy,
                                disabled: busy,
                              }}
                              accessibilityLabel={`${family.family} ${weightName}${
                                installed
                                  ? `, ${t.editor.installedFont}`
                                  : `, ${t.editor.downloadFont}`
                              }`}
                              disabled={busy}
                              onPress={() =>
                                void installFace(family.id, weight)
                              }
                              style={[
                                styles.chip,
                                {
                                  borderColor:
                                    selected || installed ? c.ink : c.border,
                                  backgroundColor: selected
                                    ? c.ink
                                    : c.surfaceAlt,
                                },
                              ]}
                            >
                              {busy ? (
                                <ActivityIndicator
                                  size="small"
                                  color={c.onInk}
                                />
                              ) : (
                                <Text
                                  style={{
                                    color: selected ? c.onInk : c.ink,
                                    fontFamily: uiFont,
                                    fontSize: typeScale.caption.size,
                                  }}
                                >
                                  {chipLabel}
                                </Text>
                              )}
                            </AnimatedPressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

            {remoteState === 'ready' &&
              matches.length === 0 &&
              remoteFamilies.length === 0 && (
                <Text
                  style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}
                >
                  {t.editor.noFontResults}
                </Text>
              )}
          </>
        )}
      </ScrollView>

      <Button label={t.common.done} onPress={closeSheet} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    fontSize: typeScale.body.size,
    padding: 0,
  },
  list: { flexShrink: 1 },
  listBody: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  specimen: { fontSize: 26 },
  meta: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typeScale.body.size,
  },
  remoteRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  remoteName: {
    fontSize: typeScale.body.size,
    flexShrink: 1,
  },
  remoteBadge: {
    fontSize: typeScale.caption.size,
  },
  remoteLoading: {
    paddingVertical: spacing.md,
    alignSelf: 'center',
  },
});
