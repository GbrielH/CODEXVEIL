import type { CodexveilClient } from '../client';

export const CAMPAIGN_MEDIA_BUCKET = 'campaign-media';
export const AVATARS_BUCKET = 'avatars';

/** Validade das URLs assinadas da mídia privada (curta: o link não deve circular). */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * URLs assinadas para arquivos do bucket privado. Caminhos que o usuário não pode ler
 * (policies do Storage) ficam de fora do resultado em vez de lançar erro.
 */
export async function signedMediaUrls(
  client: CodexveilClient,
  paths: readonly (string | null | undefined)[],
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (unique.length === 0) return {};
  const { data, error } = await client.storage
    .from(CAMPAIGN_MEDIA_BUCKET)
    .createSignedUrls(unique, expiresIn);
  if (error) {
    console.warn('[codexveil] não foi possível assinar URLs de mídia', error);
    return {};
  }
  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

/**
 * Remove (melhor esforço) os arquivos de uma campanha antes de excluí-la. O Storage não
 * apaga arquivos por cascata do banco; arquivos que restarem continuam privados e podem
 * ser limpos por uma rotina administrativa.
 */
export async function removeCampaignMedia(client: CodexveilClient, campaignId: string): Promise<number> {
  const bucket = client.storage.from(CAMPAIGN_MEDIA_BUCKET);
  const root = `campaigns/${campaignId}`;
  const paths: string[] = [];

  for (const folder of ['cover', 'creatures']) {
    const { data } = await bucket.list(`${root}/${folder}`, { limit: 1000 });
    for (const file of data ?? []) {
      if (file.id) paths.push(`${root}/${folder}/${file.name}`);
    }
  }

  const { data: sessionFolders } = await bucket.list(`${root}/sessions`, { limit: 1000 });
  for (const folder of sessionFolders ?? []) {
    if (folder.id) continue;
    const { data } = await bucket.list(`${root}/sessions/${folder.name}`, { limit: 1000 });
    for (const file of data ?? []) {
      if (file.id) paths.push(`${root}/sessions/${folder.name}/${file.name}`);
    }
  }

  if (paths.length === 0) return 0;
  const { error } = await bucket.remove(paths);
  if (error) {
    console.warn(`[codexveil] não foi possível remover ${paths.length} arquivo(s) da campanha`, error);
    return 0;
  }
  return paths.length;
}
