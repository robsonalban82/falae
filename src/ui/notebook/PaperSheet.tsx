import type { ReactNode } from 'react';
import './notebook.css';

type Props = { as?: 'div' | 'section' | 'article' | 'li'; className?: string; children: ReactNode };

/** Notebook paper surface with a dotted texture (decorative, below 3:1 on purpose). */
export function PaperSheet({ as: Tag = 'div', className, children }: Props) {
  return <Tag className={`nb-paper ${className ?? ''}`.trim()}>{children}</Tag>;
}
