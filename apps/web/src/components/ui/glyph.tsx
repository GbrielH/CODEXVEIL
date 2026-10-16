import { GLYPH_VIEWBOX, glyphs, type GlyphName } from '@codexveil/ui/glyphs';
import { cx } from '@/lib/cx';

interface GlyphProps {
  name: GlyphName;
  className?: string;
  title?: string;
}

/** Glifos temáticos próprios, no mesmo estilo de traço dos ícones Lucide. */
export function Glyph({ name, className, title }: GlyphProps) {
  return (
    <svg
      viewBox={GLYPH_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('h-5 w-5', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {glyphs[name].paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
