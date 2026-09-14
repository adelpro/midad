import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AnimatedPressable,
  Button,
  DirectionIcon,
  Icon,
  IconButton,
  Reveal,
  Sheet,
} from "@/components/ui";
import { EditorCanvasHost } from "@/editor/EditorCanvasHost";
import {
  collectSvgFontFaces,
  collectUsedFamilies,
  projectToSvg,
} from "@/editor/export/svg";
import {
  HelpSheet,
  LearnOverlay,
  helpEntry,
  helpLabel,
  helpRole,
  useHelpMode,
  type HelpKey,
} from "@/editor/help";
import { renderProjectToPng } from "@/editor/render/offscreen";
import {
  SelectionOverflowActions,
  SelectionRailActions,
  defaultSelectionBar,
  overflowActionIds,
  railActionIds,
  resolveSelectionActions,
  visibleActionCount,
  type SelectionActionId,
  type SelectionCommandId,
  type SelectionShape,
} from "@/editor/selection-actions";
import {
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
  type ShortcutContext,
} from "@/editor/shortcuts";
import { textLineBreaks, useParagraphFonts } from "@/editor/skia/text";
import { useEditorStore } from "@/editor/store";
import {
  FontSizeGauge,
  NumberStepper,
  TextPreview,
} from "@/editor/text-style-controls";
import { canSplitIntoClusters } from "@/editor/text/clusters";
import {
  mergePartTexts,
  splitTextObject,
  type SplitFailure,
} from "@/editor/text/split";
import { useAutoSave } from "@/editor/use-auto-save";
import { useKeyboardShortcuts } from "@/editor/use-keyboard-shortcuts";
import { useObjectGestures } from "@/editor/use-object-gestures";
import { hapticDelete, hapticSuccess, hapticTick } from "@/haptics";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import { formatPartLabel, formatSelectedCount } from "@/i18n/strings";
import { shareFile, shareImage } from "@/storage/export";
import type {
  CalligraphyTextObject,
  ObjectTransform,
  TextAlign,
} from "@/storage/project-schema";
import {
  loadProject as loadProjectFile,
  saveProject,
} from "@/storage/projects";
import { useSettings } from "@/storage/settings";
import { THUMB_MAX_WIDTH_PX, saveThumb } from "@/storage/thumbs";
import {
  calligraphyFonts,
  fontRoles,
  layout,
  radius,
  spacing,
  typeScale,
} from "@/theme";
import {
  DEFAULT_INK,
  inkSwatches,
  paperSwatches,
} from "@/theme/content-palette";
import {
  DEFAULT_LEADING_RATIO,
  presentationByKey,
  presentations,
  presetPatch,
} from "@/theme/presentations";

type ActiveTool = "select" | "text" | "color" | "background";

/** Font-size bounds for the size gauge (design units). */
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 600;
/** Font-size step per tap — a few points, so a 96pt title needs ~20 taps to double. */
const FONT_SIZE_STEP = 4;
/** The rail's top clearance (dp): keeps its controls off the canvas card. */
const CONTEXT_RAIL_TOP_GAP = spacing.sm;
/**
 * Height of the context rail (dp) — deliberately fixed.
 *
 * The rail is always laid out, so a control mounting or unmounting inside it
 * cannot change the canvas box above. Its make-up is the tallest occupant (a
 * parts tile), the top gap, and the hairline.
 *
 * The gap lives in here rather than as a margin on the rail, because the
 * hairline is what separates the bar from the canvas: a margin would push the
 * two apart and leave the bar looking detached from the artwork.
 */
const CONTEXT_RAIL_HEIGHT = 56 + CONTEXT_RAIL_TOP_GAP;
/** Size given to newly created text — 96pt on a 1080-wide canvas. */
const DEFAULT_FONT_SIZE = 96;
/** Opacity bounds — never fully invisible, or the object could not be re-found. */
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Arrow-key nudge distance: a tap moves one design unit, Shift moves ten. */
function nudgeStep(context: ShortcutContext): number {
  return context.shift ? NUDGE_STEP_LARGE : NUDGE_STEP;
}

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

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const addObject = useEditorStore((s) => s.addObject);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const updateObject = useEditorStore((s) => s.updateObject);
  const alignSelected = useEditorStore((s) => s.alignSelected);
  const setGrid = useEditorStore((s) => s.setGrid);
  const gridEnabled = useEditorStore((s) => s.project?.gridEnabled);
  const multiSelectMode = useEditorStore((s) => s.multiSelectMode);
  const setMultiSelectMode = useEditorStore((s) => s.setMultiSelectMode);
  const selectAll = useEditorStore((s) => s.selectAll);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const nudgeSelected = useEditorStore((s) => s.nudgeSelected);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);

  const [tool, setTool] = useState<ActiveTool>("select");
  /**
   * Choosing a tool is a detent — tick, then switch. Programmatic resets (e.g.
   * after committing text) call `setTool` directly so they stay silent.
   */
  const selectTool = useCallback((next: ActiveTool) => {
    hapticTick();
    setTool(next);
  }, []);
  const [textSheetOpen, setTextSheetOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftFont, setDraftFont] = useState<string>(calligraphyFonts[0].key);
  const [draftFontSize, setDraftFontSize] = useState(DEFAULT_FONT_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  /** Transient explanation shown when a split is refused. */
  const [splitNotice, setSplitNotice] = useState<string | null>(null);
  /** The complete tool reference, opened from the top bar or from learn mode. */
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  /** The overflow list behind the selection rail's `⋯`. */
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  /** Learn mode: controls explain themselves on tap instead of acting. */
  const help = useHelpMode();
  /**
   * Rail geometry, measured rather than assumed.
   *
   * The rail's inner row is capped by `layout.maxToolbar` and nothing else, so
   * the window's width is already a good first answer — which matters, because
   * the action count is derived from it and an unmeasured first frame would
   * otherwise have to guess. `onLayout` then reports the truth (a split view on
   * a tablet, a scrollbar on the web). The context width is the one figure that
   * cannot be derived up front: it comes from the zone's content (see the rail
   * markup).
   */
  const { width: windowWidth } = useWindowDimensions();
  const [railWidth, setRailWidth] = useState(0);
  const [contextWidth, setContextWidth] = useState(0);
  const [countWidth, setCountWidth] = useState(0);
  /**
   * The `?` button, the swatches and the empty-rail notice read their copy from
   * the help table like every other control, so there is one place to change it.
   */
  const helpText = (key: HelpKey) =>
    helpLabel(helpEntry(key).label, t, language);
  /**
   * Role copy for a control that already shows its own name.
   *
   * The five tools carry a visible caption under the icon, so repeating that
   * caption in the tooltip would say nothing. A tooltip should add whatever the
   * control does not already show — the name for an icon-only button, the role
   * for a captioned one.
   */
  const helpRoleText = (key: HelpKey) => helpRole(helpEntry(key), language);
  const learnEntry = helpEntry("topBar.learn");

  useAutoSave();

  // Load the project once.
  useEffect(() => {
    (async () => {
      if (!id) {
        return;
      }
      const proj = await loadProjectFile(id);
      if (proj) {
        loadProject(proj);
      }
    })();
  }, [id, loadProject]);

  // Object gestures freeze in learn mode, so a tap meant as "what is this?"
  // can never move, resize or rotate the selection instead.
  const { gestures, tapPoint } = useObjectGestures(
    tool === "select" && !help.active,
  );

  // Loaded once for offscreen rendering (thumbnails, exports).
  const skiaFonts = useParagraphFonts();

  const handleTapResult = useCallback(
    (objId: string | null) => {
      if (tool === "select") {
        const store = useEditorStore.getState();
        if (store.gs.selectionHandledOnDown) {
          store.setGs({ selectionHandledOnDown: false });
        } else {
          select(objId, multiSelectMode);
        }
        setEditingId(null);
      }
    },
    [tool, select, multiSelectMode],
  );

  const selectedObject = useMemo(
    () => project?.objects.find((o) => o.id === selectedIds[0]),
    [project, selectedIds],
  );

  /** The selection, narrowed to text objects for the typography controls. */
  const selectedText = useMemo(
    () => (selectedObject?.type === "text" ? selectedObject : undefined),
    [selectedObject],
  );

  /**
   * The split group the selection belongs to. Parts are ordinary objects in the
   * flat list; `part.rootId` is what ties them back to the word they came from.
   */
  const partSiblings = useMemo(() => {
    const rootId = selectedText?.part?.rootId;
    if (!rootId) {
      return [];
    }
    return (project?.objects ?? [])
      .filter(
        (o): o is CalligraphyTextObject =>
          o.type === "text" && o.part?.rootId === rootId,
      )
      .sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0));
  }, [project, selectedText]);

  /** Position of the selected object within its split group (-1 when absent). */
  const activePartIndex = partSiblings.findIndex(
    (p) => p.id === selectedIds[0],
  );

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
    (selectedText.wrapWidth != null || selectedText.text.includes("\n"));

  /** The preset the selection is currently wearing (falling back to the first). */
  const activePresentation =
    presentationByKey(selectedText?.presentation?.key) ?? presentations[0];

  /** The face the text sheet is previewing, for the preview's caption. */
  const draftFontMeta =
    calligraphyFonts.find((f) => f.key === draftFont) ?? calligraphyFonts[0];
  const draftFontLabel =
    language === "ar" ? draftFontMeta.labelAr : draftFontMeta.labelEn;

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
        case "too-few-clusters":
          return t.editor.splitNeedsTwoParts;
        case "cluster-wrapped":
          return t.editor.splitWrapped;
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
    return obj?.type === "text" ? obj : undefined;
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
    const outcome = splitTextObject(obj, skiaFonts, canvas.width);
    if (!outcome.ok) {
      setSplitNotice(splitFailureMessage(outcome.reason));
      return;
    }
    setSplitNotice(null);
    store.splitObjectIntoParts(obj.id, outcome.parts);
  }, [liveText, skiaFonts, splitFailureMessage, t]);

  const rejoinSelected = useCallback(() => {
    if (partSiblings.length === 0) {
      return;
    }
    const text = mergePartTexts(partSiblings);
    if (text === null) {
      // Incomplete group — refuse rather than silently drop a part.
      setSplitNotice(t.editor.splitFailed);
      return;
    }
    const first = partSiblings[0];
    // The parts may have drifted apart, so the merged object is centred on the
    // group's centroid: the word reappears where its pieces were, instead of
    // jumping to whichever part happened to sort first.
    const centre = partSiblings.reduce(
      (acc, p) => ({
        x: acc.x + p.transform.x / partSiblings.length,
        y: acc.y + p.transform.y / partSiblings.length,
      }),
      { x: 0, y: 0 },
    );
    const merged: CalligraphyTextObject = {
      id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      type: "text",
      text,
      fontKey: first.fontKey,
      fontSize: first.fontSize,
      lineHeight: first.lineHeight,
      wrapWidth: null,
      align: first.align,
      color: first.color,
      opacity: first.opacity,
      outline: first.outline,
      shadows: first.shadows,
      presentation: first.presentation,
      transform: { ...first.transform, x: centre.x, y: centre.y },
      zIndex: first.zIndex,
    };
    setSplitNotice(null);
    useEditorStore.getState().mergeObjectParts(
      merged,
      partSiblings.map((p) => p.id),
    );
  }, [partSiblings, t]);

  /** Selects the neighbouring part of the active split group. */
  const stepPart = useCallback(
    (direction: 1 | -1) => {
      if (partSiblings.length < 2) {
        return;
      }
      const current = partSiblings.findIndex(
        (p) => p.id === useEditorStore.getState().selectedIds[0],
      );
      const from = current < 0 ? 0 : current;
      const next =
        (from + direction + partSiblings.length) % partSiblings.length;
      select(partSiblings[next].id);
    },
    [partSiblings, select],
  );

  /** Cycles the presentation presets, wrapping in both directions. */
  const cyclePresentation = useCallback(
    (direction: 1 | -1) => {
      const obj = liveText();
      if (!obj) {
        return;
      }
      const current = presentations.findIndex(
        (p) => p.key === obj.presentation?.key,
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
      store.updateObject(obj.id, presetPatch(preset, obj) as never);
    },
    [liveText],
  );

  const applyPresentation = useCallback(
    (key: string) => {
      const obj = liveText();
      const preset = presentationByKey(key);
      if (!obj || !preset) {
        return;
      }
      const store = useEditorStore.getState();
      store.snapshot();
      store.updateObject(obj.id, presetPatch(preset, obj) as never);
    },
    [liveText],
  );

  /** Snapshot + patch for one discrete style change on the selected text. */
  const patchStyle = useCallback(
    (patch: Partial<CalligraphyTextObject>) => {
      const obj = liveText();
      if (!obj) {
        return;
      }
      const store = useEditorStore.getState();
      store.snapshot();
      store.updateObject(obj.id, patch as never);
    },
    [liveText],
  );

  /**
   * Live font-size change on the selection.
   *
   * Deliberately snapshot-free: the gauge brackets a whole drag in
   * `beginFontSizeDrag`, so one gesture — which fires this dozens of times —
   * lands as a single history entry instead of flooding undo.
   */
  const setFontSize = useCallback(
    (fontSize: number) => {
      const obj = liveText();
      if (!obj || fontSize === obj.fontSize) {
        return;
      }
      // Scale the leading with the size so the text does not reflow as it grows.
      const ratio =
        obj.fontSize > 0
          ? obj.lineHeight / obj.fontSize
          : DEFAULT_LEADING_RATIO;
      useEditorStore.getState().updateObject(obj.id, {
        fontSize,
        lineHeight: Math.round(fontSize * ratio),
      } as never);
    },
    [liveText],
  );

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
      patchStyle({ opacity });
    },
    [liveText, patchStyle],
  );

  /** Applies a discrete transform to the selection with a history snapshot. */
  const transformSelected = useCallback((patch: Partial<ObjectTransform>) => {
    const store = useEditorStore.getState();
    const objects = store.project?.objects.filter((o) =>
      store.selectedIds.includes(o.id),
    );
    if (!objects?.length) {
      return;
    }
    store.snapshot();
    for (const obj of objects) {
      store.updateObject(obj.id, { transform: { ...obj.transform, ...patch } });
    }
  }, []);

  /**
   * Drops a manual wrap width so the selected text hugs its content again
   * (the auto-width default), capped at the canvas edge.
   */
  const fitTextToContent = useCallback(() => {
    const store = useEditorStore.getState();
    const obj = store.project?.objects.find(
      (o) => o.id === store.selectedIds[0],
    );
    if (!obj || obj.type !== "text") {
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
    if (obj && obj.type === "text") {
      setDraftText(obj.text);
      setDraftFont(obj.fontKey);
      setDraftFontSize(obj.fontSize);
      setEditingId(obj.id);
    } else {
      setDraftText("");
      setDraftFont(calligraphyFonts[0].key);
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
    if (existing && existing.type === "text") {
      const store = useEditorStore.getState();
      store.snapshot();
      // Keep the object's own leading ratio: re-opening the sheet to retype a
      // word must not silently undo an "airy" or "tight" preset.
      const ratio =
        existing.fontSize > 0
          ? existing.lineHeight / existing.fontSize
          : DEFAULT_LEADING_RATIO;
      store.updateObject(existing.id, {
        text: draftText.trim(),
        fontKey: draftFont,
        fontSize: draftFontSize,
        lineHeight: Math.round(draftFontSize * ratio),
      } as never);
    } else {
      addObject({
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "text",
        text: draftText.trim(),
        fontKey: draftFont,
        fontSize: draftFontSize,
        lineHeight: Math.round(draftFontSize * DEFAULT_LEADING_RATIO),
        align: "center",
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
    setDraftText("");
    setEditingId(null);
    setTool("select");
  }, [project, draftText, draftFont, draftFontSize, editingId, addObject]);

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
    if (!project) {
      return;
    }
    await saveProject({ ...project, updatedAt: new Date().toISOString() });
    try {
      const png = renderProjectToPng(project, skiaFonts, {
        maxWidthPx: THUMB_MAX_WIDTH_PX,
      });
      await saveThumb(project.id, png.base64DataUri);
    } catch {
      // Thumbnail is best-effort; the project itself is saved.
      // Fires for the explicit save button and for the save that precedes every
      // export — both are "the work is safely on disk" moments.
      hapticSuccess();
    }
  }, [project, skiaFonts]);

  const runExport = useCallback(
    async (key: "image" | "svg" | "file", fn: () => Promise<void>) => {
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
    if (!project || exporting) return;
    void runExport("image", async () => {
      const png = renderProjectToPng(project, skiaFonts, { maxWidthPx: 2048 });
      await shareImage({
        data: png.base64DataUri,
        format: "png",
        fileName: `${project.name || "midad-design"}.png`,
      });
    });
  }, [project, exporting, runExport, skiaFonts]);

  const exportSvg = useCallback(() => {
    if (!project || exporting) return;
    const dialogTitle = t.editor.exportSvgAction;
    void runExport("svg", async () => {
      const faces = await collectSvgFontFaces(collectUsedFamilies(project));
      // SVG cannot re-flow Arabic text itself, so resolve the visual line
      // breaks from the same layout the canvas uses.
      const lineBreaks = skiaFonts ? textLineBreaks(project, skiaFonts) : {};
      const svg = projectToSvg(project, faces, lineBreaks);
      await shareFile({
        data: svg,
        fileName: `${project.name || "midad-design"}.svg`,
        mimeType: "image/svg+xml",
        uti: "public.svg-image",
        dialogTitle,
      });
    });
  }, [project, exporting, runExport, t, skiaFonts]);

  const exportFile = useCallback(() => {
    if (!project || exporting) return;
    const dialogTitle = t.editor.exportProjectFile;
    void runExport("file", async () => {
      await shareFile({
        data: JSON.stringify(project),
        fileName: `${project.name || "midad"}.midad.json`,
        mimeType: "application/json",
        uti: "public.json",
        dialogTitle,
      });
    });
  }, [project, exporting, runExport, t]);

  const setBgColor = useCallback((color: string) => {
    useEditorStore.getState().setCanvas({
      background: { type: "paper", color },
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
    // Learn mode owns the keyboard too: the canvas is frozen and every control
    // is a question, so firing an action from a key would be a lie.
    enabled:
      !textSheetOpen &&
      !styleSheetOpen &&
      !actionSheetOpen &&
      !exportOpen &&
      !helpSheetOpen &&
      !help.active,
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
      // Flip and rotation mirror the selection-bar buttons exactly, including
      // reading their angles from the primary selection.
      flipH: () =>
        transformSelected({
          flipH: !(selectedObject?.transform.flipH ?? false),
        }),
      flipV: () =>
        transformSelected({
          flipV: !(selectedObject?.transform.flipV ?? false),
        }),
      rotateCcw: () =>
        transformSelected({
          rotation: (selectedObject?.transform.rotation ?? 0) - 90,
        }),
      rotateCw: () =>
        transformSelected({
          rotation: (selectedObject?.transform.rotation ?? 0) + 90,
        }),
      bringToFront: () => {
        const id = selectedIds[0];
        if (id) {
          bringToFront([id]);
        }
      },
      sendToBack: () => {
        const id = selectedIds[0];
        if (id) {
          sendToBack([id]);
        }
      },
      toolSelect: () => {
        setMultiSelectMode(false);
        selectTool("select");
      },
      toolMultiSelect: () => {
        selectTool("select");
        setMultiSelectMode(!multiSelectMode);
      },
      toolText: () => {
        setMultiSelectMode(false);
        selectTool("text");
        openTextSheet();
      },
      toggleGrid: () => setGrid(!gridEnabled),
      openHelp: () => {
        help.exit();
        setHelpSheetOpen(true);
      },
    },
  });

  /**
   * What each selection action does.
   *
   * A `Record` rather than a switch, so adding an action to the table cannot
   * leave it unwired without the compiler saying so.
   */
  const runSelectionAction = useMemo<Record<SelectionCommandId, () => void>>(
    () => ({
      styleOpen: () => setStyleSheetOpen(true),
      stylePrev: () => cyclePresentation(-1),
      styleNext: () => cyclePresentation(1),
      scaleUp: () =>
        transformSelected({
          scale: (selectedObject?.transform.scale ?? 1) * 1.1,
        }),
      scaleDown: () =>
        transformSelected({
          scale: (selectedObject?.transform.scale ?? 1) * 0.9,
        }),
      rotateCcw: () =>
        transformSelected({
          rotation: (selectedObject?.transform.rotation ?? 0) - 90,
        }),
      rotateCw: () =>
        transformSelected({
          rotation: (selectedObject?.transform.rotation ?? 0) + 90,
        }),
      flipH: () =>
        transformSelected({
          flipH: !(selectedObject?.transform.flipH ?? false),
        }),
      fitText: fitTextToContent,
      split: splitSelected,
      rejoin: rejoinSelected,
      duplicate: duplicateSelected,
      bringToFront: () => bringToFront([selectedIds[0]]),
      sendToBack: () => sendToBack([selectedIds[0]]),
      delete: deleteSelected,
      alignLeft: () => alignSelected("left"),
      alignCenterH: () => alignSelected("centerH"),
      alignRight: () => alignSelected("right"),
      alignTop: () => alignSelected("top"),
      alignMiddleV: () => alignSelected("middleV"),
      alignBottom: () => alignSelected("bottom"),
      centerH: () => alignSelected("canvasCenterH"),
      centerV: () => alignSelected("canvasCenterV"),
      more: () => setActionSheetOpen(true),
    }),
    [
      alignSelected,
      bringToFront,
      cyclePresentation,
      deleteSelected,
      duplicateSelected,
      fitTextToContent,
      rejoinSelected,
      selectedIds,
      selectedObject,
      sendToBack,
      splitSelected,
      transformSelected,
    ],
  );

  /**
   * Pin/unpin. The rail truncates from its tail, so a pin puts the action at
   * the *head* of the bar — the one position the width budget can never cut —
   * and an unpin takes it out, leaving it in the sheet until it is pinned
   * again. The first pin materialises the default order, so the rest of the bar
   * keeps the arrangement the user was looking at.
   */
  const toggleActionPin = useCallback((id: SelectionActionId) => {
    hapticTick();
    const settings = useSettings.getState();
    const order = settings.selectionBarActions ?? defaultSelectionBar();
    settings.setSelectionBarActions(
      order.includes(id) ? order.filter((x) => x !== id) : [id, ...order],
    );
  }, []);

  /** What the current selection can do — the table's only input. */
  const selectionShape: SelectionShape = {
    isText: !!selectedText,
    canSplit: canSplitSelected,
    canRejoin: partSiblings.length > 1,
    isMulti: selectedIds.length > 1,
  };

  /**
   * Whether the rail has anything to put *beside* the actions. When it does
   * not, the context zone is absent and its measured width stays out of the
   * budget, so every action has the whole row to itself.
   *
   * The style panel is deliberately not in here: it is a *rail action*
   * (`styleOpen`), because as a five-slot navigator it crowded the very actions
   * this bar exists to hold.
   */
  const hasContextZone =
    partSiblings.length > 1 ||
    !!splitNotice ||
    tool === "color" ||
    tool === "background";

  /**
   * The bar's order: what this device pinned, or the table's own default.
   *
   * `null` means it was never customised, and the default is read *through* the
   * table rather than copied into this file, so a change to what a fresh bar
   * holds reaches every device that never reordered it.
   */
  const storedRailOrder = useSettings((state) => state.selectionBarActions);
  const railOrder = storedRailOrder ?? defaultSelectionBar();
  const railIds = railActionIds(selectionShape, railOrder);
  const visibleCount = visibleActionCount({
    railWidth: railWidth || Math.min(windowWidth, layout.maxToolbar),
    // Measured, never guessed: each sibling is sized to its content, so the
    // cluster is given exactly what is left over. What that content may *claim*
    // of the budget is capped in there, or the scroller would outbid the
    // actions for the whole row.
    contextWidth: hasContextZone ? contextWidth : 0,
    countWidth: selectedIds.length > 1 ? countWidth : 0,
    available: railIds.length,
  });
  const actionSources = {
    t,
    language,
    press: help.press,
    shortcuts,
    run: runSelectionAction,
    // Where each action stands in the bar, and the one control that changes it.
    bar: railOrder,
    togglePin: toggleActionPin,
  };
  const railActions = resolveSelectionActions(railIds, actionSources);
  const overflowActions = resolveSelectionActions(
    // Everything the bar is *not* showing: whatever the width budget cut, then
    // the actions that only ever live in the sheet. The table is handed the
    // visible head so the sheet lists what the user just lost at the top —
    // which is precisely what they came here looking for.
    overflowActionIds(selectionShape, railIds.slice(0, visibleCount)),
    // The sheet closes on press: it covers the canvas, so staying open would
    // hide the very change the press just made.
    { ...actionSources, afterRun: () => setActionSheetOpen(false) },
  );
  const moreAction = resolveSelectionActions(["more"], {
    ...actionSources,
    // The one control learn mode does not swallow: it *reveals* controls, so
    // explaining it instead of opening it would leave everything behind it with
    // no explanation on any surface.
    disclosure: true,
  })[0];

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
        edges={["top", "bottom"]}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { borderColor: c.border }]}>
          <View style={styles.barInner}>
            <IconButton
              onPress={help.press("topBar.back", () => router.back())}
              accessibilityLabel={t.editor.hints.back}
              hint={t.editor.hints.back}
              hintPlacement="below"
            >
              <Icon
                name={language === "ar" ? "chevronRight" : "chevronLeft"}
                size={20}
              />
            </IconButton>
            <Text
              numberOfLines={1}
              style={[styles.title, { fontFamily: fonts.ui, color: c.ink }]}
            >
              {project.name || t.editor.newProject}
            </Text>
            <View style={styles.topActions}>
              <IconButton
                onPress={help.press("topBar.undo", undo)}
                disabled={!canUndo}
                accessibilityLabel={t.editor.hints.undo}
                hint={shortcuts.hint(t.editor.hints.undo, "undo")}
                hintPlacement="below"
              >
                <Icon name="undo" size={18} color={canUndo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={help.press("topBar.redo", redo)}
                disabled={!canRedo}
                accessibilityLabel={t.editor.hints.redo}
                hint={shortcuts.hint(t.editor.hints.redo, "redo")}
                hintPlacement="below"
              >
                <Icon name="redo" size={18} color={canRedo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={help.press("topBar.grid", () => setGrid(!gridEnabled))}
                variant={gridEnabled ? "ink" : "ghost"}
                accessibilityLabel={t.editor.hints.grid}
                hint={shortcuts.hint(t.editor.hints.grid, "toggleGrid")}
                hintPlacement="below"
              >
                <Icon
                  name="grid"
                  size={18}
                  color={gridEnabled ? c.onInk : c.ink}
                />
              </IconButton>
              <IconButton
                onPress={help.press("topBar.save", save)}
                accessibilityLabel={t.editor.hints.save}
                accessibilityHint={t.editor.hints.save}
                hint={shortcuts.hint(t.editor.hints.save, "save")}
                hintPlacement="below"
              >
                <Icon name="download" size={18} />
              </IconButton>
              <IconButton
                onPress={help.press("topBar.export", () => {
                  setExportError(null);
                  setExportOpen(true);
                })}
                accessibilityLabel={t.editor.hints.export}
                hint={t.editor.hints.export}
                hintPlacement="below"
              >
                <Icon name="export" size={18} />
              </IconButton>
              {/* The one control learn mode cannot swallow — it is how the mode
                  is left again. */}
              <IconButton
                onPress={help.toggle}
                variant={help.active ? "ink" : "ghost"}
                accessibilityLabel={helpText("topBar.learn")}
                hint={helpText("topBar.learn")}
                accessibilityHint={helpRole(learnEntry, language)}
                hintPlacement="below"
              >
                <Icon
                  name="help"
                  size={18}
                  color={help.active ? c.onInk : c.ink}
                />
              </IconButton>
            </View>
          </View>
        </View>

        {/* Canvas + gestures */}
        <View style={styles.canvasWrap}>
          <GestureDetector gesture={gestures}>
            <View
              style={[
                styles.canvasCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <EditorCanvasHost
                project={project}
                selectedIds={selectedIds}
                tapPoint={tapPoint}
                onTapResult={handleTapResult}
              />
            </View>
          </GestureDetector>
          {help.active && (
            <LearnOverlay
              activeKey={help.activeKey}
              onExit={help.exit}
              onOpenHelp={() => setHelpSheetOpen(true)}
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
            style={[styles.railInner, rowStyle(isRTL)]}
            onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
          >
            {/*
             * The selection's actions, ranked by `selection-actions.tsx`. Only
             * as many render as fit: the rail is one row inside a fixed-height
             * slot, so the rest wait behind `⋯` rather than scrolling off an
             * edge — which in Arabic is the left one, where nothing signals
             * that they exist.
             */}
            {selectedIds.length > 0 && (
              <>
                {selectedIds.length > 1 && (
                  <Text
                    onLayout={(event) =>
                      setCountWidth(event.nativeEvent.layout.width)
                    }
                    style={styles.selectionCount}
                  >
                    {formatSelectedCount(selectedIds.length, language)}
                  </Text>
                )}
                <SelectionRailActions
                  actions={railActions}
                  visibleCount={visibleCount}
                  more={moreAction}
                  isRTL={isRTL}
                />
              </>
            )}

            {/*
             * Everything that exists because of the current tool, or because of
             * the way the selection is built. It keeps a scroller of its own: a
             * split word can hold more parts than a phone is wide, and unlike
             * the actions beside it, parts are content — scrolling them is the
             * honest degradation. The row is measured so the actions know how
             * much room is left.
             */}
            {hasContextZone && (
              <View style={styles.railContextZone}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.railContextTrack}
                >
                  {/*
                   * Measured inside the scroller, not on it: the content
                   * container is sized to its children, so this reports how
                   * wide the zone *wants* to be — which is the number the
                   * actions above subtract from their budget.
                   */}
                  <View
                    style={[styles.railContextRow, rowStyle(isRTL)]}
                    onLayout={(event) =>
                      setContextWidth(event.nativeEvent.layout.width)
                    }
                  >
                    {/* Parts strip — the pieces of a split word, in reading order */}
                    {partSiblings.length > 1 && (
                      <Reveal style={styles.partsStrip}>
                        <IconButton
                          onPress={help.press("sel.partPrev", () =>
                            stepPart(-1),
                          )}
                          accessibilityLabel={t.editor.hints.partPrev}
                          hint={t.editor.hints.partPrev}
                        >
                          <DirectionIcon isRTL={!isRTL} size={16} />
                        </IconButton>
                        <View style={styles.partsTrack}>
                          {partSiblings.map((part, index) => (
                            <PartTile
                              key={part.id}
                              label={formatPartLabel(
                                index,
                                partSiblings.length,
                                language,
                              )}
                              text={part.text}
                              fontKey={part.fontKey}
                              index={index}
                              active={index === activePartIndex}
                              onPress={help.press("sel.partTile", () =>
                                select(part.id),
                              )}
                            />
                          ))}
                        </View>
                        <IconButton
                          onPress={help.press("sel.partNext", () =>
                            stepPart(1),
                          )}
                          accessibilityLabel={t.editor.hints.partNext}
                          hint={t.editor.hints.partNext}
                        >
                          <DirectionIcon isRTL={isRTL} size={16} />
                        </IconButton>
                      </Reveal>
                    )}

                    {/* Why a split was refused */}
                    {!!splitNotice && (
                      <Reveal
                        style={[
                          styles.notice,
                          {
                            backgroundColor: c.dangerBg,
                            borderColor: c.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.noticeText,
                            { color: c.danger, fontFamily: fonts.ui },
                          ]}
                        >
                          {splitNotice}
                        </Text>
                      </Reveal>
                    )}

                    {/* A tool that has nothing to show has to say why
                      (DESIGN.md §8). The colour strip renders nothing without
                      a selection, so this is the one place the empty rail
                      explains itself. */}
                    {tool === "color" && !selectedObject && (
                      <Reveal
                        style={[
                          styles.notice,
                          {
                            backgroundColor: c.surfaceAlt,
                            borderColor: c.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.noticeText,
                            { color: c.muted, fontFamily: fonts.ui },
                          ]}
                        >
                          {helpRole(helpEntry("sel.empty"), language)}
                        </Text>
                      </Reveal>
                    )}

                    {/* Colour picker for the 'color' tool — in the rail, so
                      switching tools cannot resize the canvas either. */}
                    {tool === "color" && selectedObject && (
                      <View
                        style={[
                          styles.colorStrip,
                          {
                            borderColor: c.border,
                            backgroundColor: c.surfaceAlt,
                          },
                        ]}
                      >
                        {inkSwatches.map((col) => (
                          <Pressable
                            key={col}
                            accessibilityRole="button"
                            accessibilityLabel={helpText("sel.swatchInk")}
                            accessibilityState={{
                              selected: selectedObject.color === col,
                            }}
                            style={[
                              styles.colorSwatch,
                              { backgroundColor: col, borderColor: c.border },
                              selectedObject.color === col &&
                                styles.colorSwatchActive,
                            ]}
                            onPress={help.press("sel.swatchInk", () => {
                              const store = useEditorStore.getState();
                              store.snapshot();
                              updateObject(selectedObject.id, {
                                color: col,
                              } as never);
                            })}
                          />
                        ))}
                      </View>
                    )}

                    {/* Background tool */}
                    {tool === "background" && (
                      <View
                        style={[
                          styles.colorStrip,
                          {
                            borderColor: c.border,
                            backgroundColor: c.surfaceAlt,
                          },
                        ]}
                      >
                        {paperSwatches.map((col) => (
                          <Pressable
                            key={col}
                            accessibilityRole="button"
                            accessibilityLabel={helpText("sel.swatchPaper")}
                            style={[
                              styles.colorSwatch,
                              { backgroundColor: col, borderColor: c.border },
                            ]}
                            onPress={help.press("sel.swatchPaper", () =>
                              setBgColor(col),
                            )}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* Tool rail */}
        <View
          style={[
            styles.toolRail,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <View style={[styles.barInner, styles.toolRailInner]}>
            <ToolBtn
              label={t.editor.select}
              hint={shortcuts.hint(helpRoleText("tool.select"), "toolSelect")}
              active={tool === "select" && !multiSelectMode}
              onPress={help.press("tool.select", () => selectTool("select"))}
              icon="pen"
            />
            <ToolBtn
              label={t.editor.hints.multiSelect}
              hint={shortcuts.hint(
                helpRoleText("tool.multiSelect"),
                "toolMultiSelect",
              )}
              active={tool === "select" && multiSelectMode}
              onPress={help.press("tool.multiSelect", () => {
                selectTool("select");
                setMultiSelectMode(!multiSelectMode);
              })}
              icon="multiSelect"
            />
            <ToolBtn
              label={t.editor.text}
              hint={shortcuts.hint(helpRoleText("tool.text"), "toolText")}
              active={tool === "text"}
              onPress={help.press("tool.text", () => {
                setMultiSelectMode(false);
                selectTool("text");
                openTextSheet();
              })}
              icon="type"
            />
            <ToolBtn
              label={t.editor.colors}
              hint={helpRoleText("tool.colors")}
              active={tool === "color"}
              onPress={help.press("tool.colors", () => {
                setMultiSelectMode(false);
                selectTool("color");
              })}
              icon="palette"
            />
            <ToolBtn
              label={t.editor.background}
              hint={helpRoleText("tool.background")}
              active={tool === "background"}
              onPress={help.press("tool.background", () => {
                setMultiSelectMode(false);
                selectTool("background");
              })}
              icon="image"
            />
          </View>
        </View>

        {/* Text sheet */}
        <Sheet
          visible={textSheetOpen}
          onClose={() => {
            setTextSheetOpen(false);
            setEditingId(null);
          }}
          title={t.editor.text}
        >
          <View style={styles.sheetBody}>
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
              accessibilityLabel={helpText("panel.textInput")}
            />
            <FontSizeGauge
              value={draftFontSize}
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={FONT_SIZE_STEP}
              onChange={setDraftFontSize}
            />
            <View style={styles.fontRow}>
              {calligraphyFonts.map((f) => (
                <Button
                  key={f.key}
                  label={language === "ar" ? f.labelAr : f.labelEn}
                  variant={draftFont === f.key ? "primary" : "secondary"}
                  onPress={help.press("panel.font", () => setDraftFont(f.key))}
                  style={styles.fontBtn}
                />
              ))}
            </View>
            <Button
              label={t.common.done}
              onPress={help.press("panel.done", saveTextObject)}
              fullWidth
            />
          </View>
        </Sheet>

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
                  {presentations.map((preset) => {
                    const active = activePresentation.key === preset.key;
                    const label =
                      language === "ar" ? preset.labelAr : preset.labelEn;
                    return (
                      <Button
                        key={preset.key}
                        label={label}
                        accessibilityLabel={label}
                        variant={active ? "primary" : "secondary"}
                        selected={active}
                        onPress={help.press("panel.preset", () =>
                          applyPresentation(preset.key),
                        )}
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
                  onPrev={help.press("panel.lineHeight", () =>
                    stepLineHeight(-1),
                  )}
                  onNext={help.press("panel.lineHeight", () =>
                    stepLineHeight(1),
                  )}
                />
                <NumberStepper
                  label={t.editor.opacity}
                  display={`${Math.round(selectedText.opacity * 100)}%`}
                  onPrev={help.press("panel.opacity", () => stepOpacity(-0.1))}
                  onNext={help.press("panel.opacity", () => stepOpacity(0.1))}
                  prevDisabled={selectedText.opacity <= MIN_OPACITY}
                  nextDisabled={selectedText.opacity >= MAX_OPACITY}
                />

                {showAlign && (
                  <View style={styles.alignRow}>
                    {(
                      [
                        ["left", t.editor.alignLeft],
                        ["center", t.editor.alignCenter],
                        ["right", t.editor.alignRight],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        label={label}
                        accessibilityLabel={label}
                        variant={
                          selectedText.align === value ? "primary" : "secondary"
                        }
                        selected={selectedText.align === value}
                        onPress={help.press("panel.align", () =>
                          patchStyle({ align: value as TextAlign }),
                        )}
                        style={styles.alignBtn}
                      />
                    ))}
                  </View>
                )}

                <Button
                  label={t.common.done}
                  onPress={help.press("panel.done", () =>
                    setStyleSheetOpen(false),
                  )}
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

        {/* Export sheet */}
        <Sheet
          visible={exportOpen}
          onClose={() => setExportOpen(false)}
          title={t.editor.export}
        >
          <View style={styles.sheetBody}>
            <Button
              label={t.editor.exportShareImage}
              onPress={help.press("export.image", exportImage)}
              fullWidth
              variant={exporting === "image" ? "secondary" : "primary"}
            />
            <Button
              label={t.editor.exportSvgAction}
              onPress={help.press("export.svg", exportSvg)}
              fullWidth
              variant="secondary"
            />
            <Button
              label={t.editor.exportProjectFile}
              onPress={help.press("export.project", exportFile)}
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

        {/*
         * The selection's overflow — whatever the rail had no room for, plus
         * the actions that only ever live here. Labelled buttons rather than
         * the rail's glyphs, because this is where someone arrives *because*
         * the icons needed naming.
         *
         * Learn mode turns the buttons into a read-only reference list and the
         * bottom presentation into the centred one. Both follow from the same
         * fact: a reference row is taller than a button and there can be
         * thirteen of them, so the body has to scroll — and `Sheet` only arms
         * its drag-to-dismiss pan on the bottom presentation, which would fight
         * that scroller. It is the trade `HelpSheet` makes, for the same reason.
         * The title comes from the help table because the sheet is the `⋯`'s
         * sheet in both modes.
         */}
        <Sheet
          visible={actionSheetOpen}
          onClose={() => setActionSheetOpen(false)}
          title={helpText("sel.more")}
          presentation={help.active ? "modal" : "bottom"}
        >
          {help.active ? (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[
                  styles.sheetNote,
                  { fontFamily: fonts.ui, color: c.muted },
                ]}
              >
                {t.editor.learnPaused}
              </Text>
              <SelectionOverflowActions
                actions={overflowActions}
                isRTL={isRTL}
                learn
              />
            </ScrollView>
          ) : (
            <View style={styles.sheetBody}>
              <SelectionOverflowActions
                actions={overflowActions}
                isRTL={isRTL}
              />
            </View>
          )}
        </Sheet>

        {/* Help sheet — the complete tool and shortcut reference */}
        <HelpSheet
          visible={helpSheetOpen}
          onClose={() => setHelpSheetOpen(false)}
          chord={shortcuts.chord}
          onStartLearn={() => {
            setHelpSheetOpen(false);
            if (!help.active) {
              help.toggle();
            }
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/**
 * One part tile in the parts strip.
 *
 * Split out of the screen because it owns press feedback — hooks cannot be
 * called from inside the parent's `map`.
 */
function PartTile({
  label,
  text,
  fontKey,
  index,
  active,
  onPress,
}: {
  label: string;
  text: string;
  fontKey: string;
  index: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.partTile,
        {
          borderColor: active ? c.accent : c.border,
          backgroundColor: active ? c.accentSoft : c.surfaceAlt,
        },
        animStyle,
      ]}
    >
      {/* Rendered with the part's own font, so the tile shows the glyph exactly
          as the canvas does. */}
      <Text
        numberOfLines={1}
        style={[styles.partGlyph, { color: c.ink, fontFamily: fontKey }]}
      >
        {text}
      </Text>
      <Text
        style={[styles.partIndex, { color: c.muted, fontFamily: fonts.ui }]}
      >
        {index + 1}
      </Text>
    </AnimatedPressable>
  );
}

function ToolBtn({
  label,
  hint,
  active,
  onPress,
  icon,
}: {
  label: string;
  /** Tooltip text. Carries the shortcut chord; defaults to the caption. */
  hint?: string;
  active: boolean;
  onPress: () => void;
  icon: "pen" | "type" | "palette" | "image" | "multiSelect";
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  return (
    <View style={styles.toolBtnWrap}>
      <IconButton
        onPress={onPress}
        variant={active ? "ink" : "ghost"}
        accessibilityLabel={label}
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
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function TextInputStub({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  /** Named by the help table, like every other editor control. */
  accessibilityLabel?: string;
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
        accessibilityLabel={accessibilityLabel}
        placeholderTextColor="#9A968C"
        style={{
          color: c.ink,
          fontFamily: fontRoles[language].ui,
          fontSize: typeScale.body.size,
          padding: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  partsStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  partsTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  partTile: {
    minWidth: 48,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
  },
  partGlyph: { fontSize: 20, lineHeight: 26 },
  partIndex: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
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
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  presetBtn: { flexGrow: 1, flexBasis: "30%" },
  alignRow: { flexDirection: "row", gap: spacing.xs },
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
    width: "100%",
    maxWidth: layout.maxToolbar,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: typeScale.subheading.size, fontWeight: "600" },
  topActions: { flexDirection: "row", gap: spacing.xs },
  /**
   * The canvas owns the leftover height. It sits in the normal column flow now:
   * the rail below it is a fixed height, so its box is constant and the
   * fit-to-view in `EditorCanvas` never re-runs behind the user's back.
   */
  canvasWrap: { flex: 1, padding: spacing.md },
  canvasCard: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
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
    paddingTop: CONTEXT_RAIL_TOP_GAP,
    borderTopWidth: 1,
  },
  /**
   * The rail's row: the selection's actions, then whatever the current tool or
   * the selection's structure adds beside them. Capped and centred like every
   * other chrome bar (DESIGN.md §5).
   *
   * Deliberately **not** `overflow: "hidden"`: a tooltip bubble is a child of
   * its own button (`ui/tooltip.tsx`), so clipping the row would swallow every
   * tooltip the rail opens. The action count is derived from this width
   * instead, which is why nothing here may depend on clipping to look right.
   */
  railInner: {
    width: "100%",
    maxWidth: layout.maxToolbar,
    alignSelf: "center",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  /**
   * The context zone takes whatever the actions leave. It keeps its own
   * scroller because a split word can hold more parts than a phone is wide —
   * and unlike actions, parts are content, so scrolling them is honest.
   */
  railContextZone: { flex: 1, minWidth: 0 },
  railContextTrack: { alignItems: "center" },
  railContextRow: { alignItems: "center", gap: spacing.md },
  selectionCount: { fontSize: typeScale.caption.size, color: "#77736B" },
  toolRail: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  toolRailInner: {
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
  },
  toolBtnWrap: { alignItems: "center", gap: 2 },
  toolLabel: { fontSize: typeScale.caption.size },
  toolAction: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sheetBody: { gap: spacing.md },
  /** The learn-mode sheet body scrolls; the acting one never needs to. */
  sheetScroll: { flexShrink: 1 },
  sheetNote: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  fontRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  fontBtn: { minWidth: 84 },
  colorStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  colorSwatchActive: { borderWidth: 3, borderColor: "#B0894F" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
