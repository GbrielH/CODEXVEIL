/**
 * Regras de upload de imagens. As mesmas restrições estão configuradas nos buckets do
 * Supabase Storage (allowed_mime_types e file_size_limit), que as aplica no servidor.
 * SVG não é aceito: pode conter scripts.
 */

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const IMAGE_EXTENSIONS: Record<ImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const UPLOAD_LIMITS = {
  media: 2 * 1024 * 1024,
} as const;
export type UploadKind = keyof typeof UPLOAD_LIMITS;

/**
 * Redução feita no aparelho antes do envio: a imagem é redimensionada para que o lado maior
 * tenha no máximo `maxDimension` pixels e é regravada em WebP com a qualidade indicada. Uma
 * foto de celular de 4 MB costuma cair para 100–400 KB, poupando o armazenamento do projeto.
 */
export const IMAGE_PRESETS = {
  /** Retrato de personagem. */
  portrait: { maxDimension: 768, quality: 0.82 },
  /** Imagem de NPC ou monstro. */
  creature: { maxDimension: 1024, quality: 0.82 },
  /** Imagem de bloco de roteiro ou capa de campanha. */
  scene: { maxDimension: 1600, quality: 0.8 },
} as const;
export type ImagePreset = keyof typeof IMAGE_PRESETS;

export type ImageValidation = { ok: true; mimeType: ImageMimeType } | { ok: false; message: string };

export function isImageMimeType(value: string): value is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function validateImageFile(
  file: { type: string; size: number },
  kind: UploadKind,
): ImageValidation {
  if (!isImageMimeType(file.type)) {
    return { ok: false, message: 'Envie uma imagem PNG, JPEG ou WebP.' };
  }
  if (file.size <= 0) {
    return { ok: false, message: 'O arquivo está vazio.' };
  }
  const limit = UPLOAD_LIMITS[kind];
  if (file.size > limit) {
    return {
      ok: false,
      message: `A imagem pode ter no máximo ${Math.round(limit / (1024 * 1024))} MB.`,
    };
  }
  return { ok: true, mimeType: file.type };
}
