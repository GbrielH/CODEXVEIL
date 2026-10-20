import { defaultEmblemColors, EMBLEM_VIEWBOX, emblemPaths } from '@codexveil/ui/brand';
import { cx } from '@/lib/cx';

interface EmblemProps {
  className?: string;
  /** Texto alternativo; omita quando o emblema é decorativo (ao lado do nome). */
  title?: string;
}

/** Emblema do Codexveil: o véu (arco ogival) que se abre sobre o códex. */
export function Emblem({ className, title }: EmblemProps) {
  const c = defaultEmblemColors;
  return (
    <svg
      viewBox={EMBLEM_VIEWBOX}
      className={cx('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d={emblemPaths.arch}
        fill={c.veil}
        stroke={c.outline}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d={emblemPaths.opening} fill={c.opening} />
      <path d={emblemPaths.star} fill={c.star} />
      <path d={emblemPaths.bookLeft} fill={c.pages} />
      <path d={emblemPaths.bookRight} fill={c.pages} />
      <path d={emblemPaths.spine} stroke={c.spine} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const wordmarkSizes = {
  sm: { emblem: 'h-7 w-7', text: 'text-base' },
  md: { emblem: 'h-9 w-9', text: 'text-xl' },
  lg: { emblem: 'h-14 w-14', text: 'text-3xl' },
} as const;

/** Logotipo tipográfico: emblema + nome em capitulares romanas (Cinzel). */
export function Wordmark({ className, size = 'md' }: WordmarkProps) {
  const s = wordmarkSizes[size];
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <Emblem className={s.emblem} />
      <span
        className={cx(
          'font-display font-semibold uppercase tracking-[0.18em] text-fg-accent',
          s.text,
        )}
      >
        Codexveil
      </span>
    </span>
  );
}
