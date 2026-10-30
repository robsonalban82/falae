import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bottom action bar, sticky on mobile. The top border only shows while the bar is actually
 * stuck over content: a sentinel right after it is off-screen exactly in that case.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) =>
      setStuck(entry ? !entry.isIntersecting : false),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        data-stuck={stuck || undefined}
        className={`sticky bottom-0 -mx-4 w-[calc(100%+2rem)] border-t-2 bg-bg px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:w-full sm:border-0 sm:bg-transparent sm:p-0 ${stuck ? 'border-line' : 'border-transparent'}`}
      >
        {children}
      </div>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </>
  );
}
