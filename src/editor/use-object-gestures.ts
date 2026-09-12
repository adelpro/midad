import { useEffect, useState } from "react";
import { Gesture, type ComposedGesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import {
  isCornerHandle,
  isHorizontalHandle,
  isRotateHandle,
  resizeHandles,
  rotateHandle,
  type ResizeHandle,
  type SizedObject,
} from "@/editor/hit-test";
import { useEditorStore } from "@/editor/store";
import type { ObjectTransform } from "@/storage/project-schema";

/** Hit radius around a resize handle, in the object's local frame (design units). */
const HANDLE_HIT_PAD = 18 / Math.SQRT2;
/** Wider touch target for the rotation grip, which is a lone handle. */
const ROTATE_HIT_PAD = HANDLE_HIT_PAD + 8;
/** Bounds for a horizontal (wrap-width) resize, in local design units. */
const MIN_WRAP_WIDTH = 24;
const MAX_WRAP_WIDTH = 20000;
/** Bounds for a uniform scale resize. */
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

export interface ObjectGestures {
  gestures: ComposedGesture;
  /** Point (design units) of the last tap for canvas hit-testing. */
  tapPoint: { x: number; y: number } | null;
}

/** Convert a view-space point into canvas design units via the fit viewport. */
function toDesign(x: number, y: number): { x: number; y: number } {
  const { viewport } = useEditorStore.getState();
  return {
    x: (x - viewport.offsetX) / viewport.scale,
    y: (y - viewport.offsetY) / viewport.scale,
  };
}

function handleTap(viewX: number, viewY: number) {
  const p = toDesign(viewX, viewY);
  // Local state lives in the hook; relay through a module-level emitter set
  // by useObjectGestures below (kept out of worklets entirely).
  tapRelay?.(p);
}

let tapRelay: ((p: { x: number; y: number }) => void) | null = null;

/** The bits of an object transform needed to map to/from its local frame. */
type Frame = Pick<
  ObjectTransform,
  "x" | "y" | "scale" | "rotation" | "flipH" | "flipV"
>;

/** Convert a design-space point into a frame's local (unrotated, unscaled) units. */
function toLocal(
  t: Frame,
  p: { x: number; y: number },
): { x: number; y: number } {
  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  const ux = dx * cos - dy * sin;
  const uy = dx * sin + dy * cos;
  const scaleX = t.flipH ? -t.scale : t.scale;
  const scaleY = t.flipV ? -t.scale : t.scale;
  return { x: ux / (scaleX || 1), y: uy / (scaleY || 1) };
}

/** Local offset (relative to the object center) → rotated/scaled design offset. */
function localOffset(t: Frame, x: number, y: number): { x: number; y: number } {
  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const sx = (t.flipH ? -t.scale : t.scale) * x;
  const sy = (t.flipV ? -t.scale : t.scale) * y;
  return { x: sx * cos - sy * sin, y: sx * sin + sy * cos };
}

/**
 * Object center that keeps `anchor` (local units) pinned in design space while
 * the object scales — so corner drags hold the opposite corner still, and edge
 * drags hold the opposite edge still.
 */
function centerForAnchor(
  origin: Frame,
  anchor: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  const before = localOffset(origin, anchor.x, anchor.y);
  const after = localOffset({ ...origin, scale }, anchor.x, anchor.y);
  return { x: origin.x + before.x - after.x, y: origin.y + before.y - after.y };
}

/** The local point that must stay pinned while `handle` is dragged. */
function anchorFor(
  handle: ResizeHandle,
  hw: number,
  hh: number,
): { x: number; y: number } {
  if (isCornerHandle(handle)) {
    return {
      x: handle.includes("e") ? -hw : hw,
      y: handle.includes("s") ? -hh : hh,
    };
  }
  switch (handle) {
    case "e":
      return { x: -hw, y: 0 };
    case "w":
      return { x: hw, y: 0 };
    case "n":
      return { x: 0, y: hh };
    default: // 's'
      return { x: 0, y: -hh };
  }
}

/**
 * Size multiplier for a handle drag, measured from the gesture's start point so
 * the object never jumps on touch-down. Corners project the drag onto their own
 * diagonal (proportional); edge handles read a single axis.
 */
function resizeFactor(
  handle: ResizeHandle,
  dx: number,
  dy: number,
  hw: number,
  hh: number,
): number {
  if (isCornerHandle(handle)) {
    const sx = handle.includes("e") ? 1 : -1;
    const sy = handle.includes("s") ? 1 : -1;
    const ax = 2 * sx * hw;
    const ay = 2 * sy * hh;
    const denom = ax * ax + ay * ay;
    return denom > 0 ? 1 + (dx * ax + dy * ay) / denom : 1;
  }
  const dir = handle === "e" || handle === "s" ? 1 : -1;
  const horizontal = isHorizontalHandle(handle);
  const half = Math.max(1, horizontal ? hw : hh);
  const delta = horizontal ? dx : dy;
  return 1 + (delta * dir) / (2 * half);
}

/**
 * Resize handle or rotation grip under a design-space point, or null.
 *
 * Local coordinates are scale-free, so the touch radius is divided by the
 * object's scale to keep the target a constant size next to the drawn handles
 * regardless of how large the object is — the same conversion `resizeHandles`
 * and `rotateHandle` apply to place the handles. The closest target wins, so
 * the rotation grip can never shadow a resize handle.
 */
function hitHandle(
  obj: SizedObject,
  p: { x: number; y: number },
): ResizeHandle | null {
  const t = obj.transform;
  const local = toLocal(t, p);
  const objectScale = Math.max(0.05, Math.abs(t.scale) || 1);

  let best: ResizeHandle | null = null;
  let bestDist = Infinity;

  const grip = rotateHandle(obj.box, objectScale);
  const gripDist = Math.hypot(local.x - grip.x, local.y - grip.y);
  if (gripDist <= ROTATE_HIT_PAD / objectScale) {
    best = "rotate";
    bestDist = gripDist;
  }

  const handleRadius = HANDLE_HIT_PAD / objectScale;
  for (const h of resizeHandles(obj.box, objectScale)) {
    const dist = Math.hypot(local.x - h.x, local.y - h.y);
    if (dist <= handleRadius && dist < bestDist) {
      bestDist = dist;
      best = h.handle;
    }
  }
  return best;
}

/** Pointer angle (degrees) about a centre, measured in design space. */
function pointerAngle(
  p: { x: number; y: number },
  cx: number,
  cy: number,
): number {
  return (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
}

/**
 * Shortest signed step from one angle to another, in (-180, 180].
 *
 * Applying the step between consecutive updates (rather than from the drag
 * origin) lets a rotation drag travel past 180° continuously instead of
 * snapping the object round to its mirrored angle.
 */
function angleStep(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Pan start: resize via a handle, else select-and-grab the topmost object. */
function beginDrag(viewX: number, viewY: number, enabled: boolean) {
  const store = useEditorStore.getState();
  if (!enabled) {
    store.setGs({ resizeTargetId: null, resizeHandle: null });
    return;
  }
  const p = toDesign(viewX, viewY);
  const selected = store.sizedObjects.find(
    (o) => o.id === store.selectedIds[0],
  );
  const handle = selected ? hitHandle(selected, p) : null;
  if (selected && handle) {
    const t = selected.transform;
    const local = toLocal(t, p);
    store.setGs({
      resizeTargetId: selected.id,
      resizeHandle: handle,
      resizeOriginX: t.x,
      resizeOriginY: t.y,
      resizeOriginScale: t.scale,
      resizeOriginRotation: t.rotation,
      resizeOriginFlipH: t.flipH,
      resizeOriginFlipV: t.flipV,
      resizeOriginBoxW: selected.box.width,
      resizeOriginBoxH: selected.box.height,
      resizeStartX: p.x,
      resizeStartY: p.y,
      resizeStartLocalX: local.x,
      resizeStartLocalY: local.y,
      resizeLastAngle: pointerAngle(p, t.x, t.y),
      dragId: null,
    });
    store.snapshot();
    return;
  }
  const sorted = [...store.sizedObjects].sort((a, b) => b.zIndex - a.zIndex);
  const hit = sorted.find(
    (o) =>
      Math.abs(p.x - o.transform.x) <= o.box.width / 2 + 8 &&
      Math.abs(p.y - o.transform.y) <= o.box.height / 2 + 8,
  );
  if (!hit) {
    store.setGs({ dragId: null, resizeTargetId: null, resizeHandle: null });
    if (store.selectedIds.length > 0) {
      store.select(null);
    }
    return;
  }
  if (!store.selectedIds.includes(hit.id)) {
    store.select(hit.id);
  }
  store.setGs({
    dragId: hit.id,
    dragOriginX: hit.transform.x,
    dragOriginY: hit.transform.y,
    resizeTargetId: null,
    resizeHandle: null,
  });
  store.snapshot();
}

function updateDrag(
  translationX: number,
  translationY: number,
  enabled: boolean,
) {
  if (!enabled) {
    return;
  }
  const store = useEditorStore.getState();
  const resizeId = store.gs.resizeTargetId;
  if (resizeId) {
    updateResize(store, resizeId, translationX, translationY);
    return;
  }
  const id = store.gs.dragId;
  if (!id) {
    return;
  }
  const obj = store.project?.objects.find((o) => o.id === id);
  if (!obj) {
    return;
  }
  const { viewport } = store;
  store.updateObject(id, {
    transform: {
      ...obj.transform,
      x: store.gs.dragOriginX + translationX / viewport.scale,
      y: store.gs.dragOriginY + translationY / viewport.scale,
    },
  });
}

/**
 * Apply a handle drag.
 *
 * - The rotation grip turns the object about its centre, keeping the scale.
 * - East/west handles on text change the wrap width: the glyphs re-flow inside
 *   the box and the font size is left alone, so narrowing can push a line onto
 *   two and widening can pull it back to one.
 * - North/south handles and all corner handles scale the object (for text that
 *   is the font size), holding the opposite edge or corner pinned.
 *
 * Size values are derived from the gesture's start state, so a resize drag is
 * absolute rather than accumulating rounding drift; rotation accumulates small
 * wrapped steps so it can travel past 180°.
 */
function updateResize(
  store: ReturnType<typeof useEditorStore.getState>,
  id: string,
  translationX: number,
  translationY: number,
) {
  const obj = store.project?.objects.find((o) => o.id === id);
  const { viewport, gs } = store;
  const handle = gs.resizeHandle;
  if (!obj || !handle) {
    return;
  }

  const origin: Frame = {
    x: gs.resizeOriginX,
    y: gs.resizeOriginY,
    scale: gs.resizeOriginScale,
    rotation: gs.resizeOriginRotation,
    flipH: gs.resizeOriginFlipH,
    flipV: gs.resizeOriginFlipV,
  };
  const hw = Math.max(1, gs.resizeOriginBoxW / 2);
  const hh = Math.max(1, gs.resizeOriginBoxH / 2);

  // Pointer travel, measured in the object's local frame (rotation/scale free).
  const p = {
    x: gs.resizeStartX + translationX / viewport.scale,
    y: gs.resizeStartY + translationY / viewport.scale,
  };

  if (isRotateHandle(handle)) {
    const angle = pointerAngle(p, origin.x, origin.y);
    const step = angleStep(gs.resizeLastAngle, angle);
    store.setGs({ resizeLastAngle: angle });
    store.updateObject(id, {
      transform: {
        ...obj.transform,
        rotation: obj.transform.rotation + step,
      },
    });
    return;
  }

  const local = toLocal(origin, p);
  const factor = resizeFactor(
    handle,
    local.x - gs.resizeStartLocalX,
    local.y - gs.resizeStartLocalY,
    hw,
    hh,
  );

  if (obj.type === "text" && isHorizontalHandle(handle)) {
    const dir = handle === "e" ? 1 : -1;
    const wrapWidth = Math.min(
      MAX_WRAP_WIDTH,
      Math.max(MIN_WRAP_WIDTH, gs.resizeOriginBoxW * factor),
    );
    // Keep the opposite edge pinned now that the box width has changed.
    const shift = localOffset(origin, -dir * hw + (dir * wrapWidth) / 2, 0);
    store.updateObject(id, {
      wrapWidth,
      transform: {
        ...obj.transform,
        x: origin.x + shift.x,
        y: origin.y + shift.y,
      },
    });
    return;
  }

  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, gs.resizeOriginScale * factor),
  );
  const center = centerForAnchor(origin, anchorFor(handle, hw, hh), scale);
  store.updateObject(id, {
    transform: { ...obj.transform, scale, x: center.x, y: center.y },
  });
}

/** Reset transient gesture scratch when a pan interaction ends. */
function clearResize() {
  useEditorStore.getState().setGs({
    resizeTargetId: null,
    resizeHandle: null,
    dragId: null,
  });
}

/** Pinch/rotate start: capture the selection's current scale & rotation. */
function beginTransform() {
  const store = useEditorStore.getState();
  const id = store.selectedIds[0];
  const obj = store.project?.objects.find((o) => o.id === id);
  if (!obj) {
    store.setGs({ transformTargetId: null });
    return;
  }
  store.setGs({
    transformTargetId: obj.id,
    scaleOrigin: obj.transform.scale,
    rotationOrigin: obj.transform.rotation,
  });
  store.snapshot();
}

function applyPinch(scaleChange: number) {
  const store = useEditorStore.getState();
  const id = store.gs.transformTargetId;
  const obj = store.project?.objects.find((o) => o.id === id);
  if (!obj) {
    return;
  }
  const scale = Math.min(
    20,
    Math.max(0.05, store.gs.scaleOrigin * scaleChange),
  );
  store.updateObject(id!, { transform: { ...obj.transform, scale } });
}

function applyRotation(radians: number) {
  const store = useEditorStore.getState();
  const id = store.gs.transformTargetId;
  const obj = store.project?.objects.find((o) => o.id === id);
  if (!obj) {
    return;
  }
  const rotation = store.gs.rotationOrigin + (radians * 180) / Math.PI;
  store.updateObject(id!, { transform: { ...obj.transform, rotation } });
}

/**
 * Editor canvas gestures.
 *
 * - Tap: hit-test topmost object → select (or clear selection on empty area).
 * - Pan: select-and-drag the topmost object under the finger (works even if
 *   it was not previously selected); history snapshotted at drag start.
 * - Pinch / Rotate: scale & rotate the current selection; snapshotted once
 *   per transform interaction.
 *
 * All handlers hop to the JS thread immediately (`runOnJS`) so every mutation
 * goes through zustand on JS — worklets stay free of JS-thread state reads.
 */
export function useObjectGestures(selectEnabled = true): ObjectGestures {
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    tapRelay = setTapPoint;
    return () => {
      tapRelay = null;
    };
  }, []);

  const tap = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x, e.y);
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart((e) => {
      runOnJS(beginDrag)(e.x, e.y, selectEnabled);
    })
    .onUpdate((e) => {
      runOnJS(updateDrag)(e.translationX, e.translationY, selectEnabled);
    })
    .onEnd(() => {
      runOnJS(clearResize)();
    })
    .onFinalize(() => {
      runOnJS(clearResize)();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      runOnJS(beginTransform)();
    })
    .onUpdate((e) => {
      runOnJS(applyPinch)(e.scale);
    });

  const rotate = Gesture.Rotation()
    .onStart(() => {
      runOnJS(beginTransform)();
    })
    .onUpdate((e) => {
      runOnJS(applyRotation)(e.rotation);
    });

  const gestures: ComposedGesture = Gesture.Race(
    tap,
    Gesture.Simultaneous(pan, pinch, rotate),
  );

  return { gestures, tapPoint };
}
