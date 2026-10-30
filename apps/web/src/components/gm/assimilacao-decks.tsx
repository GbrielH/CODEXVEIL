'use client';

import {
  CARD_RANKS,
  CARD_SUITS,
  assimilationKindLabels,
  safeAssimilacaoBookEntryData,
} from '@codexveil/rpg-systems/assimilacao';
import { Layers, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
}

const ALL_CARDS = CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => `${rank}:${suit}`));

function shuffled(): DeckState {
  const pile = [...ALL_CARDS];
  for (let index = pile.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [pile[index], pile[other]] = [pile[other]!, pile[index]!];
  }
  return { pile, drawn: [] };
}

/**
 * Baralhos do Assimilador: cartas de Assimilação (mutações nos Testes de Assimilação) e de
 * Eventos (gerador de aventuras). O texto vem do livro liberado na campanha; o estado do
 * baralho fica neste navegador.
 */
export function AssimilacaoDecks({
  campaignId,
  entries,
}: {
  campaignId: string;
  entries: readonly DeckEntry[];
}) {
  const storageKey = `codexveil:asrpg-baralhos:${campaignId}`;
  const [decks, setDecks] = useState<Record<DeckId, DeckState>>(() => ({
    assimilation: shuffled(),
    event: shuffled(),
  }));
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- retoma o baralho deste navegador depois de montar.
      if (saved) setDecks(JSON.parse(saved) as Record<DeckId, DeckState>);
    } catch {
      // Sem armazenamento: começa embaralhado.
    }
  }, [storageKey]);
  const update = (next: Record<DeckId, DeckState>) => {
    setDecks(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Sem armazenamento: o baralho vale só até recarregar.
    }
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
                update({
                  ...decks,
                  [id]: { pile: state.pile.slice(1), drawn: [...state.drawn, state.pile[0]!] },
                })
              }
            >
              <Layers className="h-4 w-4" aria-hidden="true" /> Comprar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ ...decks, [id]: shuffled() })}
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
            ? 'Cartas do livro liberado na campanha. O monte fica guardado neste navegador.'
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
