'use server';

import {
  createBoard,
  createCampaign,
  createCampaignItem,
  createCampaignNote,
  createCharacterItem,
  createCreature,
  createSession,
  createSessionBlock,
  getCampaign,
  getCharacter,
  listSessionBlocks,
  listSessions,
  saveBoardItems,
  saveCharacterDraft,
  updateCreatureGmData,
} from '@codexveil/database';
import { canEditCharacterPlayState, positionBetween } from '@codexveil/domain';
import { createDnd5eDraft } from '@codexveil/rpg-systems/dnd5e';
import { createT20Draft } from '@codexveil/rpg-systems/tormenta20';
import { uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { campaignPath, characterPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tomoActionSchema } from '@/lib/tomo-actions';
import { characterAccessInput } from '@codexveil/database';

export type TomoActionResult = { ok: true; message: string; href: string } | { ok: false; message: string };

const optionalId = uuidSchema.nullable().catch(null);

/**
 * Executa uma ação proposta pelo Tomo, depois que a pessoa confirmou no chat. Tudo é validado de
 * novo aqui, e grava com o cliente da própria pessoa: o RLS decide o que ela pode criar.
 * `scope` traz a campanha e o personagem da página em que o Tomo respondeu.
 */
export async function runTomoAction(
  scope: { campaignId?: unknown; characterId?: unknown },
  input: unknown,
): Promise<TomoActionResult> {
  const user = await requireSessionUser(routes.dashboard);
  const action = tomoActionSchema.safeParse(input);
  if (!action.success) return { ok: false, message: 'Proposta inválida.' };
  const campaignId = optionalId.parse(scope.campaignId ?? null);
  const characterId = optionalId.parse(scope.characterId ?? null);
  const data = action.data;

  try {
    const supabase = await createSupabaseServerClient();
    const campaign = campaignId ? await getCampaign(supabase, campaignId, user.id) : null;
    const needCampaign = (gmOnly: boolean) => {
      if (!campaign) return 'Abra a campanha antes de pedir isso ao Tomo.';
      if (campaign.status !== 'active') return 'A campanha está arquivada.';
      if (gmOnly && campaign.role !== 'gm') return 'Só o mestre da campanha pode fazer isso.';
      return null;
    };

    switch (data.acao) {
      case 'criar_campanha': {
        const id = await createCampaign(supabase, {
          name: data.nome,
          description: data.descricao,
          systemId: data.sistema,
          characterRules: {},
          creationQuestions: [],
        });
        revalidatePath(routes.dashboard);
        return { ok: true, message: 'Campanha criada. Você é o mestre.', href: campaignPath(id) };
      }
      case 'criar_personagem': {
        // Numa campanha do mesmo sistema em que a pessoa joga, o rascunho já fica nela.
        const inCampaign = campaign && campaign.role === 'player' && campaign.status === 'active' && campaign.systemId === data.sistema ? campaign.id : null;
        const draft =
          data.sistema === 'dnd5e'
            ? {
                draft: {
                  ...createDnd5eDraft(),
                  name: data.nome,
                  details: {
                    ...createDnd5eDraft().details,
                    height: data.altura,
                    age: data.idade,
                    appearance: data.aparencia,
                    personality: data.personalidade,
                    backstory: data.historia,
                  },
                },
                campaignId: inCampaign ?? '',
                step: 'start',
              }
            : {
                draft: {
                  ...createT20Draft(),
                  name: data.nome,
                  height: data.altura,
                  age: data.idade,
                  appearance: data.aparencia,
                  personality: data.personalidade,
                  history: data.historia,
                },
                step: 'inicio',
              };
        const id = await saveCharacterDraft(supabase, { systemId: data.sistema, campaignId: inCampaign, name: data.nome, payload: draft });
        const params = new URLSearchParams(inCampaign ? { campanha: inCampaign } : { sistema: data.sistema });
        params.set('rascunho', id);
        revalidatePath(routes.characters);
        return { ok: true, message: 'Rascunho criado. Termine a criação no assistente.', href: `${routes.newCharacter}?${params.toString()}` };
      }
      case 'criar_anotacao': {
        const problem = needCampaign(false);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        await createCampaignNote(supabase, campaign.id, {
          title: data.titulo,
          body: data.texto,
          visibility: data.visibilidade === 'grupo' ? 'members' : data.visibilidade === 'mestre' ? 'gm' : 'author',
          isPinned: false,
        });
        revalidatePath(campaignPath(campaign.id, '/anotacoes'));
        return { ok: true, message: 'Anotação criada.', href: campaignPath(campaign.id, '/anotacoes') };
      }
      case 'criar_criatura': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
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
      case 'criar_item': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        await createCampaignItem(supabase, campaign.id, {
          name: data.nome,
          category: data.categoria,
          rarity: data.raridade,
          requiresAttunement: false,
          weight: null,
          value: data.valor,
          description: data.descricao,
          visibility: data.visivel_ao_grupo ? 'members' : 'gm',
        });
        revalidatePath(campaignPath(campaign.id, '/biblioteca/itens'));
        return { ok: true, message: 'Item criado na biblioteca.', href: campaignPath(campaign.id, '/biblioteca/itens') };
      }
      case 'criar_sessao': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        const sessionId = await createSession(supabase, campaign.id, {
          title: data.titulo,
          scheduledAt: null,
          isPublished: false,
          mode: 'presencial',
          physicalDice: false,
        });
        revalidatePath(campaignPath(campaign.id, '/sessoes'));
        return { ok: true, message: 'Sessão criada (não publicada).', href: campaignPath(campaign.id, `/sessoes/${sessionId}`) };
      }
      case 'nota_na_sessao': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
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
      case 'criar_quadro': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        const boardId = await createBoard(supabase, campaign.id, data.titulo);
        if (data.notas.length) {
          // Notas em grade, 4 por linha.
          const items = data.notas.map((note, index) => ({
            id: crypto.randomUUID(),
            type: 'note',
            x: (index % 4) * 240,
            y: Math.floor(index / 4) * 180,
            w: 220,
            h: 160,
            color: (['amber', 'violet', 'sky', 'emerald', 'rose', 'slate'] as const)[index % 6],
            text: note,
          }));
          await saveBoardItems(supabase, boardId, items, 1);
        }
        return { ok: true, message: 'Quadro criado.', href: `${campaignPath(campaign.id, '/quadros')}?quadro=${boardId}` };
      }
      case 'item_no_personagem': {
        const character = characterId ? await getCharacter(supabase, characterId, user.id) : null;
        if (!character) return { ok: false, message: 'Abra a ficha do personagem antes de pedir isso ao Tomo.' };
        if (!canEditCharacterPlayState(characterAccessInput(character))) return { ok: false, message: 'Você não pode alterar o inventário deste personagem.' };
        await createCharacterItem(supabase, character.id, {
          name: data.nome,
          category: data.categoria,
          quantity: data.quantidade,
          weight: null,
          description: data.descricao,
          notes: '',
          isEquipped: false,
        });
        const href = characterPath(character.id);
        revalidatePath(href);
        return { ok: true, message: 'Item adicionado ao inventário.', href };
      }
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}
