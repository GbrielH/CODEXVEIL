import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import {
  Binary,
  Brush,
  CloudLightning,
  Coins,
  Cog,
  Droplet,
  Eye,
  Fish,
  Flame,
  Ghost,
  Hourglass,
  Skull,
  Snowflake,
  Spade,
  Sparkles,
  Sun,
  Trees,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { cx } from '@/lib/cx';

/** Sapo com coroa (a biblioteca de ícones não tem sapo). */
function FrogIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M9 4.5 10 3l2 1.2L14 3l1 1.5" />
      <circle cx="7.5" cy="9" r="2.5" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M5 10.5C3.2 12 3 14.5 4 16.5 5.5 19.5 9 20.5 12 20.5s6.5-1 8-4c1-2 .8-4.5-1-6" />
      <path d="M8.5 15.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" />
    </svg>
  );
}

const ICONS: Record<DiceAura, ComponentType<LucideProps>> = {
  blood: Droplet,
  storm: CloudLightning,
  frost: Snowflake,
  arcane: Sparkles,
  shadow: Ghost,
  holy: Sun,
  gears: Cog,
  forest: Trees,
  fire: Flame,
  skeleton: Skull,
  cosmic: Eye,
  tarot: Spade,
  glitch: Binary,
  ink: Brush,
  abyss: Fish,
  time: Hourglass,
  gold: Coins,
  frog: FrogIcon,
};

/** Ícone da aura, na cor dela e com um leve brilho. */
export function AuraIcon({ aura, className }: { aura: DiceAura; className?: string }) {
  const Icon = ICONS[aura];
  const color = diceAuraLabels[aura].color;
  return (
    <Icon
      aria-hidden="true"
      className={cx('h-4 w-4 shrink-0', className)}
      style={{ color, filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
}
