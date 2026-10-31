import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Posições dos fantasminhas em volta do painel (cada um flutua num ritmo próprio). */
const GHOSTS = [
  { className: '-top-5 -left-3 h-12', delay: '0s' },
  { className: '-top-6 right-6 h-10', delay: '0.8s' },
  { className: '-bottom-3 -right-3 h-11', delay: '1.5s' },
] as const;

/**
 * Personagem morto ou morrendo (vida em zero): fantasminhas em pixel art flutuando em volta do
 * painel, em loop, até a vida voltar. Vale para todos os sistemas.
 */
export function GhostAura({
  active,
  count = 3,
  children,
  className,
}: {
  active: boolean;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      {children}
      {active
        ? GHOSTS.slice(0, count).map((ghost) => (
            // eslint-disable-next-line @next/next/no-img-element -- animação pequena e estática do public
            <img
              key={ghost.delay}
              src="/efeitos/fantasma.webp"
              alt=""
              aria-hidden="true"
              className={cx(
                'codex-ghost pointer-events-none absolute z-10 w-auto drop-shadow-[0_0_8px_rgb(220_220_255/0.5)]',
                ghost.className,
              )}
              style={{ animationDelay: ghost.delay }}
            />
          ))
        : null}
      {active ? <span className="sr-only">Personagem morto ou morrendo.</span> : null}
    </div>
  );
}

/** Vida zerada a partir dos recursos do personagem (o recurso de exibição "health"). */
export function isDown(
  resources: readonly { display: string; current: number; max: number | null }[],
) {
  const health = resources.find((resource) => resource.display === 'health');
  return Boolean(health && (health.max ?? 0) > 0 && health.current <= 0);
}
