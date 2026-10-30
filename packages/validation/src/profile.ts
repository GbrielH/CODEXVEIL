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
/**
 * Texturas dos dados 3D (catálogo da biblioteca `@3d-dice/dice-box-threejs`, arquivos em
 * `apps/web/public/dice/textures`). A chave é o nome que a biblioteca aceita.
 */
export const DICE_TEXTURES = [
  'marble',
  'wood',
  'metal',
  'bronze01',
  'paper',
  'cloudy_2',
  'speckles',
  'glitter',
  'stars',
  'astral',
  'stainedglass',
  'fire',
  'ice',
  'water',
  'dragon',
  'lizard',
  'bird',
  'skulls',
  'leopard',
  'tiger',
  'cheetah',
] as const;
export type DiceTexture = (typeof DICE_TEXTURES)[number];

export const diceTextureLabels: Record<DiceTexture, { name: string; file: string }> = {
  marble: { name: 'Mármore', file: 'marble.webp' },
  wood: { name: 'Madeira', file: 'wood.webp' },
  metal: { name: 'Aço', file: 'metal.webp' },
  bronze01: { name: 'Bronze', file: 'bronze01.webp' },
  paper: { name: 'Papel', file: 'paper.webp' },
  cloudy_2: { name: 'Nuvens', file: 'cloudy.alt.webp' },
  speckles: { name: 'Salpicado', file: 'speckles.webp' },
  glitter: { name: 'Purpurina', file: 'glitter.webp' },
  stars: { name: 'Estrelas', file: 'stars.webp' },
  astral: { name: 'Mar astral', file: 'astral.webp' },
  stainedglass: { name: 'Vitral', file: 'stainedglass.webp' },
  fire: { name: 'Fogo', file: 'fire.webp' },
  ice: { name: 'Gelo', file: 'ice.webp' },
  water: { name: 'Água', file: 'water.webp' },
  dragon: { name: 'Escamas de dragão', file: 'dragon.webp' },
  lizard: { name: 'Lagarto', file: 'lizard.webp' },
  bird: { name: 'Penas', file: 'feather.webp' },
  skulls: { name: 'Caveiras', file: 'skulls.webp' },
  leopard: { name: 'Leopardo', file: 'leopard.webp' },
  tiger: { name: 'Tigre', file: 'tiger.webp' },
  cheetah: { name: 'Guepardo', file: 'cheetah.webp' },
};

/** Aparência dos próprios dados 3D ("Meus dados" no Perfil): textura e cor dos números. */
export const diceLookSchema = z
  .object({
    texture: z.enum(DICE_TEXTURES).nullable().default(null).catch(null),
    /** Cor dos números (#rrggbb); vazio = automática (contraste com a cor do dado). */
    numberColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable()
      .default(null)
      .catch(null),
  })
  .prefault({});
export type DiceLook = z.output<typeof diceLookSchema>;

export const preferencesSchema = z
  .object({
    density: z.enum(DENSITIES).default('comfortable'),
    motion: z.enum(MOTION_PREFERENCES).default('system'),
    avatar: avatarSchema.nullable().default(null).catch(null),
    dice: diceLookSchema,
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
