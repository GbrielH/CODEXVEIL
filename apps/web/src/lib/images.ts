/**
 * Redução de imagens no navegador antes do envio ao Storage: redimensiona para o lado maior
 * do preset e regrava em WebP. Assim o armazenamento recebe arquivos pequenos (em geral
 * 100–400 KB) mesmo quando o usuário escolhe uma foto grande do celular.
 */
import {
  IMAGE_PRESETS,
  isImageMimeType,
  validateImageFile,
  type ImageMimeType,
  type ImagePreset,
} from '@codexveil/validation';

export interface PreparedImage {
  file: File;
  /** Tamanho original e final, em bytes, para mensagens e testes. */
  originalSize: number;
}

function targetSize(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

/**
 * Prepara a imagem escolhida para envio. Se o navegador não conseguir decodificar ou gerar
 * WebP, devolve o arquivo original (a validação de tipo e tamanho continua valendo).
 */
export async function prepareImageForUpload(file: File, preset: ImagePreset): Promise<PreparedImage> {
  const { maxDimension, quality } = IMAGE_PRESETS[preset];
  try {
    const source = await decode(file);
    const { width, height } = targetSize(source.width, source.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { file, originalSize: file.size };
    context.drawImage(source, 0, 0, width, height);
    if ('close' in source) source.close();
    const blob = await toBlob(canvas, quality);
    // Alguns navegadores antigos devolvem PNG quando não sabem gerar WebP.
    if (!blob || blob.type !== 'image/webp') return { file, originalSize: file.size };
    // Nunca troca por um arquivo maior que o original (ex.: imagem pequena já otimizada).
    if (blob.size >= file.size && file.type === 'image/webp') return { file, originalSize: file.size };
    const name = file.name.replace(/\.[^.]+$/, '') || 'imagem';
    return { file: new File([blob], `${name}.webp`, { type: 'image/webp' }), originalSize: file.size };
  } catch {
    return { file, originalSize: file.size };
  }
}

export type ImageCheck = { ok: true; file: File; mimeType: ImageMimeType } | { ok: false; message: string };

/**
 * Confere o tipo, reduz a imagem e só então aplica o limite de tamanho do bucket: uma foto
 * grande do celular é aceita porque chega pequena ao servidor.
 */
export async function prepareImage(original: File, preset: ImagePreset): Promise<ImageCheck> {
  if (!isImageMimeType(original.type)) return { ok: false, message: 'Envie uma imagem PNG, JPEG ou WebP.' };
  const { file } = await prepareImageForUpload(original, preset);
  const check = validateImageFile(file, 'media');
  return check.ok ? { ok: true, file, mimeType: check.mimeType } : check;
}
