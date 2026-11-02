import {
  createBoard,
  createCampaign,
  createCampaignItem,
  createCampaignNote,
  createCharacterAbility,
  createCharacterItem,
  createCreature,
  createSession,
  createSessionBlock,
  getCampaign,
  adjustCharacterResource,
  getCharacter,
  listCampaignCharacters,
  listCharacterResources,
  recordMoney,
  saveCharacterSheet,
  listSessionBlocks,
  listSessions,
  saveBoardItems,
  saveCharacterDraft,
  updateCreatureGmData,
  addMapToken,
  getActiveMap,
} from '@codexveil/database';
import {
  canEditCharacterPlayState,
  canEditCharacterSheet,
  positionBetween,
} from '@codexveil/domain';
import { assimilacaoStatBlockSchema } from '@codexveil/rpg-systems/assimilacao';
import { createDnd5eDraft, dnd5eStatBlockSchema } from '@codexveil/rpg-systems/dnd5e';
import { createT20Draft, t20StatBlockSchema } from '@codexveil/rpg-systems/tormenta20';
import { uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage } from '@/lib/actions';
import { campaignPath, characterPath, routes } from '@/lib/routes';
import { tomoActionSchema } from '@/lib/tomo-actions';

/**
 * Ficha de estatísticas proposta pelo Tomo, no formato do sistema. O que não passar no esquema
 * não é gravado como ficha: volta em texto para as anotações do mestre.
 */
function creatureStats(
  systemId: string,
  name: string,
  size: string,
  raw: Record<string, unknown> | undefined,
): { stats: Record<string, unknown>; leftover: string } {
  if (!raw) return { stats: {}, leftover: '' };
  const parsed =
    systemId === 'tormenta20'
      ? t20StatBlockSchema.safeParse(raw)
      : systemId === 'assimilacao'
        ? assimilacaoStatBlockSchema.safeParse({ name, ...raw })
        : dnd5eStatBlockSchema.safeParse({ size, ...raw });
  return parsed.success
    ? { stats: parsed.data, leftover: '' }
    : { stats: {}, leftover: `Estatísticas sugeridas pelo Tomo:\n${JSON.stringify(raw, null, 2)}` };
}
import { characterAccessInput, type CodexveilClient } from '@codexveil/database';

export type TomoActionResult =
  { ok: true; message: string; href: string } | { ok: false; message: string };

const optionalId = uuidSchema.nullable().catch(null);

/**
 * Executa uma ação proposta pelo Tomo, depois que a pessoa confirmou no chat (site ou app). Tudo é
 * validado de novo aqui, e grava com o cliente da própria pessoa: o RLS decide o que ela pode
 * criar. `scope` traz a campanha e o personagem da página em que o Tomo respondeu.
 */
export async function executeTomoAction(
  supabase: CodexveilClient,
  user: { id: string },
  scope: { campaignId?: unknown; characterId?: unknown },
  input: unknown,
): Promise<TomoActionResult> {
  const action = tomoActionSchema.safeParse(input);
  if (!action.success) return { ok: false, message: 'Proposta inválida.' };
  const campaignId = optionalId.parse(scope.campaignId ?? null);
  const characterId = optionalId.parse(scope.characterId ?? null);
  const data = action.data;

  try {
    const campaign = campaignId ? await getCampaign(supabase, campaignId, user.id) : null;
    // Ficha em questão: a aberta (/personagens/…) ou, dentro de uma campanha ("Meu personagem"),
    // o personagem da pessoa nela.
    const resolveCharacter = async () => {
      if (characterId) return getCharacter(supabase, characterId, user.id);
      if (!campaign) return null;
      const own = (await listCampaignCharacters(supabase, campaign.id)).find(
        (entry) => entry.ownerId === user.id,
      );
      return own ? getCharacter(supabase, own.id, user.id) : null;
    };
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
        const inCampaign =
          campaign &&
          campaign.role === 'player' &&
          campaign.status === 'active' &&
          campaign.systemId === data.sistema
            ? campaign.id
            : null;
        if (data.sistema === 'assimilacao') {
          // O assistente do Assimilação ainda não guarda rascunho: abre a criação na campanha certa
          // (as ideias do Tomo continuam na conversa para copiar).
          const params = new URLSearchParams(
            inCampaign ? { campanha: inCampaign } : { sistema: 'assimilacao' },
          );
          return {
            ok: true,
            message: 'Abra a criação e use as ideias do Tomo.',
            href: `${routes.newCharacter}?${params.toString()}`,
          };
        }
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
        const id = await saveCharacterDraft(supabase, {
          systemId: data.sistema,
          campaignId: inCampaign,
          name: data.nome,
          payload: draft,
        });
        const params = new URLSearchParams(
          inCampaign ? { campanha: inCampaign } : { sistema: data.sistema },
        );
        params.set('rascunho', id);
        revalidatePath(routes.characters);
        return {
          ok: true,
          message: 'Rascunho criado. Termine a criação no assistente.',
          href: `${routes.newCharacter}?${params.toString()}`,
        };
      }
      case 'criar_anotacao': {
        const problem = needCampaign(false);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        await createCampaignNote(supabase, campaign.id, {
          title: data.titulo,
          body: data.texto,
          visibility: 'author',
          isPinned: false,
        });
        revalidatePath(campaignPath(campaign.id, '/anotacoes'));
        return {
          ok: true,
          message: 'Anotação criada.',
          href: campaignPath(campaign.id, '/anotacoes'),
        };
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
        const sheet = creatureStats(campaign.systemId, data.nome, data.tamanho, data.estatisticas);
        if (data.segredos || data.estatisticas)
          await updateCreatureGmData(supabase, creatureId, {
            stats: sheet.stats as never,
            notes: sheet.leftover,
            secrets: data.segredos,
          });
        revalidatePath(campaignPath(campaign.id, '/biblioteca'));
        return {
          ok: true,
          message: `${data.tipo === 'npc' ? 'NPC' : 'Monstro'} criado na biblioteca (oculto dos jogadores).`,
          href: campaignPath(campaign.id, `/biblioteca/${creatureId}`),
        };
      }
      case 'criar_encontro': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        const created: {
          id: string;
          name: string;
          kind: 'npc' | 'monster';
          size: string;
          count: number;
        }[] = [];
        for (const entry of data.criaturas) {
          const kind = entry.tipo === 'npc' ? 'npc' : 'monster';
          const id = await createCreature(supabase, campaign.id, {
            kind,
            name: entry.nome,
            subtitle: data.titulo,
            description: entry.descricao,
            visibility: 'gm',
            size: entry.tamanho,
          });
          const sheet = creatureStats(
            campaign.systemId,
            entry.nome,
            entry.tamanho,
            entry.estatisticas,
          );
          if (entry.estatisticas)
            await updateCreatureGmData(supabase, id, {
              stats: sheet.stats as never,
              notes: sheet.leftover,
              secrets: '',
            });
          created.push({
            id,
            name: entry.nome,
            kind,
            size: entry.tamanho,
            count: entry.quantidade,
          });
        }
        // Tokens no mapa ativo, ocultos, agrupados num canto livre (o mestre arrasta depois).
        const map = await getActiveMap(supabase, campaign.id);
        let placed = 0;
        if (map) {
          let x = 1;
          let y = 1;
          for (const entry of created)
            for (let copy = 0; copy < entry.count; copy++) {
              await addMapToken(supabase, {
                mapId: map.id,
                campaignId: campaign.id,
                kind: 'creature',
                creatureId: entry.id,
                label: entry.count > 1 ? `${entry.name} ${copy + 1}` : entry.name,
                x: Math.min(x, map.cols - 1),
                y: Math.min(y, map.rows - 1),
                size: entry.size as never,
                isHidden: true,
              });
              placed += 1;
              x += 2;
              if (x > Math.min(map.cols - 2, 9)) {
                x = 1;
                y += 2;
              }
            }
        }
        // Cita as criaturas no roteiro da sessão, se ela foi dita.
        let sessionNote = '';
        if (data.sessao) {
          const session = (await listSessions(supabase, campaign.id)).find(
            (item) => item.number === data.sessao,
          );
          if (session) {
            const blocks = await listSessionBlocks(supabase, session.id);
            let last = blocks.at(-1)?.position ?? null;
            const add = async (content: Parameters<typeof createSessionBlock>[1]['content']) => {
              const position = positionBetween(last, null);
              last = position;
              await createSessionBlock(supabase, {
                sessionId: session.id,
                campaignId: campaign.id,
                position,
                visibility: 'gm',
                content,
              });
            };
            await add({ type: 'subheading', data: { text: data.titulo } });
            for (const entry of created)
              await add({
                type: entry.kind === 'npc' ? 'npc_ref' : 'monster_ref',
                data: { creatureId: entry.id, note: entry.count > 1 ? `${entry.count}×` : '' },
              });
            sessionNote = ` e citado no roteiro da sessão ${session.number}`;
          }
        }
        revalidatePath(campaignPath(campaign.id, '/biblioteca'));
        revalidatePath(campaignPath(campaign.id, '/mapa'));
        return {
          ok: true,
          message: `Encontro montado: ${created.length} criatura(s) na biblioteca${map ? `, ${placed} token(s) ocultos no mapa "${map.name}"` : ' (sem mapa ativo: nenhum token posto)'}${sessionNote}.`,
          href: campaignPath(campaign.id, map ? '/mapa' : '/biblioteca'),
        };
      }
      case 'bloco_no_roteiro': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        const session = (await listSessions(supabase, campaign.id)).find(
          (entry) => entry.number === data.sessao,
        );
        if (!session)
          return { ok: false, message: `Não achei a sessão ${data.sessao} nesta campanha.` };
        const blocks = await listSessionBlocks(supabase, session.id);
        await createSessionBlock(supabase, {
          sessionId: session.id,
          campaignId: campaign.id,
          position: positionBetween(blocks.at(-1)?.position ?? null, null),
          visibility: data.tipo === 'nota_do_mestre' ? 'gm' : 'members',
          content:
            data.tipo === 'titulo'
              ? { type: 'heading', data: { text: data.texto.slice(0, 200) } }
              : data.tipo === 'nota_do_mestre'
                ? { type: 'gm_note', data: { text: data.texto } }
                : { type: 'paragraph', data: { text: data.texto } },
        });
        const href = campaignPath(campaign.id, `/sessoes/${session.id}`);
        revalidatePath(href);
        return {
          ok: true,
          message: `Bloco adicionado ao fim do roteiro da sessão ${session.number}.`,
          href,
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
        return {
          ok: true,
          message: 'Item criado na biblioteca.',
          href: campaignPath(campaign.id, '/biblioteca/itens'),
        };
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
        return {
          ok: true,
          message: 'Sessão criada (não publicada).',
          href: campaignPath(campaign.id, `/sessoes/${sessionId}`),
        };
      }
      case 'nota_na_sessao': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        const session = (await listSessions(supabase, campaign.id)).find(
          (entry) => entry.number === data.sessao,
        );
        if (!session)
          return { ok: false, message: `Não achei a sessão ${data.sessao} nesta campanha.` };
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
        return {
          ok: true,
          message: `Nota privada adicionada ao fim da sessão ${session.number}.`,
          href,
        };
      }
      case 'criar_quadro': {
        const problem = needCampaign(true);
        if (problem || !campaign) return { ok: false, message: problem ?? '' };
        // O quadro é de uma sessão: a em andamento ou, sem ela, a mais recente.
        const sessions = await listSessions(supabase, campaign.id);
        const target =
          sessions.find((entry) => entry.status === 'in_progress') ??
          [...sessions].sort((a, b) => b.number - a.number)[0];
        if (!target)
          return {
            ok: false,
            message: 'Crie uma sessão primeiro: cada quadro fica dentro de uma sessão.',
          };
        const boardId = await createBoard(supabase, campaign.id, target.id, data.titulo);
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
        return {
          ok: true,
          message: `Quadro criado na sessão ${target.number}.`,
          href: `${campaignPath(campaign.id, `/sessoes/${target.id}/editar`)}?aba=quadro&quadro=${boardId}`,
        };
      }
      case 'editar_personagem': {
        const character = await resolveCharacter();
        if (!character)
          return {
            ok: false,
            message:
              'Não achei o personagem: abra a ficha dele (ou a aba Meu personagem da campanha).',
          };
        if (!canEditCharacterSheet(characterAccessInput(character)))
          return { ok: false, message: 'Você não pode alterar esta ficha.' };
        const sheet = (character.sheet ?? {}) as Record<
          string,
          Record<string, unknown> | undefined
        >;
        const texts = {
          aparencia: data.aparencia,
          personalidade: data.personalidade,
          historia: data.historia,
        };
        let next: unknown = character.sheet;
        if (Object.values(texts).some((value) => value !== undefined)) {
          if (character.systemId === 'tormenta20') {
            next = {
              ...sheet,
              identity: {
                ...sheet.identity,
                ...(texts.aparencia !== undefined ? { appearance: texts.aparencia } : {}),
                ...(texts.personalidade !== undefined ? { personality: texts.personalidade } : {}),
                ...(texts.historia !== undefined ? { history: texts.historia } : {}),
              },
            };
          } else {
            next = {
              ...sheet,
              details: {
                ...sheet.details,
                ...(texts.aparencia !== undefined ? { appearance: texts.aparencia } : {}),
                ...(texts.personalidade !== undefined ? { personality: texts.personalidade } : {}),
                ...(texts.historia !== undefined ? { backstory: texts.historia } : {}),
              },
            };
          }
        }
        await saveCharacterSheet(supabase, character.id, character.version, {
          ...(data.nome ? { name: data.nome } : {}),
          ...(next !== character.sheet ? { sheet: next } : {}),
        });
        const href = characterPath(character.id);
        revalidatePath(href);
        return { ok: true, message: 'Ficha alterada.', href };
      }
      case 'ajustar_recurso': {
        const character = await resolveCharacter();
        if (!character)
          return {
            ok: false,
            message:
              'Não achei o personagem: abra a ficha dele (ou a aba Meu personagem da campanha).',
          };
        if (!canEditCharacterPlayState(characterAccessInput(character)))
          return { ok: false, message: 'Você não pode alterar este personagem.' };
        const t20 = character.systemId === 'tormenta20';
        const key =
          data.recurso === 'pv'
            ? 'hp'
            : data.recurso === 'pm'
              ? t20
                ? 'pm'
                : null
              : t20
                ? 'tibar'
                : `currency_${data.moeda ?? 'gp'}`;
        const track = key
          ? (await listCharacterResources(supabase, character.id)).find(
              (entry) => entry.key === key,
            )
          : undefined;
        if (!track) return { ok: false, message: 'Esta ficha não tem esse recurso.' };
        // Dinheiro gasto ou recebido entra no histórico de moedas.
        if (
          data.recurso === 'dinheiro' &&
          (data.operacao === 'gastar' || data.operacao === 'receber') &&
          data.valor > 0
        ) {
          await recordMoney(
            supabase,
            character.id,
            track.key,
            data.operacao === 'gastar' ? -data.valor : data.valor,
            'Pelo Tomo',
          );
          const href = characterPath(character.id);
          revalidatePath(href);
          return { ok: true, message: 'Feito (registrado no histórico de moedas).', href };
        }
        const operation =
          data.operacao === 'dano'
            ? 'damage'
            : data.operacao === 'cura'
              ? 'heal'
              : data.operacao === 'gastar'
                ? 'spend'
                : 'set_current';
        const amount = data.operacao === 'receber' ? track.current + data.valor : data.valor;
        await adjustCharacterResource(supabase, track.id, operation, amount);
        const href = characterPath(character.id);
        revalidatePath(href);
        return { ok: true, message: 'Feito.', href };
      }
      case 'habilidade_no_personagem': {
        const character = await resolveCharacter();
        if (!character)
          return {
            ok: false,
            message:
              'Não achei o personagem: abra a ficha dele (ou a aba Meu personagem da campanha).',
          };
        if (!canEditCharacterSheet(characterAccessInput(character)))
          return { ok: false, message: 'Você não pode alterar esta ficha.' };
        const kind =
          data.tipo === 'magia'
            ? 'spell'
            : data.tipo === 'poder' || data.tipo === 'talento'
              ? 'feat'
              : 'class_feature';
        await createCharacterAbility(supabase, character.id, {
          kind,
          name: data.nome,
          source: 'Adicionado pelo Tomo',
          description: data.descricao,
          data: {},
          resourceId: null,
        });
        const href = characterPath(character.id);
        revalidatePath(href);
        return { ok: true, message: 'Adicionado à ficha.', href };
      }
      case 'item_no_personagem': {
        const character = await resolveCharacter();
        if (!character)
          return {
            ok: false,
            message:
              'Não achei o personagem: abra a ficha dele (ou a aba Meu personagem da campanha).',
          };
        if (!canEditCharacterPlayState(characterAccessInput(character)))
          return { ok: false, message: 'Você não pode alterar o inventário deste personagem.' };
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
