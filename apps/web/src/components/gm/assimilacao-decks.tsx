'use client';

import {
  CARD_RANKS,
  CARD_SUITS,
  assimilationKindLabels,
  safeAssimilacaoBookEntryData,
} from '@codexveil/rpg-systems/assimilacao';
import { Layers, Shuffle } from 'lucide-react';
import { listCardDecks, saveCardDeck, type CardDeck, type ShownCard } from '@codexveil/database';
import { useCallback, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { AssimSymbol, withAssimSymbols } from '@/components/assimilacao/symbols';
import { BookText } from '@/components/books/book-text';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';

export interface DeckEntry {
  kind: string;
  key: string;
  name: string;
  data: unknown;
}

type DeckId = 'assimilation' | 'event';
interface DeckState {
  /** Cartas que faltam sair (código "rank:suit"), na ordem embaralhada. */
  pile: string[];
  drawn: string[];
  /** Carta mostrada ao grupo, com nome e texto (os jogadores não leem o monte). */
  shown: ShownCard | null;
}

const ALL_CARDS = CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => `${rank}:${suit}`));

function shuffled(): DeckState {
  const pile = [...ALL_CARDS];
  for (let index = pile.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [pile[index], pile[other]] = [pile[other]!, pile[index]!];
  }
  return { pile, drawn: [], shown: null };
}

/**
 * Baralhos do Assimilador: cartas de Assimilação (mutações nos Testes de Assimilação) e de
 * Eventos (gerador de aventuras). O texto vem do livro liberado na campanha; o monte fica no
 * banco (`card_decks`), igual em todos os aparelhos do mestre, e a carta mostrada aparece ao grupo.
 */
export function AssimilacaoDecks({
  campaignId,
  entries,
  initial,
}: {
  campaignId: string;
  entries: readonly DeckEntry[];
  initial: readonly CardDeck[];
}) {
  const { toast } = useToast();
  const fromServer = (list: readonly CardDeck[]) => {
    const find = (id: DeckId) => list.find((entry) => entry.deck === id);
    const pick = (id: DeckId): DeckState => {
      const saved = find(id);
      return saved && saved.pile.length + saved.drawn.length > 0
        ? { pile: saved.pile, drawn: saved.drawn, shown: saved.shown }
        : shuffled();
    };
    return { assimilation: pick('assimilation'), event: pick('event') };
  };
  const [decks, setDecks] = useState<Record<DeckId, DeckState>>(() => fromServer(initial));
  const refresh = useCallback(() => {
    void listCardDecks(getSupabaseBrowserClient(), campaignId)
      .then((list) => setDecks(fromServer(list)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fromServer só depende do embaralhamento.
  }, [campaignId]);
  useRealtimeRefresh(
    `baralhos:${campaignId}`,
    [{ table: 'card_decks', filter: `campaign_id=eq.${campaignId}` }],
    refresh,
  );
  const update = (next: Record<DeckId, DeckState>, id: DeckId) => {
    setDecks(next);
    void saveCardDeck(getSupabaseBrowserClient(), campaignId, { deck: id, ...next[id] }).catch(
      (error: unknown) =>
        toast({
          tone: 'danger',
          title: 'O baralho não foi salvo',
          description: failureMessage(error, 'Tente de novo.'),
        }),
    );
  };

  const byCard = useMemo(() => {
    const map: Record<DeckId, Map<string, DeckEntry>> = {
      assimilation: new Map(),
      event: new Map(),
    };
    for (const entry of entries) {
      if (entry.kind !== 'assimilation' && entry.kind !== 'event') continue;
      const data = entry.data as { rank?: string; suit?: string };
      if (data.rank && data.suit) map[entry.kind].set(`${data.rank}:${data.suit}`, entry);
    }
    return map;
  }, [entries]);

  const deck = (id: DeckId, title: string) => {
    const state = decks[id];
    const last = state.drawn[state.drawn.length - 1];
    const entry = last ? byCard[id].get(last) : undefined;
    const [rank, suit] = last?.split(':') ?? [];
    const card = entry
      ? id === 'assimilation'
        ? safeAssimilacaoBookEntryData('assimilation', entry.data)
        : safeAssimilacaoBookEntryData('event', entry.data)
      : null;
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-fg">
            {title} <span className="text-xs text-fg-muted">· {state.pile.length} no monte</span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={state.pile.length === 0}
              onClick={() =>
                update(
                  {
                    ...decks,
                    [id]: {
                      pile: state.pile.slice(1),
                      drawn: [...state.drawn, state.pile[0]!],
                      shown: state.shown,
                    },
                  },
                  id,
                )
              }
            >
              <Layers className="h-4 w-4" aria-hidden="true" /> Comprar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ ...decks, [id]: shuffled() }, id)}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" /> Embaralhar
            </Button>
          </div>
        </div>
        {last ? (
          <div className="flex flex-col gap-2 rounded-md bg-sunken/60 p-3" aria-live="polite">
            <p className="flex items-center gap-2 text-sm">
              <span className="rounded border border-line-strong px-1.5 font-display text-fg">
                {rank}
                <AssimSymbol code={suit ?? ''} />
              </span>
              <strong className="text-fg">
                {entry?.name ?? 'Carta sem texto no livro liberado'}
              </strong>
              {card && 'kind' in card ? (
                <span className="text-xs text-fg-muted">{assimilationKindLabels[card.kind]}</span>
              ) : null}
              <Button
                size="sm"
                variant={state.shown?.card === last ? 'secondary' : 'ghost'}
                className="ml-auto"
                onClick={() => {
                  const levels =
                    card && 'levels' in card
                      ? card.levels
                          .map(
                            (level) =>
                              `- **${level.name}**${level.requirement ? ` (${level.requirement})` : ''}: ${level.text}`,
                          )
                          .join('\n')
                      : '';
                  const shown: ShownCard | null =
                    state.shown?.card === last || !last
                      ? null
                      : {
                          card: last,
                          name: entry?.name ?? last.replace(':', ' '),
                          text: [card?.text ?? '', levels].filter(Boolean).join('\n\n'),
                        };
                  update({ ...decks, [id]: { ...state, shown } }, id);
                }}
              >
                {state.shown?.card === last ? 'Mostrando ao grupo' : 'Mostrar ao grupo'}
              </Button>
              {card && 'category' in card ? (
                <span className="text-xs text-fg-muted">{card.category}</span>
              ) : null}
            </p>
            {card?.text ? <BookText body={card.text} /> : null}
            {card && 'levels' in card ? (
              <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
                {card.levels.map((level) => (
                  <li key={level.name}>
                    {(['A', 'B', 'C'] as const).flatMap((code) =>
                      Array.from({ length: level.cost[code] }, (_, i) => (
                        <AssimSymbol key={`${code}${i}`} code={code} />
                      )),
                    )}{' '}
                    <strong className="text-fg">{level.name}</strong>
                    {level.requirement ? <> ({withAssimSymbols(level.requirement)})</> : null}:{' '}
                    {withAssimSymbols(level.text)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {state.drawn.length > 1 ? (
          <p className="text-xs text-fg-muted">
            Já saíram:{' '}
            {state.drawn
              .slice(0, -1)
              .map((code) => byCard[id].get(code)?.name ?? code.replace(':', ' '))
              .join(' · ')}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Baralhos do Assimilador"
        description={
          entries.length
            ? 'Cartas do livro liberado na campanha. O monte vale em todos os seus aparelhos; “Mostrar ao grupo” exibe a carta na aba Sessão.'
            : 'Libere o livro do Assimilação nas regras da campanha para ver o texto das cartas.'
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {deck('assimilation', 'Cartas de Assimilação')}
        {deck('event', 'Cartas de Eventos')}
      </div>
    </Card>
  );
}
