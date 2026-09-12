import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Icon, IconButton, Sheet } from "@/components/ui";
import { EditorCanvasHost } from "@/editor/EditorCanvasHost";
import {
  collectSvgFontFaces,
  collectUsedFamilies,
  projectToSvg,
} from "@/editor/export/svg";
import { renderProjectToPng } from "@/editor/render/offscreen";
import { textLineBreaks, useParagraphFonts } from "@/editor/skia/text";
import { useEditorStore } from "@/editor/store";
import { useObjectGestures } from "@/editor/use-object-gestures";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { shareFile, shareImage } from "@/storage/export";
import type { ObjectTransform } from "@/storage/project-schema";
import {
  loadProject as loadProjectFile,
  saveProject,
} from "@/storage/projects";
import { THUMB_MAX_WIDTH_PX, saveThumb } from "@/storage/thumbs";
import { calligraphyFonts, fontRoles, spacing, typeScale } from "@/theme";

type ActiveTool = "select" | "text" | "color" | "background";

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
  const { t, language } = useT();
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
  const setGrid = useEditorStore((s) => s.setGrid);
  const gridEnabled = useEditorStore((s) => s.project?.gridEnabled);

  const [tool, setTool] = useState<ActiveTool>("select");
  const [textSheetOpen, setTextSheetOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftFont, setDraftFont] = useState<string>(calligraphyFonts[0].key);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
        select(objId);
        setEditingId(null);
      }
    },
    [tool, select],
  );

  const selectedObject = useMemo(
    () => project?.objects.find((o) => o.id === selectedIds[0]),
    [project, selectedIds],
  );

  /** Applies a discrete transform to the selection with a history snapshot. */
  const transformSelected = useCallback((patch: Partial<ObjectTransform>) => {
    const store = useEditorStore.getState();
    const obj = store.project?.objects.find(
      (o) => o.id === store.selectedIds[0],
    );
    if (!obj) {
      return;
    }
    store.snapshot();
    store.updateObject(obj.id, { transform: { ...obj.transform, ...patch } });
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
      setEditingId(obj.id);
    } else {
      setDraftText("");
      setDraftFont(calligraphyFonts[0].key);
      setEditingId(null);
    }
    setTextSheetOpen(true);
  }, []);

  const saveTextObject = useCallback(() => {
    if (!project || !draftText.trim()) {
      return;
    }
    const canvas = project.canvas;
    if (editingId && project.objects.some((o) => o.id === editingId)) {
      const store = useEditorStore.getState();
      store.snapshot();
      store.updateObject(editingId, {
        text: draftText.trim(),
        fontKey: draftFont,
      } as never);
    } else {
      addObject({
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: "text",
        text: draftText.trim(),
        fontKey: draftFont,
        fontSize: 96,
        lineHeight: 120,
        align: "center",
        color: "#111111",
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
  }, [project, draftText, draftFont, editingId, addObject]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) {
      return;
    }
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
    await saveProject(project);
    try {
      const png = renderProjectToPng(project, skiaFonts, {
        maxWidthPx: THUMB_MAX_WIDTH_PX,
      });
      await saveThumb(project.id, png.base64DataUri);
    } catch {
      // Thumbnail is best-effort; the project itself is saved.
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
          <IconButton onPress={() => router.back()}>
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
            <IconButton onPress={undo} disabled={!canUndo}>
              <Icon name="undo" size={18} color={canUndo ? c.ink : c.faint} />
            </IconButton>
            <IconButton onPress={redo} disabled={!canRedo}>
              <Icon name="redo" size={18} color={canRedo ? c.ink : c.faint} />
            </IconButton>
            <IconButton
              onPress={() => setGrid(!gridEnabled)}
              variant={gridEnabled ? "ink" : "ghost"}
            >
              <Icon
                name="grid"
                size={18}
                color={gridEnabled ? c.onInk : c.ink}
              />
            </IconButton>
            <IconButton onPress={save}>
              <Icon name="download" size={18} />
            </IconButton>
            <IconButton
              onPress={() => {
                setExportError(null);
                setExportOpen(true);
              }}
            >
              <Icon name="export" size={18} />
            </IconButton>
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

        {/* Selection context bar */}
        {selectedObject && (
          <View
            style={[
              styles.selectionBar,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <IconButton
              onPress={() =>
                transformSelected({
                  scale: selectedObject.transform.scale * 1.1,
                })
              }
            >
              <Icon name="plus" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                transformSelected({
                  scale: selectedObject.transform.scale * 0.9,
                })
              }
            >
              <Icon name="minus" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                transformSelected({
                  rotation: selectedObject.transform.rotation - 90,
                })
              }
            >
              <Icon name="rotateCcw" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                transformSelected({
                  rotation: selectedObject.transform.rotation + 90,
                })
              }
            >
              <Icon name="rotateCw" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                transformSelected({ flipH: !selectedObject.transform.flipH })
              }
            >
              <Icon name="flip" size={16} />
            </IconButton>
            {selectedObject.type === "text" && (
              <IconButton onPress={fitTextToContent}>
                <Icon name="fitText" size={16} />
              </IconButton>
            )}
            <IconButton onPress={duplicateSelected}>
              <Icon name="duplicate" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                useEditorStore.getState().bringToFront([selectedObject.id])
              }
            >
              <Icon name="layerUp" size={16} />
            </IconButton>
            <IconButton
              onPress={() =>
                useEditorStore.getState().sendToBack([selectedObject.id])
              }
            >
              <Icon name="layerDown" size={16} />
            </IconButton>
            <IconButton onPress={deleteSelected}>
              <Icon name="trash" size={16} color="#7A1F1F" />
            </IconButton>
          </View>
        )}

        {/* Tool rail */}
        <View
          style={[
            styles.toolRail,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <ToolBtn
            label={t.editor.select}
            active={tool === "select"}
            onPress={() => setTool("select")}
            icon="pen"
          />
          <ToolBtn
            label={t.editor.text}
            active={tool === "text"}
            onPress={() => {
              setTool("text");
              openTextSheet();
            }}
            icon="type"
          />
          <ToolBtn
            label={t.editor.colors}
            active={tool === "color"}
            onPress={() => setTool("color")}
            icon="palette"
          />
          <ToolBtn
            label={t.editor.background}
            active={tool === "background"}
            onPress={() => setTool("background")}
            icon="image"
          />
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
            <TextInputStub
              value={draftText}
              onChange={setDraftText}
              placeholder={t.editor.enterText}
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
                  color: "#7A1F1F",
                  fontFamily: fonts.ui,
                  fontSize: typeScale.small.size,
                }}
              >
                {t.editor.exportFailed}: {exportError}
              </Text>
            )}
          </View>
        </Sheet>

        {/* Color picker inline for 'color' tool */}
        {tool === "color" && selectedObject && (
          <View
            style={[
              styles.colorStrip,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            {[
              "#111111",
              "#7A1F1F",
              "#1F4E79",
              "#1F6C3B",
              "#B0894F",
              "#FFFFFF",
            ].map((col) => (
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
          <View
            style={[
              styles.colorStrip,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            {[
              "#F7F6F3",
              "#FFFFFF",
              "#111111",
              "#E8E2D5",
              "#2C3E50",
              "#5C4033",
            ].map((col) => (
              <Pressable
                key={col}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: col, borderColor: c.border },
                ]}
                onPress={() => setBgColor(col)}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function ToolBtn({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: "pen" | "type" | "palette" | "image";
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  return (
    <View style={styles.toolBtnWrap}>
      <IconButton onPress={onPress} variant={active ? "ink" : "ghost"}>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontSize: typeScale.subheading.size, fontWeight: "600" },
  topActions: { flexDirection: "row", gap: spacing.xs },
  canvasWrap: { flex: 1, padding: spacing.md },
  canvasCard: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  selectionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  toolRail: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  toolBtnWrap: { alignItems: "center", gap: 2 },
  toolLabel: { fontSize: typeScale.caption.size },
  toolAction: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sheetBody: { gap: spacing.md },
  fontRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  fontBtn: { minWidth: 84 },
  colorStrip: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    justifyContent: "center",
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
