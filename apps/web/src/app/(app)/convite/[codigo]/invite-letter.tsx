'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Emblem } from '@/components/brand/emblem';
import { cx } from '@/lib/cx';

type Phase = 'closed' | 'opening' | 'rising' | 'done';

/**
 * Convite como carta: o envelope fechado aparece centralizado, o selo some, a aba abre, a
 * carta (o conteúdo) sobe e o envelope desaparece. Com "reduzir movimento", a carta aparece direto.
 */
export function InviteLetter({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('closed');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const skip = window.setTimeout(() => setPhase('done'), 0);
      return () => window.clearTimeout(skip);
    }
    const timers = [
      window.setTimeout(() => setPhase('opening'), 500),
      window.setTimeout(() => setPhase('rising'), 1300),
      window.setTimeout(() => setPhase('done'), 2300),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const showLetter = phase === 'rising' || phase === 'done';

  return (
    <div className="relative min-h-[30rem]">
      <div
        className={cx(
          'transition-all duration-700 ease-out',
          showLetter
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-10 scale-95 opacity-0',
        )}
        aria-hidden={!showLetter}
      >
        {children}
      </div>

      {phase === 'done' ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-40 flex justify-center"
        >
          <div
            className={cx(
              'relative aspect-[3/2] w-[min(24rem,92%)] transition-all duration-700 ease-in [perspective:1200px]',
              phase === 'rising' ? 'translate-y-16 opacity-0' : 'translate-y-0 opacity-100',
            )}
          >
            {/* Fundo do envelope. */}
            <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full drop-shadow-2xl">
              <rect
                x="1"
                y="1"
                width="298"
                height="198"
                rx="10"
                fill="#2A0E14"
                stroke="#C9828E"
                strokeOpacity="0.45"
              />
            </svg>
            {/* Carta de pergaminho: sobe de dentro do envelope quando a aba abre. */}
            <div
              className={cx(
                'parchment absolute inset-x-[8%] top-[6%] h-[80%] rounded-sm shadow-md transition-transform delay-300 duration-500 ease-out',
                phase === 'closed' ? 'translate-y-0' : '-translate-y-[45%]',
              )}
            >
              <div className="mx-auto mt-[8%] h-1.5 w-1/2 rounded bg-black/15" />
              <div className="mx-auto mt-2 h-1 w-2/3 rounded bg-black/10" />
              <div className="mx-auto mt-1.5 h-1 w-3/5 rounded bg-black/10" />
            </div>
            {/* Frente do envelope (laterais e bolso), na frente da carta. */}
            <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full">
              <path d="M1 12 Q1 1 12 1 L150 108 L12 199 Q1 199 1 188 Z" fill="#3D1520" />
              <path d="M299 12 Q299 1 288 1 L150 108 L288 199 Q299 199 299 188 Z" fill="#3D1520" />
              <path
                d="M1 188 L150 100 L299 188 Q299 199 288 199 L12 199 Q1 199 1 188 Z"
                fill="#4A1A24"
                stroke="#000"
                strokeOpacity="0.2"
              />
            </svg>
            {/* Aba: gira para trás a partir da borda de cima e fica atrás da carta. */}
            <div
              className={cx(
                'absolute inset-x-0 top-0 h-[58%] origin-top transition-transform duration-500 ease-in-out',
                phase === 'closed' ? 'z-10' : '-z-10',
              )}
              style={{ transform: phase === 'closed' ? 'rotateX(0deg)' : 'rotateX(180deg)' }}
            >
              <svg viewBox="0 0 300 116" preserveAspectRatio="none" className="h-full w-full">
                <path
                  d="M1 10 Q1 1 10 1 L290 1 Q299 1 299 10 L150 116 Z"
                  fill="#571F2B"
                  stroke="#C9828E"
                  strokeOpacity="0.35"
                />
              </svg>
            </div>
            {/* Selo de cera. */}
            <div
              className={cx(
                'absolute top-[58%] left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-wine-300/60 bg-wine-700 shadow-lg transition-all duration-300',
                phase === 'closed' ? 'scale-100 opacity-100' : 'scale-150 opacity-0',
              )}
            >
              <Emblem className="h-8 w-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
