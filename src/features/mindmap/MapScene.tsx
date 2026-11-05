import { useEffect } from 'react';
import { artUrl } from './art';

type Props = { name: string | undefined; size: 'card' | 'center' };

const sizes = { card: 'size-16 min-[400px]:size-20 sm:size-24', center: 'size-20 sm:size-28' };

/** Decorative scene. A missing scene renders nothing (and warns), so the layout has no empty column. */
export function MapScene({ name, size }: Props) {
  const url = name === undefined ? undefined : artUrl(name);
  useEffect(() => {
    if (name !== undefined && url === undefined) console.warn(`[falae] Cena "${name}" não existe.`);
  }, [name, url]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size === 'card' ? 96 : 112}
      height={size === 'card' ? 96 : 112}
      className={`${sizes[size]} shrink-0 self-end object-contain`}
    />
  );
}
