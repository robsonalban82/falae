import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes the height of the returned element as a CSS variable on <html> while `active`, so
 * sticky bars and scroll margins elsewhere can offset themselves by it. Cleans up on unmount.
 */
export function useHeightVar(name: string, active = true) {
  const ref = useRef<HTMLDivElement>(null);
  // Layout effect: the value is there before any rAF-scheduled scroll reads it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty(name, `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(name);
    };
  }, [name, active]);
  return ref;
}
