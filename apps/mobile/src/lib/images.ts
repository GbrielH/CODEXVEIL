/**
 * Imagens escolhidas no aparelho: a pessoa recorta (retratos e criaturas), o app reduz para o
 * tamanho do preset e regrava em WebP, como o site. Assim o armazenamento recebe arquivos
 * pequenos (em geral 100–400 KB) mesmo a partir de fotos grandes.
 */
import { IMAGE_PRESETS, validateImageFile, type ImageMimeType, type ImagePreset } from '@codexveil/validation';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** `uri`: arquivo local já reduzido, para pré-visualizar antes de enviar. */
export type PickedImage = { ok: true; bytes: ArrayBuffer; mimeType: ImageMimeType; extension: string; uri: string } | { ok: false; message: string };

/** Abre a galeria; devolve `null` se a pessoa desistir. */
export async function pickImage(preset: ImagePreset): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: preset !== 'scene',
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  try {
    const { maxDimension, quality } = IMAGE_PRESETS[preset];
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > maxDimension) {
      context.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: quality, format: SaveFormat.WEBP });
    const bytes = await new File(saved.uri).arrayBuffer();
    const check = validateImageFile({ type: 'image/webp', size: bytes.byteLength }, 'media');
    if (!check.ok) return { ok: false, message: check.message };
    return { ok: true, bytes, mimeType: 'image/webp', extension: 'webp', uri: saved.uri };
  } catch {
    return { ok: false, message: 'Não foi possível preparar a imagem. Tente outra.' };
  }
}
