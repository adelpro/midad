import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GALLERY_HEADER_LARGE,
  GalleryHeader,
} from '@/components/gallery/gallery-header';
import { ProjectRow, type SwipeSide } from '@/components/gallery/project-row';
import {
  UNDO_WINDOW_MS,
  useDeferredDelete,
} from '@/components/gallery/use-deferred-delete';
import {
  Button,
  EmptyState,
  Icon,
  ProjectCardSkeleton,
  Sheet,
  Snackbar,
} from '@/components/ui';
import { renderImportedThumbnail } from '@/editor/render/thumbnail-on-demand';
import { hapticDelete, hapticTick } from '@/haptics';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import { formatGalleryCount } from '@/i18n/strings';
import { importProjectFile } from '@/storage/import-project';
import { sortPinnedFirst, usePins } from '@/storage/pins';
import { isWeb } from '@/storage/platform';
import { PROJECT_FILE_VERSION } from '@/storage/project-schema';
import type { MidadProject } from '@/storage/project-schema';
import {
  listProjects,
  loadProject,
  readBackgroundBytes,
  saveProject,
  writeBackgroundBytes,
} from '@/storage/projects';
import { copyImageAssetsFromStore } from '@/storage/copy-assets';
import { DEFAULT_CANVASES, useSettings } from '@/storage/settings';
import { getThumb } from '@/storage/thumbs';
import {
  breakpoint,
  fontRoles,
  spacing,
  springDampingRatios,
  typeScale,
} from '@/theme';

const MIN_COLUMN_WIDTH = 168;
/** Centered content cap so the grid never sprawls on desktop/tablet. */
const MAX_LIST_WIDTH = 920;

/**
 * Row reordering (pin / unpin) animation.
 *
 * FlashList v2 has no `itemLayoutAnimation` prop any more — RN's
 * `LayoutAnimation` is the documented path, and it requires
 * `prepareForLayoutAnimationRender()` beforehand. `update: spring` keeps the
 * move inside the spring-only vocabulary of DESIGN.md §6.
 *
 * FlashList's own docs call Android's LayoutAnimation "experimental" and it is
 * a no-op on react-native-web, so on those platforms rows simply jump. No
 * `UIManager.setLayoutAnimationEnabledExperimental` call is needed (or wanted):
 * it is a no-op under the New Architecture this app runs on.
 */
const REORDER_LAYOUT = {
  duration: 300,
  update: {
    type: LayoutAnimation.Types.spring,
    // `springDamping` is a *ratio* here (0–1), exactly like the ζ the presets are
    // authored in — not Reanimated's absolute `damping` coefficient.
    springDamping: springDampingRatios.sheet,
  },
  create: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
  delete: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

function makeNewProject(index: number): MidadProject {
  const now = new Date().toISOString();
  const size = DEFAULT_CANVASES[index];
  return {
    version: PROJECT_FILE_VERSION,
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

export default function GalleryScreen() {
  const router = useRouter();
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const insets = useSafeAreaInsets();
  const { defaultCanvasIndex } = useSettings();
  const pinnedIds = usePins((s) => s.pinnedIds);
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

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
  // Only one row may show its swipe actions at a time; the parent owns which.
  const [openRow, setOpenRow] = useState<{
    id: string;
    side: SwipeSide;
  } | null>(null);

  // Project action menu state.
  const [menuProject, setMenuProject] = useState<MidadProject | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');

  // Only needed so `prepareForLayoutAnimationRender()` can be called before a
  // pinned row is reordered.
  const listRef = useRef<FlashListRef<MidadProject>>(null);

  // Scroll offset shared with the collapsible header.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // A tap — not a scroll — anywhere on the list closes an open row, the same
  // platform convention as tapping the card. Movement is what separates a tap
  // from a scroll: a drag past the threshold leaves the row alone (the list's
  // own `onScrollBeginDrag` already closes on scroll).
  const listTapStart = useRef<{ x: number; y: number } | null>(null);
  const handleListTouchStart = useCallback((e: GestureResponderEvent) => {
    listTapStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  }, []);
  const handleListTouchEnd = useCallback((e: GestureResponderEvent) => {
    const start = listTapStart.current;
    listTapStart.current = null;
    if (!start) {
      return;
    }
    const moved = Math.hypot(
      e.nativeEvent.pageX - start.x,
      e.nativeEvent.pageY - start.y,
    );
    if (moved <= 10) {
      setOpenRow(null);
    }
  }, []);

  // Pinned designs float to the top. Pins are device-local, so the ordering
  // lives here rather than in `listProjects()` — the stored documents never
  // carry the flag.
  const sortedProjects = useMemo(
    () => sortPinnedFirst(projects, pinnedIds),
    [projects, pinnedIds],
  );

  // FlashList's grid manager lays out columns with absolute `left` positions,
  // which never mirrors under RTL. Reverse each row's items so the grid reads
  // right-to-left in Arabic without reshuffling which project sits in which row.
  const displayData = useMemo(() => {
    if (!isRTL || numColumns <= 1) {
      return sortedProjects;
    }
    const out: MidadProject[] = [];
    for (let i = 0; i < sortedProjects.length; i += numColumns) {
      out.push(...sortedProjects.slice(i, i + numColumns).reverse());
    }
    return out;
  }, [isRTL, numColumns, sortedProjects]);

  const fetchAll = useCallback(async () => {
    const list = await listProjects();
    const entries = await Promise.all(
      list.map(async (p) => [p.id, await getThumb(p.id)] as const),
    );
    return {
      list,
      thumbs: Object.fromEntries(entries) as Record<string, string | null>,
    };
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
        usePins.getState().prunePins(list.map((p) => p.id));
        setLoading(false);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fetchAll]);

  /** Reads storage into state, without touching the pull-to-refresh spinner. */
  const reload = useCallback(async () => {
    const { list, thumbs: nextThumbs } = await fetchAll();
    setProjects(list);
    setThumbs(nextThumbs);
    // Drop pins whose design no longer exists.
    usePins.getState().prunePins(list.map((p) => p.id));
  }, [fetchAll]);

  const handleUndoDelete = useCallback(() => {
    // Nothing was written to disk, so a refetch is all it takes to restore the
    // card — with its thumbnail, ordering and pin intact.
    void reload();
  }, [reload]);

  const {
    pending: pendingDelete,
    notice: deleteNotice,
    requestDelete: requestDeferredDelete,
    undo: undoDelete,
    flush: flushDeferredDelete,
  } = useDeferredDelete(handleUndoDelete);

  const handleUndo = useCallback(() => {
    // Putting a design back is a selection-like change, not a "success".
    hapticTick();
    undoDelete();
  }, [undoDelete]);

  /**
   * Every explicit reload settles a pending delete first. Without that,
   * renaming / duplicating / importing inside the undo window would read the
   * not-yet-deleted file back off disk and resurrect the card.
   */
  const refresh = useCallback(async () => {
    flushDeferredDelete();
    setOpenRow(null);
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [flushDeferredDelete, reload]);

  /**
   * A latched row does not survive leaving the screen: coming back to a row that
   * is still open reads as input the app is still waiting on.
   *
   * The tab stays mounted while the editor is open, so the mount fetch is not
   * enough on its own: without re-reading storage here, a design renamed or
   * edited in the editor keeps showing its stale card until the app restarts.
   */
  useFocusEffect(
    useCallback(() => {
      setOpenRow(null);
      // An undo window means the file is still on disk, so reloading now would
      // resurrect the card the user just deleted; `refresh` settles it instead.
      if (pendingDelete === null) {
        void reload();
      }
    }, [pendingDelete, reload]),
  );

  const handleImportBytes = useCallback(
    async (bytes: Uint8Array) => {
      const { status, project } = await importProjectFile(bytes);
      if (status !== 'ok') {
        setImportError(t.gallery.importFailed);
        return;
      }
      setImportError(null);
      if (project) {
        try {
          await renderImportedThumbnail(project);
        } catch {
          // Thumbnail is best-effort; the design itself is imported and the
          // next editor save regenerates it.
        }
      }
      await refresh();
    },
    [refresh, t],
  );

  const importProject = useCallback(async () => {
    setImportError(null);
    if (Platform.OS === 'web') {
      const el = document.createElement('input');
      el.type = 'file';
      el.accept = '.midad,application/zip';
      el.onchange = () => {
        const file = el.files?.[0];
        if (!file) return;
        file
          .arrayBuffer()
          .then((buffer) => handleImportBytes(new Uint8Array(buffer)))
          .catch(() => setImportError(t.gallery.importFailed));
      };
      el.click();
      return;
    }
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) {
        return;
      }
      const { File } = await import('expo-file-system');
      await handleImportBytes(await new File(res.assets[0].uri).bytes());
    } catch {
      setImportError(t.gallery.importFailed);
    }
  }, [handleImportBytes, t]);

  const createNew = useCallback(async () => {
    const project = makeNewProject(defaultCanvasIndex);
    await saveProject(project);
    router.push(`/editor?id=${project.id}`);
  }, [defaultCanvasIndex, router]);

  const openProject = useCallback(
    (id: string) => {
      // The row was transient: it must not be waiting when the user comes back
      // from the editor.
      setOpenRow(null);
      router.push(`/editor?id=${id}`);
    },
    [router],
  );

  const openMenu = useCallback((project: MidadProject) => {
    setOpenRow(null);
    setMenuProject(project);
    setRenaming(false);
    setRenameText(project.name || '');
  }, []);

  const closeMenu = useCallback(() => setMenuProject(null), []);

  const duplicateProject = useCallback(async () => {
    if (!menuProject) return;
    const src = (await loadProject(menuProject.id)) ?? menuProject;
    const now = new Date().toISOString();
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // The image lives beside the document, so the copy needs its own bytes:
    // `saveProject` writes the document alone.
    const bg = src.canvas.background;
    let background = bg;
    if (bg.type === 'image' && bg.imageFile) {
      const bytes = await readBackgroundBytes(src.id, bg.imageFile);
      if (bytes) {
        background = {
          ...bg,
          ...(await writeBackgroundBytes(
            id,
            bytes,
            bg.imageMime ?? 'image/jpeg',
          )),
        };
      }
    }
    const copy: MidadProject = {
      ...src,
      id,
      name: src.name ? `${src.name}${t.gallery.copySuffix}` : '',
      createdAt: now,
      updatedAt: now,
      canvas: { ...src.canvas, background },
    };
    // Same reason as the background above, for every placed image: `saveProject`
    // writes the document alone, so the copy needs its own bytes or its images
    // render empty the moment they are reopened.
    await copyImageAssetsFromStore(copy, id);
    await saveProject(copy);
    closeMenu();
    await refresh();
  }, [closeMenu, menuProject, refresh, t]);

  const renameProject = useCallback(async () => {
    if (!menuProject) return;
    // Read the document back before writing: this row's copy can be older than
    // the file if the design was edited in the editor since the list loaded,
    // and saving the stale snapshot would silently discard those edits.
    const src = (await loadProject(menuProject.id)) ?? menuProject;
    await saveProject({
      ...src,
      name: renameText.trim(),
      updatedAt: new Date().toISOString(),
    });
    closeMenu();
    await refresh();
  }, [closeMenu, menuProject, refresh, renameText]);

  /**
   * Removes the design optimistically: the card leaves the list immediately,
   * but the files are only deleted once the undo window closes — see
   * `useDeferredDelete` for why this is not delete-then-restore.
   */
  const deleteDesign = useCallback(
    (project: MidadProject) => {
      setOpenRow(null);
      hapticDelete();
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      requestDeferredDelete(project);
    },
    [requestDeferredDelete],
  );

  const togglePin = useCallback(
    (project: MidadProject) => {
      // Close the row first: the list re-sorts, and a row that is both open and
      // moving is hard to follow.
      setOpenRow(null);
      hapticTick();
      if (!reduceMotion) {
        // FlashList has to be told a reorder is coming *before* RN starts
        // animating, otherwise it recycles the moving cells and the move glitches.
        // Reduce Motion skips it entirely: `LayoutAnimation` does not consult the
        // OS setting on every platform, so it has to be gated by hand.
        listRef.current?.prepareForLayoutAnimationRender();
        LayoutAnimation.configureNext(REORDER_LAYOUT);
      }
      usePins.getState().togglePin(project.id);
    },
    [reduceMotion],
  );

  const removeProject = useCallback(() => {
    if (!menuProject) return;
    const project = menuProject;
    closeMenu();
    deleteDesign(project);
  }, [closeMenu, deleteDesign, menuProject]);

  /**
   * The menu's pin row. The swipe already offers pin on a phone, but this sheet
   * is the only entry point on web, in the wide grid's `⋯`, and on a long press
   * — so without this row a pin could be seen but never set.
   */
  const pinProject = useCallback(() => {
    if (!menuProject) return;
    const project = menuProject;
    closeMenu();
    togglePin(project);
  }, [closeMenu, menuProject, togglePin]);

  const menuPinned = !!menuProject && pinnedIds.includes(menuProject.id);

  const sheetTitle = menuProject?.name || t.gallery.untitled;

  const renderImportError = () => (
    <View
      style={[
        styles.importErrorWrap,
        rowStyle(isRTL),
        { backgroundColor: c.dangerBg },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.importErrorText}>
        <Text style={[styles.importError, { color: c.danger }]}>
          {importError}
        </Text>
        <Text style={[styles.importHint, { color: c.muted }]}>
          {t.gallery.importFailedHint}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.close}
        hitSlop={10}
        onPress={() => setImportError(null)}
      >
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
          ]}
        >
          {Array.from({ length: isWide ? 4 : 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} layout={isWide ? 'stack' : 'row'} />
          ))}
        </View>
      ) : projects.length === 0 ? (
        <View
          style={[
            styles.emptyWrap,
            { paddingTop: contentTop, maxWidth: MAX_LIST_WIDTH },
          ]}
        >
          {!!importError && renderImportError()}
          <View style={styles.center}>
            <EmptyState
              glyph="خط"
              title={t.gallery.emptyTitle}
              description={t.gallery.emptyBody}
            >
              <Button label={t.gallery.newDesign} onPress={createNew} />
            </EmptyState>
          </View>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          key={numColumns}
          data={displayData}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onTouchStart={handleListTouchStart}
          onTouchEnd={handleListTouchEnd}
          // A row being scrolled away is no longer the thing being touched, so
          // it returns to rest — the platform convention.
          onScrollBeginDrag={() => setOpenRow(null)}
          style={{ ...styles.listWrap, maxWidth: MAX_LIST_WIDTH }}
          ListHeaderComponent={importError ? renderImportError : undefined}
          contentContainerStyle={[
            styles.list,
            {
              paddingTop: contentTop,
              paddingBottom: spacing.xxxl + insets.bottom,
            },
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
          renderItem={({ item }) => (
            <ProjectRow
              project={item}
              thumbUri={thumbs[item.id] ?? null}
              layout={isWide ? 'stack' : 'row'}
              // Swipe is a touch affordance for the full-width row only: grid
              // tiles are too narrow for it, and a mouse drag on web is
              // undiscoverable — those get the overflow button instead.
              swipeable={!isWide && !isWeb}
              openSide={
                !isWide && openRow?.id === item.id ? openRow.side : null
              }
              onOpenChange={(side) => {
                if (side) {
                  // Confirm the reveal the moment it latches, like a detent.
                  hapticTick();
                }
                setOpenRow(side ? { id: item.id, side } : null);
              }}
              onPress={() => openProject(item.id)}
              onMenu={() => openMenu(item)}
              onTogglePin={() => togglePin(item)}
              onDelete={() => deleteDesign(item)}
            />
          )}
        />
      )}

      <GalleryHeader
        scrollY={scrollY}
        count={formatGalleryCount(projects.length, language)}
        isWide={isWide}
        onImport={importProject}
        onCreate={createNew}
      />

      {/* Sibling of the list, so it survives the list unmounting when the last
          design is deleted. It sits inside the tab scene, so the tab bar is
          already below it and no bottom safe-area inset is needed. */}
      <Snackbar
        visible={pendingDelete !== null}
        message={deleteNotice}
        actionLabel={t.common.undo}
        onAction={handleUndo}
        bottomOffset={spacing.lg}
        durationMs={UNDO_WINDOW_MS}
        resetKey={pendingDelete?.id ?? ''}
      />

      <Sheet visible={!!menuProject} onClose={closeMenu} title={sheetTitle}>
        {renaming ? (
          <View style={styles.sheetBody}>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder={t.gallery.untitled}
              placeholderTextColor={c.faint}
              autoFocus
              style={[
                styles.renameInput,
                {
                  backgroundColor: c.surfaceAlt,
                  borderColor: c.border,
                  color: c.ink,
                  fontFamily: fonts.ui,
                },
              ]}
            />
            <Button label={t.common.save} onPress={renameProject} fullWidth />
            <Button
              label={t.common.cancel}
              onPress={() => setRenaming(false)}
              variant="secondary"
              fullWidth
            />
          </View>
        ) : (
          /* The scroller is the panel's direct child rather than something a
             wrapper holds: only the panel's own child can give up height, and a
             wrapper around a scroller just spills past the panel's bottom edge.
             Five rows plus their gaps need that on a short viewport. */
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
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
            <Button
              label={t.common.duplicate}
              onPress={duplicateProject}
              variant="secondary"
              fullWidth
            />
            <Button
              label={menuPinned ? t.gallery.unpin : t.gallery.pin}
              onPress={pinProject}
              variant="secondary"
              fullWidth
            />
            <Button
              label={t.common.delete}
              onPress={removeProject}
              variant="danger"
              fullWidth
            />
          </ScrollView>
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
  skeletonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  sheetScroll: {
    // Bounds the body by the panel's 82% cap, so the rows scroll instead of
    // spilling past its bottom edge (the same pattern as help-sheet.tsx).
    flexShrink: 1,
  },
  sheetBody: {
    gap: spacing.md,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typeScale.body.size,
  },
});
