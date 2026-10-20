import { initialsOf } from '@/components/ui/avatar';
import { cx } from '@/lib/cx';

const sizes = {
  sm: 'h-12 w-12 text-sm',
  md: 'h-16 w-16 text-lg',
  lg: 'h-28 w-24 text-3xl sm:h-32 sm:w-28',
} as const;

interface PortraitProps {
  name: string;
  url: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

/** Retrato do personagem em moldura de arco, ou iniciais quando não há imagem. */
export function Portrait({ name, url, size = 'md', className }: PortraitProps) {
  const classes = cx(
    'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-t-[999px] rounded-b-md border border-parchment-400/40 bg-wine-950 shadow-card',
    sizes[size],
    className,
  );
  if (url) {
    return (
      <span className={classes}>
        {/* URL assinada de curta duração do Storage privado; o nome aparece ao lado. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={cx(classes, 'font-display font-semibold text-parchment-300')}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
