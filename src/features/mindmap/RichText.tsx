import type { RichSegment } from '../../domain/mindmap/richText';

type Props = { segments: readonly RichSegment[]; boldClassName?: string };

/** Renders parsed `**bold**` segments as <strong> (no HTML injection). */
export function RichText({ segments, boldClassName = '' }: Props) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <strong key={i} className={boldClassName}>
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
