import type DiceBox from '@3d-dice/dice-box-threejs';
import { diceFontLabels, type DiceLook } from '@codexveil/validation';

/** Aparência de alguém já pronta para a mesa: a imagem vem como URL assinada. */
export type DiceAppearance = DiceLook & { imageUrl: string | null };

/** Partes internas da biblioteca que a face desenhada e a fonte precisam (não tipadas). */
interface DiceBoxInternals {
  DiceColors: {
    getTexture: (name: unknown) => unknown;
    loadImage: (source: string) => Promise<HTMLImageElement | undefined>;
    assetPath: string;
  };
  DiceFactory: {
    get: (type: string) => { font: string };
    materials_cache: Record<string, unknown>;
  };
}

/** Dados que a mesa rola (a biblioteca guarda cada um num registro interno). */
const DIE_TYPES = ['d2', 'd4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20'] as const;
const CUSTOM_PREFIX = 'cv-face:';
const patched = new WeakSet<object>();
const originalFonts = new WeakMap<object, Record<string, string>>();
const appliedFont = new WeakMap<object, string>();

/** Nome curto e estável para a URL (o nome entra no cache de materiais da biblioteca). */
function hash(text: string): string {
  let value = 0;
  for (let index = 0; index < text.length; index++)
    value = (value * 31 + text.charCodeAt(index)) | 0;
  return (value >>> 0).toString(36);
}

/** Família da fonte para o canvas (resolve a variável CSS da fonte de títulos do site). */
export function diceFontFamily(font: DiceLook['font']): string | null {
  if (!font) return null;
  const family = diceFontLabels[font].family;
  const variable = /^var\((--[\w-]+)\)$/.exec(family)?.[1];
  if (!variable) return family;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || 'serif';
}

/** Ensina a biblioteca a usar uma imagem qualquer (URL) como textura da face. */
function patch(box: DiceBox) {
  if (patched.has(box)) return;
  patched.add(box);
  const inner = box as unknown as DiceBoxInternals;
  const colors = inner.DiceColors;
  const getTexture = colors.getTexture.bind(colors);
  colors.getTexture = (name) => {
    if (typeof name === 'string' && name.startsWith(CUSTOM_PREFIX)) {
      const source = name.slice(CUSTOM_PREFIX.length);
      return { name: `cv-${hash(source)}`, composite: 'source-over', source, material: 'plastic' };
    }
    return getTexture(name);
  };
  const loadImage = colors.loadImage.bind(colors);
  colors.loadImage = (source) => {
    if (!/^(https?:|data:|blob:)/.test(source)) return loadImage(source);
    return new Promise<HTMLImageElement | undefined>((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(undefined);
      image.src = source;
    });
  };
  originalFonts.set(
    box,
    Object.fromEntries(DIE_TYPES.map((type) => [type, inner.DiceFactory.get(type).font])),
  );
}

/** Troca a fonte de todos os dados (e limpa o cache de faces, que não leva a fonte em conta). */
function applyFont(box: DiceBox, font: DiceLook['font']) {
  const key = font ?? '';
  if ((appliedFont.get(box) ?? '') === key) return;
  appliedFont.set(box, key);
  const inner = box as unknown as DiceBoxInternals;
  const family = diceFontFamily(font);
  const originals = originalFonts.get(box) ?? {};
  for (const type of DIE_TYPES) {
    const die = inner.DiceFactory.get(type);
    die.font = family ?? originals[type] ?? die.font;
  }
  inner.DiceFactory.materials_cache = {};
}

/** Prepara a caixa para a próxima rolagem com a cor da sessão e a aparência do dono. */
export async function applyDiceLook(
  box: DiceBox,
  prefix: string,
  color: string,
  autoNumberColor: string,
  look: DiceAppearance | null,
) {
  patch(box);
  applyFont(box, look?.font ?? null);
  const numbers = look?.numberColor ?? autoNumberColor;
  const image = look?.imageUrl ?? null;
  await box.updateConfig({
    theme_customColorset: {
      // A biblioteca guarda o conjunto pelo nome: cor, face, números e fonte entram nele.
      name: `${prefix}-${color.slice(1)}-${image ? hash(image) : 'lisa'}-${numbers.slice(1)}-${look?.font ?? 'padrao'}`,
      background: color,
      foreground: numbers,
      outline: '#000000',
      texture: image ? `${CUSTOM_PREFIX}${image}` : 'none',
      material: 'plastic',
    },
  });
}
