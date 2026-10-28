import type { ReactNode } from 'react';

/** Marks English text so screen readers pronounce it correctly. */
export function En({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span lang="en" className={className}>
      {children}
    </span>
  );
}
