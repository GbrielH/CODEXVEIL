import { setCharacterNpcCampaign, type CodexveilClient } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage } from '@/lib/actions';

/**
 * Ficha completa de NPC criada pela biblioteca da campanha (`/personagens/novo?npc=<campanha>`):
 * o assistente manda `npcCampaignId`, e a ação guarda a ficha como NPC logo depois de criá-la, para
 * ela não aparecer em "Meus personagens".
 */
export function npcCampaignIdFrom(input: unknown): string | null {
  const value = (input as { npcCampaignId?: unknown } | null)?.npcCampaignId;
  return uuidSchema.safeParse(value).success ? (value as string) : null;
}

/** Guarda a ficha recém-criada como NPC. Em caso de erro, devolve a mensagem para o assistente. */
export async function keepAsNpc(
  client: CodexveilClient,
  characterId: string,
  npcCampaignId: string | null,
): Promise<{ ok: false; message: string } | null> {
  if (!npcCampaignId) return null;
  try {
    await setCharacterNpcCampaign(client, characterId, npcCampaignId);
  } catch (error) {
    return {
      ok: false,
      message: `A ficha foi criada, mas não virou NPC da campanha (${failureMessage(error)}). Guarde-a pela Biblioteca.`,
    };
  }
  revalidatePath(`/campanhas/${npcCampaignId}/biblioteca`);
  return null;
}
