'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Emblem } from '@/components/brand/emblem';
import { cx } from '@/lib/cx';

type Phase = 'closed' | 'opening' | 'pulling' | 'dropping' | 'growing' | 'done';

/** Quando cada etapa começa (ms). */
const TIMELINE: [Phase, number][] = [
  ['opening', 500],
  ['pulling', 1150],
  ['dropping', 1950],
  ['growing', 2550],
  ['done', 3200],
];

/**
 * Convite como carta, centralizado na página:
 *   1. envelope fechado com o selo; 2. o selo some e a aba abre;
 *   3. o próprio convite sobe pela abertura (a parte de baixo continua dentro do bolso);
 *   4. o envelope desce e some; 5. o convite cresce até o tamanho final.
 * As camadas ficam no mesmo contexto de empilhamento (nenhum contêiner do envelope tem
 * transform/opacity), para o convite ficar entre o fundo e a frente do envelope.
 * Com "reduzir movimento", o convite aparece direto.
 */
export function InviteLetter({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const [fit, setFit] = useState<{ scale: number; envHeight: number } | null>(null);

  // Mede o convite e o envelope para o convite (reduzido) caber dentro do envelope; refaz a
  // medida se algum dos dois mudar de tamanho (fontes e estilos carregando, janela redimensionada).
  useLayoutEffect(() => {
    const card = cardRef.current;
    const envelope = envelopeRef.current;
    if (!card || !envelope) return;
    const measure = () => {
      if (
        !card.offsetWidth ||
        !card.offsetHeight ||
        !envelope.offsetWidth ||
        !envelope.offsetHeight
      )
        return;
      const scale = Math.min(
        (envelope.offsetWidth * 0.86) / card.offsetWidth,
        (envelope.offsetHeight * 0.86) / card.offsetHeight,
        1,
      );
      setFit({ scale, envHeight: envelope.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(envelope);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const skip = window.setTimeout(() => setPhase('done'), 0);
      return () => window.clearTimeout(skip);
    }
    const timers = TIMELINE.map(([next, at]) => window.setTimeout(() => setPhase(next), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const animating = phase !== 'done';
  const flapOpen = phase !== 'closed';
  const outOfEnvelope = phase === 'growing' || phase === 'done';
  const dropped = phase === 'dropping' || phase === 'growing';
  const drop = dropped ? 'translateY(75vh)' : 'translateY(0)';
  const layer: CSSProperties = { transform: drop, opacity: dropped ? 0 : 1 };

  let cardStyle: CSSProperties = { opacity: 0 };
  if (fit && !outOfEnvelope) {
    // Dentro do envelope: reduzido e um pouco abaixo do centro; ao puxar, sobe pela abertura.
    const lift =
      phase === 'pulling' || phase === 'dropping' ? -fit.envHeight * 0.62 : fit.envHeight * 0.04;
    cardStyle = { transform: `translateY(${lift}px) scale(${fit.scale})`, zIndex: 10 };
  } else if (outOfEnvelope) {
    cardStyle = { transform: 'translateY(0) scale(1)', zIndex: 30 };
  }

  const fade = 'transition-[transform,opacity] duration-[600ms] ease-in';

  return (
    <div className="relative flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center py-8">
      <div
        ref={cardRef}
        className={cx(
          'relative w-full max-w-xl',
          // Fechado: sem transição, o convite já começa reduzido dentro do envelope.
          phase !== 'closed' &&
            'transition-transform duration-[650ms] ease-[cubic-bezier(0.3,0.7,0.3,1)]',
        )}
        style={cardStyle}
        inert={animating}
      >
        {children}
      </div>

      {phase === 'done' ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div ref={envelopeRef} className="relative aspect-[3/2] w-[min(26rem,90vw)]">
            {/* Fundo (por dentro) do envelope: atrás do convite. */}
            <svg
              viewBox="0 0 300 200"
              className={`absolute inset-0 z-0 h-full w-full drop-shadow-2xl ${fade}`}
              style={layer}
            >
              <rect
                x="1"
                y="1"
                width="298"
                height="198"
                rx="10"
                fill="#2A0E14"
                stroke="#C2AEFF"
                strokeOpacity="0.45"
              />
            </svg>
            {/* Aba: fechada cobre o convite; aberta, gira para cima e fica atrás dele. */}
            <div
              className="absolute inset-x-0 top-0 h-[58%] origin-top transition-[transform,opacity] duration-500 ease-in-out"
              style={{
                transform: `${drop} perspective(1200px) rotateX(${flapOpen ? 180 : 0}deg)`,
                opacity: dropped ? 0 : 1,
                zIndex: flapOpen ? 5 : 25,
              }}
            >
              <svg viewBox="0 0 300 116" preserveAspectRatio="none" className="h-full w-full">
                <path
                  d="M1 10 Q1 1 10 1 L290 1 Q299 1 299 10 L150 116 Z"
                  fill="#6B3BC6"
                  stroke="#C2AEFF"
                  strokeOpacity="0.35"
                />
              </svg>
            </div>
            {/* Frente: laterais e bolso, na frente do convite. */}
            <svg
              viewBox="0 0 300 200"
              className={`absolute inset-0 z-20 h-full w-full ${fade}`}
              style={layer}
            >
              <path d="M1 12 Q1 1 12 1 L150 108 L12 199 Q1 199 1 188 Z" fill="#3D1520" />
              <path d="M299 12 Q299 1 288 1 L150 108 L288 199 Q299 199 299 188 Z" fill="#3D1520" />
              <path
                d="M1 188 L150 100 L299 188 Q299 199 288 199 L12 199 Q1 199 1 188 Z"
                fill="#4A1A24"
                stroke="#000"
                strokeOpacity="0.2"
              />
            </svg>
            {/* Selo de cera. */}
            <div
              className="absolute top-[58%] left-1/2 z-[26] flex h-14 w-14 items-center justify-center rounded-full border-2 border-wine-300/60 bg-wine-700 shadow-lg transition-[transform,opacity] duration-300"
              style={{
                transform: `translate(-50%, -50%) scale(${flapOpen ? 1.5 : 1})`,
                opacity: flapOpen ? 0 : 1,
              }}
            >
              <Emblem className="h-8 w-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
