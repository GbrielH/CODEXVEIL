import { diceAuraLabels, type DiceAura } from '@codexveil/validation';
import {
  Anchor,
  Binary,
  Cpu,
  FlaskRound,
  Footprints,
  Hand,
  Moon,
  Shell,
  Sword,
  Wind,
  Cat,
  FlaskConical,
  Music,
  PartyPopper,
  Rainbow,
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

/** Morcego (a biblioteca de ícones não tem). */
function BatIcon({ className, ...props }: LucideProps) {
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
      <path d="M12 9.5 10.5 7.5 10 10c-2-2.5-5-3.5-8-3 1.5 1 2 2.5 2 4 1.5-.5 3 0 4 1 .8-.7 2-.6 2.5.3L12 14l1.5-1.7c.5-.9 1.7-1 2.5-.3 1-1 2.5-1.5 4-1 0-1.5.5-3 2-4-3-.5-6 .5-8 3l-.5-2.5z" />
    </svg>
  );
}

/** Meteoro com rastro. */
function MeteorIcon({ className, ...props }: LucideProps) {
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
      <circle cx="15.5" cy="15.5" r="4.5" />
      <path d="M12.3 12.3 4 4M11 15 6 10M15 11l-5-5" />
    </svg>
  );
}

/** Pentagrama no círculo. */
function PentagramIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 3.5 17 19 4 9.5h16L7 19z" />
    </svg>
  );
}

/** Três arranhões de garra. */
function ClawIcon({ className, ...props }: LucideProps) {
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
      <path d="M5 3c3 4 5 9 5 16M10 2c3 4 5 9 5 17M15 3c3 4 4 9 4 15" />
    </svg>
  );
}

const GhostIcon = Ghost;

/** Lobo uivando. */
function WolfIcon({ className, ...props }: LucideProps) {
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
      <path d="M4 20h14M7 20l1-6 4-2 2-5 1-4 2 3-1 3 2 2-2 1-2 4v4" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  );
}

/** Abelha. */
function BeeIcon({ className, ...props }: LucideProps) {
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
      <ellipse cx="12" cy="14" rx="5" ry="6" />
      <path d="M7.5 12h9M7.5 16h9M10 8.5C8 5 5 5 4 7s1 4 4 3M14 8.5C16 5 19 5 20 7s-1 4-4 3" />
    </svg>
  );
}

const ICONS: Record<DiceAura, ComponentType<LucideProps>> = {
  blood: Droplet,
  storm: CloudLightning,
  frost: Snowflake,
  arcane: Sparkles,
  shadow: Moon,
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
  vampire: BatIcon,
  bard: Music,
  rainbow: Rainbow,
  poison: FlaskConical,
  cat: Cat,
  meteor: MeteorIcon,
  party: PartyPopper,
  wind: Wind,
  ritual: PentagramIcon,
  claw: ClawIcon,
  necro: Hand,
  pirate: Anchor,
  samurai: Sword,
  kaiju: Footprints,
  cyber: Cpu,
  werewolf: WolfIcon,
  siren: Shell,
  alchemy: FlaskRound,
  ghost: GhostIcon,
  bees: BeeIcon,
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
