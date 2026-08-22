import type { DesignObject } from '@/storage/project-schema';

export interface SizedObject {
  id: string;
  transform: DesignObject['transform'];
  zIndex: number;
  box: { width: number; height: number };
}

/**
 * Returns the top-most object (highest zIndex) under a point, or null.
 * Objects are given in z-order; we iterate from the back and return the first
 * (deepest-last drawn = top-most visual) hit.
 */
export function hitTest(objects: SizedObject[], x: number, y: number): string | null {
  // Iterate front-to-back (highest z first).
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const o of sorted) {
    const t = o.transform;
    // Center of the object box.
    const cx = t.x;
    const cy = t.y;
    const hw = o.box.width / 2;
    const hh = o.box.height / 2;
    if (Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh) {
      return o.id;
    }
  }
  return null;
}