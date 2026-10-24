import type { AvatarIcon } from '@codexveil/validation';
import type { ReactNode } from 'react';

/*
 * Retratos de perfil por classe, no estilo do emblema do Codexveil: silhueta escura sobre um
 * círculo vinho com brilhos de pergaminho. Ficam no código (nada no banco além da escolha).
 */

const SIL = '#07070a';
const EDGE = '#d9c3a5';
const WINE = '#7a1f2b';

/** Capuz com rosto na sombra (base de várias silhuetas). */
const hood = (
  <>
    <path d="M18 60c0-14 5-24 14-24s14 10 14 24z" fill={SIL} />
    <path
      d="M32 12c-9 0-15 8-15 18 0 6 2 10 5 13h20c3-3 5-7 5-13 0-10-6-18-15-18z"
      fill={SIL}
      stroke={EDGE}
      strokeWidth="0.8"
    />
    <path d="M32 21c-5 0-8 5-8 11 0 4 2 7 4 9h8c2-2 4-5 4-9 0-6-3-11-8-11z" fill="#000" />
  </>
);

/** Cabeça e ombros simples. */
const bust = (
  <>
    <path d="M16 60c0-13 7-21 16-21s16 8 16 21z" fill={SIL} />
    <circle cx="32" cy="27" r="9" fill={SIL} stroke={EDGE} strokeWidth="0.6" />
  </>
);

const spark = (x: number, y: number, s = 2.2) => (
  <path
    d={`M${x} ${y - s * 2}L${x + s * 0.5} ${y - s * 0.5}L${x + s * 2} ${y}L${x + s * 0.5} ${y + s * 0.5}L${x} ${y + s * 2}L${x - s * 0.5} ${y + s * 0.5}L${x - s * 2} ${y}L${x - s * 0.5} ${y - s * 0.5}z`}
    fill={EDGE}
  />
);

export const AVATAR_ICON_ART: Record<AvatarIcon, { label: string; art: ReactNode }> = {
  barbaro: {
    label: 'Bárbaro',
    art: (
      <>
        {bust}
        <path d="M23 23c-4-2-6-6-5-10 2 3 4 5 7 6zM41 23c4-2 6-6 5-10-2 3-4 5-7 6z" fill={EDGE} />
        <path
          d="M46 34l6 22M44 36c4-4 9-3 11 0-3 1-6 3-8 6z"
          stroke={EDGE}
          strokeWidth="1.6"
          fill={SIL}
        />
      </>
    ),
  },
  bardo: {
    label: 'Bardo',
    art: (
      <>
        {bust}
        <path d="M22 21c2-4 8-6 14-4l6-4-2 6" fill={SIL} stroke={EDGE} strokeWidth="0.8" />
        <ellipse cx="42" cy="50" rx="6" ry="7" fill={SIL} stroke={EDGE} strokeWidth="1" />
        <path d="M42 43l6-14" stroke={EDGE} strokeWidth="1.6" />
        <circle cx="42" cy="50" r="1.5" fill={EDGE} />
      </>
    ),
  },
  clerigo: {
    label: 'Clérigo',
    art: (
      <>
        {hood}
        <circle cx="32" cy="50" r="5" fill="none" stroke={EDGE} strokeWidth="1.2" />
        <path d="M32 45v10M27 50h10" stroke={EDGE} strokeWidth="1.2" />
      </>
    ),
  },
  druida: {
    label: 'Druida',
    art: (
      <>
        {hood}
        <path
          d="M24 16c-3-4-3-8-1-11M24 12l-4-2M40 16c3-4 3-8 1-11M40 12l4-2"
          stroke={EDGE}
          strokeWidth="1.4"
          fill="none"
        />
        <path d="M30 52c0-4 2-7 6-8-1 4-2 7-6 8z" fill={EDGE} />
      </>
    ),
  },
  guerreiro: {
    label: 'Guerreiro',
    art: (
      <>
        <path d="M16 60c0-13 7-21 16-21s16 8 16 21z" fill={SIL} />
        <path d="M23 30c0-8 4-13 9-13s9 5 9 13v6H23z" fill={SIL} stroke={EDGE} strokeWidth="0.9" />
        <path d="M24 28h16M32 18v6" stroke={EDGE} strokeWidth="1" />
        <path d="M48 18v32M44 44h8" stroke={EDGE} strokeWidth="1.8" />
      </>
    ),
  },
  monge: {
    label: 'Monge',
    art: (
      <>
        {bust}
        <circle
          cx="32"
          cy="27"
          r="11.5"
          fill="none"
          stroke={EDGE}
          strokeWidth="0.6"
          strokeDasharray="1.5 2"
        />
        <circle cx="32" cy="50" r="3" fill={EDGE} />
        <path d="M26 50h-4M38 50h4" stroke={EDGE} strokeWidth="1.2" />
      </>
    ),
  },
  paladino: {
    label: 'Paladino',
    art: (
      <>
        {bust}
        <path
          d="M32 40l9 3v6c0 5-4 8-9 10-5-2-9-5-9-10v-6z"
          fill={SIL}
          stroke={EDGE}
          strokeWidth="1.2"
        />
        <path d="M32 44v11M28 48h8" stroke={EDGE} strokeWidth="1.2" />
        <circle cx="32" cy="27" r="12.5" fill="none" stroke={EDGE} strokeWidth="0.8" />
      </>
    ),
  },
  patrulheiro: {
    label: 'Patrulheiro',
    art: (
      <>
        {hood}
        <path d="M48 14c8 10 8 30 0 40" stroke={EDGE} strokeWidth="1.6" fill="none" />
        <path d="M48 14v40" stroke={EDGE} strokeWidth="0.6" />
        <path d="M14 34l14 0M14 34l3-2M14 34l3 2" stroke={EDGE} strokeWidth="1" />
      </>
    ),
  },
  ladino: {
    label: 'Ladino',
    art: (
      <>
        {hood}
        <path d="M20 44l8 10M44 44l-8 10" stroke={EDGE} strokeWidth="1.6" />
        <path d="M27 31h4M33 31h4" stroke={WINE} strokeWidth="1.4" />
      </>
    ),
  },
  feiticeiro: {
    label: 'Feiticeiro',
    art: (
      <>
        {bust}
        <path
          d="M18 50c-3-5 0-9 2-12 0 4 3 5 3 8 0 2-2 4-5 4zM46 50c3-5 0-9-2-12 0 4-3 5-3 8 0 2 2 4 5 4z"
          fill={WINE}
          stroke={EDGE}
          strokeWidth="0.6"
        />
        {spark(32, 14, 1.6)}
      </>
    ),
  },
  bruxo: {
    label: 'Bruxo',
    art: (
      <>
        {hood}
        <path d="M27 31c3-3 7-3 10 0-3 3-7 3-10 0z" fill={WINE} />
        <circle cx="32" cy="31" r="1.2" fill={EDGE} />
        <path d="M24 52c4-3 12-3 16 0" stroke={EDGE} strokeWidth="0.8" fill="none" />
      </>
    ),
  },
  mago: {
    label: 'Mago',
    art: (
      <>
        <path d="M16 60c0-13 7-21 16-21s16 8 16 21z" fill={SIL} />
        <circle cx="32" cy="30" r="8" fill={SIL} />
        <path d="M20 24h24L33 4z" fill={SIL} stroke={EDGE} strokeWidth="0.9" />
        <path d="M48 16v40" stroke={EDGE} strokeWidth="1.6" />
        {spark(48, 13, 1.8)}
      </>
    ),
  },
  encapuzado: {
    label: 'Encapuzado',
    art: (
      <>
        {hood}
        {spark(32, 30, 1.6)}
      </>
    ),
  },
};

/** Retrato no círculo vinho com moldura e brilhos. */
export function AvatarIconArt({ icon, className }: { icon: AvatarIcon; className?: string }) {
  const entry = AVATAR_ICON_ART[icon];
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={entry.label}>
      <defs>
        <radialGradient id={`av-bg-${icon}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#3a1018" />
          <stop offset="100%" stopColor="#0b0b0f" />
        </radialGradient>
        <clipPath id={`av-clip-${icon}`}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#0b0b0f" stroke={WINE} strokeWidth="1.5" />
      <circle cx="32" cy="32" r="29" fill={`url(#av-bg-${icon})`} />
      <circle
        cx="32"
        cy="27"
        r="16"
        fill="none"
        stroke={EDGE}
        strokeOpacity="0.25"
        strokeWidth="0.6"
      />
      <g clipPath={`url(#av-clip-${icon})`}>{entry.art}</g>
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke={EDGE}
        strokeOpacity="0.5"
        strokeWidth="0.5"
      />
    </svg>
  );
}
