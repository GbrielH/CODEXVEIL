/**
 * Imagens de livros importados (mapas, criaturas, ferramentas): bucket privado `book-assets`,
 * caminho `{sistema}/{livro}/{hash}-{ext}`. O nome é o hash SHA-256 do conteúdo, conferido aqui
 * antes do envio; uma imagem já enviada (por você ou por outra pessoa com o mesmo livro) não é
 * reenviada nem sobrescrita. Leem o dono do livro e os mestres das campanhas que o usam.
 */
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import { SIGNED_URL_TTL_SECONDS } from './storage';

export const BOOK_ASSETS_BUCKET = 'book-assets';

export interface BookAssetInput {
  /** `{hash hexadecimal}-{jpg|png|webp}`, como gerado pelos scripts de livro. */
  key: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Conteúdo em base64. */
  data: string;
}

export function bookAssetPath(systemId: string, bookKey: string, key: string): string {
  return `${systemId}/${bookKey}/${key}`;
}

function decodeBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Envia as imagens de um livro. Confere que o nome corresponde ao conteúdo (o pacote não pode
 * pôr uma imagem no lugar de outra) e ignora as que já existem.
 */
export async function uploadBookAssets(
  client: CodexveilClient,
  systemId: string,
  bookKey: string,
  assets: readonly BookAssetInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: number; existing: number }> {
  const bucket = client.storage.from(BOOK_ASSETS_BUCKET);
  let uploaded = 0;
  let existing = 0;
  onProgress?.(0, assets.length);
  for (const [index, asset] of assets.entries()) {
    const match = /^([0-9a-f]{32,64})-(jpg|png|webp)$/.exec(asset.key);
    if (!match) throw toAppError(new Error(`Imagem com nome inválido: ${asset.key}`));
    const bytes = decodeBase64(asset.data);
    const hash = await sha256Hex(bytes);
    if (!hash.startsWith(match[1]!))
      throw toAppError(new Error(`A imagem ${asset.key} não corresponde ao conteúdo do pacote.`));
    const { error } = await bucket.upload(bookAssetPath(systemId, bookKey, asset.key), bytes, {
      contentType: asset.mime,
      upsert: false,
    });
    if (!error) uploaded += 1;
    else if (
      /exist|duplicate|409/i.test(
        `${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`,
      )
    )
      existing += 1;
    else throw toAppError(error);
    onProgress?.(index + 1, assets.length);
  }
  return { uploaded, existing };
}

/** URLs assinadas das imagens de um livro, por chave. Chaves que o usuário não lê ficam de fora. */
export async function bookAssetUrls(
  client: CodexveilClient,
  systemId: string,
  bookKey: string,
  keys: readonly (string | null | undefined)[],
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  if (unique.length === 0) return {};
  const { data, error } = await client.storage.from(BOOK_ASSETS_BUCKET).createSignedUrls(
    unique.map((key) => bookAssetPath(systemId, bookKey, key)),
    expiresIn,
  );
  if (error) {
    console.warn('[codexveil] não foi possível assinar imagens do livro', error);
    return {};
  }
  const urls: Record<string, string> = {};
  for (const entry of data) {
    const key = entry.path?.split('/').pop();
    if (key && entry.signedUrl && !entry.error) urls[key] = entry.signedUrl;
  }
  return urls;
}

/** Baixa uma imagem do livro (para copiá-la à mídia de uma campanha). */
export async function downloadBookAsset(
  client: CodexveilClient,
  systemId: string,
  bookKey: string,
  key: string,
): Promise<Blob> {
  const { data, error } = await client.storage
    .from(BOOK_ASSETS_BUCKET)
    .download(bookAssetPath(systemId, bookKey, key));
  if (error) throw toAppError(error);
  return data;
}
