import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json } from '../types.gen';

/** Listas cruas da aba MASTER (o formato é validado em `@codexveil/rpg-systems/assimilacao`). */
export interface AssimilacaoMasterData {
  conflicts: unknown;
  refuges: unknown;
}

export async function getAssimilacaoMaster(
  client: CodexveilClient,
  campaignId: string,
): Promise<AssimilacaoMasterData> {
  const { data, error } = await client
    .from('assimilacao_master')
    .select('conflicts, refuges')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return { conflicts: data?.conflicts ?? [], refuges: data?.refuges ?? [] };
}

/** Grava uma das listas (cria a linha da campanha na primeira vez). */
export async function saveAssimilacaoMaster(
  client: CodexveilClient,
  campaignId: string,
  changes: { conflicts?: unknown[]; refuges?: unknown[] },
): Promise<void> {
  const values = {
    ...(changes.conflicts ? { conflicts: changes.conflicts as Json } : {}),
    ...(changes.refuges ? { refuges: changes.refuges as Json } : {}),
  };
  // Sem upsert: a coluna da campanha não pode ser alterada (só inserida).
  const updated = await client
    .from('assimilacao_master')
    .update(values)
    .eq('campaign_id', campaignId)
    .select('campaign_id');
  if (updated.error) throw toAppError(updated.error);
  if (updated.data.length > 0) return;
  const { error } = await client
    .from('assimilacao_master')
    .insert({ campaign_id: campaignId, ...values });
  if (error) throw toAppError(error);
}
