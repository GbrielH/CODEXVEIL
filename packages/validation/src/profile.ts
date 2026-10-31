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
/** Fontes dos números dos dados 3D ("Meus dados"). */
export const DICE_FONTS = ['classic', 'modern', 'machine', 'display'] as const;
export type DiceFont = (typeof DICE_FONTS)[number];

export const diceFontLabels: Record<DiceFont, { name: string; family: string }> = {
  classic: { name: 'Clássica', family: '"Times New Roman", serif' },
  modern: { name: 'Moderna', family: 'Arial, sans-serif' },
  machine: { name: 'Máquina', family: '"Courier New", monospace' },
  display: { name: 'Título', family: 'var(--font-display)' },
};

/** Caminho de uma imagem de dado no Storage: `users/{usuário}/dice/{arquivo}`. */
const diceImagePath = /^users\/[0-9a-f-]{36}\/dice\/[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp)$/;

/**
 * Aparência dos próprios dados 3D ("Meus dados"): a face desenhada pelo jogador (imagem no
 * Storage), a cor e a fonte dos números. Valores antigos (texturas) são ignorados.
 */
export const diceLookSchema = z
  .object({
    image: z.string().regex(diceImagePath).nullable().default(null).catch(null),
    /** Cor dos números (#rrggbb); vazio = automática (contraste com a cor do dado). */
    numberColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable()
      .default(null)
      .catch(null),
    font: z.enum(DICE_FONTS).nullable().default(null).catch(null),
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
