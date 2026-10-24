/**
 * Limites por plano. A estrutura existe para permitir planos gratuitos e pagos no futuro;
 * hoje só há o plano `free`, sem limites ativos (todos `null`). Não há cobrança nem
 * assinaturas simuladas. A validação real acontece no banco (tabela `plans` e gatilhos
 * de limite), nunca apenas na interface.
 */

export interface PlanLimits {
  maxOwnedCampaigns: number | null;
  maxOwnedCharacters: number | null;
  maxMembersPerCampaign: number | null;
  maxStorageMb: number | null;
}

/** Recursos limitados: os do plano e os limites fixos que protegem o espaço do banco. */
export type LimitedResource = keyof PlanLimits | 'maxBookPacks' | 'maxBookEntries' | 'maxBookBytes' | 'maxBookStorage' | 'maxCharacterDrafts';

/** `null` significa ilimitado. */
export function isWithinLimit(currentCount: number, limit: number | null): boolean {
  return limit === null || currentCount < limit;
}

export function remainingQuota(currentCount: number, limit: number | null): number | null {
  return limit === null ? null : Math.max(0, limit - currentCount);
}

export const limitReachedMessages: Record<LimitedResource, string> = {
  maxOwnedCampaigns: 'Você atingiu o limite de campanhas do seu plano.',
  maxOwnedCharacters: 'Você atingiu o limite de personagens do seu plano.',
  maxMembersPerCampaign: 'A campanha atingiu o limite de participantes do plano do mestre.',
  maxStorageMb: 'O espaço de armazenamento do seu plano está cheio.',
  maxBookPacks: 'Você atingiu o limite de 40 livros importados. Remova um livro para importar outro.',
  maxBookEntries: 'O livro passou do limite de 6.000 entradas. Divida o pacote em mais de um livro.',
  maxBookBytes: 'O livro passou do limite de 25 MB. Divida o pacote em mais de um livro.',
  maxBookStorage: 'Seus livros passaram do limite de 60 MB por conta. Remova um livro para importar outro.',
  maxCharacterDrafts: 'Você atingiu o limite de 20 rascunhos de personagem. Apague um rascunho para salvar outro.',
};
