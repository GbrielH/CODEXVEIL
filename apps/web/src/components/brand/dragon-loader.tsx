import { characterIcons } from '@codexveil/ui/character-icons';
import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/** Chamas do sopro: atraso, distância final (x, y) e cor, do núcleo quente às pontas vinho. */
const FLAMES = [
  { delay: 0, x: 380, y: -40, color: 'var(--color-amber-300)' },
  { delay: 0.18, x: 430, y: 30, color: 'var(--color-ember-400)' },
  { delay: 0.36, x: 400, y: -10, color: 'var(--color-amber-400)' },
  { delay: 0.54, x: 450, y: 45, color: 'var(--color-ember-300)' },
  { delay: 0.72, x: 410, y: -55, color: 'var(--color-wine-400)' },
  { delay: 0.9, x: 440, y: 10, color: 'var(--color-ember-400)' },
  { delay: 1.08, x: 390, y: 50, color: 'var(--color-amber-300)' },
  { delay: 1.26, x: 460, y: -25, color: 'var(--color-wine-300)' },
] as const;

/** Lágrima de fogo apontando para a direita, com a ponta fina na boca do dragão. */
const FLAME_PATH = 'M0 0C22 -10 48 -30 80 -20C102 -12 104 8 82 18C50 30 22 10 0 0Z';
const HEAD = characterIcons.species.dragonborn?.d ?? '';

/**
 * Carregamento temático: um dragão minimalista (silhueta do game-icons.net, CC BY 3.0) soprando
 * fogo em chamas que crescem, esfriam de âmbar para vinho e somem. Sem animação quando a pessoa
 * prefere movimento reduzido.
 */
export function DragonLoader({
  label = 'Carregando…',
  size = 'md',
  className,
}: {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx(
        'flex flex-col items-center justify-center gap-3 py-10 text-fg-secondary',
        className,
      )}
    >
      <svg
        viewBox="0 0 1000 512"
        aria-hidden="true"
        className={cx(
          'dragon-loader overflow-visible',
          size === 'sm' ? 'w-28' : size === 'lg' ? 'w-72' : 'w-48',
        )}
      >
        <ellipse
          className="dragon-glow"
          cx="660"
          cy="335"
          rx="300"
          ry="80"
          fill="var(--color-amber-400)"
        />
        <g transform="translate(440 332)">
          {FLAMES.map((flame) => (
            <path
              key={flame.delay}
              className="dragon-flame"
              d={FLAME_PATH}
              fill={flame.color}
              style={
                {
                  '--delay': `${flame.delay}s`,
                  '--fx': `${flame.x}px`,
                  '--fy': `${flame.y}px`,
                } as CSSProperties
              }
            />
          ))}
        </g>
        <path className="dragon-head" d={HEAD} fill="var(--color-fg-accent)" />
      </svg>
      <span className="dragon-label font-display text-sm tracking-[0.18em] uppercase">{label}</span>
    </div>
  );
}
