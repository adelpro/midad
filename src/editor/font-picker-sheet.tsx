import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  AnimatedPressable,
  Button,
  DirectionIcon,
  Icon,
  Sheet,
} from '@/components/ui';
import { useInstalledRemoteFontKeys } from '@/hooks/use-installed-remote-fonts';
import { useLoadedBundledFontKeys } from '@/hooks/use-loaded-bundled-fonts';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useFontPins } from '@/storage/font-pins';
import { warmDisplayFonts } from '@/storage/bundled-font-registry';
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
  type FontFamily,
  type FontScript,
} from '@/theme';
import { familyPinId, googlePinId, parseFontPinId } from '@/theme/font-pins';
import {
  filterBundledDuplicates,
  humanizeRemoteFontId,
  parseRemoteFontKey,
  remoteFontKey,
  type RemoteFontFamily,
} from '@/theme/remote-fonts';

/**
 * A real phrase, so a row shows the face's letterforms rather than its name.
 *
 * Per script, because the faces are. An Arabic phrase in a Latin face shows
 * nothing useful: the picker renders through React Native `Text`, so a face
 * that cannot draw the sample falls back to the platform font rather than
 * failing — which made every Latin row identical Arabic text in a fallback
 * face, telling the designer nothing about the faces on offer.
 *
 * The Latin sample is chosen to show what a script face is *for*: `Affection`
 * has an `ff` ligature, a tall `f` ascender and a `ct` pair, none of which
 * `Lorem ipsum` exercises.
 */
const SPECIMENS: Record<FontScript, string> = {
  arabic: 'بسم الله',
  latin: 'Affection',
};

/**
 * Every folded name a bundled family answers to, mapped to the weights it
 * provides — the input `filterBundledDuplicates` needs to tell a redundant
 * Google row from a useful one.
 *
 * A family is registered under several spellings: its own key, its label, and
 * the keys of its variants. The variant keys matter most, because they are
 * where the two registries' spellings diverge: the bundle calls one family
 * `noto-naskh` and labels it "Noto Naskh", while Google ships
 * `noto-naskh-arabic` — only the variant key `NotoNaskhArabic` folds to meet it.
 *
 * Module scope, not per-render: the bundled registry is static, so this never
 * needs recomputing.
 */
const bundledWeightsCover: ReadonlyMap<string, readonly number[]> = (() => {
  const cover = new Map<string, readonly number[]>();
  for (const family of fontFamilies) {
    const weights = [...new Set(family.variants.map((v) => v.weight))].sort(
      (a, b) => a - b,
    );
    for (const name of [
      family.key,
      family.labelEn,
      ...family.variants.map((v) => v.key),
    ]) {
      cover.set(name.toLowerCase().replace(/[^a-z0-9]/g, ''), weights);
    }
  }
  return cover;
})();
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
 * A bottom sheet on every OS; the sheet's own scroll regions win over the
 * drag-to-dismiss gesture, so the list scrolls inside without fighting the
 * sheet.
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
  /**
   * The script filter over the bundled sections. `null` means "not chosen yet",
   * and the filter then follows the active family's script — so a Latin design
   * opens on the Latin list instead of below twenty-two Arabic rows. Choosing an
   * item pins it for the rest of the open; closing clears it, which is what
   * makes the default per-open rather than per-session. Not persisted: the pin
   * store is device state, this is a view over one list.
   */
  const [scriptChoice, setScriptChoice] = useState<FontScript | 'all' | null>(
    null,
  );
  const script: FontScript | 'all' =
    scriptChoice ?? familyForVariant(value)?.script ?? 'arabic';
  const activeKey = familyForVariant(value)?.key;
  /** Remote faces registered this session — drives the chips' installed state. */
  const installedRemote = useInstalledRemoteFontKeys();
  const pinnedIds = useFontPins((s) => s.pinnedIds);
  const toggleFontPin = useFontPins((s) => s.toggleFontPin);
  const pinnedCollapsed = useFontPins((s) => s.pinnedCollapsed);
  const setPinnedCollapsed = useFontPins((s) => s.setPinnedCollapsed);
  /** The full catalogue, so a pinned remote row can show badges and chips. */
  const [catalog, setCatalog] = useState<RemoteFontFamily[]>([]);

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
  const hasRemotePins = pinnedIds.some(
    (id) => parseFontPinId(id)?.source === 'google',
  );

  /**
   * Warm the display faces while the sheet is open, so tapping a family is
   * instant rather than a wait. Fire-and-forget: a rejection leaves the snapshot
   * short and the `ensure` on selection retries the one face that is needed, so
   * a failed warm-up must not take the sheet down with it.
   *
   * `loadedBundled` is read for its re-renders, not its value — each publish
   * repaints the specimens as their face arrives, which is the whole reason the
   * warm-up is visible rather than a silent stall behind a static row.
   */
  const loadedKeys = useLoadedBundledFontKeys();
  useEffect(() => {
    if (!visible) {
      return;
    }
    void warmDisplayFonts().catch(() => {});
  }, [visible]);

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
          const families = await getRemoteFontCatalog();
          if (cancelled) {
            return;
          }
          setRemoteFamilies(
            filterRemoteFontFamilies(
              // The bundled families are already listed above this section, so
              // a Google family that only re-offers one is a duplicate row —
              // unless it carries a weight the bundle lacks, which the bundled
              // variants cannot reach.
              filterBundledDuplicates(families, bundledWeightsCover),
              q,
              REMOTE_RESULT_LIMIT,
            ),
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

  // A pinned remote row needs the catalogue for its badge and weight chips, so
  // load it on open when any pin is remote — not only when the user searches.
  useEffect(() => {
    if (!visible || !hasRemotePins) {
      return;
    }
    let cancelled = false;
    getRemoteFontCatalog()
      .then((families) => {
        if (!cancelled) {
          setCatalog(families);
        }
      })
      .catch(() => {
        // A failed fetch must not clear a catalogue already loaded; the pinned
        // row falls back to its name and its installed weights.
      });
    return () => {
      cancelled = true;
    };
  }, [visible, hasRemotePins]);

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

  // Resolve each pinned id to what its row renders: a bundled family, or the
  // remote family's catalogue entry plus the weights installed on this device
  // (so an offline pinned face is still selectable).
  const pinnedEntries = useMemo(() => {
    return pinnedIds
      .map((id) => {
        const parsed = parseFontPinId(id);
        if (!parsed) {
          return null;
        }
        if (parsed.source === 'family') {
          const family = fontFamilies.find((f) => f.key === parsed.key);
          return family ? { kind: 'bundled' as const, id, family } : null;
        }
        const family = catalog.find((f) => f.id === parsed.key) ?? null;
        const installedWeights = [
          ...new Set(
            [...installedRemote]
              .map((key) => parseRemoteFontKey(key))
              .filter(
                (parsedKey): parsedKey is NonNullable<typeof parsedKey> =>
                  parsedKey?.id === parsed.key,
              )
              .map((parsedKey) => parsedKey.weight),
          ),
        ].sort((a, b) => a - b);
        return {
          kind: 'remote' as const,
          id,
          fontId: parsed.key,
          family,
          installedWeights,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [pinnedIds, catalog, installedRemote]);

  // Clear on close so reopening always shows the full catalogue, not the last
  // search term (the sheet stays mounted while hidden).
  const closeSheet = () => {
    setQuery('');
    // Clearing the choice, not the derived value: reopening re-defaults to the
    // active family's script.
    setScriptChoice(null);
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

  /**
   * The filtered bundled list, partitioned by script. Arabic first: it is the
   * app's own script and the larger of the two sets, so the section a session
   * usually wants is the one above the fold.
   */
  const fontSections = useMemo(
    () =>
      (['arabic', 'latin'] as const).map((script) => ({
        script,
        title: script === 'arabic' ? t.editor.arabicFonts : t.editor.latinFonts,
        families: matches.filter((f) => f.script === script),
      })),
    [matches, t],
  );

  /**
   * Bundled families on screen, not families matched. `matches.length` counts
   * rows the filter may be hiding, so it cannot tell an empty sheet from a full
   * one; this can.
   */
  const visibleBundledCount = fontSections.reduce(
    (n, section) =>
      script === 'all' || section.script === script
        ? n + section.families.length
        : n,
    0,
  );

  return (
    <Sheet
      visible={visible}
      onClose={closeSheet}
      title={t.editor.fontFamily}
      closeButton
    >
      {/* Script filter. The bundled list is long enough that both scripts
          stacked put Latin below twenty-two Arabic rows, so the filter is what
          makes the other script reachable. The pinned section and the Google
          section are deliberately outside it: a pin is cross-script, and the
          Google section is search-driven (see docs/editor-font-pins.md §3). */}
      <View style={styles.filterRow}>
        <Button
          label={t.editor.allFonts}
          variant={script === 'all' ? 'primary' : 'secondary'}
          selected={script === 'all'}
          onPress={() => setScriptChoice('all')}
          labelFit
          style={styles.filterItem}
        />
        <Button
          label={t.editor.arabicFonts}
          variant={script === 'arabic' ? 'primary' : 'secondary'}
          selected={script === 'arabic'}
          onPress={() => setScriptChoice('arabic')}
          labelFit
          style={styles.filterItem}
        />
        <Button
          label={t.editor.latinFonts}
          variant={script === 'latin' ? 'primary' : 'secondary'}
          selected={script === 'latin'}
          onPress={() => setScriptChoice('latin')}
          labelFit
          style={styles.filterItem}
        />
      </View>

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
        {/* Pinned families — always at the top, with or without a search. */}
        {pinnedEntries.length > 0 && (
          <View>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !pinnedCollapsed }}
              accessibilityLabel={
                pinnedCollapsed
                  ? t.editor.expandPinned
                  : t.editor.collapsePinned
              }
              onPress={() => setPinnedCollapsed(!pinnedCollapsed)}
              style={styles.pinnedHead}
            >
              <View style={styles.pinnedHeadMain}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: c.ink, fontFamily: uiFont },
                  ]}
                >
                  {t.editor.pinnedFonts}
                </Text>
                <Text
                  style={[
                    styles.pinnedCount,
                    { color: c.muted, fontFamily: uiFont },
                  ]}
                >
                  ({pinnedEntries.length})
                </Text>
              </View>
              {pinnedCollapsed ? (
                <DirectionIcon isRTL={isRTL} size={18} color={c.muted} />
              ) : (
                <Icon name="chevronDown" size={18} color={c.muted} />
              )}
            </AnimatedPressable>
            {!pinnedCollapsed &&
              pinnedEntries.map((entry) => {
                if (entry.kind === 'bundled') {
                  const selected = entry.family.key === activeKey;
                  return (
                    <View key={entry.id}>
                      <BundledFamilyRow
                        family={entry.family}
                        selected={selected}
                        pinned
                        loaded={loadedKeys.has(entry.family.defaultVariant)}
                        onPress={() => onChange(entry.family.defaultVariant)}
                        onTogglePin={() => toggleFontPin(entry.id)}
                      />
                      {selected && entry.family.variants.length > 1 && (
                        <BundledVariantChips
                          family={entry.family}
                          value={value}
                          onChange={onChange}
                        />
                      )}
                    </View>
                  );
                }
                return (
                  <View key={entry.id}>
                    <RemoteFamilyRow
                      id={entry.fontId}
                      name={
                        entry.family?.family ??
                        humanizeRemoteFontId(entry.fontId)
                      }
                      weights={entry.family?.weights ?? entry.installedWeights}
                      hasArabic={
                        entry.family
                          ? entry.family.subsets.includes('arabic')
                          : null
                      }
                      open={openRemoteId === entry.fontId}
                      onToggleOpen={() => {
                        setOpenRemoteId(
                          openRemoteId === entry.fontId ? null : entry.fontId,
                        );
                        setInstallErrorKey(null);
                      }}
                      pinned
                      onTogglePin={() => toggleFontPin(entry.id)}
                      value={value}
                      installedRemote={installedRemote}
                      installing={installing}
                      installErrorKey={installErrorKey}
                      onInstall={(id, weight) => void installFace(id, weight)}
                    />
                  </View>
                );
              })}
          </View>
        )}

        {/* The bundled list, grouped by script. Grouping partitions the already
            filtered `matches` rather than filtering twice, so the search box
            keeps working across both sections. An empty section renders no
            header at all, for the same reason the Google Fonts header hides on
            an empty result: a heading above nothing reads as a broken section. */}
        {fontSections.map((section) =>
          section.families.length === 0 ||
          (script !== 'all' && section.script !== script) ? null : (
            <View key={section.script}>
              <View style={styles.sectionHead}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: c.ink, fontFamily: uiFont },
                  ]}
                >
                  {section.title}
                </Text>
              </View>
              {section.families.map((family) => {
                const selected = family.key === activeKey;
                return (
                  <View key={family.key}>
                    <BundledFamilyRow
                      family={family}
                      selected={selected}
                      pinned={pinnedIds.includes(familyPinId(family.key))}
                      loaded={loadedKeys.has(family.defaultVariant)}
                      onPress={() => onChange(family.defaultVariant)}
                      onTogglePin={() => toggleFontPin(familyPinId(family.key))}
                    />
                    {selected && family.variants.length > 1 && (
                      <BundledVariantChips
                        family={family}
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ),
        )}

        {/* Google Fonts — the on-demand section. It appears only while typing,
            so the picker's search box doubles as its search field; the catalog
            is searched by display name, and each family row expands to weight
            chips with a download state machine (download → spinner → installed
            / retry). Families that only re-offer a bundled face are filtered out
            above, so a query never lists the same typeface twice.

            The section header hides when the search resolved to nothing: with
            every hit deduplicated away, a lone "Google Fonts" heading above an
            empty list reads as a broken section rather than an empty result.

            The "no results" text below therefore lives *outside* this block: it
            answers for the whole sheet, and gating it on this section's header
            being present is what let a filtered-out query render nothing at
            all. Its condition is what the eye can see — no bundled row on
            screen, and the remote search settled with nothing either — and the
            spinner is what covers the window before `ready`. */}
        {!!query.trim() &&
          (remoteState !== 'ready' || remoteFamilies.length > 0) && (
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
                remoteFamilies.map((family) => (
                  <RemoteFamilyRow
                    key={family.id}
                    id={family.id}
                    name={family.family}
                    weights={family.weights}
                    hasArabic={family.subsets.includes('arabic')}
                    open={family.id === openRemoteId}
                    onToggleOpen={() => {
                      setOpenRemoteId(
                        family.id === openRemoteId ? null : family.id,
                      );
                      setInstallErrorKey(null);
                    }}
                    pinned={pinnedIds.includes(googlePinId(family.id))}
                    onTogglePin={() => toggleFontPin(googlePinId(family.id))}
                    value={value}
                    installedRemote={installedRemote}
                    installing={installing}
                    installErrorKey={installErrorKey}
                    onInstall={(id, weight) => void installFace(id, weight)}
                  />
                ))}
            </>
          )}

        {/* One answer for the whole sheet, so it can never be hidden behind a
            section that the filter removed. */}
        {remoteState === 'ready' &&
          visibleBundledCount === 0 &&
          remoteFamilies.length === 0 && (
            <Text style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}>
              {t.editor.noFontResults}
            </Text>
          )}
      </ScrollView>

      <Button label={t.common.done} onPress={closeSheet} fullWidth />
    </Sheet>
  );
}

/** The pin control shared by every family row. Its name states the next press. */
function PinToggle({
  pinned,
  onToggle,
}: {
  pinned: boolean;
  onToggle: () => void;
}) {
  const { colors: c } = useTheme();
  const { t } = useT();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: pinned }}
      accessibilityLabel={pinned ? t.gallery.unpin : t.gallery.pin}
      onPress={onToggle}
      hitSlop={6}
      style={[styles.pin, { borderColor: pinned ? c.ink : c.border }]}
    >
      <Icon
        name="pin"
        size={16}
        color={pinned ? c.ink : c.muted}
        weight={pinned ? 'fill' : 'regular'}
      />
    </AnimatedPressable>
  );
}

/** A bundled family's variant chips, for the row that is selected. */
function BundledVariantChips({
  family,
  value,
  onChange,
}: {
  family: FontFamily;
  value: string;
  onChange: (fontKey: string) => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const uiFont = fontRoles[language].ui;
  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);
  return (
    <View style={styles.chips}>
      {family.variants.map((variant) => {
        const on = variant.key === value;
        return (
          <AnimatedPressable
            key={variant.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label(variant.labelAr, variant.labelEn)}
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
  );
}

/** A bundled family row with its trailing pin control. */
function BundledFamilyRow({
  family,
  selected,
  pinned,
  loaded,
  onPress,
  onTogglePin,
}: {
  family: FontFamily;
  selected: boolean;
  pinned: boolean;
  /** Whether the family's default face is registered with the platform. */
  loaded: boolean;
  onPress: () => void;
  onTogglePin: () => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const uiFont = fontRoles[language].ui;
  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);
  return (
    <View
      style={[
        styles.row,
        {
          borderColor: selected ? c.ink : c.border,
          backgroundColor: selected ? c.surfaceAlt : c.surface,
        },
      ]}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label(family.labelAr, family.labelEn)}, ${label(
          family.styleTagAr,
          family.styleTagEn,
        )}`}
        onPress={onPress}
        style={styles.rowBody}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.specimen,
            {
              color: c.ink,
              // Never request a face the platform has not registered: an
              // unloaded family name resolves to (and may cache) a fallback, so
              // the row shows the UI face until `useLoadedBundledFontKeys`
              // repaints it with the real one.
              fontFamily: loaded ? family.defaultVariant : uiFont,
            },
          ]}
        >
          {SPECIMENS[family.script]}
        </Text>
        <Text style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}>
          {label(family.labelAr, family.labelEn)} ·{' '}
          {label(family.styleTagAr, family.styleTagEn)}
        </Text>
      </AnimatedPressable>
      <PinToggle pinned={pinned} onToggle={onTogglePin} />
    </View>
  );
}

/** A remote (Google) family row with its trailing pin control. */
function RemoteFamilyRow({
  id,
  name,
  weights,
  hasArabic,
  open,
  onToggleOpen,
  pinned,
  onTogglePin,
  value,
  installedRemote,
  installing,
  installErrorKey,
  onInstall,
}: {
  id: string;
  name: string;
  weights: readonly number[];
  hasArabic: boolean | null;
  open: boolean;
  onToggleOpen: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  value: string;
  installedRemote: ReadonlySet<string>;
  installing: { id: string; weight: number } | null;
  installErrorKey: string | null;
  onInstall: (id: string, weight: number) => void;
}) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const uiFont = fontRoles[language].ui;
  const badge =
    hasArabic === null
      ? null
      : hasArabic
        ? t.editor.supportsArabic
        : t.editor.noArabicSupport;
  return (
    <View>
      <View
        style={[
          styles.remoteRow,
          {
            borderColor: open ? c.ink : c.border,
            backgroundColor: open ? c.surfaceAlt : c.surface,
          },
        ]}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={badge ? `${name}, ${badge}` : name}
          onPress={onToggleOpen}
          style={styles.rowBody}
        >
          <View style={styles.remoteRowMain}>
            <Text
              numberOfLines={1}
              style={[styles.remoteName, { color: c.ink, fontFamily: uiFont }]}
            >
              {name}
            </Text>
            {badge && (
              <Text
                style={[
                  styles.remoteBadge,
                  { color: hasArabic ? c.ink : c.muted, fontFamily: uiFont },
                ]}
              >
                {badge}
              </Text>
            )}
          </View>
        </AnimatedPressable>
        <PinToggle pinned={pinned} onToggle={onTogglePin} />
      </View>

      {open &&
        (weights.length > 0 ? (
          <View style={styles.chips}>
            {weights.map((weight) => {
              const key = remoteFontKey(id, weight);
              const selected = key === value;
              const installed = installedRemote.has(key);
              const busy =
                installing?.id === id && installing.weight === weight;
              const failed = installErrorKey === key;
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
                  accessibilityState={{ selected, busy, disabled: busy }}
                  accessibilityLabel={`${name} ${weightName}${
                    installed
                      ? `, ${t.editor.installedFont}`
                      : `, ${t.editor.downloadFont}`
                  }`}
                  disabled={busy}
                  onPress={() => onInstall(id, weight)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected || installed ? c.ink : c.border,
                      backgroundColor: selected ? c.ink : c.surfaceAlt,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={c.onInk} />
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
        ) : (
          <Text style={[styles.meta, { color: c.danger, fontFamily: uiFont }]}>
            {t.editor.fontCatalogFailed}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // The three labels are long enough that `Button`'s default 24 dp side padding
  // leaves too little for the largest Arabic face; the compact padding buys the
  // room back and the fitted label covers the rest by scaling down.
  filterItem: { flex: 1, paddingHorizontal: spacing.sm },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingStart: spacing.md,
    paddingEnd: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowBody: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  /**
   * The Google section's rows keep their card. They are a different kind of row —
   * a downloaded face with a badge and a weight-chip state machine — and the
   * border is what anchors that difference against the flat bundled list above.
   */
  remoteRow: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingStart: spacing.md,
    paddingEnd: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pin: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The face's own ink can reach past its line box — the same class the text
   * preview fixed (`text-style-controls.tsx`) — so `numberOfLines` would clip a
   * tall-ascent specimen (Amiri Quran is ~1.82 em). Carrying a little vertical
   * headroom on the element moves the clip out to the padding box.
   */
  specimen: { fontSize: 20, paddingVertical: 2 },
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
  pinnedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  pinnedHeadMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pinnedCount: {
    fontSize: typeScale.caption.size,
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
