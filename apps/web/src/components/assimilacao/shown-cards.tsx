'use client';

import { listShownCards, type CardDeckId, type ShownCard } from '@codexveil/database';
import { useEffect, useState } from 'react';
import { AssimSymbol } from '@/components/assimilacao/symbols';
import { BookText } from '@/components/books/book-text';
import { Card, CardHeader } from '@/components/ui/card';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const DECK_LABELS: Record<CardDeckId, string> = {
  assimilation: 'Carta de Assimilação',
  event: 'Carta de Evento',
};

/**
 * Cartas que o mestre mostrou ao grupo (baralhos do Assimilação). Os jogadores não recebem as
 * mudanças do monte em tempo real (não podem lê-lo), então a lista é conferida a cada 15 s.
 */
export function ShownCards({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: ({ deck: CardDeckId } & ShownCard)[];
}) {
  const [cards, setCards] = useState(initial);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void listShownCards(getSupabaseBrowserClient(), campaignId)
        .then(setCards)
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [campaignId]);
  if (cards.length === 0) return null;
  return (
    <Card ornate>
      <CardHeader title="Cartas na mesa" description="Mostradas pelo Assimilador." />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const [rank, suit] = card.card.split(':');
          return (
            <section
              key={card.deck}
              className="flex flex-col gap-2 rounded-lg border border-line p-3"
            >
              <p className="eyebrow">{DECK_LABELS[card.deck]}</p>
              <p className="flex items-center gap-2 font-display text-lg text-fg">
                <span className="rounded border border-line-strong px-1.5 text-sm">
                  {rank}
                  <AssimSymbol code={suit ?? ''} />
                </span>
                {card.name}
              </p>
              {card.text ? <BookText body={card.text} /> : null}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
