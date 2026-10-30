import { z } from 'zod';
import { displayNameSchema } from './auth';
import { optionalText } from './common';

export const DENSITIES = ['comfortable', 'compact'] as const;
export const MOTION_PREFERENCES = ['system', 'reduce'] as const;

/** Retratos de perfil (imagens no código, em `public/retratos` e `assets/retratos`; o banco guarda só a chave). */
export const AVATAR_ICONS = [
  'guerreiro',
  'patrulheiro',
  'grimorio',
  'clerigo',
  'ladino',
  'barbaro',
  'bardo',
  'druida',
  'guardiao',
  'monge',
  'paladino',
  'fera',
  'feiticeiro',
  'bruxo',
  'mago',
] as const;

export const AVATAR_LABELS: Record<(typeof AVATAR_ICONS)[number], string> = {
  guerreiro: 'Guerreiro',
  patrulheiro: 'Patrulheiro',
  grimorio: 'Grimório',
  clerigo: 'Clérigo',
  ladino: 'Ladino',
  barbaro: 'Bárbaro',
  bardo: 'Bardo',
  druida: 'Druida',
  guardiao: 'Guardião',
  monge: 'Monge',
  paladino: 'Paladino',
  fera: 'Fera',
  feiticeiro: 'Feiticeiro',
  bruxo: 'Bruxo',
  mago: 'Mago',
};
export type AvatarPreset = (typeof AVATAR_ICONS)[number];

/** Foto da conta Google (opcional): só endereços do googleusercontent, nada de links arbitrários. */
export type AvatarPhoto = `https://${string}`;
export type AvatarIcon = AvatarPreset | AvatarPhoto;
const GOOGLE_PHOTO = /^https:\/\/lh\d\.googleusercontent\.com\/[\w\-/=.~]+$/;
export function isAvatarPhoto(icon: AvatarIcon | null | undefined): icon is AvatarPhoto {
  return typeof icon === 'string' && icon.startsWith('https://');
}
/** Foto do perfil Google nos metadados da conta (`avatar_url` ou `picture`), se for válida. */
export function googlePhotoFrom(
  metadata: Record<string, unknown> | null | undefined,
): AvatarPhoto | null {
  const url = metadata?.avatar_url ?? metadata?.picture;
  return typeof url === 'string' && url.length <= 600 && GOOGLE_PHOTO.test(url)
    ? (url as AvatarPhoto)
    : null;
}
const avatarSchema = z.union([
  // 'encapuzado' (retrato antigo que saiu) vira o Ladino, o mais parecido.
  z.preprocess((value) => (value === 'encapuzado' ? 'ladino' : value), z.enum(AVATAR_ICONS)),
  z
    .string()
    .max(600)
    .regex(GOOGLE_PHOTO)
    .transform((url) => url as AvatarPhoto),
]);

/** Preferências de interface guardadas em `profiles.preferences`. */
export const preferencesSchema = z
  .object({
    density: z.enum(DENSITIES).default('comfortable'),
    motion: z.enum(MOTION_PREFERENCES).default('system'),
    avatar: avatarSchema.nullable().default(null).catch(null),
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
