'use server';

import {
  createCampaignNote,
  createCreature,
  createSessionBlock,
  getCampaign,
  listSessionBlocks,
  listSessions,
  updateCreatureGmData,
} from '@codexveil/database';
import { positionBetween } from '@codexveil/domain';
import { uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { campaignPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tomoActionSchema } from '@/lib/tomo-actions';

export type TomoActionResult = { ok: true; message: string; href: string } | { ok: false; message: string };

/**
 * Executa uma ação proposta pelo Tomo, depois que o mestre confirmou no chat. Tudo é validado de
 * novo aqui; só o mestre de uma campanha ativa grava (o RLS confere outra vez no banco).
 */
export async function runTomoAction(campaignId: unknown, input: unknown): Promise<TomoActionResult> {
  const user = await requireSessionUser(routes.dashboard);
  const id = uuidSchema.safeParse(campaignId);
  const action = tomoActionSchema.safeParse(input);
  if (!id.success || !action.success) return { ok: false, message: 'Proposta inválida.' };

  try {
    const supabase = await createSupabaseServerClient();
    const campaign = await getCampaign(supabase, id.data, user.id);
    if (!campaign || campaign.role !== 'gm') return { ok: false, message: 'Só o mestre da campanha pode usar as ações do Tomo.' };
    if (campaign.status !== 'active') return { ok: false, message: 'A campanha está arquivada.' };
    const data = action.data;

    switch (data.acao) {
      case 'criar_criatura': {
        const creatureId = await createCreature(supabase, campaign.id, {
          kind: data.tipo === 'npc' ? 'npc' : 'monster',
          name: data.nome,
          subtitle: data.subtitulo,
          description: data.descricao,
          visibility: 'gm',
          size: data.tamanho,
        });
        if (data.segredos) await updateCreatureGmData(supabase, creatureId, { stats: {}, notes: '', secrets: data.segredos });
        revalidatePath(campaignPath(campaign.id, '/biblioteca'));
        return {
          ok: true,
          message: `${data.tipo === 'npc' ? 'NPC' : 'Monstro'} criado na biblioteca (oculto dos jogadores).`,
          href: campaignPath(campaign.id, `/biblioteca/${creatureId}`),
        };
      }
      case 'criar_anotacao': {
        await createCampaignNote(supabase, campaign.id, {
          title: data.titulo,
          body: data.texto,
          visibility: data.visibilidade === 'grupo' ? 'members' : 'gm',
          isPinned: false,
        });
        revalidatePath(campaignPath(campaign.id, '/anotacoes'));
        return { ok: true, message: 'Anotação criada.', href: campaignPath(campaign.id, '/anotacoes') };
      }
      case 'nota_na_sessao': {
        const session = (await listSessions(supabase, campaign.id)).find((entry) => entry.number === data.sessao);
        if (!session) return { ok: false, message: `Não achei a sessão ${data.sessao} nesta campanha.` };
        const blocks = await listSessionBlocks(supabase, session.id);
        await createSessionBlock(supabase, {
          sessionId: session.id,
          campaignId: campaign.id,
          position: positionBetween(blocks.at(-1)?.position ?? null, null),
          visibility: 'gm',
          content: { type: 'gm_note', data: { text: data.texto } },
        });
        const href = campaignPath(campaign.id, `/sessoes/${session.id}`);
        revalidatePath(href);
        return { ok: true, message: `Nota privada adicionada ao fim da sessão ${session.number}.`, href };
      }
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}
