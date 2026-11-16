'use client';

import type DiceBox from '@3d-dice/dice-box-threejs';
import { Minus, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { throwDice } from '@/components/dice/dice-scene';
import { applyDiceLook, type DiceAppearance } from '@/components/dice/dice-look';
import { textColorFor } from '@/components/dice/dice-tray';
import { Button } from '@/components/ui/button';
import { cx } from '@/lib/cx';

const SIDES = [4, 6, 8, 10, 12, 20] as const;
type Sides = (typeof SIDES)[number];
/** Quantos dados cabem numa rolagem de teste. */
const MAX_DICE = 10;
const START: Record<Sides, number> = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 1 };

interface TestRoll {
  key: number;
  color: string;
  look: DiceAppearance;
  notation: string;
  critical: boolean;
  fumble: boolean;
  results: { sides: Sides; value: number }[];
}

/**
 * Mesa de dados de teste em "Meus dados": monte a rolagem (d4 a d20) e role de verdade, em 3D,
 * com o dado em edição (desenho, cores, fonte e aura), como ele cai na mesa da campanha.
 * `getLook` lê o editor na hora (mesmo sem salvar).
 */
export function DiceTestTable({
  getLook,
}: {
  getLook: () => { color: string; look: DiceAppearance };
}) {
  const containerId = `mesa-teste-${useId().replace(/:/g, '')}`;
  const boxRef = useRef<DiceBox | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [counts, setCounts] = useState<Record<Sides, number>>(START);
  const [request, setRequest] = useState<TestRoll | null>(null);
  const [doneKey, setDoneKey] = useState<number | null>(null);
  const total = SIDES.reduce((sum, sides) => sum + counts[sides], 0);

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
      try {
        await applyDiceLook(box, 'teste', request.color, textColorFor(request.color), request.look);
        await throwDice(box, request.notation, 8000, {
          aura: request.look.aura,
          critical: request.critical,
          fumble: request.fumble,
        });
        if (active) setDoneKey(request.key);
      } catch (error) {
        console.error('[codexveil] falha na rolagem de teste', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [request]);

  const change = (sides: Sides, delta: number) =>
    setCounts((current) => {
      const next = Math.max(0, current[sides] + delta);
      if (delta > 0 && total >= MAX_DICE) return current;
      return { ...current, [sides]: next };
    });

  /** Sorteia os valores e manda a rolagem para a mesa. `force` garante esse valor num d20. */
  const roll = (force: 20 | 1 | null) => {
    const chosen = { ...counts };
    if (force && chosen[20] === 0) chosen[20] = 1;
    if (SIDES.every((sides) => chosen[sides] === 0)) chosen[20] = 1;
    const results: TestRoll['results'] = [];
    for (const sides of SIDES)
      for (let i = 0; i < chosen[sides]; i++)
        results.push({ sides, value: 1 + Math.floor(Math.random() * sides) });
    const firstD20 = results.find((die) => die.sides === 20);
    if (force && firstD20) firstD20.value = force;
    const groups = SIDES.filter((sides) => chosen[sides] > 0).map(
      (sides) => `${chosen[sides]}d${sides}`,
    );
    setRequest({
      key: Date.now(),
      ...getLook(),
      notation: `${groups.join('+')}@${results.map((die) => die.value).join(',')}`,
      critical: results.some((die) => die.sides === 20 && die.value === 20),
      fumble:
        !results.some((die) => die.sides === 20 && die.value === 20) &&
        results.some((die) => die.sides === 20 && die.value === 1),
      results,
    });
  };

  const done = request && doneKey === request.key;
  const sum = request?.results.reduce((acc, die) => acc + die.value, 0) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {SIDES.map((sides) => (
          <span
            key={sides}
            className={cx(
              'flex h-9 items-center overflow-hidden rounded-md border text-sm',
              counts[sides] ? 'border-fg-brand bg-hover text-fg' : 'border-line text-fg-secondary',
            )}
          >
            <button
              type="button"
              onClick={() => change(sides, 1)}
              disabled={total >= MAX_DICE}
              aria-label={`Adicionar um d${sides}`}
              className="h-full px-2.5 hover:bg-hover disabled:opacity-50"
            >
              {counts[sides] ? `${counts[sides]}× ` : ''}d{sides}
            </button>
            {counts[sides] ? (
              <button
                type="button"
                onClick={() => change(sides, -1)}
                aria-label={`Tirar um d${sides}`}
                className="h-full border-l border-line px-1.5 hover:bg-hover"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setCounts(START)}
          aria-label="Voltar para 1d20"
          className="flex h-9 items-center rounded-md px-2 text-fg-muted hover:bg-hover"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => roll(null)} disabled={unavailable}>
          Testar rolagem
        </Button>
        <Button size="sm" variant="secondary" onClick={() => roll(20)} disabled={unavailable}>
          Rolar um 20
        </Button>
        <Button size="sm" variant="secondary" onClick={() => roll(1)} disabled={unavailable}>
          Rolar um 1
        </Button>
      </div>
      {unavailable ? (
        <p className="rounded-lg border border-line p-4 text-sm text-fg-muted">
          A mesa 3D fica desligada com &quot;movimento reduzido&quot;.
        </p>
      ) : (
        <div className="relative h-72 overflow-hidden rounded-xl border border-parchment-400/25 bg-[radial-gradient(ellipse_at_center,rgb(60_30_90/0.55),rgb(11_11_15/0.95))] shadow-inner">
          <div
            id={containerId}
            aria-hidden="true"
            className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"
          />
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3 text-center"
          >
            {done && request ? (
              <>
                <span className="font-display text-3xl text-white">{sum}</span>
                <span className="text-xs text-white/70">
                  {SIDES.filter((sides) => request.results.some((die) => die.sides === sides))
                    .map(
                      (sides) =>
                        `d${sides}: ${request.results
                          .filter((die) => die.sides === sides)
                          .map((die) => die.value)
                          .join(', ')}`,
                    )
                    .join(' · ')}
                </span>
              </>
            ) : (
              <span className="text-xs text-white/60">
                {request ? 'Rolando…' : 'Escolha os dados e clique em "Testar rolagem".'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
