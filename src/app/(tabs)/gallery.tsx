import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';

import { Button, Card, EmptyState, Icon, DirectionIcon, Sheet, ProjectCardSkeleton } from '@/components/ui';
import { GALLERY_HEADER_LARGE, GalleryHeader } from '@/components/gallery/gallery-header';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatGalleryCount } from '@/i18n/strings';
import { rowStyle } from '@/i18n/rtl';
import { DEFAULT_CANVASES, useSettings } from '@/storage/settings';
import { listProjects, loadProject, saveProject, deleteProject } from '@/storage/projects';
import { getThumb, deleteThumb } from '@/storage/thumbs';
import { importProjectFromJson } from '@/storage/import-project';
import { breakpoint, fontRoles, spacing, typeScale } from '@/theme';
import type { MidadProject } from '@/storage/project-schema';

const MIN_COLUMN_WIDTH = 168;
const THUMB_RATIO = 4 / 3;
/** Centered content cap so the grid never sprawls on desktop/tablet. */
const MAX_LIST_WIDTH = 920;
const ROW_THUMB_W = 116;

function makeNewProject(index: number): MidadProject {
  const now = new Date().toISOString();
  const size = DEFAULT_CANVASES[index];
  return {
    version: 1,
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    // Empty name so the UI localizes "Untitled" per language.
    name: '',
    createdAt: now,
    updatedAt: now,
    canvas: {
      width: size.width,
      height: size.height,
      background: { type: 'paper', color: '#F7F6F3' },
    },
    objects: [],
    gridEnabled: false,
  };
}

function formatDate(iso: string, language: string): string {
  const d = new Date(iso);
  // Latin digits for Arabic too (`ar-u-nu-latn`) — numerals stay Western by default.
  return d.toLocaleDateString(language === 'ar' ? 'ar-u-nu-latn' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GalleryScreen() {
  const router = useRouter();
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const insets = useSafeAreaInsets();
  const { defaultCanvasIndex } = useSettings();
  const { width: windowWidth } = useWindowDimensions();

  // Phone-first: one card per line on narrow screens; multi-column grid on
  // wide surfaces, capped so the list stays centered and scannable.
  const isWide = windowWidth >= breakpoint.wide;
  const effectiveWidth = Math.min(windowWidth, MAX_LIST_WIDTH);
  const numColumns = !isWide
    ? 1
    : Math.min(6, Math.max(2, Math.floor(effectiveWidth / MIN_COLUMN_WIDTH)));
  const contentTop = GALLERY_HEADER_LARGE + insets.top;

  const [projects, setProjects] = useState<MidadProject[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Project action menu state.
  const [menuProject, setMenuProject] = useState<MidadProject | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  // Scroll offset shared with the collapsible header.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // FlashList's grid manager lays out columns with absolute `left` positions,
  // which never mirrors under RTL. Reverse each row's items so the grid reads
  // right-to-left in Arabic without reshuffling which project sits in which row.
  const displayData = useMemo(() => {
    if (!isRTL || numColumns <= 1) {
      return projects;
    }
    const out: MidadProject[] = [];
    for (let i = 0; i < projects.length; i += numColumns) {
      out.push(...projects.slice(i, i + numColumns).reverse());
    }
    return out;
  }, [isRTL, numColumns, projects]);

  const fetchAll = useCallback(async () => {
    const list = await listProjects();
    const entries = await Promise.all(
      list.map(async (p) => [p.id, await getThumb(p.id)] as const),
    );
    return { list, thumbs: Object.fromEntries(entries) as Record<string, string | null> };
  }, []);

  // Fetch projects on mount. All setState calls happen inside the async
  // resolution, never synchronously within the effect body.
  useEffect(() => {
    let active = true;
    fetchAll()
      .then(({ list, thumbs: nextThumbs }) => {
        if (!active) return;
        setProjects(list);
        setThumbs(nextThumbs);
        setLoading(false);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { list, thumbs: nextThumbs } = await fetchAll();
      setProjects(list);
      setThumbs(nextThumbs);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const handleImportText = useCallback(
    async (text: string) => {
      const status = await importProjectFromJson(text);
      if (status !== 'ok') {
        setImportError(t.gallery.importFailed);
        return;
      }
      setImportError(null);
      await refresh();
    },
    [refresh, t],
  );

  const importProject = useCallback(async () => {
    setImportError(null);
    if (Platform.OS === 'web') {
      const el = document.createElement('input');
      el.type = 'file';
      el.accept = '.midad,application/json,.json';
      el.onchange = () => {
        const file = el.files?.[0];
        if (!file) return;
        file
          .text()
          .then(handleImportText)
          .catch(() => setImportError(t.gallery.importFailed));
      };
      el.click();
      return;
    }
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) {
        return;
      }
      const { File } = await import('expo-file-system');
      const text = await new File(res.assets[0].uri).text();
      await handleImportText(text);
    } catch {
      setImportError(t.gallery.importFailed);
    }
  }, [handleImportText, t]);

  const createNew = useCallback(async () => {
    const project = makeNewProject(defaultCanvasIndex);
    await saveProject(project);
    router.push(`/editor?id=${project.id}`);
  }, [defaultCanvasIndex, router]);

  const openProject = useCallback(
    (id: string) => {
      router.push(`/editor?id=${id}`);
    },
    [router],
  );

  const openMenu = useCallback(
    (project: MidadProject) => {
      setMenuProject(project);
      setConfirmDelete(false);
      setRenaming(false);
      setRenameText(project.name || '');
    },
    [],
  );

  const closeMenu = useCallback(() => setMenuProject(null), []);

  const duplicateProject = useCallback(async () => {
    if (!menuProject) return;
    const src = (await loadProject(menuProject.id)) ?? menuProject;
    const now = new Date().toISOString();
    const copy: MidadProject = {
      ...src,
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: src.name ? `${src.name}${t.gallery.copySuffix}` : '',
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(copy);
    closeMenu();
    await refresh();
  }, [closeMenu, menuProject, refresh, t]);

  const renameProject = useCallback(async () => {
    if (!menuProject) return;
    const name = renameText.trim();
    await saveProject({ ...menuProject, name, updatedAt: new Date().toISOString() });
    closeMenu();
    await refresh();
  }, [closeMenu, menuProject, refresh, renameText]);

  const removeProject = useCallback(async () => {
    if (!menuProject) return;
    await deleteProject(menuProject.id);
    await deleteThumb(menuProject.id);
    closeMenu();
    await refresh();
  }, [closeMenu, menuProject, refresh]);

  const sheetTitle = menuProject?.name || t.gallery.untitled;

  const renderImportError = () => (
    <View
      style={[
        styles.importErrorWrap,
        rowStyle(isRTL),
        { backgroundColor: c.dangerBg },
      ]}
      accessibilityLiveRegion="polite">
      <View style={styles.importErrorText}>
        <Text style={[styles.importError, { color: c.danger }]}>{importError}</Text>
        <Text style={[styles.importHint, { color: c.muted }]}>{t.gallery.importFailedHint}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.close}
        hitSlop={10}
        onPress={() => setImportError(null)}>
        <Icon name="close" size={16} color={c.muted} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: c.paper }]}>
      {loading ? (
        <View
          style={[
            styles.skeletonWrap,
            { paddingTop: contentTop + spacing.md, maxWidth: MAX_LIST_WIDTH },
          ]}>
          {Array.from({ length: isWide ? 4 : 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} layout={isWide ? 'stack' : 'row'} />
          ))}
        </View>
      ) : projects.length === 0 ? (
        <View style={[styles.emptyWrap, { paddingTop: contentTop, maxWidth: MAX_LIST_WIDTH }]}>
          {!!importError && renderImportError()}
          <View style={styles.center}>
            <EmptyState
              glyph="خط"
              title={t.gallery.emptyTitle}
              description={t.gallery.emptyBody}>
              <Button label={t.gallery.newDesign} onPress={createNew} />
            </EmptyState>
          </View>
        </View>
      ) : (
        <FlashList
          key={numColumns}
          data={displayData}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ ...styles.listWrap, maxWidth: MAX_LIST_WIDTH }}
          ListHeaderComponent={importError ? renderImportError : undefined}
          contentContainerStyle={[
            styles.list,
            { paddingTop: contentTop, paddingBottom: spacing.xxxl + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.muted}
              colors={[c.muted]}
              progressBackgroundColor={c.surface}
            />
          }
          renderItem={({ item }) => {
            const thumbUri = thumbs[item.id];
            return (
              <Card
                onPress={() => openProject(item.id)}
                onLongPress={() => openMenu(item)}
                style={[styles.card, !isWide && styles.cardRow, !isWide && rowStyle(isRTL)]}>
                <View
                  style={[
                    styles.thumb,
                    !isWide && styles.thumbRow,
                    { backgroundColor: c.surfaceAlt, borderColor: c.border },
                  ]}>
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <Icon name="pen" color={c.faint} size={22} />
                  )}
                </View>
                <View style={!isWide ? styles.cardBodyRow : styles.cardBody}>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { fontFamily: fonts.ui, color: c.ink }]}>
                    {item.name || t.gallery.untitled}
                  </Text>
                  <Text style={[styles.cardDate, { fontFamily: fonts.ui, color: c.faint }]}>
                    {formatDate(item.updatedAt, language)}
                  </Text>
                </View>
                {!isWide && (
                  <View style={styles.rowChevron}>
                    <DirectionIcon isRTL={isRTL} color={c.faint} size={18} />
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      <GalleryHeader
        scrollY={scrollY}
        count={formatGalleryCount(projects.length, language)}
        isWide={isWide}
        onImport={importProject}
        onCreate={createNew}
      />

      <Sheet visible={!!menuProject} onClose={closeMenu} title={sheetTitle}>
        {confirmDelete ? (
          <View style={styles.sheetBody}>
            <Text style={[styles.confirmText, { color: c.ink, fontFamily: fonts.ui }]}>
              {t.gallery.deleteTitle}
            </Text>
            <Text style={[styles.confirmSub, { color: c.muted, fontFamily: fonts.ui }]}>
              {t.gallery.deleteBody}
            </Text>
            <Button label={t.common.delete} onPress={removeProject} variant="danger" fullWidth />
            <Button label={t.common.cancel} onPress={() => setConfirmDelete(false)} variant="secondary" fullWidth />
          </View>
        ) : renaming ? (
          <View style={styles.sheetBody}>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder={t.gallery.untitled}
              placeholderTextColor={c.faint}
              autoFocus
              style={[
                styles.renameInput,
                { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.ink, fontFamily: fonts.ui },
              ]}
            />
            <Button label={t.common.save} onPress={renameProject} fullWidth />
            <Button label={t.common.cancel} onPress={() => setRenaming(false)} variant="secondary" fullWidth />
          </View>
        ) : (
          <View style={styles.sheetBody}>
            <Button
              label={t.common.open}
              onPress={() => {
                closeMenu();
                openProject(menuProject!.id);
              }}
              fullWidth
            />
            <Button
              label={t.common.rename}
              onPress={() => setRenaming(true)}
              variant="secondary"
              fullWidth
            />
            <Button label={t.common.duplicate} onPress={duplicateProject} variant="secondary" fullWidth />
            <Button label={t.common.delete} onPress={() => setConfirmDelete(true)} variant="danger" fullWidth />
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  importErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    gap: spacing.sm,
  },
  importErrorText: {
    flex: 1,
    gap: 2,
  },
  importError: {
    fontSize: typeScale.small.size,
  },
  importHint: {
    fontSize: typeScale.caption.size,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  listWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  list: {
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
  },
  // Phone layout — horizontal row card.
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    aspectRatio: THUMB_RATIO,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  thumbRow: {
    width: ROW_THUMB_W,
    height: ROW_THUMB_W / THUMB_RATIO,
    borderEndWidth: 1,
    borderBottomWidth: 0,
  },
  rowChevron: {
    marginEnd: spacing.lg,
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardBodyRow: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardName: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: typeScale.caption.size,
  },
  skeletonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  sheetBody: {
    gap: spacing.md,
  },
  confirmText: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    fontWeight: '600',
  },
  confirmSub: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typeScale.body.size,
  },
});
