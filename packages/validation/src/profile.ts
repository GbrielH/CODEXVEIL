import { z } from 'zod';
import { displayNameSchema } from './auth';
import { optionalText } from './common';

export const DENSITIES = ['comfortable', 'compact'] as const;
export const MOTION_PREFERENCES = ['system', 'reduce'] as const;

/** Preferências de interface guardadas em `profiles.preferences`. */
export const preferencesSchema = z
  .object({
    density: z.enum(DENSITIES).default('comfortable'),
    motion: z.enum(MOTION_PREFERENCES).default('system'),
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
