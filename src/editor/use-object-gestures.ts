import { useEffect, useMemo, useState } from "react";
import { Gesture, type ComposedGesture } from "react-native-gesture-handler";
import { runOnJS, useReducedMotion } from "react-native-reanimated";

import {
  isCornerHandle,
  isHorizontalHandle,
  isRotateHandle,
  OBJECT_HIT_PAD,
  resizeHandles,
  rotateHandle,
  toLocalPoint,
  type ResizeHandle,
  type SizedObject,
} from "@/editor/hit-test";
import {
  isAdditiveSelectionModifier,
  useModifierKeys,
} from "@/editor/modifier-keys";
import { useEditorStore, type DragOrigin } from "@/editor/store";
import { hapticTick } from "@/haptics";
import type { DesignObject, ObjectTransform } from "@/storage/project-schema";

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
/** Rotation snap: magnet window around each 45° multiple, in degrees. */
const SNAP_INCREMENT_DEG = 45;
const SNAP_WINDOW_DEG = 4;
/**
 * Release-settle spring: critically damped (ζ = 1, the `springs.ui` preset in
 * DESIGN.md), so it glides onto the snap target without overshoot.
 */
const SETTLE_STIFFNESS = 260;
const SETTLE_C = 2 * Math.sqrt(SETTLE_STIFFNESS);
const SETTLE_MAX_MS = 400;
const SETTLE_EPS_ANGLE = 0.05;
const SETTLE_EPS_VEL = 5;
/** Clamp for the release angular velocity handed to the settle spring. */
const MAX_RELEASE_VEL = 720;

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

/**
 * Convert a design-space point into a frame's local (unrotated, unscaled) units.
 * Delegates to the shared mapping so the gesture layer, the canvas overlay and
 * the selection hit-test can never disagree about where a box is.
 */
function toLocal(
  t: Frame,
  p: { x: number; y: number },
): { x: number; y: number } {
  return toLocalPoint(t, p.x, p.y);
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

/**
 * Nearest 45° multiple when `rotation` sits inside the magnet window, else
 * null. Multiples are evenly spaced, so plain arithmetic (no wrap handling)
 * always finds the closest one.
 */
function snapRotationTarget(rotation: number): number | null {
  const target = Math.round(rotation / SNAP_INCREMENT_DEG) * SNAP_INCREMENT_DEG;
  return Math.abs(rotation - target) <= SNAP_WINDOW_DEG ? target : null;
}

/** Cancel handle for an in-flight rotation settle, if any. */
let cancelSettle: (() => void) | null = null;

/**
 * A new grab always wins over a settle: the next drag starts from the live
 * on-screen rotation, so interrupting mid-settle is seamless.
 */
function cancelRotationSettle() {
  cancelSettle?.();
  cancelSettle = null;
}

/**
 * Animate a rotation onto its snap target after the pointer lifts.
 *
 * Critically damped (ζ = 1): no overshoot, well under half a second. Seeded
 * with the pointer's release angular velocity (velocity handoff) so the drag
 * and the settle read as one motion. Reduced motion jumps straight to the
 * target. Runs on rAF and writes through the store, so it is release-time
 * only — tracking during the drag is untouched.
 */
function settleRotation(
  id: string,
  target: number,
  v0: number,
  reduceMotion: boolean,
) {
  cancelRotationSettle();
  const store = useEditorStore.getState();
  const obj = store.project?.objects.find((o) => o.id === id);
  if (!obj) {
    return;
  }
  const from = obj.transform.rotation;
  if (reduceMotion || from === target) {
    if (from !== target) {
      store.updateObject(id, {
        transform: { ...obj.transform, rotation: target },
      });
    }
    return;
  }
  const start = performance.now();
  const A = from - target;
  const B = v0 + SETTLE_C * A;
  let raf = 0;
  let cancelled = false;
  const step = (now: number) => {
    if (cancelled) {
      return;
    }
    const t = Math.min((now - start) / 1000, SETTLE_MAX_MS / 1000);
    const e = Math.exp(-SETTLE_C * t);
    const x = target + (A + B * t) * e;
    const v = (B - SETTLE_C * (A + B * t)) * e;
    const s = useEditorStore.getState();
    const o = s.project?.objects.find((p) => p.id === id);
    if (!o) {
      cancelSettle = null;
      return;
    }
    const done =
      (Math.abs(x - target) < SETTLE_EPS_ANGLE &&
        Math.abs(v) < SETTLE_EPS_VEL) ||
      now - start >= SETTLE_MAX_MS;
    s.updateObject(id, {
      transform: { ...o.transform, rotation: done ? target : x },
    });
    if (done) {
      cancelSettle = null;
      return;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  cancelSettle = () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * Pan start.
 *
 * Handles exist only around a single object (a multi-selection is outlined as
 * one plain group box), so a handle drag is never ambiguous. Otherwise the
 * pointer-down decides the selection and, when it lands on something selected,
 * starts a drag of the whole selection:
 *
 * - additive on (multi-select tool, or Shift/Cmd/Ctrl on web), pointer on an
 *   unselected object → add it, do not drag it (an imprecise tap must not
 *   nudge the object);
 * - pointer on an already-selected object → drag every selected object; a
 *   quick tap (no drag) toggles it off via the tap handler — that is the
 *   multi-select deselect idiom;
 * - additive off → replace the selection and drag it.
 *
 * `selectionHandledOnDown` records that the selection already changed here, so
 * the trailing tap does not toggle it a second time. `additiveSelect` records
 * what the press meant, so the trailing tap cannot disagree with this half.
 */
function beginDrag(viewX: number, viewY: number, enabled: boolean) {
  cancelRotationSettle();
  const store = useEditorStore.getState();
  // Additive = the multi-select tool, or a selection modifier (Shift/Cmd/Ctrl
  // on web). Recorded in the scratch so the trailing tap reads the SAME value
  // the pointer-down used — the two halves of one press cannot disagree.
  const additive = store.multiSelectMode || isAdditiveSelectionModifier();
  if (!enabled) {
    // Reset the flag here as well: only the trailing tap consumes it, and a tap
    // is not guaranteed to follow (a real drag swallows it). Left set, it would
    // swallow the next tap in a tool where the canvas is selectable but not
    // draggable.
    store.setGs({
      resizeTargetId: null,
      resizeHandle: null,
      dragOrigins: [],
      selectionHandledOnDown: false,
      additiveSelect: additive,
    });
    return;
  }
  const p = toDesign(viewX, viewY);
  const single =
    store.selectedIds.length === 1
      ? store.sizedObjects.find((o) => o.id === store.selectedIds[0])
      : undefined;
  const handle = single ? hitHandle(single, p) : null;
  if (single && handle) {
    const t = single.transform;
    const local = toLocal(t, p);
    // Pointer-down feedback: the grab is acknowledged the instant it lands.
    hapticTick();
    store.setGs({
      resizeTargetId: single.id,
      resizeHandle: handle,
      resizeOriginX: t.x,
      resizeOriginY: t.y,
      resizeOriginScale: t.scale,
      resizeOriginRotation: t.rotation,
      resizeOriginFlipH: t.flipH,
      resizeOriginFlipV: t.flipV,
      resizeOriginBoxW: single.box.width,
      resizeOriginBoxH: single.box.height,
      resizeStartX: p.x,
      resizeStartY: p.y,
      resizeStartLocalX: local.x,
      resizeStartLocalY: local.y,
      resizeLastAngle: pointerAngle(p, t.x, t.y),
      resizeLastAngleAt: Date.now(),
      rotateVelocity: 0,
      lastSnapAngle: null,
      dragOrigins: [],
      selectionHandledOnDown: false,
      additiveSelect: additive,
    });
    store.snapshot();
    return;
  }

  const sorted = [...store.sizedObjects].sort((a, b) => b.zIndex - a.zIndex);
  // The shared tolerance is applied in the object's local units, so the grab
  // matches the box the user can actually see — and matches the tap hit-test.
  const hit = sorted.find((o) => {
    const local = toLocal(o.transform, p);
    return (
      Math.abs(local.x) <= o.box.width / 2 + OBJECT_HIT_PAD &&
      Math.abs(local.y) <= o.box.height / 2 + OBJECT_HIT_PAD
    );
  });
  if (!hit) {
    store.setGs({
      dragOrigins: [],
      resizeTargetId: null,
      resizeHandle: null,
      selectionHandledOnDown: false,
      additiveSelect: additive,
    });
    if (store.selectedIds.length > 0) {
      store.select(null);
      store.setGs({ selectionHandledOnDown: true });
    }
    return;
  }

  const alreadySelected = store.selectedIds.includes(hit.id);

  if (additive && !alreadySelected) {
    store.select(hit.id, true);
    store.setGs({
      dragOrigins: [],
      resizeTargetId: null,
      resizeHandle: null,
      selectionHandledOnDown: true,
      additiveSelect: additive,
    });
    return;
  }

  if (!alreadySelected) {
    store.select(hit.id);
  }

  // Capture origins for the whole (possibly just-updated) selection.
  const origins: DragOrigin[] = [];
  for (const id of store.selectedIds) {
    const o = store.sizedObjects.find((x) => x.id === id);
    if (o) {
      origins.push({ id, x: o.transform.x, y: o.transform.y });
    }
  }

  store.setGs({
    dragOrigins: origins,
    resizeTargetId: null,
    resizeHandle: null,
    selectionHandledOnDown: !alreadySelected,
    additiveSelect: additive,
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
  // A two-finger pinch/rotate owns the object while it runs — the pan must
  // not also move it (relative and absolute writers would fight).
  if (store.gs.transformTargetId) {
    return;
  }
  const origins = store.gs.dragOrigins;
  if (origins.length === 0) {
    return;
  }
  const { viewport } = store;
  const dx = translationX / viewport.scale;
  const dy = translationY / viewport.scale;
  // Every object in the selection moves by the same delta from its own origin,
  // so a group drag preserves the relative layout. One store write for the
  // whole selection — N objects, one render per frame instead of N.
  const patches: { id: string; patch: Partial<DesignObject> }[] = [];
  for (const origin of origins) {
    const obj = store.project?.objects.find((o) => o.id === origin.id);
    if (!obj) {
      continue;
    }
    patches.push({
      id: origin.id,
      patch: {
        transform: {
          ...obj.transform,
          x: origin.x + dx,
          y: origin.y + dy,
        },
      },
    });
  }
  if (patches.length > 0) {
    store.updateObjects(patches);
  }
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
    const now = Date.now();
    const dt = Math.max(1, now - gs.resizeLastAngleAt) / 1000;
    // Smoothed angular velocity — the release handoff for the settle spring.
    const rotateVelocity = Math.max(
      -MAX_RELEASE_VEL,
      Math.min(MAX_RELEASE_VEL, 0.7 * gs.rotateVelocity + 0.3 * (step / dt)),
    );
    const next = obj.transform.rotation + step;
    // Magnet feedback only: tick once per snap-window entry. The rotation
    // itself stays 1:1 with the pointer; the settle on release lands it.
    const snapped = snapRotationTarget(next);
    if (snapped !== null && snapped !== gs.lastSnapAngle) {
      hapticTick();
    }
    store.setGs({
      resizeLastAngle: angle,
      resizeLastAngleAt: now,
      rotateVelocity,
      lastSnapAngle: snapped,
    });
    store.updateObject(id, {
      transform: {
        ...obj.transform,
        rotation: next,
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
    transformTargetId: null,
    lastSnapAngle: null,
    dragOrigins: [],
  });
}

/**
 * Pan end. A rotation drag that stops inside a snap window settles onto the
 * 45° multiple with a short spring (velocity handoff from the pointer);
 * everything else is already at rest.
 */
function endDrag(reduceMotion: boolean) {
  const store = useEditorStore.getState();
  const { gs } = store;
  if (gs.resizeTargetId && gs.resizeHandle === "rotate") {
    const obj = store.project?.objects.find((o) => o.id === gs.resizeTargetId);
    if (obj) {
      const snapped = snapRotationTarget(obj.transform.rotation);
      if (snapped !== null && snapped !== obj.transform.rotation) {
        settleRotation(
          gs.resizeTargetId,
          snapped,
          gs.rotateVelocity,
          reduceMotion,
        );
      }
    }
  }
}

/** Pinch/rotate start: capture the selection's current scale & rotation. */
function beginTransform() {
  cancelRotationSettle();
  const store = useEditorStore.getState();
  // A handle drag owns the object — a second finger must not start a
  // competing absolute transform on top of it.
  if (store.gs.resizeTargetId) {
    return;
  }
  // Pinch and rotate both fire onStart for the same two-finger touch; the
  // second call must not re-snapshot (it would double the history entry).
  if (store.gs.transformTargetId) {
    return;
  }
  // Pinch and rotate have a single pivot about one object's centre; with a
  // group selected there is no unambiguous pivot, so they stay inert.
  if (store.selectedIds.length !== 1) {
    store.setGs({ transformTargetId: null });
    return;
  }
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
 * - Tap: hit-test the topmost object and select it (or clear on empty area).
 *   Skipped when pointer-down already resolved the selection — see
 *   `GestureScratch.selectionHandledOnDown`.
 * - Pan: decide the selection, then drag it. A single object resizes through
 *   its handles; a multi-selection is dragged as a group. History is
 *   snapshotted once at drag start.
 * - Pinch / Rotate: scale & rotate a single selected object; snapshotted once
 *   per transform interaction.
 *
 * All handlers hop to the JS thread immediately (`runOnJS`) so every mutation
 * goes through zustand on JS — worklets stay free of JS-thread state reads.
 */
export function useObjectGestures(selectEnabled = true): ObjectGestures {
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const reduceMotion = useReducedMotion();
  // Tracks Shift/Cmd/Ctrl on web so `beginDrag` can read the modifier at
  // pointer-down; a no-op on native (touch has no selection modifier).
  useModifierKeys();

  useEffect(() => {
    tapRelay = setTapPoint;
    return () => {
      tapRelay = null;
    };
  }, []);

  // Memoized: rebuilding the composition every render used to hand RNGH a new
  // gesture object on every animation frame of a drag.
  const gestures = useMemo<ComposedGesture>(() => {
    const tap = Gesture.Tap()
      .maxDuration(220)
      .onEnd((e) => {
        runOnJS(handleTap)(e.x, e.y);
      });

    const pan = Gesture.Pan()
      // Resolve the grab at pointer-down (onBegin), not after a movement
      // threshold: a handle must be caught where the finger lands, and the
      // resize/rotate baselines are measured from that exact point. The 2px
      // hysteresis only filters jitter — translation is still measured from
      // the touch-down point, so tracking stays 1:1.
      .minDistance(2)
      .onBegin((e) => {
        runOnJS(beginDrag)(e.x, e.y, selectEnabled);
      })
      .onUpdate((e) => {
        runOnJS(updateDrag)(e.translationX, e.translationY, selectEnabled);
      })
      .onEnd(() => {
        runOnJS(endDrag)(reduceMotion);
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
      })
      .onFinalize(() => {
        runOnJS(clearResize)();
      });

    const rotate = Gesture.Rotation()
      .onStart(() => {
        runOnJS(beginTransform)();
      })
      .onUpdate((e) => {
        runOnJS(applyRotation)(e.rotation);
      })
      .onFinalize(() => {
        runOnJS(clearResize)();
      });

    return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate));
  }, [selectEnabled, reduceMotion]);

  return { gestures, tapPoint };
}
