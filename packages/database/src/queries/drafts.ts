/**
 * Rascunhos de personagem: a criação salva incompleta para continuar depois (só o dono vê).
 * O conteúdo (`payload`) é o estado do assistente de cada sistema; quem valida é o módulo do
 * sistema ao continuar.
 */
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json } from '../types.gen';

export interface CharacterDraftSummary {
  id: string;
  systemId: string;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  updatedAt: string;
}

export interface CharacterDraftRow extends CharacterDraftSummary {
  payload: Json;
}

export async function listMyCharacterDrafts(
  client: CodexveilClient,
  ownerId: string,
): Promise<CharacterDraftSummary[]> {
  const { data, error } = await client
    .from('character_drafts')
    .select('id, system_id, campaign_id, name, updated_at, campaign:campaigns(name)')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    systemId: row.system_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign?.name ?? null,
    name: row.name,
    updatedAt: row.updated_at,
  }));
}

export async function getCharacterDraft(
  client: CodexveilClient,
  draftId: string,
): Promise<CharacterDraftRow | null> {
  const { data, error } = await client
    .from('character_drafts')
    .select('id, system_id, campaign_id, name, payload, updated_at, campaign:campaigns(name)')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data
    ? {
        id: data.id,
        systemId: data.system_id,
        campaignId: data.campaign_id,
        campaignName: data.campaign?.name ?? null,
        name: data.name,
        payload: data.payload,
        updatedAt: data.updated_at,
      }
    : null;
}

/** Cria o rascunho (sem `draftId`) ou grava por cima do existente. Devolve o id. */
export async function saveCharacterDraft(
  client: CodexveilClient,
  input: {
    draftId?: string | null;
    systemId: string;
    campaignId: string | null;
    name: string;
    payload: unknown;
  },
): Promise<string> {
  const name = input.name.trim().slice(0, 80);
  const payload = (input.payload ?? {}) as Json;
  if (input.draftId) {
    const { data, error } = await client
      .from('character_drafts')
      .update({ name, payload })
      .eq('id', input.draftId)
      .select('id')
      .maybeSingle();
    if (error) throw toAppError(error);
    if (data) return data.id;
  }
  const { data, error } = await client
    .from('character_drafts')
    .insert({ system_id: input.systemId, campaign_id: input.campaignId, name, payload })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export async function deleteCharacterDraft(
  client: CodexveilClient,
  draftId: string,
): Promise<void> {
  const { error } = await client.from('character_drafts').delete().eq('id', draftId);
  if (error) throw toAppError(error);
}
