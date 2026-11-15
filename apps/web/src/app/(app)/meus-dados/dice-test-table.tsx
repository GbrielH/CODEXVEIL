'use client';

import type DiceBox from '@3d-dice/dice-box-threejs';
import { useEffect, useId, useRef, useState } from 'react';
import { throwDice } from '@/components/dice/dice-scene';
import { applyDiceLook, type DiceAppearance } from '@/components/dice/dice-look';
import { textColorFor } from '@/components/dice/dice-tray';

/** Pedido de rolagem de teste: o dado como está no editor (mesmo sem salvar). */
export interface TestRoll {
  key: number;
  color: string;
  look: DiceAppearance;
  /** Resultado do d20 (20 = crítico, com o efeito da aura). */
  natural: number;
}

/**
 * Mesa de dados de teste em "Meus dados": rola um d20 de verdade, em 3D, com o dado em edição
 * (desenho, cores, fonte e aura), do mesmo jeito que ele cai na mesa da campanha.
 */
export function DiceTestTable({ request }: { request: TestRoll | null }) {
  const containerId = `mesa-teste-${useId().replace(/:/g, '')}`;
  const boxRef = useRef<DiceBox | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [result, setResult] = useState<{ key: number; natural: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const off = window.setTimeout(() => setUnavailable(true), 0);
      return () => window.clearTimeout(off);
    }
    let cancelled = false;
    void import('@3d-dice/dice-box-threejs')
      .then(async ({ default: Box }) => {
        if (cancelled) return;
        const box = new Box(`#${containerId}`, {
          sounds: false,
          shadows: true,
          theme_material: 'plastic',
          gravity_multiplier: 400,
          baseScale: 90,
          strength: 1.4,
          light_intensity: 0.9,
        });
        await box.initialize();
        if (!cancelled) boxRef.current = box;
      })
      .catch((error: unknown) => {
        console.error('[codexveil] mesa de teste indisponível', error);
        setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [containerId]);

  useEffect(() => {
    if (!request) return;
    let active = true;
    void (async () => {
      // A cena 3D pode ainda estar carregando: espera até 3 s.
      for (let waited = 0; !boxRef.current && waited < 3000; waited += 200)
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      const box = boxRef.current;
      if (!box || !active) return;
      setResult(null);
      try {
        await applyDiceLook(box, 'teste', request.color, textColorFor(request.color), request.look);
        await throwDice(box, `1d20@${request.natural}`, 8000, {
          aura: request.look.aura,
          critical: request.natural === 20,
        });
        if (active) setResult({ key: request.key, natural: request.natural });
      } catch (error) {
        console.error('[codexveil] falha na rolagem de teste', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [request]);

  if (unavailable) {
    return (
      <p className="rounded-lg border border-line p-4 text-sm text-fg-muted">
        A mesa 3D fica desligada com &quot;movimento reduzido&quot;.
      </p>
    );
  }
  return (
    <div className="relative h-72 overflow-hidden rounded-xl border border-parchment-400/25 bg-[radial-gradient(ellipse_at_center,rgb(60_30_90/0.55),rgb(11_11_15/0.95))] shadow-inner">
      <div
        id={containerId}
        aria-hidden="true"
        className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
      />
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3 text-center"
      >
        {result && result.key === request?.key ? (
          <span className="font-display text-3xl text-white">{result.natural}</span>
        ) : (
          <span className="text-xs text-white/60">
            {request ? 'Rolando…' : 'Clique em "Testar rolagem" para jogar o dado aqui.'}
          </span>
        )}
      </div>
    </div>
  );
}
