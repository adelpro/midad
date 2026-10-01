import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, Reveal, Sheet } from '@/components/ui';
import { EditorCanvasHost } from '@/editor/EditorCanvasHost';
import { FontField } from '@/editor/font-picker';
import { FontPickerSheet } from '@/editor/font-picker-sheet';
import { ColorPickerSheet } from '@/editor/color-picker-sheet';
import { CollectionBarHost } from '@/editor/collection-bar';
import {
  collectSvgFontFaces,
  collectUsedFamilies,
  projectToSvg,
} from '@/editor/export/svg';
import {
  canGroup,
  canUngroup,
  collectionMembers,
  flipCollection,
  memberOrigins,
  OBJECT_SCALE_BOUNDS,
  rotateCollection,
  scaleCollection,
  selectionFrame,
  unitCount,
} from '@/editor/groups';
import {
  helpEntry,
  helpRole,
  HelpSheet,
  LearnOverlay,
  useHelpMode,
} from '@/editor/help';
import { InsertSheet, type ShapeKey } from '@/editor/insert-sheet';
import { renderProjectToPng } from '@/editor/render/offscreen';
import {
  defaultSelectionBar,
  overflowActionIds,
  railActionIds,
  resolveSelectionActions,
  SelectionOverflowActions,
  SelectionRailActions,
  visibleActionCount,
  type SelectionActionId,
  type SelectionActionSources,
  type SelectionCommandId,
  type SelectionShape,
} from '@/editor/selection-actions';
import {
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
  type ShortcutContext,
} from '@/editor/shortcuts';
import {
  projectFontKeys,
  textLineBreaks,
  useParagraphFonts,
} from '@/editor/skia/text';
import { glyphStyleOf, nextGlyphStyle } from '@/editor/glyphs';
import { useEditorStore } from '@/editor/store';
import {
  FontSizeGauge,
  NumberStepper,
  TextPreview,
} from '@/editor/text-style-controls';
import { canSplitIntoClusters } from '@/editor/text/clusters';
import {
  mergePartTexts,
  splitTextObject,
  type SplitFailure,
} from '@/editor/text/split';
import { useAutoSave } from '@/editor/use-auto-save';
import { useKeyboardShortcuts } from '@/editor/use-keyboard-shortcuts';
import { useObjectGestures } from '@/editor/use-object-gestures';
import { hapticDelete, hapticSuccess, hapticTick } from '@/haptics';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import { pickBackgroundImage } from '@/storage/background-image';
import { saveImageToLibrary, shareFile, shareImage } from '@/storage/export';
import { hasMediaLibrary } from '@/storage/platform';
import { useInstalledRemoteFontKeys } from '@/hooks/use-installed-remote-fonts';
import { ensureBundledFonts } from '@/storage/bundled-font-registry';
import { BrandLoader } from '@/components/ui';
import { bundledDisplayKeysFor } from '@/theme/bundled-fonts';
import { displayFontKeys } from '@/theme';
import {
  downloadRemoteFont,
  missingRemoteFontKeys,
} from '@/storage/remote-font-registry';
import type {
  CalligraphyTextObject,
  DesignObject,
  GlyphObject,
  GlyphStyle,
  MidadProject,
  ObjectTransform,
  TextAlign,
} from '@/storage/project-schema';
import { PROJECT_FILE_EXT } from '@/storage/project-schema';
import { exportProjectFile } from '@/storage/project-io';
import {
  loadProject as loadProjectFile,
  saveProject,
  writeBackgroundImage,
} from '@/storage/projects';
import { useSettings } from '@/storage/settings';
import { saveThumb, THUMB_MAX_WIDTH_PX } from '@/storage/thumbs';
import {
  boldSiblingForKey,
  familyForVariant,
  fontFamilies,
  fontRoles,
  layout,
  radius,
  spacing,
  typeScale,
  variantFor,
} from '@/theme';
import { parseRemoteFontKey, remoteFontLabel } from '@/theme/remote-fonts';
import {
  DEFAULT_INK,
  DEFAULT_PAPER,
  paperSwatches,
} from '@/theme/content-palette';
import {
  DEFAULT_LEADING_RATIO,
  presentationByKey,
  presentations,
  presetPatch,
} from '@/theme/presentations';

type ActiveTool = 'select' | 'text' | 'insert' | 'color' | 'background';

/**
 * The current selection, in document order, read fresh from the store.
 *
 * Every style edit below acts on the whole selection — a group is one element,
 * so a colour or a preset belongs to all of it — and they all need the same
 * list.
 */
function currentSelection(): DesignObject[] {
  const store = useEditorStore.getState();
  return (
    store.project?.objects.filter((o) => store.selectedIds.includes(o.id)) ?? []
  );
}

/**
 * Complete a collection patch against the live object, so `updateObjects` gets a
 * full `Partial<DesignObject>`.
 *
 * A collection patch names only the fields it moves; the object's own transform
 * supplies the rest — its flips, and whichever of scale or rotation the operation
 * did not touch.
 */
function withTransform(
  objects: readonly DesignObject[],
  patches: readonly { id: string; transform: Partial<ObjectTransform> }[],
): { id: string; patch: Partial<DesignObject> }[] {
  const full: { id: string; patch: Partial<DesignObject> }[] = [];
  for (const patch of patches) {
    const obj = objects.find((o) => o.id === patch.id);
    if (!obj) {
      continue;
    }
    full.push({
      id: patch.id,
      patch: { transform: { ...obj.transform, ...patch.transform } },
    });
  }
  return full;
}

/** Font-size bounds for the size gauge (design units). */
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 600;
/** Font-size step per tap — a few points, so a 96pt title needs ~20 taps to double. */
const FONT_SIZE_STEP = 4;
/**
 * Height of the context rail (dp) — deliberately fixed.
 *
 * The rail is always laid out, so a control mounting or unmounting inside it
 * cannot change the canvas box above. Sized for its tallest occupant (a parts
 * tile) plus its hairline.
 */
const CONTEXT_RAIL_HEIGHT = 56;
/** Size given to newly created text — 96pt on a 1080-wide canvas. */
const DEFAULT_FONT_SIZE = 96;
/**
 * Size given to a newly inserted decoration.
 *
 * `GlyphObject` and `ShapeObject` carry no size of their own: both render into a
 * `SHAPE_BASE_SIZE` (120) box and are scaled by `transform.scale`, so one
 * constant serves both. 2 puts a fresh ornament at 240 design units — a little
 * larger than the default 96pt text, which is the size a decoration wants in
 * order to be usable the moment it lands.
 */
const DECOR_INSERT_SCALE = 2;
/**
 * Stroke width for a new shape, in the renderer's base units. `ShapeRenderer`
 * doubles it for `ring` and `line`, and the library's previews use the same
 * value, so a tile shows the object you actually get.
 */
const SHAPE_STROKE_WIDTH = 4;
/** Opacity bounds — never fully invisible, or the object could not be re-found. */
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1;
/**
 * Share of the window the text sheet's scrolling body may occupy.
 *
 * The preview box grows with the type it previews, so the controls have to be
 * able to scroll rather than run the sheet's confirm button off the bottom. The
 * rest of the 82% panel is left for that button and the sheet's chrome.
 */
const SHEET_BODY_MAX_FRACTION = 0.6;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Arrow-key nudge distance: a tap moves one design unit, Shift moves ten. */
function nudgeStep(context: ShortcutContext): number {
  return context.shift ? NUDGE_STEP_LARGE : NUDGE_STEP;
}

/**
 * True when a project differs from another only by object transforms.
 *
 * A canvas drag rewrites `transform` on the moved objects and leaves every other
 * field — and every other object — referentially intact. None of the screen's
 * chrome reads a transform, so a frame that only moves objects must not re-render
 * the top bar, both rails and every sheet. The canvas keeps the moving transforms
 * out of this comparison by subscribing to the raw project itself (`CanvasStage`).
 *
 * Everything that is not `transform` is compared, including fields this file does
 * not render, because a structural edit must always win: comparing a curated list
 * would silently strand the screen the day a new object field is added.
 */
function sameScreenObject(a: DesignObject, b: DesignObject): boolean {
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  for (const key in ra) {
    if (key === 'transform') {
      continue;
    }
    if (ra[key] !== rb[key]) {
      return false;
    }
  }
  for (const key in rb) {
    if (key !== 'transform' && !(key in ra)) {
      return false;
    }
  }
  return true;
}

function sameScreenProject(a: MidadProject, b: MidadProject): boolean {
  if (a === b) {
    return true;
  }
  if (a.name !== b.name || a.gridEnabled !== b.gridEnabled) {
    return false;
  }
  if (a.canvas !== b.canvas) {
    return false;
  }
  const ao = a.objects;
  const bo = b.objects;
  if (ao.length !== bo.length) {
    return false;
  }
  for (let i = 0; i < ao.length; i++) {
    const x = ao[i];
    const y = bo[i];
    if (x !== y && !sameScreenObject(x, y)) {
      return false;
    }
  }
  return true;
}

/**
 * The project, but only as often as the *screen* needs to render it.
 *
 * The store hands out a new `project` on every drag frame. Subscribed raw, that
 * re-rendered this 2400-line screen — top bar, both rails, the collection bar and
 * eight sheets — once per frame just to move an object. This snapshot keeps the
 * last project that differed structurally, so a transform-only frame is a no-op
 * here. The canvas does not use it: `CanvasStage` subscribes to the raw project so
 * the moving transforms still reach Skia.
 */
function useScreenProject(): MidadProject | null {
  const subscribe = useEditorStore.subscribe;
  const snapshot = useRef<MidadProject | null>(
    useEditorStore.getState().project,
  );
  const getSnapshot = useCallback(() => {
    const next = useEditorStore.getState().project;
    const prev = snapshot.current;
    if (next === prev || (prev && next && sameScreenProject(prev, next))) {
      return prev;
    }
    snapshot.current = next;
    return next;
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * The Skia canvas, subscribed to the store itself.
 *
 * A drag writes the project every frame; keeping that subscription here rather
 * than in `EditorScreen` is what confines the per-frame render to the canvas
 * subtree. `selectedIds` rides along because the canvas draws the selection chrome.
 */
const CanvasStage = memo(function CanvasStage({
  tapPoint,
  onTapResult,
}: {
  tapPoint: { x: number; y: number } | null;
  onTapResult: (id: string | null) => void;
}) {
  const project = useEditorStore((s) => s.project);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  if (!project) {
    return null;
  }
  return (
    <EditorCanvasHost
      project={project}
      selectedIds={selectedIds}
      tapPoint={tapPoint}
      onTapResult={onTapResult}
    />
  );
});

/**
 * Full editor screen body. Lives outside `src/app/` so that on web it is only
 * evaluated through a dynamic import after CanvasKit (WASM) has loaded — every
 * module statically imported here reaches `@shopify/react-native-skia`, and
 * evaluating them at bundle startup would capture an undefined CanvasKit in
 * the web Skia singleton.
 */
export function EditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const dir = {
    writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const),
    textAlign: isRTL ? ('right' as const) : ('left' as const),
  };

  const project = useScreenProject();
  const loadProject = useEditorStore((s) => s.loadProject);
  const addObject = useEditorStore((s) => s.addObject);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const alignSelected = useEditorStore((s) => s.alignSelected);
  const setGrid = useEditorStore((s) => s.setGrid);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const gridEnabled = useEditorStore((s) => s.project?.gridEnabled);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const setMultiSelectMode = useEditorStore((s) => s.setMultiSelectMode);
  const selectAll = useEditorStore((s) => s.selectAll);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const nudgeSelected = useEditorStore((s) => s.nudgeSelected);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);
  const groupSelected = useEditorStore((s) => s.groupSelected);
  const ungroupSelected = useEditorStore((s) => s.ungroupSelected);
  const enterMember = useEditorStore((s) => s.enterMember);
  const exitCollection = useEditorStore((s) => s.exitCollection);
  // `sizedObjects` is deliberately NOT subscribed here: the canvas publishes it in
  // an effect after every drag frame, so reading it from this screen re-rendered
  // the whole tree a second time per frame. `CollectionBarHost` owns the
  // subscription and the only thing that needs it — the selection's frame.

  const [tool, setTool] = useState<ActiveTool>('select');
  /**
   * Choosing a tool is a detent — tick, then switch. Programmatic resets (e.g.
   * after committing text) call `setTool` directly so they stay silent.
   */
  const selectTool = useCallback((next: ActiveTool) => {
    hapticTick();
    setTool(next);
  }, []);
  const [textSheetOpen, setTextSheetOpen] = useState(false);
  /** The full-height font picker, opened from the Text sheet's Font field. */
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftFont, setDraftFont] = useState<string>(
    fontFamilies[0].defaultVariant,
  );
  const [draftFontSize, setDraftFontSize] = useState(DEFAULT_FONT_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The ornament and shape library. */
  const [insertSheetOpen, setInsertSheetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  /** The Colors tool's picker sheet. */
  const [colorSheetOpen, setColorSheetOpen] = useState(false);
  /** The selection bar's `⋯` overflow sheet. */
  const [moreOpen, setMoreOpen] = useState(false);
  /** The header's secondary actions. */
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  /** The draft shown while renaming the current project. */
  const [titleSheetOpen, setTitleSheetOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  /** The help reference sheet. */
  const [helpOpen, setHelpOpen] = useState(false);
  /** Transient explanation shown when a split is refused. */
  const [splitNotice, setSplitNotice] = useState<string | null>(null);

  // Measured widths for the selection rail's truncation budget (see
  // `visibleActionCount`): the row and the context zone's content. Zero until the
  // first layout pass, which the width maths treats as "everything fits".
  const [railWidth, setRailWidth] = useState(0);
  const [contextWidth, setContextWidth] = useState(0);

  // The text sheet's preview budget and scroll cap are both window-relative, so
  // a short phone gets a shorter preview instead of a sheet off the top of the
  // screen.
  const { height: windowHeight } = useWindowDimensions();

  useAutoSave();

  // The selection bar's order is a device-local preference (settings store),
  // and learn mode binds every selection control to its help entry.
  const selectionBarActions = useSettings((s) => s.selectionBarActions);
  const setSelectionBarActions = useSettings((s) => s.setSelectionBarActions);
  const recentColors = useSettings((s) => s.recentColors);
  const pushRecentColor = useSettings((s) => s.pushRecentColor);
  const help = useHelpMode();
  /** The learn-mode binder, held in a variable so the bar head's memo can key on it. */
  const helpPress = help.press;

  const [projectLoading, setProjectLoading] = useState(false);
  /**
   * A face refused to load, so the cover gate is stood down.
   *
   * Without this the editor strands: `ensureBundledFonts` rejects, `finally`
   * clears `projectLoading`, but the provider will never hold the missing face,
   * so `fontsReady` stays false and `coverVisible` pins the cover over a design
   * that never opens. One flag is enough because the ensure is a single
   * `loadAsync` over all missing keys — it publishes all of them or none.
   */
  const [ensureFailed, setEnsureFailed] = useState(false);

  // Load the project once — after its display faces. Cover, then open: a design
  // naming Gulzar must not paint one frame in Amiri while the face loads, so the
  // ensure happens *before* `loadProject` puts anything on the canvas, and
  // `coverVisible` below holds the screen for the whole window.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        return;
      }
      setProjectLoading(true);
      try {
        const proj = await loadProjectFile(id);
        if (cancelled) {
          return;
        }
        if (proj) {
          try {
            await ensureBundledFonts(
              bundledDisplayKeysFor(projectFontKeys(proj), displayFontKeys),
            );
          } catch {
            // Open anyway: `buildParagraph` falls the missing face back to
            // Amiri, which is a legible design, and the bundled registry retries
            // the face the next time this design is opened. Stranding the user
            // on a cover for a font that is never coming is strictly worse.
            if (!cancelled) {
              setEnsureFailed(true);
            }
          }
          if (cancelled) {
            return;
          }
          loadProject(proj);
        }
      } finally {
        if (!cancelled) {
          setProjectLoading(false);
        }
      }
    })().catch(() => {
      // A read that rejects leaves `project` null; the gate below is already
      // false by then, so the screen falls through to its own empty branch.
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadProject]);

  // Only dragging is tool-gated; a tap resolves the selection in every tool
  // (see `handleTapResult`). Learn mode turns the canvas inert too — there is
  // nothing to grab while every press is an explanation.
  const { gestures, tapPoint } = useObjectGestures(
    tool === 'select' && !help.active,
  );

  // Loaded once for offscreen rendering (thumbnails, exports).
  const skiaFonts = useParagraphFonts();

  // ── missing remote fonts ────────────────────────────────────────────────────
  // The never-silent half of the remote-font contract: on open, any text face
  // that is `remote:<…>` but not installed on this device raises a banner
  // offering the download (the canvas renders Amiri meanwhile — see
  // `buildParagraph` in skia/text.ts). Bundled faces never reach this list;
  // `missingRemoteFontKeys` ignores non-remote keys.
  const installedRemoteKeys = useInstalledRemoteFontKeys();
  const [missingFonts, setMissingFonts] = useState<string[] | null>(null);
  const [downloadingMissing, setDownloadingMissing] = useState(false);

  // The scan is keyed on the *content* of the document's fontKeys, so dragging
  // (which re-creates the project object every frame) does not re-read
  // AsyncStorage. It re-runs when the installed set changes instead — a
  // download from the banner clears itself.
  const projectFontKeySignature = useMemo(
    () => (project ? [...projectFontKeys(project)].sort().join('\u0000') : ''),
    [project],
  );

  // ── the cover gate ─────────────────────────────────────────────────────────
  // The display faces this document names, and whether the live provider can
  // draw every one of them yet.
  //
  // Keyed on the *signature*, not the project object — the same trick the
  // missing-font banner uses, and for the same reason: a drag re-creates the
  // project every frame, and a memo keyed on that identity would re-derive this
  // sixty times a second.
  const requiredDisplayKeys = useMemo(
    () =>
      bundledDisplayKeysFor(
        projectFontKeySignature.split('\u0000'),
        displayFontKeys,
      ),
    [projectFontKeySignature],
  );
  const fontsReady =
    ensureFailed ||
    (skiaFonts != null &&
      requiredDisplayKeys.every((key) => skiaFonts.families.has(key)));
  // Only on a real design route: the editor is also reachable without an `id`
  // (a new, empty design), and there is nothing to wait for.
  const coverVisible = !!id && (projectLoading || !fontsReady);

  // Whoever puts a display key into the document owns loading it. The open
  // effect above covers the design being opened; this covers a face that
  // *arrives* — the picker applying one, a split, a paste, an undo. Without it
  // the gate waits on a face nobody is loading, and since the cover replaces the
  // whole editor (the back button lives below it) a failed load stranded the user
  // on a pulse with no way back.
  //
  // `requiredDisplayKeys`' identity is memo-controlled and only moves when the
  // document's font keys actually change, so this runs once per requirement and
  // not once per drag frame.
  useEffect(() => {
    if (requiredDisplayKeys.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      // The flag is per-requirement, not per-mount: a fresh requirement earns a
      // fresh attempt, so one unrecoverable face does not stand the gate down for
      // every face the rest of the session names.
      setEnsureFailed(false);
      try {
        await ensureBundledFonts(requiredDisplayKeys);
      } catch {
        // Open in Amiri rather than strand. `buildParagraph`'s fallback makes the
        // substitution visible in the design, and the next requirement retries.
        if (!cancelled) {
          setEnsureFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, requiredDisplayKeys]);

  useEffect(() => {
    let cancelled = false;
    // The scan always runs in the async continuation — never a synchronous
    // setState in the effect body — so opening (or closing) a design re-reads
    // AsyncStorage without cascading a render.
    void (async () => {
      const missing = projectFontKeySignature
        ? await missingRemoteFontKeys(projectFontKeySignature.split('\u0000'))
        : [];
      if (!cancelled) {
        setMissingFonts(missing.length > 0 ? missing : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectFontKeySignature, installedRemoteKeys]);

  const downloadMissingFonts = useCallback(async () => {
    const missing = missingFonts;
    if (!missing || missing.length === 0 || downloadingMissing) {
      return;
    }
    setDownloadingMissing(true);
    try {
      for (const fontKey of missing) {
        const parsed = parseRemoteFontKey(fontKey);
        if (parsed) {
          await downloadRemoteFont(parsed.id, parsed.weight);
        }
      }
    } finally {
      setDownloadingMissing(false);
    }
  }, [missingFonts, downloadingMissing]);

  /**
   * A canvas tap resolves the selection whatever tool is active. The rails only
   * add capability (a paper, an ink) and none of them owns the canvas, so a tap
   * that did nothing would read as a dead canvas — most visibly right after
   * picking a background image, the one flow that leaves its tool selected.
   *
   * Selecting a design while the background tool is open is a request to work
   * on that design, not to keep picking a paper: hand the canvas back to Select
   * so its icon lights up and the selection rail replaces the background
   * toolbox. A tap that hits nothing leaves the tool alone, so the paper can
   * still be adjusted.
   */
  const handleTapResult = useCallback(
    (objId: string | null) => {
      if (objId !== null && tool === 'background') {
        selectTool('select');
      }
      const store = useEditorStore.getState();
      if (store.gs.selectionHandledOnDown) {
        store.setGs({ selectionHandledOnDown: false });
      } else if (
        objId !== null &&
        !store.gs.additiveSelect &&
        // A member of the collection that is *already* selected, tapped rather
        // than dragged (a drag swallows the tap): the second tap steps inside.
        store.selectedIds.length > 1 &&
        store.selectedIds.includes(objId) &&
        store.project?.objects.find((o) => o.id === objId)?.groupId !==
          undefined
      ) {
        store.enterMember(objId);
      } else {
        // The additive flag was recorded at pointer-down (`beginDrag`), so the
        // tap-up half of the press agrees with it — the multi-select tool or a
        // web selection modifier (Shift/Cmd/Ctrl).
        select(objId, store.gs.additiveSelect);
      }
      setEditingId(null);
    },
    [select, selectTool, tool],
  );

  const selectedObject = useMemo(
    () => project?.objects.find((o) => o.id === selectedIds[0]),
    [project, selectedIds],
  );

  /** The selection, narrowed to text objects for the typography controls. */
  const selectedText = useMemo(
    () => (selectedObject?.type === 'text' ? selectedObject : undefined),
    [selectedObject],
  );

  /**
   * The split word the selection belongs to, if any: `part.rootId` is what ties a
   * part back to the word it was cut from.
   *
   * Kept apart from the collection members below on purpose. Rejoin is about
   * *provenance* — it has to go on working for a word that was later ungrouped —
   * while the bar's member track and the frame are about *membership*. One lookup
   * could not serve both without breaking one of them.
   */
  const rejoinParts = useMemo(() => {
    const rootId = selectedText?.part?.rootId;
    if (!rootId) {
      return [];
    }
    return (project?.objects ?? [])
      .filter(
        (o): o is CalligraphyTextObject =>
          o.type === 'text' && o.part?.rootId === rootId,
      )
      .sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0));
  }, [project, selectedText]);

  /**
   * The members of the collection the selection is in, in reading order — a split
   * word's letters, or a group's objects.
   *
   * Empty for a lone object, which is what keeps the bar's member track off the
   * canvas until there is more than one member to navigate.
   */
  const members = useMemo(
    () => collectionMembers(selectedIds, project?.objects ?? []),
    [selectedIds, project],
  );

  /** Position of the primary selection within the member track (-1 when absent). */
  const activeMemberIndex =
    selectedIds.length === 1
      ? members.findIndex((m) => m.id === selectedIds[0])
      : -1;

  /**
   * Whether the selection can be broken into parts. Deliberately a cheap
   * text-only test so the button state never waits on fonts (the actual split
   * still validates against the shaper).
   */
  const canSplitSelected =
    !!selectedText &&
    !selectedText.part &&
    canSplitIntoClusters(selectedText.text);

  /** Only meaningful when the text has more than one visual line to align. */
  const showAlign =
    !!selectedText &&
    (selectedText.wrapWidth != null || selectedText.text.includes('\n'));

  /** The preset the selection is currently wearing (falling back to the first). */
  const activePresentation =
    presentationByKey(selectedText?.presentation?.key) ?? presentations[0];

  /** The face the text sheet is previewing, for the preview's caption. */
  const draftFontMeta = familyForVariant(draftFont);
  const draftFontLabel = draftFontMeta
    ? `${language === 'ar' ? draftFontMeta.labelAr : draftFontMeta.labelEn} · ${
        language === 'ar'
          ? variantFor(draftFont)?.labelAr
          : variantFor(draftFont)?.labelEn
      }`
    : (remoteFontLabel(draftFont) ?? '');

  // The refusal message is transient — it explains a rejected action rather than
  // describing persistent state.
  useEffect(() => {
    if (!splitNotice) {
      return;
    }
    const timer = setTimeout(() => setSplitNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [splitNotice]);

  const splitFailureMessage = useCallback(
    (reason: SplitFailure): string => {
      switch (reason) {
        case 'too-few-clusters':
          return t.editor.splitNeedsTwoParts;
        case 'cluster-wrapped':
          return t.editor.splitWrapped;
        case 'latin-script':
          return t.editor.splitLatinScript;
        default:
          return t.editor.splitFailed;
      }
    },
    [t],
  );

  /** The selected text object, read fresh from the store for one-shot actions. */
  const liveText = useCallback((): CalligraphyTextObject | undefined => {
    const store = useEditorStore.getState();
    const obj = store.project?.objects.find(
      (o) => o.id === store.selectedIds[0],
    );
    return obj?.type === 'text' ? obj : undefined;
  }, []);

  const splitSelected = useCallback(() => {
    const store = useEditorStore.getState();
    const canvas = store.project?.canvas;
    const obj = liveText();
    if (!canvas || !obj) {
      return;
    }
    if (!skiaFonts) {
      setSplitNotice(t.editor.splitFailed);
      return;
    }
    const outcome = splitTextObject(obj, skiaFonts.fonts, canvas.width);
    if (!outcome.ok) {
      setSplitNotice(splitFailureMessage(outcome.reason));
      return;
    }
    setSplitNotice(null);
    store.splitObjectIntoParts(obj.id, outcome.parts);
  }, [liveText, skiaFonts, splitFailureMessage, t]);

  const rejoinSelected = useCallback(() => {
    // The parts are read live rather than from `rejoinParts`: the screen's
    // project can lag a drag by its transforms, and the merged word has to land
    // where its pieces actually are now, not where they were before the drag.
    const rootId = liveText()?.part?.rootId;
    if (!rootId) {
      return;
    }
    const parts = (useEditorStore.getState().project?.objects ?? [])
      .filter(
        (o): o is CalligraphyTextObject =>
          o.type === 'text' && o.part?.rootId === rootId,
      )
      .sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0));
    if (parts.length < 2) {
      return;
    }
    const text = mergePartTexts(parts);
    if (text === null) {
      // Incomplete group — refuse rather than silently drop a part.
      setSplitNotice(t.editor.splitFailed);
      return;
    }
    const first = parts[0];
    // The parts may have drifted apart, so the merged object is centred on the
    // group's centroid: the word reappears where its pieces were, instead of
    // jumping to whichever part happened to sort first.
    const centre = parts.reduce(
      (acc, p) => ({
        x: acc.x + p.transform.x / parts.length,
        y: acc.y + p.transform.y / parts.length,
      }),
      { x: 0, y: 0 },
    );
    const merged: CalligraphyTextObject = {
      id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      text,
      fontKey: first.fontKey,
      fontSize: first.fontSize,
      lineHeight: first.lineHeight,
      wrapWidth: null,
      align: first.align,
      color: first.color,
      opacity: first.opacity,
      shadows: first.shadows,
      presentation: first.presentation,
      transform: { ...first.transform, x: centre.x, y: centre.y },
      zIndex: first.zIndex,
    };
    setSplitNotice(null);
    useEditorStore.getState().mergeObjectParts(
      merged,
      parts.map((p) => p.id),
    );
  }, [liveText, t]);

  /**
   * Moves the focus to the neighbouring member of the selected collection.
   */
  const stepMember = useCallback(
    (direction: 1 | -1) => {
      if (members.length < 2) {
        return;
      }
      const current = members.findIndex(
        (m) => m.id === useEditorStore.getState().selectedIds[0],
      );
      const from = current < 0 ? 0 : current;
      const next = (from + direction + members.length) % members.length;
      // Entering the neighbour, not selecting it: a plain `select` would grow
      // back to the whole collection and the track would stop stepping.
      enterMember(members[next].id);
    },
    [members, enterMember],
  );

  /**
   * The collection bar's presses, bound here rather than inside the bar because
   * learn mode has to intercept them: while it is on, a tile or an arrow
   * explains itself instead of moving the focus, which is the whole point of the
   * mode. The bar stays presentational and calls these like any other handler.
   */
  const pressMember = useCallback(
    (id: string) => helpPress('sel.memberTile', () => enterMember(id)),
    [helpPress, enterMember],
  );

  const pressStep = useCallback(
    (direction: 1 | -1) =>
      helpPress(direction < 0 ? 'sel.partPrev' : 'sel.partNext', () =>
        stepMember(direction),
      ),
    [helpPress, stepMember],
  );

  /**
   * Cycles the presentation presets, wrapping in both directions.
   *
   * The step is read from the primary selection and applied to every selected
   * text object, so stepping a group keeps the group in one look.
   */
  const cyclePresentation = useCallback(
    (direction: 1 | -1) => {
      const primary = liveText();
      const texts = currentSelection().filter((o) => o.type === 'text');
      if (!primary || texts.length === 0) {
        return;
      }
      const current = presentations.findIndex(
        (p) => p.key === primary.presentation?.key,
      );
      const next =
        current < 0
          ? direction === 1
            ? 0
            : presentations.length - 1
          : (current + direction + presentations.length) % presentations.length;
      const preset = presentations[next];
      const store = useEditorStore.getState();
      store.snapshot();
      for (const obj of texts) {
        store.updateObject(obj.id, presetPatch(preset, obj) as never);
      }
    },
    [liveText],
  );

  /**
   * Applies a presentation preset to every selected text object.
   *
   * The patch is resolved per object — a preset is a delta against each object's
   * own properties — so a group ends up in one look without flattening what each
   * member started from.
   */
  const applyPresentation = useCallback((key: string) => {
    const preset = presentationByKey(key);
    const texts = currentSelection().filter((o) => o.type === 'text');
    if (!preset || texts.length === 0) {
      return;
    }
    const store = useEditorStore.getState();
    store.snapshot();
    for (const obj of texts) {
      store.updateObject(obj.id, presetPatch(preset, obj) as never);
    }
  }, []);

  /**
   * Patches every selected object in one step, snapshotting per call.
   *
   * `opacity` is the field every object type carries, so it still reaches a
   * group of mixed kinds; it keeps the one-snapshot-per-change shape. Colour has
   * its own per-visit path in `applyColor` (see `docs/editor-color-picker.md`);
   * text-only fields stay in `patchStyle`.
   */
  const patchSelectedAll = useCallback(
    (patch: { color?: string; opacity?: number }) => {
      const store = useEditorStore.getState();
      const objects = currentSelection();
      if (objects.length === 0) {
        return;
      }
      store.snapshot();
      for (const obj of objects) {
        store.updateObject(obj.id, patch as never);
      }
    },
    [],
  );

  /**
   * True once the current Colors-tool visit has snapshotted. Reset when the tool
   * is pressed, so one visit is one undo step (`docs/editor-color-picker.md`
   * §5) — the same shape as `beginFontSizeDrag`.
   */
  const colorSession = useRef(false);

  /**
   * Apply a colour to the whole selection. The first change of a visit
   * snapshots; the rest update live and free. A custom entry is remembered.
   */
  const applyColor = useCallback(
    (color: string, source: 'preset' | 'custom') => {
      const store = useEditorStore.getState();
      const objects = currentSelection();
      if (objects.length === 0) {
        return;
      }
      if (!colorSession.current) {
        store.snapshot();
        colorSession.current = true;
      }
      for (const obj of objects) {
        store.updateObject(obj.id, { color } as never);
      }
      if (source === 'custom') {
        pushRecentColor(color);
      }
    },
    [pushRecentColor],
  );

  /**
   * Snapshot + patch for one discrete style change, applied to every selected
   * text object.
   *
   * A group is one element, so a style change lands on all of it — the same rule
   * `scaleSelection` and its siblings follow for the transform buttons. One
   * snapshot covers the whole selection, so a single undo reverts all of it.
   */
  const patchStyle = useCallback((patch: Partial<CalligraphyTextObject>) => {
    const store = useEditorStore.getState();
    const texts = currentSelection().filter((o) => o.type === 'text');
    if (texts.length === 0) {
      return;
    }
    store.snapshot();
    for (const obj of texts) {
      store.updateObject(obj.id, patch as never);
    }
  }, []);

  /**
   * Live font-size change on the selection.
   *
   * Deliberately snapshot-free: the gauge brackets a whole drag in
   * `beginFontSizeDrag`, so one gesture — which fires this dozens of times —
   * lands as a single history entry instead of flooding undo.
   */
  const setFontSize = useCallback((fontSize: number) => {
    const store = useEditorStore.getState();
    const patches: { id: string; patch: Partial<DesignObject> }[] = [];
    for (const obj of currentSelection()) {
      if (obj.type !== 'text' || fontSize === obj.fontSize) {
        continue;
      }
      // Scale the leading with the size so the text does not reflow as it
      // grows. The ratio is each object's own, so a group of texts set at
      // different leadings keeps each one's rhythm.
      const ratio =
        obj.fontSize > 0
          ? obj.lineHeight / obj.fontSize
          : DEFAULT_LEADING_RATIO;
      patches.push({
        id: obj.id,
        patch: { fontSize, lineHeight: Math.round(fontSize * ratio) },
      });
    }
    if (patches.length === 0) {
      return;
    }
    // One write for the whole selection, and still snapshot-free: the gauge
    // brackets a whole drag in `beginFontSizeDrag`.
    store.updateObjects(patches);
  }, []);

  /** Opens the undo bracket that one gauge drag (or one step tap) fills. */
  const beginFontSizeDrag = useCallback(() => {
    if (liveText()) {
      useEditorStore.getState().snapshot();
    }
  }, [liveText]);

  const stepLineHeight = useCallback(
    (delta: number) => {
      const obj = liveText();
      if (!obj) {
        return;
      }
      const step = Math.max(1, Math.round(obj.fontSize * 0.05));
      const lineHeight = Math.max(1, Math.round(obj.lineHeight + delta * step));
      if (lineHeight === obj.lineHeight) {
        return;
      }
      patchStyle({ lineHeight });
    },
    [liveText, patchStyle],
  );

  const stepOpacity = useCallback(
    (delta: number) => {
      const obj = liveText();
      if (!obj) {
        return;
      }
      const opacity = clamp(
        Math.round((obj.opacity + delta) * 100) / 100,
        MIN_OPACITY,
        MAX_OPACITY,
      );
      if (opacity === obj.opacity) {
        return;
      }
      // Cross-type: opacity is meaningful on a text object and an ornament
      // alike, so a mixed group dims together.
      patchSelectedAll({ opacity });
    },
    [liveText, patchSelectedAll],
  );

  /**
   * The frame the selection's handles are drawn on, with its measured members.
   *
   * The same rule the canvas draws and the gesture layer grabs (`groups.ts`), so a
   * rail button acts on exactly the box the user can see.
   */
  const selectionTarget = useCallback(
    () =>
      selectionFrame(
        useEditorStore.getState().selectedIds,
        useEditorStore.getState().sizedObjects,
      ),
    [],
  );

  /**
   * Scales the selection.
   *
   * One object keeps the classic behaviour — its own scale, clamped. A whole
   * selection scales as a *frame*: every member's offset from the centre is
   * multiplied by the factor as well as its own scale, so the arrangement stays
   * similar instead of each member growing in place.
   */
  const scaleSelection = useCallback(
    (factor: number) => {
      const store = useEditorStore.getState();
      const objects = currentSelection();
      if (objects.length === 0) {
        return;
      }
      store.snapshot();
      if (objects.length === 1) {
        const obj = objects[0];
        store.updateObject(obj.id, {
          transform: {
            ...obj.transform,
            scale: clamp(
              obj.transform.scale * factor,
              OBJECT_SCALE_BOUNDS.min,
              OBJECT_SCALE_BOUNDS.max,
            ),
          },
        });
        return;
      }
      const target = selectionTarget();
      if (!target) {
        return;
      }
      store.updateObjects(
        withTransform(
          objects,
          scaleCollection(
            memberOrigins(target.members),
            factor,
            { x: target.frame.x, y: target.frame.y },
            OBJECT_SCALE_BOUNDS,
          ),
        ),
      );
    },
    [selectionTarget],
  );

  /**
   * Rotates the selection.
   *
   * One object turns in place. A whole selection *orbits* its frame centre as
   * well, which is the difference between turning a composition and spinning
   * every piece of it on the spot.
   */
  const rotateSelection = useCallback(
    (delta: number) => {
      const store = useEditorStore.getState();
      const objects = currentSelection();
      if (objects.length === 0) {
        return;
      }
      store.snapshot();
      if (objects.length === 1) {
        const obj = objects[0];
        store.updateObject(obj.id, {
          transform: {
            ...obj.transform,
            rotation: obj.transform.rotation + delta,
          },
        });
        return;
      }
      const target = selectionTarget();
      if (!target) {
        return;
      }
      store.updateObjects(
        withTransform(
          objects,
          rotateCollection(memberOrigins(target.members), delta, {
            x: target.frame.x,
            y: target.frame.y,
          }),
        ),
      );
    },
    [selectionTarget],
  );

  /**
   * Mirrors the selection.
   *
   * A whole selection mirrors about its frame centre: the offsets reflect *and*
   * every member turns to face the other way, because that is what a mirror is.
   * Flipping the members in place would leave the arrangement exactly where it was
   * and only turn each letter backwards.
   */
  const flipSelection = useCallback(
    (axis: 'h' | 'v') => {
      const store = useEditorStore.getState();
      const objects = currentSelection();
      if (objects.length === 0) {
        return;
      }
      store.snapshot();
      if (objects.length === 1) {
        const obj = objects[0];
        store.updateObject(obj.id, {
          transform: {
            ...obj.transform,
            flipH: axis === 'h' ? !obj.transform.flipH : obj.transform.flipH,
            flipV: axis === 'v' ? !obj.transform.flipV : obj.transform.flipV,
          },
        });
        return;
      }
      const target = selectionTarget();
      if (!target) {
        return;
      }
      store.updateObjects(
        withTransform(
          objects,
          flipCollection(memberOrigins(target.members), axis, {
            x: target.frame.x,
            y: target.frame.y,
          }),
        ),
      );
    },
    [selectionTarget],
  );

  /**
   * Drops a manual wrap width so the selected text hugs its content again
   * (the auto-width default), capped at the canvas edge.
   */
  const fitTextToContent = useCallback(() => {
    const store = useEditorStore.getState();
    const obj = store.project?.objects.find(
      (o) => o.id === store.selectedIds[0],
    );
    if (!obj || obj.type !== 'text') {
      return;
    }
    store.snapshot();
    store.updateObject(obj.id, { wrapWidth: null } as never);
  }, []);

  /** Opens the text sheet; prefills when a text object is selected. */
  const openTextSheet = useCallback(() => {
    const store = useEditorStore.getState();
    const obj = store.project?.objects.find(
      (o) => o.id === store.selectedIds[0],
    );
    if (obj && obj.type === 'text') {
      setDraftText(obj.text);
      setDraftFont(obj.fontKey);
      setDraftFontSize(obj.fontSize);
      setEditingId(obj.id);
    } else {
      setDraftText('');
      setDraftFont(fontFamilies[0].defaultVariant);
      setDraftFontSize(DEFAULT_FONT_SIZE);
      setEditingId(null);
    }
    setTextSheetOpen(true);
  }, []);

  const saveTextObject = useCallback(() => {
    if (!project || !draftText.trim()) {
      return;
    }
    const canvas = project.canvas;
    const existing =
      editingId && project.objects.find((o) => o.id === editingId);
    if (existing && existing.type === 'text') {
      const store = useEditorStore.getState();
      store.snapshot();
      // Keep the object's own leading ratio: re-opening the sheet to retype a
      // word must not silently undo an "airy" or "tight" preset.
      const ratio =
        existing.fontSize > 0
          ? existing.lineHeight / existing.fontSize
          : DEFAULT_LEADING_RATIO;
      // A font change invalidates any style-preset highlight: the look no longer
      // reflects the preset the object was wearing.
      const fontChanged = existing.fontKey !== draftFont;
      store.updateObject(existing.id, {
        text: draftText.trim(),
        fontKey: draftFont,
        fontSize: draftFontSize,
        lineHeight: Math.round(draftFontSize * ratio),
        ...(fontChanged ? { presentation: undefined } : {}),
      } as never);
    } else {
      addObject({
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        text: draftText.trim(),
        fontKey: draftFont,
        fontSize: draftFontSize,
        lineHeight: Math.round(draftFontSize * DEFAULT_LEADING_RATIO),
        align: 'center',
        color: DEFAULT_INK,
        opacity: 1,
        transform: {
          x: canvas.width / 2,
          y: canvas.height / 2,
          scale: 1,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        zIndex: (project.objects.length + 1) * 10,
      });
    }
    setTextSheetOpen(false);
    setDraftText('');
    setEditingId(null);
    setTool('select');
  }, [project, draftText, draftFont, draftFontSize, editingId, addObject]);

  /**
   * Insert a decoration — the library's only write path.
   *
   * Both kinds share one transform: centred on the canvas, size carried by
   * `scale`, and a `zIndex` following the same `* 10` spacing text objects use,
   * so the newest object lands on top. The rail returns to Select because the
   * sheet has closed and the new object is what wants the handles.
   */
  const insertGlyph = useCallback(
    (glyphKey: string, style: GlyphStyle) => {
      if (!project) {
        return;
      }
      addObject({
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'glyph',
        glyphKey,
        // The style the library picker had selected — a tile always inserts
        // the ornament it previews.
        glyphStyle: style,
        color: DEFAULT_INK,
        opacity: 1,
        transform: {
          x: project.canvas.width / 2,
          y: project.canvas.height / 2,
          scale: DECOR_INSERT_SCALE,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        zIndex: (project.objects.length + 1) * 10,
      });
      setTool('select');
    },
    [project, addObject],
  );

  const insertShape = useCallback(
    (shapeKey: ShapeKey) => {
      if (!project) {
        return;
      }
      addObject({
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'shape',
        shapeKey,
        color: DEFAULT_INK,
        // Stroked to match the library's previews and the ornament idiom —
        // rules, frames and rings — rather than a filled block.
        fill: false,
        strokeWidth: SHAPE_STROKE_WIDTH,
        opacity: 1,
        transform: {
          x: project.canvas.width / 2,
          y: project.canvas.height / 2,
          scale: DECOR_INSERT_SCALE,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        zIndex: (project.objects.length + 1) * 10,
      });
      setTool('select');
    },
    [project, addObject],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) {
      return;
    }
    hapticDelete();
    useEditorStore.getState().removeObjects(selectedIds);
  }, [selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (!selectedIds.length) {
      return;
    }
    useEditorStore.getState().duplicateObjects(selectedIds);
  }, [selectedIds]);

  const save = useCallback(async () => {
    // Read the live project, not the render snapshot: `useScreenProject` holds
    // the last *structural* project, so a save after a drag would otherwise
    // persist pre-drag transforms.
    const live = useEditorStore.getState().project;
    if (!live) {
      return;
    }
    await saveProject({ ...live, updatedAt: new Date().toISOString() });
    try {
      const png = renderProjectToPng(live, skiaFonts?.fonts ?? null, {
        maxWidthPx: THUMB_MAX_WIDTH_PX,
      });
      await saveThumb(live.id, png.base64DataUri);
    } catch {
      // Thumbnail is best-effort; the project itself is saved.
      // Fires for the explicit save button and for the save that precedes every
      // export — both are "the work is safely on disk" moments.
      hapticSuccess();
    }
  }, [skiaFonts]);

  const runExport = useCallback(
    async (
      key: 'image' | 'svg' | 'file' | 'photos',
      fn: () => Promise<void>,
    ) => {
      setExporting(key);
      setExportError(null);
      try {
        await save();
        await fn();
        setExportOpen(false);
      } catch (e) {
        setExportError(e instanceof Error ? e.message : String(e));
      } finally {
        setExporting(null);
      }
    },
    [save],
  );

  const exportImage = useCallback(() => {
    if (exporting) return;
    void runExport('image', async () => {
      const live = useEditorStore.getState().project;
      if (!live) return;
      const png = renderProjectToPng(live, skiaFonts?.fonts ?? null, {
        maxWidthPx: 2048,
      });
      await shareImage({
        data: png.base64DataUri,
        format: 'png',
        fileName: `${live.name || 'midad-design'}.png`,
      });
    });
  }, [exporting, runExport, skiaFonts]);

  const exportSvg = useCallback(() => {
    if (exporting) return;
    const dialogTitle = t.editor.exportSvgAction;
    void runExport('svg', async () => {
      const live = useEditorStore.getState().project;
      if (!live) return;
      const faces = await collectSvgFontFaces(collectUsedFamilies(live));
      // SVG cannot re-flow Arabic text itself, so resolve the visual line
      // breaks from the same layout the canvas uses.
      const lineBreaks = skiaFonts ? textLineBreaks(live, skiaFonts.fonts) : {};
      const svg = projectToSvg(live, faces, lineBreaks);
      await shareFile({
        data: svg,
        fileName: `${live.name || 'midad-design'}.svg`,
        mimeType: 'image/svg+xml',
        uti: 'public.svg-image',
        dialogTitle,
      });
    });
  }, [exporting, runExport, t, skiaFonts]);

  const exportFile = useCallback(() => {
    if (exporting) return;
    const dialogTitle = t.editor.exportProjectFile;
    void runExport('file', async () => {
      const live = useEditorStore.getState().project;
      if (!live) return;
      await shareFile({
        data: await exportProjectFile(live),
        fileName: `${live.name || 'midad'}.${PROJECT_FILE_EXT}`,
        mimeType: 'application/zip',
        uti: 'public.zip-archive',
        dialogTitle,
      });
    });
  }, [exporting, runExport, t]);

  /**
   * Native only: write the design straight into the device photo library. A
   * denied permission comes back as `false`, which `runExport` surfaces through
   * the sheet's own error line rather than a silent no-op.
   */
  const exportSaveToPhotos = useCallback(() => {
    if (exporting) return;
    void runExport('photos', async () => {
      const live = useEditorStore.getState().project;
      if (!live) return;
      const png = renderProjectToPng(live, skiaFonts?.fonts ?? null, {
        maxWidthPx: 2048,
      });
      const saved = await saveImageToLibrary({
        data: png.base64DataUri,
        format: 'png',
        fileName: `${live.name || 'midad-design'}.png`,
      });
      if (!saved) {
        throw new Error(t.editor.saveToPhotosDenied);
      }
    });
  }, [exporting, runExport, skiaFonts, t]);

  const setBgColor = useCallback((color: string) => {
    useEditorStore.getState().setCanvas({
      background: { type: 'paper', color },
    });
  }, []);

  /**
   * Launch the system image picker and set the chosen image as the design's
   * background.
   *
   * The bytes are written beside the document immediately — not on the next
   * autosave — so the periodic write never has to touch the image, and the
   * `.midad` export carries it without re-encoding.
   */
  const setBgImage = useCallback(async () => {
    const picked = await pickBackgroundImage();
    const current = useEditorStore.getState().project;
    if (!picked || !current) {
      return;
    }
    const stored = await writeBackgroundImage(
      current.id,
      picked.base64,
      picked.mime,
    );
    useEditorStore.getState().setCanvas({
      background: { type: 'image', ...stored },
    });
    // The picker is a modal flow; return to Select so the canvas is
    // immediately draggable again. Silent (`setTool`, not `selectTool`) —
    // the picker already gave the user feedback.
    setTool('select');
  }, []);

  /** Revert an image background to the default paper colour. */
  const clearBgImage = useCallback(() => {
    useEditorStore.getState().setCanvas({
      background: { type: 'paper', color: DEFAULT_PAPER },
    });
  }, []);

  /**
   * Keyboard shortcuts. Every action routed here already exists as a button —
   * the layer only adds the key, so the two paths cannot drift apart.
   *
   * `enabled` is false while a sheet is open: the sheet owns the keyboard then,
   * which is also what leaves Escape free for react-native-web to close it.
   */
  const shortcuts = useKeyboardShortcuts({
    enabled:
      !textSheetOpen &&
      !styleSheetOpen &&
      !insertSheetOpen &&
      !exportOpen &&
      !helpOpen,
    handlers: {
      delete: deleteSelected,
      undo,
      redo,
      duplicate: duplicateSelected,
      selectAll,
      save: () => void save(),
      clearSelection,
      nudgeLeft: (context) => nudgeSelected(-nudgeStep(context), 0),
      nudgeRight: (context) => nudgeSelected(nudgeStep(context), 0),
      nudgeUp: (context) => nudgeSelected(0, -nudgeStep(context)),
      nudgeDown: (context) => nudgeSelected(0, nudgeStep(context)),
      // Flip and rotation mirror the selection-bar buttons exactly: one object
      // turns or mirrors in place, a whole selection turns about its frame centre.
      flipH: () => flipSelection('h'),
      flipV: () => flipSelection('v'),
      rotateCcw: () => rotateSelection(-90),
      rotateCw: () => rotateSelection(90),
      bringToFront: () => {
        if (selectedIds.length > 0) {
          bringToFront(selectedIds);
        }
      },
      sendToBack: () => {
        if (selectedIds.length > 0) {
          sendToBack(selectedIds);
        }
      },
      // Grouping is a discrete structural edit, so the chord mirrors the rail
      // button exactly — same predicate, same store call.
      group: groupSelected,
      ungroup: ungroupSelected,
      toolSelect: () => {
        setMultiSelectMode(false, true);
        selectTool('select');
      },
      toolMultiSelect: () => {
        selectTool('select');
        setMultiSelectMode(!multiSelectMode, multiSelectMode);
      },
      toolText: () => {
        setMultiSelectMode(false);
        selectTool('text');
        openTextSheet();
      },
      toggleGrid: () => setGrid(!gridEnabled),
      // The sheet is the same surface the `?` button opens, so the chord
      // leaves learn mode first — the sheet's "Learn mode" button always turns
      // the mode on, never off.
      openHelp: () => {
        help.exit();
        setHelpOpen(true);
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Selection bar — the rail truncates to what fits and the rest live in the
  // `⋯` sheet (see `selection-actions.tsx`). The screen supplies the behaviour
  // through `run`; the module decides what is available and in what order.
  // ---------------------------------------------------------------------------

  /**
   * How many *elements* the selection holds — a group counts as one.
   *
   * This is what the badge reports and what `isMulti` gates the align group on,
   * so a group of three reads as "1" and offers the same actions a single
   * object does. That is the point of a group: it behaves as one element.
   */
  const elementCount = useMemo(
    () => unitCount(selectedIds, project?.objects ?? []),
    [selectedIds, project],
  );

  /** What the current selection can do, for the action table. */
  const shape: SelectionShape = useMemo(
    () => ({
      isText: !!selectedText,
      isGlyph: selectedIds.length === 1 && selectedObject?.type === 'glyph',
      canSplit: canSplitSelected,
      canRejoin: rejoinParts.length > 1,
      isMulti: elementCount > 1,
      canGroup: canGroup(selectedIds, project?.objects ?? []),
      canUngroup: canUngroup(selectedIds, project?.objects ?? []),
    }),
    [
      selectedText,
      selectedIds,
      selectedObject,
      canSplitSelected,
      rejoinParts.length,
      elementCount,
      project,
    ],
  );

  /**
   * What the collection bar's head names, and its way back out of an entered
   * collection.
   *
   * Resolved here rather than inside `CollectionBarHost` because binding a press
   * belongs to this screen — learn mode intercepts every one of them — and because
   * neither value needs geometry. The host adds the frame, which does, and which is
   * the only part of the bar that has to follow the canvas frame by frame.
   */
  const collectionBarRole = helpRole(helpEntry('sel.collectionBar'), language);
  const exitCollectionForBar = helpPress('sel.collectionBar', exitCollection);

  /** What each selection command does. A `Record`, so a new id cannot be left unhandled. */
  const run = useMemo<Record<SelectionCommandId, () => void>>(
    () => ({
      styleOpen: () => setStyleSheetOpen(true),
      stylePrev: () => cyclePresentation(-1),
      styleNext: () => cyclePresentation(1),
      scaleUp: () => scaleSelection(1.1),
      scaleDown: () => scaleSelection(0.9),
      rotateCcw: () => rotateSelection(-90),
      rotateCw: () => rotateSelection(90),
      flipH: () => flipSelection('h'),
      flipV: () => flipSelection('v'),
      fitText: fitTextToContent,
      split: splitSelected,
      rejoin: rejoinSelected,
      glyphStyle: () => {
        const objects = project?.objects ?? [];
        const patches = objects
          .filter(
            (o): o is GlyphObject =>
              o.type === 'glyph' && selectedIds.includes(o.id),
          )
          .map((o) => ({
            id: o.id,
            patch: { glyphStyle: nextGlyphStyle(glyphStyleOf(o)) },
          }));
        if (patches.length > 0) {
          useEditorStore.getState().updateObjects(patches);
        }
      },
      duplicate: duplicateSelected,
      group: groupSelected,
      ungroup: ungroupSelected,
      bringToFront: () => {
        // The whole selection, not the primary alone: z-order is part of what a
        // group owns, and `bringToFront` already assigns one value to all of it
        // so the group keeps its internal layering.
        if (selectedIds.length > 0) {
          bringToFront(selectedIds);
        }
      },
      sendToBack: () => {
        if (selectedIds.length > 0) {
          sendToBack(selectedIds);
        }
      },
      delete: deleteSelected,
      alignLeft: () => alignSelected('left'),
      alignCenterH: () => alignSelected('centerH'),
      alignRight: () => alignSelected('right'),
      alignTop: () => alignSelected('top'),
      alignMiddleV: () => alignSelected('middleV'),
      alignBottom: () => alignSelected('bottom'),
      centerH: () => alignSelected('canvasCenterH'),
      centerV: () => alignSelected('canvasCenterV'),
      more: () => setMoreOpen(true),
    }),
    [
      selectedIds,
      project,
      scaleSelection,
      rotateSelection,
      flipSelection,
      fitTextToContent,
      splitSelected,
      rejoinSelected,
      duplicateSelected,
      bringToFront,
      sendToBack,
      deleteSelected,
      alignSelected,
      cyclePresentation,
      groupSelected,
      ungroupSelected,
    ],
  );

  /** The bar's order: the user's pins, or the fresh-install default. */
  const bar = selectionBarActions ?? defaultSelectionBar();

  /** Moves an action to the head of the bar, or takes it out again. */
  const togglePin = useCallback(
    (id: SelectionActionId) => {
      const current =
        useSettings.getState().selectionBarActions ?? defaultSelectionBar();
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [id, ...current.filter((x) => x !== id)];
      setSelectionBarActions(next);
    },
    [setSelectionBarActions],
  );

  const sources: SelectionActionSources = {
    t,
    language,
    press: help.press,
    shortcuts,
    run,
    bar,
    togglePin,
  };

  /**
   * Whether the context zone holds anything at all. The zone's *slot* is
   * reserved either way — it is part of the fixed-height rail — but only its
   * contents may be charged against the actions' width budget.
   */
  const hasContext = splitNotice !== null || tool === 'background';

  const railIds = railActionIds(shape, bar);
  const visibleCount = visibleActionCount({
    railWidth,
    // The zone's contents are content, not actions — swatches, the background
    // picker, a refusal notice — and `0` is how this says "nothing is rendered":
    // charged nothing, not even the gap. An *empty* zone still reported its
    // `contentContainerStyle` padding as its size, so the rail went on paying a
    // button's worth of width for nothing, in every state, forever.
    contextWidth: hasContext ? contextWidth : 0,
    available: railIds.length,
  });
  const railActions = resolveSelectionActions(railIds, sources);
  // `⋯` is resolved on its own with `disclosure`, so learn mode leaves it
  // working — it is the only route to the actions the rail had no room for.
  const moreAction = resolveSelectionActions(['more'], {
    ...sources,
    disclosure: true,
  })[0];
  const overflowActions = resolveSelectionActions(
    overflowActionIds(shape, railIds.slice(0, visibleCount)),
    { ...sources, afterRun: () => setMoreOpen(false) },
  );

  /**
   * The tool rail's six presses.
   *
   * Hoisted out of the JSX so `ToolBtn` — which is memoized — sees the same
   * `onPress` for a given tool and can skip its subtree. An inline closure would
   * be a new function on every render, and a drag re-renders this screen on every
   * frame, so the six buttons would reconcile sixty times a second to change
   * nothing. The dependencies are what the presses actually read: the current
   * tool and multi-select mode, both of which change on a tap, not on a frame.
   */
  const pressSelectTool = useCallback(() => {
    // Exit multi-select while keeping the group — the Select button is the
    // "leave the mode, keep what you picked" affordance.
    setMultiSelectMode(false, true);
    selectTool('select');
  }, [selectTool, setMultiSelectMode]);

  const pressMultiSelectTool = useCallback(() => {
    selectTool('select');
    // Turning the mode off keeps the group (same as Select).
    setMultiSelectMode(!multiSelectMode, multiSelectMode);
  }, [multiSelectMode, selectTool, setMultiSelectMode]);

  const pressTextTool = useCallback(() => {
    setMultiSelectMode(false);
    selectTool('text');
    openTextSheet();
  }, [openTextSheet, selectTool, setMultiSelectMode]);

  const pressInsertTool = useCallback(() => {
    setMultiSelectMode(false);
    selectTool('insert');
    setInsertSheetOpen(true);
  }, [selectTool, setMultiSelectMode]);

  const pressColorTool = useCallback(() => {
    setMultiSelectMode(false);
    selectTool('color');
    // A new visit is a new undo step.
    colorSession.current = false;
    setColorSheetOpen(true);
  }, [selectTool, setMultiSelectMode]);

  /**
   * Close the picker and, if this visit actually changed a colour, hand the rail
   * back to Select so the canvas is immediately draggable again — the same
   * "modal flow is over" reset the background-image picker does. A visit that
   * changed nothing keeps the tool where it was. Silent (`setTool`): the sheet
   * closing is feedback enough.
   */
  const closeColorSheet = useCallback(() => {
    setColorSheetOpen(false);
    if (colorSession.current) {
      setTool('select');
    }
  }, []);

  const pressBackgroundTool = useCallback(() => {
    setMultiSelectMode(false);
    selectTool('background');
  }, [selectTool, setMultiSelectMode]);

  const openTitleSheet = useCallback(() => {
    setTitleDraft(project?.name ?? '');
    setTitleSheetOpen(true);
  }, [project?.name]);

  const saveTitle = useCallback(() => {
    const name = titleDraft.trim();
    setProjectName(name);
    setTitleSheetOpen(false);
    // Persist on the spot rather than waiting on auto-save: this Save is the
    // user's explicit commit, and auto-save may be off. `setProjectName` is
    // synchronous, so `getState()` already carries the new name.
    const current = useEditorStore.getState().project;
    if (current) {
      void saveProject({ ...current, updatedAt: new Date().toISOString() });
    }
  }, [setProjectName, titleDraft]);

  // Cover, then open. This sits *after* every hook, so the editor's own state
  // keeps accumulating while the cover is up — the cover is a paint decision,
  // not a different component. It also has to come before the `!project` branch
  // below: a design whose faces are still loading has no project on screen yet,
  // and that branch would show "Loading…" text instead of the pulse.
  if (coverVisible) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: c.paper }]}
        edges={['top', 'bottom']}
      >
        <BrandLoader />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
        <View style={styles.center}>
          <Text style={{ color: c.muted }}>{t.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: c.paper }]}
        edges={['top', 'bottom']}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { borderColor: c.border }]}>
          <View style={[styles.barInner, rowStyle(isRTL)]}>
            <IconButton
              onPress={() => router.back()}
              accessibilityLabel={t.editor.hints.back}
              hint={t.editor.hints.back}
            >
              <Icon
                name={language === 'ar' ? 'chevronRight' : 'chevronLeft'}
                size={20}
              />
            </IconButton>
            <Pressable
              onPress={openTitleSheet}
              accessibilityRole="button"
              accessibilityLabel={project.name || t.editor.newProject}
              accessibilityHint={t.common.rename}
              style={({ pressed }) => [
                styles.titleButton,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="middle"
                style={[
                  styles.title,
                  { fontFamily: fonts.ui, color: c.ink },
                  dir,
                  { textAlign: 'center' },
                ]}
              >
                {project.name || t.editor.newProject}
              </Text>
            </Pressable>
            <View style={styles.topActions}>
              <IconButton
                onPress={undo}
                disabled={!canUndo}
                accessibilityLabel={t.editor.hints.undo}
                hint={shortcuts.hint(t.editor.hints.undo, 'undo')}
              >
                <Icon name="undo" size={18} color={canUndo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={redo}
                disabled={!canRedo}
                accessibilityLabel={t.editor.hints.redo}
                hint={shortcuts.hint(t.editor.hints.redo, 'redo')}
              >
                <Icon name="redo" size={18} color={canRedo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={() => setHeaderMoreOpen(true)}
                accessibilityLabel={t.common.more}
                hint={t.common.more}
              >
                <Icon name="more" size={18} />
              </IconButton>
            </View>
          </View>
        </View>

        {/* Missing remote fonts — a design using Google Fonts this device does
            not have yet renders in Amiri until they are downloaded; this strip
            is the never-silent prompt that offers them. */}
        {missingFonts && missingFonts.length > 0 && (
          <View
            style={[
              styles.missingFontsBanner,
              { backgroundColor: c.dangerBg, borderColor: c.border },
            ]}
          >
            <View style={styles.missingFontsText}>
              <Text
                style={[
                  styles.noticeText,
                  { color: c.danger, fontFamily: fonts.ui },
                  dir,
                ]}
              >
                {t.editor.missingFontsTitle}
              </Text>
              <Text
                style={[
                  styles.missingFontsBody,
                  { color: c.muted, fontFamily: fonts.ui },
                  dir,
                ]}
              >
                {t.editor.missingFontsBody}
              </Text>
            </View>
            <Pressable
              onPress={() => void downloadMissingFonts()}
              disabled={downloadingMissing}
              accessibilityRole="button"
              accessibilityLabel={t.editor.downloadFont}
              style={({ pressed }) => [
                styles.missingFontsButton,
                { opacity: pressed || downloadingMissing ? 0.6 : 1 },
              ]}
            >
              {downloadingMissing ? (
                <ActivityIndicator size="small" color={c.danger} />
              ) : (
                <Text
                  style={[
                    styles.missingFontsButtonText,
                    { color: c.danger, fontFamily: fonts.ui },
                    dir,
                  ]}
                >
                  {t.editor.downloadFont}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Canvas + gestures */}
        <View style={styles.canvasWrap}>
          {/*
           * The card keeps the border; the detector wraps the border-less layer
           * inside it. Gesture x/y are reported against the view the detector is
           * attached to, while `EditorCanvas` measures — and draws into — the box
           * *inside* the card's 1pt border. Attaching the detector to the card put
           * every press 1pt off the drawing, which is a quarter of a handle's touch
           * radius at a phone's fit zoom.
           */}
          <View
            style={[
              styles.canvasCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <GestureDetector gesture={gestures}>
              <View style={styles.canvasGestureLayer}>
                <CanvasStage
                  tapPoint={tapPoint}
                  onTapResult={handleTapResult}
                />
              </View>
            </GestureDetector>
          </View>
          <CollectionBarHost
            selectedIds={selectedIds}
            members={members}
            activeIndex={activeMemberIndex}
            role={collectionBarRole}
            onExitCollection={exitCollectionForBar}
            onEnterMember={pressMember}
            onStep={pressStep}
          />
          {help.active && (
            <LearnOverlay
              activeKey={help.activeKey}
              onExit={help.exit}
              onOpenHelp={() => {
                help.exit();
                setHelpOpen(true);
              }}
            />
          )}
        </View>

        {/*
         * Context rail — everything that exists *because of* the current
         * selection or tool.
         *
         * Fixed height and always laid out on purpose: a bar that mounted and
         * unmounted in the column flow used to resize the canvas, which re-runs
         * the fit-to-view in `EditorCanvas` and visibly zooms the design.
         * Reserving the slot instead of floating a dock OVER the canvas is also
         * what keeps the selection border and its handles clear of the chrome —
         * they belong to the canvas, and nothing may sit between them and the
         * finger.
         */}
        <View
          style={[
            styles.contextRail,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <View
            style={[styles.contextRow, rowStyle(isRTL)]}
            onLayout={(e) => setRailWidth(e.nativeEvent.layout.width)}
          >
            {/* Selection rail — truncates to what fits; the rest live in `⋯`.
                Hidden while the background tool is active: that tool is about
                the canvas, so its controls own the rail and the selection
                actions would otherwise crowd them out of the same row. */}
            {selectedIds.length > 0 && tool !== 'background' && (
              <View style={styles.selectionRail}>
                <SelectionRailActions
                  actions={railActions}
                  visibleCount={visibleCount}
                  more={moreAction}
                  isRTL={isRTL}
                />
              </View>
            )}

            {/* Context zone — the only part of the rail that scrolls */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.contextScroll}
              contentContainerStyle={[styles.contextTrack, rowStyle(isRTL)]}
              onContentSizeChange={(w) => setContextWidth(w)}
            >
              {/*
               * The member track is deliberately *not* here. It is the
               * collection bar on the canvas (`collection-bar.tsx`) — the zone
               * is for content about the current tool, and the track is
               * navigation that was spending the actions' width budget.
               */}

              {/* Why a split was refused */}
              {!!splitNotice && (
                <Reveal
                  style={[
                    styles.notice,
                    { backgroundColor: c.dangerBg, borderColor: c.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.noticeText,
                      { color: c.danger, fontFamily: fonts.ui },
                      dir,
                    ]}
                  >
                    {splitNotice}
                  </Text>
                </Reveal>
              )}

              {/* Background tool */}
              {tool === 'background' && (
                <View style={styles.bgToolWrap}>
                  <View
                    style={[
                      styles.colorStrip,
                      { borderColor: c.border, backgroundColor: c.surfaceAlt },
                    ]}
                  >
                    {paperSwatches.map((col) => (
                      <Pressable
                        key={col}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: col, borderColor: c.border },
                        ]}
                        onPress={() => setBgColor(col)}
                      />
                    ))}
                    {/* Image background — pick from the photo library */}
                    <Pressable
                      onPress={() => void setBgImage()}
                      accessibilityRole="button"
                      accessibilityLabel={t.editor.backgroundImage}
                      style={[
                        styles.bgImageBtn,
                        { borderColor: c.border, backgroundColor: c.surface },
                        project.canvas.background.type === 'image' && {
                          borderColor: c.accentText,
                          backgroundColor: c.accentSoft,
                        },
                      ]}
                    >
                      <Icon name="image" size={16} color={c.ink} />
                    </Pressable>
                    {project.canvas.background.type === 'image' && (
                      <Pressable
                        onPress={clearBgImage}
                        accessibilityRole="button"
                        accessibilityLabel={t.editor.bgImageClear}
                        style={[
                          styles.bgImageBtn,
                          { borderColor: c.border, backgroundColor: c.surface },
                        ]}
                      >
                        <Icon name="trash" size={16} color={c.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Tool rail */}
        <View
          style={[
            styles.toolRail,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <View
            style={[styles.barInner, styles.toolRailInner, rowStyle(isRTL)]}
          >
            <ToolBtn
              label={t.editor.select}
              hint={shortcuts.hint(t.editor.select, 'toolSelect')}
              active={tool === 'select' && !multiSelectMode}
              onPress={pressSelectTool}
              icon="pen"
            />
            <ToolBtn
              label={t.editor.multiSelect}
              accessibilityLabel={t.editor.hints.multiSelect}
              hint={shortcuts.hint(
                t.editor.hints.multiSelect,
                'toolMultiSelect',
              )}
              active={tool === 'select' && multiSelectMode}
              onPress={pressMultiSelectTool}
              icon="multiSelect"
            />
            <ToolBtn
              label={t.editor.text}
              hint={shortcuts.hint(t.editor.text, 'toolText')}
              active={tool === 'text'}
              onPress={pressTextTool}
              icon="type"
            />
            <ToolBtn
              label={t.editor.glyphs}
              active={tool === 'insert'}
              onPress={pressInsertTool}
              icon="shapes"
            />
            <ToolBtn
              label={t.editor.colors}
              active={tool === 'color'}
              onPress={pressColorTool}
              icon="palette"
            />
            <ToolBtn
              label={t.editor.background}
              active={tool === 'background'}
              onPress={pressBackgroundTool}
              icon="image"
            />
          </View>
        </View>

        {/* Header secondary actions */}
        <Sheet
          visible={headerMoreOpen}
          onClose={() => setHeaderMoreOpen(false)}
          title={t.common.more}
        >
          <View style={styles.sheetBody}>
            <Button
              label={t.editor.grid}
              onPress={() => {
                setGrid(!gridEnabled);
                setHeaderMoreOpen(false);
              }}
              fullWidth
              variant="secondary"
            />
            <Button
              label={t.common.save}
              onPress={() => {
                void save();
                setHeaderMoreOpen(false);
              }}
              fullWidth
              variant="secondary"
            />
            <Button
              label={t.editor.export}
              onPress={() => {
                setExportError(null);
                setHeaderMoreOpen(false);
                setExportOpen(true);
              }}
              fullWidth
              variant="secondary"
            />
            <Button
              label={t.editor.helpTitle}
              onPress={() => {
                setHeaderMoreOpen(false);
                setHelpOpen(true);
              }}
              fullWidth
              variant="secondary"
            />
          </View>
        </Sheet>

        {/* Rename sheet */}
        <Sheet
          visible={titleSheetOpen}
          onClose={() => setTitleSheetOpen(false)}
          title={t.common.rename}
        >
          <View style={styles.sheetBody}>
            <TextInputStub
              value={titleDraft}
              onChange={setTitleDraft}
              placeholder={t.editor.projectName}
            />
            <Button label={t.common.save} onPress={saveTitle} fullWidth />
          </View>
        </Sheet>

        {/* Text sheet */}
        <Sheet
          visible={textSheetOpen}
          onClose={() => {
            setTextSheetOpen(false);
            setEditingId(null);
          }}
          title={t.editor.text}
          contentPadding={spacing.md}
        >
          {/* The scroll cap is what lets the preview box be tall: without it a
              big type size would grow the box past the panel and take the
              confirm button off-screen with it. */}
          <ScrollView
            style={{
              maxHeight: Math.round(windowHeight * SHEET_BODY_MAX_FRACTION),
            }}
            contentContainerStyle={styles.textSheetBody}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* Live, because a draft has no object on the canvas yet — this is
                the only place the chosen face and size can be seen. In the
                style sheet the canvas behind the sheet is the preview. */}
            <TextPreview
              text={draftText}
              fontKey={draftFont}
              fontLabel={draftFontLabel}
              fontSize={draftFontSize}
              lineHeight={Math.round(draftFontSize * DEFAULT_LEADING_RATIO)}
              canvasWidth={project?.canvas.width ?? 0}
            />
            <TextInputStub
              value={draftText}
              onChange={setDraftText}
              placeholder={t.editor.enterText}
            />
            <FontSizeGauge
              value={draftFontSize}
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={FONT_SIZE_STEP}
              onChange={setDraftFontSize}
            />
            <FontField
              value={draftFont}
              onPress={() => setFontPickerOpen(true)}
            />
          </ScrollView>
          <Button
            label={t.common.done}
            onPress={saveTextObject}
            fullWidth
            style={styles.sheetFooter}
          />
        </Sheet>

        {/* Full-height font picker, opened from the Text sheet's Font field */}
        <FontPickerSheet
          visible={fontPickerOpen}
          value={draftFont}
          onChange={setDraftFont}
          onClose={() => setFontPickerOpen(false)}
        />

        {/* Colour picker — opened by the Colors tool. Nothing colour-related
            lives in the rail; the sheet owns the whole picker. */}
        <ColorPickerSheet
          visible={colorSheetOpen}
          value={selectedObject?.color ?? DEFAULT_INK}
          recentColors={recentColors}
          onChange={applyColor}
          onClose={closeColorSheet}
        />

        {/* Ornament and shape library */}
        <InsertSheet
          visible={insertSheetOpen}
          onClose={() => setInsertSheetOpen(false)}
          onPickGlyph={insertGlyph}
          onPickShape={insertShape}
        />

        {/* Style sheet — presentation and typography for the selected object */}
        <Sheet
          visible={styleSheetOpen}
          onClose={() => setStyleSheetOpen(false)}
          title={t.editor.style}
        >
          <View style={styles.sheetBody}>
            {selectedText ? (
              <>
                <View style={styles.presetRow}>
                  {presentations
                    .filter(
                      (preset) =>
                        preset.key !== 'bold' ||
                        boldSiblingForKey(selectedText.fontKey) !== null,
                    )
                    .map((preset) => {
                      const active = activePresentation.key === preset.key;
                      const label =
                        language === 'ar' ? preset.labelAr : preset.labelEn;
                      return (
                        <Button
                          key={preset.key}
                          label={label}
                          accessibilityLabel={label}
                          variant={active ? 'primary' : 'secondary'}
                          selected={active}
                          onPress={() => applyPresentation(preset.key)}
                          style={styles.presetBtn}
                        />
                      );
                    })}
                </View>

                {/* One snapshot per drag — bracketed by the gauge — then live
                    updates, so the canvas behind the sheet resizes as you
                    drag and the whole gesture undoes in one step. */}
                <FontSizeGauge
                  value={selectedText.fontSize}
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  step={FONT_SIZE_STEP}
                  onChange={setFontSize}
                  onSlidingStart={beginFontSizeDrag}
                />
                <NumberStepper
                  label={t.editor.lineHeight}
                  display={String(Math.round(selectedText.lineHeight))}
                  onPrev={() => stepLineHeight(-1)}
                  onNext={() => stepLineHeight(1)}
                />
                <NumberStepper
                  label={t.editor.opacity}
                  display={`${Math.round(selectedText.opacity * 100)}%`}
                  onPrev={() => stepOpacity(-0.1)}
                  onNext={() => stepOpacity(0.1)}
                  prevDisabled={selectedText.opacity <= MIN_OPACITY}
                  nextDisabled={selectedText.opacity >= MAX_OPACITY}
                />

                {showAlign && (
                  <View style={styles.alignRow}>
                    {(
                      [
                        ['left', t.editor.alignLeft],
                        ['center', t.editor.alignCenter],
                        ['right', t.editor.alignRight],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        label={label}
                        accessibilityLabel={label}
                        variant={
                          selectedText.align === value ? 'primary' : 'secondary'
                        }
                        selected={selectedText.align === value}
                        onPress={() =>
                          patchStyle({ align: value as TextAlign })
                        }
                        style={styles.alignBtn}
                      />
                    ))}
                  </View>
                )}

                <Button
                  label={t.common.done}
                  onPress={() => setStyleSheetOpen(false)}
                  fullWidth
                />
              </>
            ) : (
              <Text
                style={[
                  styles.noticeText,
                  { color: c.muted, fontFamily: fonts.ui },
                ]}
              >
                {t.editor.select}
              </Text>
            )}
          </View>
        </Sheet>

        {/* Selection overflow — the actions the rail had no room for */}
        <Sheet
          visible={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={t.common.more}
        >
          {/* No body wrapper: the list's own scroller has to be the panel's
              direct child, or its `flexShrink` cannot bite and the last rows
              spill past the panel's edge instead of scrolling into view. */}
          <SelectionOverflowActions
            actions={overflowActions}
            learn={help.active}
          />
        </Sheet>

        {/* Help reference — the full catalog, plus the Learn mode entry point */}
        <HelpSheet
          visible={helpOpen}
          onClose={() => setHelpOpen(false)}
          chord={shortcuts.chord}
          onStartLearn={() => {
            setHelpOpen(false);
            help.toggle();
          }}
        />

        {/* Export sheet */}
        <Sheet
          visible={exportOpen}
          onClose={() => setExportOpen(false)}
          title={t.editor.export}
        >
          <View style={styles.sheetBody}>
            <Button
              label={t.editor.exportShareImage}
              onPress={exportImage}
              fullWidth
              variant={exporting === 'image' ? 'secondary' : 'primary'}
            />
            {hasMediaLibrary && (
              <Button
                label={t.editor.exportSaveToPhotos}
                onPress={exportSaveToPhotos}
                fullWidth
                variant="secondary"
              />
            )}
            <Button
              label={t.editor.exportSvgAction}
              onPress={exportSvg}
              fullWidth
              variant="secondary"
            />
            <Button
              label={t.editor.exportProjectFile}
              onPress={exportFile}
              fullWidth
              variant="secondary"
            />
            {exporting && <ActivityIndicator color={c.ink} />}
            {!!exportError && (
              <Text
                style={{
                  color: c.danger,
                  fontFamily: fonts.ui,
                  fontSize: typeScale.small.size,
                }}
              >
                {t.editor.exportFailed}: {exportError}
              </Text>
            )}
          </View>
        </Sheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function ToolBtnRaw({
  label,
  accessibilityLabel,
  hint,
  active,
  onPress,
  icon,
}: {
  label: string;
  accessibilityLabel?: string;
  /** Tooltip text. Carries the shortcut chord; defaults to the caption. */
  hint?: string;
  active: boolean;
  onPress: () => void;
  icon:
    'pen' | 'type' | 'sparkle' | 'shapes' | 'palette' | 'image' | 'multiSelect';
}) {
  const { colors: c } = useTheme();
  const { language, isRTL } = useT();
  return (
    <View style={styles.toolBtnWrap}>
      <IconButton
        onPress={onPress}
        variant={active ? 'ink' : 'ghost'}
        accessibilityLabel={accessibilityLabel ?? label}
        hint={hint ?? label}
      >
        <Icon name={icon} size={18} color={active ? c.onInk : c.ink} />
      </IconButton>
      <Text
        style={[
          styles.toolLabel,
          {
            color: active ? c.ink : c.faint,
            fontFamily: fontRoles[language].ui,
            writingDirection: isRTL ? 'rtl' : 'ltr',
            textAlign: 'center',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Memoized: the tool rail is six of these and a drag re-renders the screen every
 * frame. Their presses are hoisted into `useCallback`s in the component above,
 * so across a drag not one prop changes and all six subtrees (IconButton + Icon
 * + label each) are skipped by reconciliation instead of rebuilt.
 */
const ToolBtn = memo(ToolBtnRaw);

function TextInputStub({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  return (
    <View
      style={[
        styles.input,
        { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      <RNTextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9A968C"
        style={{
          color: c.ink,
          fontFamily: fontRoles[language].ui,
          fontSize: typeScale.body.size,
          padding: 0,
          writingDirection: language === 'ar' ? 'rtl' : 'ltr',
          textAlign: language === 'ar' ? 'right' : 'left',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  missingFontsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  missingFontsText: { flex: 1, gap: 2 },
  missingFontsBody: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  missingFontsButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  missingFontsButtonText: {
    fontSize: typeScale.body.size,
    fontWeight: '700',
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  presetBtn: { flexGrow: 1, flexBasis: '30%' },
  alignRow: { flexDirection: 'row', gap: spacing.xs },
  alignBtn: { flex: 1 },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  // Horizontal chrome bars keep their hairline and fill edge-to-edge, but their
  // *content* is capped and centred so the controls stay together on a wide
  // display instead of scattering across the window (DESIGN.md §5).
  barInner: {
    width: '100%',
    maxWidth: layout.maxToolbar,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    width: '100%',
    fontSize: typeScale.subheading.size,
    lineHeight: typeScale.subheading.lineHeight,
    fontWeight: '600',
  },
  topActions: { flexDirection: 'row', gap: spacing.xs },
  /**
   * The canvas owns the leftover height. It sits in the normal column flow now:
   * the rail below it is a fixed height, so its box is constant and the
   * fit-to-view in `EditorCanvas` never re-runs behind the user's back.
   */
  canvasWrap: { flex: 1, padding: spacing.md },
  canvasCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: layout.canvasBorder,
    overflow: 'hidden',
    // RNGH sets touch-action:none on its wrapper, but style resets or browser
    // default-drags can break pointer capture mid-gesture on web. Belt-and-
    // suspenders: assert both here and on the gesture layer below.
    touchAction: 'none',
    userSelect: 'none',
  },
  /**
   * The view the canvas gestures are attached to, and the only box that carries
   * them: it is exactly the box `EditorCanvas` measures and draws into, so a
   * press and a drawn handle can never be a border apart. Never give this layer
   * a border, padding or margin — that would reintroduce the offset.
   */
  canvasGestureLayer: {
    flex: 1,
    touchAction: 'none',
    userSelect: 'none',
  },
  /**
   * The context rail — the strip above the tool rail holding whatever the
   * current selection or tool needs.
   *
   * A reserved slot rather than a floating dock (DESIGN.md §5 carve-out for the
   * editor): floating chrome would sit between the finger and the selection
   * border, and an in-flow bar that came and went would resize the canvas.
   */
  contextRail: {
    height: CONTEXT_RAIL_HEIGHT,
    borderTopWidth: 1,
  },
  /**
   * The row holding the selection rail and the context zone. Capped and
   * centred like every other chrome bar's content (DESIGN.md §5); its width is
   * measured for the rail's truncation budget (`visibleActionCount`).
   */
  contextRow: {
    width: '100%',
    maxWidth: layout.maxToolbar,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  /**
   * The selection rail never scrolls: it truncates to what fits and the rest
   * live in the `⋯` sheet.
   */
  selectionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  contextScroll: {
    flex: 1,
  },
  contextTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  toolRail: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  toolRailInner: {
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  toolBtnWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  toolLabel: { width: '100%', fontSize: typeScale.caption.size },
  sheetBody: { gap: spacing.md },
  textSheetBody: {
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  /** The text sheet's confirm button, outside the scrolling body. */
  sheetFooter: { marginTop: spacing.md },
  colorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  /** The background toolbox sits at the start of the scrollable context zone. */
  bgToolWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Circle image button, sized to sit flush with the paper swatches. */
  bgImageBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
