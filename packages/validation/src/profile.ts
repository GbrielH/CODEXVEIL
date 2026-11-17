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

/** Auras dos dados (somente contas de criador; o banco recusa as demais). */
export const DICE_AURAS = [
  'blood',
  'storm',
  'frost',
  'arcane',
  'shadow',
  'holy',
  'gears',
  'forest',
  'fire',
  'skeleton',
  'cosmic',
  'tarot',
  'glitch',
  'ink',
  'abyss',
  'time',
  'gold',
  'frog',
  'vampire',
  'bard',
  'rainbow',
  'poison',
  'cat',
  'meteor',
  'party',
  'wind',
  'ritual',
  'claw',
  'necro',
  'pirate',
  'samurai',
  'kaiju',
  'cyber',
  'werewolf',
  'siren',
  'alchemy',
  'ghost',
  'haki',
  'cthulhu',
  'sungod',
  'heaven',
  'tarrasque',
  'purple',
  'wheel',
  'capture',
  'darklord',
  'notebook',
  'orbs',
  'sakura',
  'phoenix',
  'kitsune',
  'mirror',
  'aurora',
  'zombie',
  'sans',
  'hollow',
  'doom',
  'zoro',
  'blackhole',
  'fullmetal',
  'sahur',
] as const;
export type DiceAura = (typeof DICE_AURAS)[number];
export const diceAuraLabels: Record<DiceAura, { name: string; color: string }> = {
  blood: { name: 'Sangue', color: '#d6283c' },
  storm: { name: 'Tempestade', color: '#7fd4ff' },
  frost: { name: 'Gelo', color: '#bfefff' },
  arcane: { name: 'Arcana', color: '#b06cff' },
  shadow: { name: 'Sombra', color: '#3b2a52' },
  holy: { name: 'Sagrada', color: '#ffd76a' },
  gears: { name: 'Engrenagens', color: '#d9a441' },
  forest: { name: 'Floresta', color: '#5fbf4a' },
  fire: { name: 'Fogo', color: '#ff7a1a' },
  skeleton: { name: 'Esqueleto', color: '#b8f0a0' },
  cosmic: { name: 'Olho Cósmico', color: '#8f7bff' },
  tarot: { name: 'Cartas do Destino', color: '#c38bd9' },
  glitch: { name: 'Glitch', color: '#22ff99' },
  ink: { name: 'Tinta', color: '#b9b2a6' },
  abyss: { name: 'Abissal', color: '#2aa7e0' },
  time: { name: 'Tempo', color: '#e6d3a3' },
  gold: { name: 'Ouro', color: '#ffc83c' },
  frog: { name: 'Sapo Rei', color: '#7ccf3c' },
  vampire: { name: 'Vampiro', color: '#c4183a' },
  bard: { name: 'Bardo', color: '#ffb347' },
  rainbow: { name: 'Arco-íris', color: '#7cc8ff' },
  poison: { name: 'Veneno', color: '#9bff3a' },
  cat: { name: 'Gato', color: '#ffb3cf' },
  meteor: { name: 'Meteoro', color: '#ff8c42' },
  party: { name: 'Festa', color: '#ff6ad5' },
  wind: { name: 'Vento', color: '#bfe8f0' },
  ritual: { name: 'Ritual', color: '#ff2a2a' },
  claw: { name: 'Garras', color: '#3dff7a' },
  necro: { name: 'Necromante', color: '#4be38f' },
  pirate: { name: 'Pirata', color: '#c8553d' },
  samurai: { name: 'Samurai', color: '#ff8fb0' },
  kaiju: { name: 'Kaiju', color: '#8fbf3f' },
  cyber: { name: 'Cyberpunk', color: '#fcee0a' },
  werewolf: { name: 'Lobisomem', color: '#b8c2dc' },
  siren: { name: 'Sereia', color: '#4fe0c8' },
  alchemy: { name: 'Alquimia', color: '#e8c46a' },
  ghost: { name: 'Fantasma', color: '#dfe9ff' },
  haki: { name: 'Haki do Rei', color: '#e0102e' },
  cthulhu: { name: 'Cthulhu', color: '#3fbf8a' },
  sungod: { name: 'Deus do Sol', color: '#fff1b8' },
  heaven: { name: 'Aceleração do Tempo', color: '#9ad7ff' },
  tarrasque: { name: 'Tarrasque', color: '#c0703a' },
  purple: { name: 'Vazio Roxo', color: '#a24bff' },
  wheel: { name: 'Roda da Adaptação', color: '#d4b25a' },
  capture: { name: 'Esfera de Captura', color: '#f0c040' },
  darklord: { name: 'Lorde Sombrio', color: '#ff2424' },
  notebook: { name: 'Caderno Sombrio', color: '#b8b8c8' },
  orbs: { name: 'Sete Esferas', color: '#ffa31a' },
  sakura: { name: 'Cerejeira', color: '#ffb3cf' },
  phoenix: { name: 'Fênix', color: '#ff8a2a' },
  kitsune: { name: 'Kitsune', color: '#7cc8ff' },
  mirror: { name: 'Espelho Partido', color: '#d8ecf8' },
  aurora: { name: 'Aurora Boreal', color: '#5cffb0' },
  zombie: { name: 'Horda Zumbi', color: '#8fbf6a' },
  sans: { name: 'Sans', color: '#35d9ff' },
  hollow: { name: 'Hollow Knight', color: '#ef334f' },
  doom: { name: 'Doutor Destino', color: '#54e36f' },
  zoro: { name: 'Zoro', color: '#d7193f' },
  blackhole: { name: 'Buraco Negro', color: '#b87cff' },
  fullmetal: { name: 'Fullmetal Alchemist', color: '#f3b43f' },
  sahur: { name: 'Tung Tung Tung Sahur', color: '#f0a34a' },
};

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
    /** Cor de fundo do dado (#rrggbb); vazio = a cor padrão da mesa. */
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable()
      .default(null)
      .catch(null),
    /** Aura ao redor do dado na mesa (somente criadores). */
    aura: z.enum(DICE_AURAS).nullable().default(null).catch(null),
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
