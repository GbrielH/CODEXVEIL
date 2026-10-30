/**
 * Objetivos de Conflito (Assimilação RPG): contadores de Sucessos da cena. O mestre cria e
 * ajusta; o grupo vê os visíveis em tempo real (`conflict_objectives`).
 */
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json } from '../types.gen';

export const CONFLICT_OBJECTIVE_KINDS = ['principal', 'secundario', 'ameaca'] as const;
export type ConflictObjectiveKind = (typeof CONFLICT_OBJECTIVE_KINDS)[number];

export const conflictObjectiveKindLabels: Record<ConflictObjectiveKind, string> = {
  principal: 'Objetivo Principal',
  secundario: 'Objetivo Secundário',
  ameaca: 'Ameaça a neutralizar',
};

export interface ConflictObjective {
  id: string;
  name: string;
  kind: ConflictObjectiveKind;
  needed: number;
  progress: number;
  visible: boolean;
}

const COLUMNS = 'id, name, kind, needed, progress, visible' as const;

function toObjective(row: {
  id: string;
  name: string;
  kind: string;
  needed: number;
  progress: number;
  visible: boolean;
}): ConflictObjective {
  const kind = (CONFLICT_OBJECTIVE_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as ConflictObjectiveKind)
    : 'principal';
  return {
    id: row.id,
    name: row.name,
    kind,
    needed: row.needed,
    progress: row.progress,
    visible: row.visible,
  };
}

export async function listConflictObjectives(
  client: CodexveilClient,
  campaignId: string,
): Promise<ConflictObjective[]> {
  const { data, error } = await client
    .from('conflict_objectives')
    .select(COLUMNS)
    .eq('campaign_id', campaignId)
    .order('sort_order')
    .order('created_at');
  if (error) throw toAppError(error);
  return data.map(toObjective);
}

export async function createConflictObjective(
  client: CodexveilClient,
  campaignId: string,
  input: { name: string; kind: ConflictObjectiveKind; needed: number; visible?: boolean },
): Promise<ConflictObjective> {
  const { data, error } = await client
    .from('conflict_objectives')
    .insert({
      campaign_id: campaignId,
      name: input.name,
      kind: input.kind,
      needed: input.needed,
      visible: input.visible ?? true,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toObjective(data);
}

export async function updateConflictObjective(
  client: CodexveilClient,
  objectiveId: string,
  fields: Partial<Pick<ConflictObjective, 'name' | 'kind' | 'needed' | 'progress' | 'visible'>>,
): Promise<ConflictObjective> {
  const { data, error } = await client
    .from('conflict_objectives')
    .update(fields)
    .eq('id', objectiveId)
    .select(COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toObjective(data);
}

export async function deleteConflictObjective(
  client: CodexveilClient,
  objectiveId: string,
): Promise<void> {
  const { error } = await client.from('conflict_objectives').delete().eq('id', objectiveId);
  if (error) throw toAppError(error);
}

/** Baralhos do Assimilador (`assimilation` e `event`); cartas como "rank:naipe" (ex.: "Q:H"). */
export type CardDeckId = 'assimilation' | 'event';

/** Carta mostrada ao grupo: código, nome e texto (com os marcadores de símbolo). */
export interface ShownCard {
  card: string;
  name: string;
  text: string;
}

export interface CardDeck {
  deck: CardDeckId;
  pile: string[];
  drawn: string[];
  shown: ShownCard | null;
}

function toShown(value: unknown): ShownCard | null {
  if (!value || typeof value !== 'object') return null;
  const { card, name, text } = value as Record<string, unknown>;
  if (typeof card !== 'string') return null;
  return {
    card,
    name: typeof name === 'string' ? name : '',
    text: typeof text === 'string' ? text : '',
  };
}

export async function listCardDecks(
  client: CodexveilClient,
  campaignId: string,
): Promise<CardDeck[]> {
  const { data, error } = await client
    .from('card_decks')
    .select('deck, pile, drawn, shown')
    .eq('campaign_id', campaignId);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    deck: row.deck as CardDeckId,
    pile: row.pile,
    drawn: row.drawn,
    shown: toShown(row.shown),
  }));
}

/** Grava o estado de um baralho (cria na primeira vez). Só o mestre. */
export async function saveCardDeck(
  client: CodexveilClient,
  campaignId: string,
  deck: CardDeck,
): Promise<void> {
  const { error } = await client
    .from('card_decks')
    .upsert(
      {
        campaign_id: campaignId,
        deck: deck.deck,
        pile: deck.pile,
        drawn: deck.drawn,
        shown: deck.shown as unknown as Json,
      },
      { onConflict: 'campaign_id,deck' },
    );
  if (error) throw toAppError(error);
}

/** Cartas que o mestre mostrou ao grupo (os jogadores não leem o monte nem as cartas de Eventos). */
export async function listShownCards(
  client: CodexveilClient,
  campaignId: string,
): Promise<({ deck: CardDeckId } & ShownCard)[]> {
  const { data, error } = await client.rpc('campaign_shown_cards', { p_campaign_id: campaignId });
  if (error) throw toAppError(error);
  // A função devolve linhas (deck, shown); o gerador de tipos não descreve funções de tabela.
  const rows = (Array.isArray(data) ? data : []) as { deck: string; shown: unknown }[];
  return rows.flatMap((row) => {
    const shown = toShown(row.shown);
    return shown ? [{ deck: row.deck as CardDeckId, ...shown }] : [];
  });
}
