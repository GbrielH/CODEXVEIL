'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';
import type { ShownRoll } from './dice-roller';

/** Limite de dados animados ao mesmo tempo (o resto entra só no total), para não travar. */
export const MAX_THROWN_DICE = 6;
const SPIN_MS = 900;
const VISIBLE_MS = 2300;

/** Contorno do dado (vista de cima), por número de lados. */
function diePoints(sides: number): string {
  switch (sides) {
    case 4:
      return '50,6 94,88 6,88';
    case 6:
      return '12,12 88,12 88,88 12,88';
    case 8:
      return '50,4 94,50 50,96 6,50';
    case 10:
    case 100:
      return '50,4 92,40 50,96 8,40';
    case 12:
      return '50,4 94,36 77,92 23,92 6,36';
    default:
      return '50,3 91,26 91,74 50,97 9,74 9,26';
  }
}

interface Thrown {
  sides: number;
  value: number;
  kept: boolean;
}

function thrownDice(roll: ShownRoll): Thrown[] {
  const list: Thrown[] = [];
  for (const group of roll.dice) {
    const kept = [...group.kept];
    for (const value of group.values) {
      const index = kept.indexOf(value);
      if (index >= 0) kept.splice(index, 1);
      list.push({ sides: group.sides, value, kept: index >= 0 });
    }
  }
  return list.slice(0, MAX_THROWN_DICE);
}

function Die({ die, index, natural }: { die: Thrown; index: number; natural: 'crit' | 'fumble' | null }) {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * die.sides));
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const spin = window.setInterval(() => setFace(1 + Math.floor(Math.random() * die.sides)), 70);
    const stop = window.setTimeout(
      () => {
        window.clearInterval(spin);
        setFace(die.value);
        setLanded(true);
      },
      SPIN_MS + index * 90,
    );
    return () => {
      window.clearInterval(spin);
      window.clearTimeout(stop);
    };
  }, [die, index]);

  return (
    <div
      className={cx('animate-die-throw relative h-24 w-24 sm:h-32 sm:w-32', !die.kept && landed && 'opacity-40')}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)]" aria-hidden="true">
        <polygon
          points={diePoints(die.sides)}
          strokeLinejoin="round"
          strokeWidth="4"
          className={cx(
            natural === 'crit' && landed ? 'fill-verdigris-900 stroke-verdigris-300' : natural === 'fumble' && landed ? 'fill-ember-900 stroke-ember-300' : 'fill-wine-800 stroke-parchment-300',
          )}
        />
      </svg>
      <span className={cx('tabular absolute inset-0 flex items-center justify-center font-display text-4xl text-parchment-200 sm:text-5xl', landed && 'animate-pop')}>{face}</span>
      <span className="absolute -bottom-5 left-0 right-0 text-center text-xs text-fg-muted">d{die.sides}</span>
    </div>
  );
}

/**
 * Dados grandes caindo e girando no meio da tela (sem caixa). Mostra até `MAX_THROWN_DICE`
 * dados; some sozinho e não bloqueia cliques.
 */
export function DiceThrow({ roll, onDone }: { roll: ShownRoll & { key: number }; onDone: () => void }) {
  const dice = thrownDice(roll);
  const extra = roll.dice.reduce((sum, group) => sum + group.values.length, 0) - dice.length;
  const d20 = roll.dice.find((group) => group.sides === 20 && group.kept.length === 1);
  const natural = d20?.kept[0] === 20 ? 'crit' : d20?.kept[0] === 1 ? 'fumble' : null;
  const [showTotal, setShowTotal] = useState(false);

  useEffect(() => {
    const total = window.setTimeout(() => setShowTotal(true), SPIN_MS + dice.length * 90);
    const done = window.setTimeout(onDone, VISIBLE_MS + dice.length * 90);
    return () => {
      window.clearTimeout(total);
      window.clearTimeout(done);
    };
  }, [roll.key, dice.length, onDone]);

  if (dice.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8" aria-hidden="true">
      <div className="flex max-w-[90vw] flex-wrap items-center justify-center gap-6">
        {dice.map((die, index) => (
          <Die key={`${roll.key}-${index}`} die={die} index={index} natural={natural} />
        ))}
      </div>
      {showTotal ? (
        <div className="animate-pop rounded-full bg-black/55 px-5 py-2 text-center backdrop-blur-sm">
          <span className="font-display text-3xl text-fg-accent">{roll.total}</span>
          {roll.label ? <span className="ml-2 text-sm text-fg-secondary">{roll.label}</span> : null}
          {extra > 0 ? <span className="ml-2 text-xs text-fg-muted">(+{extra} dados)</span> : null}
        </div>
      ) : null}
    </div>
  );
}
