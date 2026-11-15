import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/**
 * Aura ao redor do dado (somente contas de criador). Camadas em CSS atrás do dado: pulso de
 * sangue, clarões de tempestade, névoa de gelo, anel arcano, fumaça de sombra e raios sagrados.
 * Com movimento reduzido, a aura fica parada (só o brilho).
 */
export function DiceAuraLayer({ aura, className }: { aura: DiceAura | null; className?: string }) {
  if (!aura) return null;
  return (
    <div
      aria-hidden="true"
      data-aura={aura}
      className={cx('dice-aura pointer-events-none absolute inset-0', className)}
      style={{ '--aura': diceAuraLabels[aura].color } as CSSProperties}
    >
      <span className="dice-aura-glow" />
      <span className="dice-aura-ring" />
      <span className="dice-aura-sparks" />
    </div>
  );
}
