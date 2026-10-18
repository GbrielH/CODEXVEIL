import type { CSSProperties } from 'react';

/** Brasas fixas (posições determinísticas para o servidor e o navegador renderizarem igual). */
const EMBERS = [
  { left: 6, size: 3, duration: 17, delay: 0, drift: 30, opacity: 0.35 },
  { left: 14, size: 2, duration: 22, delay: 6, drift: -20, opacity: 0.25 },
  { left: 23, size: 4, duration: 19, delay: 11, drift: 40, opacity: 0.3 },
  { left: 37, size: 2, duration: 24, delay: 3, drift: -35, opacity: 0.2 },
  { left: 48, size: 3, duration: 18, delay: 14, drift: 25, opacity: 0.3 },
  { left: 59, size: 2, duration: 21, delay: 8, drift: -15, opacity: 0.25 },
  { left: 68, size: 4, duration: 16, delay: 2, drift: 30, opacity: 0.3 },
  { left: 77, size: 2, duration: 23, delay: 12, drift: -25, opacity: 0.2 },
  { left: 86, size: 3, duration: 20, delay: 5, drift: 20, opacity: 0.3 },
  { left: 94, size: 2, duration: 25, delay: 9, drift: -30, opacity: 0.25 },
] as const;

/**
 * Brasas subindo bem devagar no fundo das áreas autenticadas: discretas, atrás do conteúdo e
 * sem capturar cliques. Somem com movimento reduzido.
 */
export function EmberField() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {EMBERS.map((ember) => (
        <span
          key={ember.left}
          className="ember"
          style={
            {
              left: `${ember.left}%`,
              width: ember.size * 2,
              height: ember.size * 2,
              '--ember-duration': `${ember.duration}s`,
              '--ember-delay': `${ember.delay}s`,
              '--ember-drift': `${ember.drift}px`,
              '--ember-opacity': ember.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
