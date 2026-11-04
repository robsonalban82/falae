import type { ReactNode } from 'react';
import './notebook.css';

/** Highlighter swipe behind a title; the text keeps the normal ink color. */
export function Marker({ children }: { children: ReactNode }) {
  return <span className="nb-marker">{children}</span>;
}
