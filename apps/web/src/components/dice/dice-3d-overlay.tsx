'use client';

import type DiceBox from '@3d-dice/dice-box-threejs';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dados 3D na tela inteira com um resultado já sorteado (notação "4d6+4d6@3,5,…"), fora da mesa
 * de uma campanha (ex.: atributos na criação do personagem). Chama `onDone` quando os dados
 * param; sem WebGL ou com animações reduzidas, chama na hora.
 */
export function Dice3DOverlay({ notation, onDone }: { notation: string; onDone: () => void }) {
  const containerId = `dados-3d-${useId().replace(/:/g, '')}`;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current();
      return;
    }
    let cancelled = false;
    let box: DiceBox | null = null;
    void import('@3d-dice/dice-box-threejs')
      .then(async ({ default: Box }) => {
        if (cancelled) return;
        box = new Box(`#${containerId}`, {
          sounds: false,
          shadows: false,
          theme_material: 'plastic',
          theme_customColorset: {
            name: 'cv-criacao',
            background: '#6b3bc6',
            foreground: '#ffffff',
            outline: '#000000',
            texture: 'none',
            material: 'plastic',
          },
          gravity_multiplier: 400,
          baseScale: 70,
          strength: 1.2,
          light_intensity: 0.9,
        });
        await box.initialize();
        if (cancelled) return;
        await box.roll(notation);
        // Um instante para ler os dados parados.
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      })
      .catch((error: unknown) => console.error('[codexveil] dados 3D indisponíveis', error))
      .finally(() => {
        if (!cancelled) done.current();
      });
    return () => {
      cancelled = true;
    };
  }, [containerId, notation]);

  return createPortal(
    <div
      id={containerId}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] [&>canvas]:h-full [&>canvas]:w-full"
    />,
    document.body,
  );
}
