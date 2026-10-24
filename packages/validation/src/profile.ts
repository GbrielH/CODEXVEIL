import { z } from 'zod';
import { displayNameSchema } from './auth';
import { optionalText } from './common';

export const DENSITIES = ['comfortable', 'compact'] as const;
export const MOTION_PREFERENCES = ['system', 'reduce'] as const;

/** Retratos de perfil por classe (desenhados no código; o banco guarda só a escolha). */
export const AVATAR_ICONS = [
  'encapuzado',
  'barbaro',
  'bardo',
  'bruxo',
  'clerigo',
  'druida',
  'feiticeiro',
  'guerreiro',
  'ladino',
  'mago',
  'monge',
  'paladino',
  'patrulheiro',
] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

/** Preferências de interface guardadas em `profiles.preferences`. */
export const preferencesSchema = z
  .object({
    density: z.enum(DENSITIES).default('comfortable'),
    motion: z.enum(MOTION_PREFERENCES).default('system'),
    avatar: z.enum(AVATAR_ICONS).nullable().default(null).catch(null),
  })
  .prefault({});
export type Preferences = z.output<typeof preferencesSchema>;

export const densityLabels: Record<(typeof DENSITIES)[number], string> = {
  comfortable: 'Confortável',
  compact: 'Compacta',
};

export const motionLabels: Record<(typeof MOTION_PREFERENCES)[number], string> = {
  system: 'Seguir o sistema',
  reduce: 'Reduzir animações',
};

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  bio: optionalText(500),
  preferences: preferencesSchema,
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;
