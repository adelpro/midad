import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web implementation: react-native-web renders `View` to a real DOM node, so
 * we can attach a native `contextmenu` listener to it. RN Web's `View` has no
 * `onContextMenu` prop, which is why this needs a raw DOM listener rather than
 * a plain prop.
 *
 * Long-press remains the touch path; this only adds the desktop right-click
 * that mouse users expect.
 */
export function useContextMenu(onOpen: () => void): (node: unknown) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);

  // Kept in a ref so a new inline handler never forces the listener to
  // re-attach on every render.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const ref = useCallback((next: unknown) => {
    setNode((next as HTMLElement | null) ?? null);
  }, []);

  useEffect(() => {
    if (!node) {
      return;
    }
    const handler = (event: Event) => {
      // Suppress the browser menu so ours is the only one on offer.
      event.preventDefault();
      onOpenRef.current();
    };
    node.addEventListener('contextmenu', handler);
    return () => node.removeEventListener('contextmenu', handler);
  }, [node]);

  return ref;
}
