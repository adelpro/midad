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
import { InsertSheet, type ShapeKey } from "@/editor/insert-sheet";
import { renderProjectToPng } from "@/editor/render/offscreen";
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
import { formatPartLabel, formatSelectedCount } from "@/i18n/strings";
import { pickBackgroundImage } from "@/storage/background-image";
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
  DEFAULT_PAPER,
  inkSwatches,
  paperSwatches,
} from "@/theme/content-palette";
import {
  DEFAULT_LEADING_RATIO,
  presentationByKey,
  presentations,
  presetPatch,
} from "@/theme/presentations";

type ActiveTool = "select" | "text" | "insert" | "color" | "background";

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
  /** The ornament and shape library. */
  const [insertSheetOpen, setInsertSheetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  /** Transient explanation shown when a split is refused. */
  const [splitNotice, setSplitNotice] = useState<string | null>(null);

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

  const { gestures, tapPoint } = useObjectGestures(tool === "select");

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

  /**
   * Insert a decoration — the library's only write path.
   *
   * Both kinds share one transform: centred on the canvas, size carried by
   * `scale`, and a `zIndex` following the same `* 10` spacing text objects use,
   * so the newest object lands on top. The rail returns to Select because the
   * sheet has closed and the new object is what wants the handles.
   */
  const insertGlyph = useCallback(
    (glyphKey: string) => {
      if (!project) {
        return;
      }
      addObject({
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "glyph",
        glyphKey,
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
      setTool("select");
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
        type: "shape",
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
      setTool("select");
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
   * Launch the system image picker and set the chosen image as the design's
   * background. The image is embedded in the project file as a base64 data URI,
   * so it travels with `.midad.json` export/import.
   */
  const setBgImage = useCallback(async () => {
    const uri = await pickBackgroundImage();
    if (uri) {
      useEditorStore.getState().setCanvas({
        background: { type: "image", imageUri: uri },
      });
    }
  }, []);

  /** Revert an image background to the default paper colour. */
  const clearBgImage = useCallback(() => {
    useEditorStore.getState().setCanvas({
      background: { type: "paper", color: DEFAULT_PAPER },
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
      !textSheetOpen && !styleSheetOpen && !insertSheetOpen && !exportOpen,
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
    },
  });

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
              onPress={() => router.back()}
              accessibilityLabel={t.editor.hints.back}
              hint={t.editor.hints.back}
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
                onPress={undo}
                disabled={!canUndo}
                accessibilityLabel={t.editor.hints.undo}
                hint={shortcuts.hint(t.editor.hints.undo, "undo")}
              >
                <Icon name="undo" size={18} color={canUndo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={redo}
                disabled={!canRedo}
                accessibilityLabel={t.editor.hints.redo}
                hint={shortcuts.hint(t.editor.hints.redo, "redo")}
              >
                <Icon name="redo" size={18} color={canRedo ? c.ink : c.faint} />
              </IconButton>
              <IconButton
                onPress={() => setGrid(!gridEnabled)}
                variant={gridEnabled ? "ink" : "ghost"}
                accessibilityLabel={t.editor.hints.grid}
                hint={shortcuts.hint(t.editor.hints.grid, "toggleGrid")}
              >
                <Icon
                  name="grid"
                  size={18}
                  color={gridEnabled ? c.onInk : c.ink}
                />
              </IconButton>
              <IconButton
                onPress={save}
                accessibilityLabel={t.editor.hints.save}
                accessibilityHint={t.editor.hints.save}
                hint={shortcuts.hint(t.editor.hints.save, "save")}
              >
                <Icon name="download" size={18} />
              </IconButton>
              <IconButton
                onPress={() => {
                  setExportError(null);
                  setExportOpen(true);
                }}
                accessibilityLabel={t.editor.hints.export}
                hint={t.editor.hints.export}
              >
                <Icon name="export" size={18} />
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.contextScroll}
            contentContainerStyle={styles.contextTrack}
          >
            {/* Selection actions */}
            {selectedIds.length > 0 && (
              <View style={styles.selectionActions}>
                {selectedIds.length > 1 && (
                  <Text style={styles.selectionCount}>
                    {formatSelectedCount(selectedIds.length, language)}
                  </Text>
                )}
                <IconButton
                  accessibilityLabel={t.editor.hints.scaleUp}
                  hint={t.editor.hints.scaleUp}
                  onPress={() =>
                    transformSelected({
                      scale: (selectedObject?.transform.scale ?? 1) * 1.1,
                    })
                  }
                >
                  <Icon name="plus" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.scaleDown}
                  hint={t.editor.hints.scaleDown}
                  onPress={() =>
                    transformSelected({
                      scale: (selectedObject?.transform.scale ?? 1) * 0.9,
                    })
                  }
                >
                  <Icon name="minus" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.rotateCcw}
                  hint={shortcuts.hint(t.editor.hints.rotateCcw, "rotateCcw")}
                  onPress={() =>
                    transformSelected({
                      rotation: (selectedObject?.transform.rotation ?? 0) - 90,
                    })
                  }
                >
                  <Icon name="rotateCcw" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.rotateCw}
                  hint={shortcuts.hint(t.editor.hints.rotateCw, "rotateCw")}
                  onPress={() =>
                    transformSelected({
                      rotation: (selectedObject?.transform.rotation ?? 0) + 90,
                    })
                  }
                >
                  <Icon name="rotateCw" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.flipH}
                  hint={shortcuts.hint(t.editor.hints.flipH, "flipH")}
                  onPress={() =>
                    transformSelected({
                      flipH: !(selectedObject?.transform.flipH ?? false),
                    })
                  }
                >
                  <Icon name="flip" size={16} />
                </IconButton>
                {selectedObject?.type === "text" && (
                  <IconButton
                    onPress={fitTextToContent}
                    accessibilityLabel={t.editor.hints.fitText}
                    hint={t.editor.hints.fitText}
                  >
                    <Icon name="fitText" size={16} />
                  </IconButton>
                )}
                {canSplitSelected && (
                  <IconButton
                    onPress={splitSelected}
                    accessibilityLabel={t.editor.hints.split}
                    hint={t.editor.hints.split}
                  >
                    <Icon name="split" size={16} />
                  </IconButton>
                )}
                {partSiblings.length > 1 && (
                  <IconButton
                    onPress={rejoinSelected}
                    accessibilityLabel={t.editor.hints.rejoin}
                    hint={t.editor.hints.rejoin}
                  >
                    <Icon name="rejoin" size={16} />
                  </IconButton>
                )}
                <IconButton
                  onPress={duplicateSelected}
                  accessibilityLabel={t.editor.hints.duplicate}
                  hint={shortcuts.hint(t.editor.hints.duplicate, "duplicate")}
                >
                  <Icon name="duplicate" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.bringToFront}
                  hint={shortcuts.hint(
                    t.editor.hints.bringToFront,
                    "bringToFront",
                  )}
                  onPress={() => bringToFront([selectedIds[0]])}
                >
                  <Icon name="layerUp" size={16} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t.editor.hints.sendToBack}
                  hint={shortcuts.hint(t.editor.hints.sendToBack, "sendToBack")}
                  onPress={() => sendToBack([selectedIds[0]])}
                >
                  <Icon name="layerDown" size={16} />
                </IconButton>
                <IconButton
                  onPress={deleteSelected}
                  accessibilityLabel={t.editor.hints.delete}
                  hint={shortcuts.hint(t.editor.hints.delete, "delete")}
                >
                  <Icon name="trash" size={16} color={c.danger} />
                </IconButton>
                {selectedIds.length > 1 && (
                  <>
                    <IconButton
                      onPress={() => alignSelected("left")}
                      accessibilityLabel={t.editor.hints.alignLeft}
                      hint={t.editor.hints.alignLeft}
                    >
                      <Icon name="alignLeft" size={16} />
                    </IconButton>
                    <IconButton
                      onPress={() => alignSelected("centerH")}
                      accessibilityLabel={t.editor.hints.alignCenterH}
                      hint={t.editor.hints.alignCenterH}
                    >
                      <Icon name="alignCenterH" size={16} />
                    </IconButton>
                    <IconButton
                      onPress={() => alignSelected("right")}
                      accessibilityLabel={t.editor.hints.alignRight}
                      hint={t.editor.hints.alignRight}
                    >
                      <Icon name="alignRight" size={16} />
                    </IconButton>
                    <IconButton
                      onPress={() => alignSelected("top")}
                      accessibilityLabel={t.editor.hints.alignTop}
                      hint={t.editor.hints.alignTop}
                    >
                      <Icon name="alignTop" size={16} />
                    </IconButton>
                    <IconButton
                      onPress={() => alignSelected("middleV")}
                      accessibilityLabel={t.editor.hints.alignMiddleV}
                      hint={t.editor.hints.alignMiddleV}
                    >
                      <Icon name="alignMiddleV" size={16} />
                    </IconButton>
                    <IconButton
                      onPress={() => alignSelected("bottom")}
                      accessibilityLabel={t.editor.hints.alignBottom}
                      hint={t.editor.hints.alignBottom}
                    >
                      <Icon name="alignBottom" size={16} />
                    </IconButton>
                  </>
                )}
                <IconButton
                  onPress={() => alignSelected("canvasCenterH")}
                  accessibilityLabel={t.editor.hints.centerH}
                  hint={t.editor.hints.centerH}
                >
                  <Icon name="centerH" size={16} />
                </IconButton>
                <IconButton
                  onPress={() => alignSelected("canvasCenterV")}
                  accessibilityLabel={t.editor.hints.centerV}
                  hint={t.editor.hints.centerV}
                >
                  <Icon name="centerV" size={16} />
                </IconButton>
              </View>
            )}

            {/* Parts strip — the pieces of a split word, in reading order */}
            {partSiblings.length > 1 && (
              <Reveal style={styles.partsStrip}>
                <IconButton
                  onPress={() => stepPart(-1)}
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
                      onPress={() => select(part.id)}
                    />
                  ))}
                </View>
                <IconButton
                  onPress={() => stepPart(1)}
                  accessibilityLabel={t.editor.hints.partNext}
                  hint={t.editor.hints.partNext}
                >
                  <DirectionIcon isRTL={isRTL} size={16} />
                </IconButton>
              </Reveal>
            )}

            {/* Style navigator — cycles the presentation presets on the selection */}
            {selectedText && (
              <Reveal style={styles.styleNav}>
                <View style={styles.styleNavInner}>
                  <IconButton
                    onPress={() => cyclePresentation(-1)}
                    accessibilityLabel={t.editor.hints.stylePrev}
                    hint={t.editor.hints.stylePrev}
                  >
                    <DirectionIcon isRTL={!isRTL} size={16} />
                  </IconButton>
                  <Pressable
                    onPress={() => setStyleSheetOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t.editor.style}
                    style={styles.styleNameWrap}
                  >
                    <Text
                      style={[
                        styles.styleName,
                        { color: c.muted, fontFamily: fonts.ui },
                      ]}
                    >
                      {t.editor.style}
                    </Text>
                    <Text
                      style={[
                        styles.styleValue,
                        { color: c.accentText, fontFamily: fonts.ui },
                      ]}
                    >
                      {language === "ar"
                        ? activePresentation.labelAr
                        : activePresentation.labelEn}
                    </Text>
                  </Pressable>
                  <IconButton
                    onPress={() => cyclePresentation(1)}
                    accessibilityLabel={t.editor.hints.styleNext}
                    hint={t.editor.hints.styleNext}
                  >
                    <DirectionIcon isRTL={isRTL} size={16} />
                  </IconButton>
                </View>
              </Reveal>
            )}

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
                  ]}
                >
                  {splitNotice}
                </Text>
              </Reveal>
            )}

            {/* Colour picker for the 'color' tool — in the rail, so switching
              tools cannot resize the canvas either. */}
            {tool === "color" && selectedObject && (
              <View
                style={[
                  styles.colorStrip,
                  { borderColor: c.border, backgroundColor: c.surfaceAlt },
                ]}
              >
                {inkSwatches.map((col) => (
                  <Pressable
                    key={col}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: col, borderColor: c.border },
                      selectedObject.color === col && styles.colorSwatchActive,
                    ]}
                    onPress={() => {
                      const store = useEditorStore.getState();
                      store.snapshot();
                      updateObject(selectedObject.id, { color: col } as never);
                    }}
                  />
                ))}
              </View>
            )}

            {/* Background tool */}
            {tool === "background" && (
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
                      project.canvas.background.type === "image" && {
                        borderColor: c.accentText,
                        backgroundColor: c.accentSoft,
                      },
                    ]}
                  >
                    <Icon name="image" size={16} color={c.ink} />
                  </Pressable>
                  {project.canvas.background.type === "image" && (
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
              hint={shortcuts.hint(t.editor.select, "toolSelect")}
              active={tool === "select" && !multiSelectMode}
              onPress={() => selectTool("select")}
              icon="pen"
            />
            <ToolBtn
              label={t.editor.hints.multiSelect}
              hint={shortcuts.hint(
                t.editor.hints.multiSelect,
                "toolMultiSelect",
              )}
              active={tool === "select" && multiSelectMode}
              onPress={() => {
                selectTool("select");
                setMultiSelectMode(!multiSelectMode);
              }}
              icon="multiSelect"
            />
            <ToolBtn
              label={t.editor.text}
              hint={shortcuts.hint(t.editor.text, "toolText")}
              active={tool === "text"}
              onPress={() => {
                setMultiSelectMode(false);
                selectTool("text");
                openTextSheet();
              }}
              icon="type"
            />
            <ToolBtn
              label={t.editor.glyphs}
              active={tool === "insert"}
              onPress={() => {
                setMultiSelectMode(false);
                selectTool("insert");
                setInsertSheetOpen(true);
              }}
              icon="sparkle"
            />
            <ToolBtn
              label={t.editor.colors}
              active={tool === "color"}
              onPress={() => {
                setMultiSelectMode(false);
                selectTool("color");
              }}
              icon="palette"
            />
            <ToolBtn
              label={t.editor.background}
              active={tool === "background"}
              onPress={() => {
                setMultiSelectMode(false);
                selectTool("background");
              }}
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
                  onPress={() => setDraftFont(f.key)}
                  style={styles.fontBtn}
                />
              ))}
            </View>
            <Button label={t.common.done} onPress={saveTextObject} fullWidth />
          </View>
        </Sheet>

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
              variant={exporting === "image" ? "secondary" : "primary"}
            />
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
  icon: "pen" | "type" | "sparkle" | "palette" | "image" | "multiSelect";
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
  styleNav: { paddingHorizontal: spacing.xs },
  styleNavInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  /**
   * Intrinsic width, not `flex: 1`: the rail sizes its sections to their
   * content, and a flexible child in an intrinsically-sized row has nothing to
   * take its width from.
   */
  styleNameWrap: {
    minWidth: 96,
    alignItems: "center",
    paddingVertical: spacing.xxs,
  },
  styleName: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  styleValue: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    fontWeight: "600",
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
  canvasCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    // RNGH sets touch-action:none on its wrapper, but style resets or browser
    // default-drags can break pointer capture mid-gesture on web. Belt-and-
    // suspenders: assert both on the canvas card itself.
    touchAction: "none",
    userSelect: "none",
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
  contextScroll: {
    width: "100%",
    maxWidth: layout.maxToolbar,
    alignSelf: "center",
  },
  contextTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    // Lets a short strip (e.g. the background toolbox) fill the rail so it can
    // centre itself; wide content still scrolls normally.
    flexGrow: 1,
  },
  /**
   * The section scrolls horizontally instead of wrapping: the selection alone
   * can hold twenty controls, and a wrapped row would grow taller than the
   * reserved slot and shove the canvas.
   */
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
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
  fontRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  fontBtn: { minWidth: 84 },
  colorStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  colorSwatchActive: { borderWidth: 3, borderColor: "#B0894F" },
  /** Centres the background toolbox within the rail. */
  bgToolWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  /** Circle image button, sized to sit flush with the paper swatches. */
  bgImageBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
