import { useEffect, useState } from 'react';
import { Gesture, type ComposedGesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useEditorStore } from '@/editor/store';

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

/** Pan start: select-and-grab the topmost object under the finger. */
function beginDrag(viewX: number, viewY: number, enabled: boolean) {
  if (!enabled) {
    return;
  }
  const store = useEditorStore.getState();
  const p = toDesign(viewX, viewY);
  const sorted = [...store.sizedObjects].sort((a, b) => b.zIndex - a.zIndex);
  const hit = sorted.find(
    (o) =>
      Math.abs(p.x - o.transform.x) <= o.box.width / 2 + 8 &&
      Math.abs(p.y - o.transform.y) <= o.box.height / 2 + 8,
  );
  if (!hit) {
    store.setGs({ dragId: null });
    if (store.selectedIds.length > 0) {
      store.select(null);
    }
    return;
  }
  if (!store.selectedIds.includes(hit.id)) {
    store.select(hit.id);
  }
  store.setGs({ dragId: hit.id, dragOriginX: hit.transform.x, dragOriginY: hit.transform.y });
  store.snapshot();
}

function updateDrag(translationX: number, translationY: number, enabled: boolean) {
  if (!enabled) {
    return;
  }
  const store = useEditorStore.getState();
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
  const scale = Math.min(20, Math.max(0.05, store.gs.scaleOrigin * scaleChange));
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
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);

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

  const gestures: ComposedGesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotate));

  return { gestures, tapPoint };
}
