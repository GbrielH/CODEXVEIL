'use client';

import {
  ASSIMILATION_KINDS,
  assimilationKindLabels,
  type AssimilationKind,
} from '@codexveil/rpg-systems/assimilacao';
import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cx } from '@/lib/cx';
import { AssimMarkIcon } from './die-face';
import { withAssimSymbols } from './symbols';

export interface AssimCard {
  name: string;
  kind: AssimilationKind;
  rank: string;
  suit: string;
  text: string;
  levels: {
    name: string;
    requirement: string;
    text: string;
    cost: { A: number; B: number; C: number };
  }[];
}

const SUIT_GLYPHS: Record<string, { glyph: string; red: boolean; label: string }> = {
  F: { glyph: '♥', red: true, label: 'Copas' },
  G: { glyph: '♦', red: true, label: 'Ouros' },
  H: { glyph: '♠', red: false, label: 'Espadas' },
  I: { glyph: '♣', red: false, label: 'Paus' },
};

/** Faixa de cor de cada tipo de Assimilação (como as fichas do livro, em tons próprios). */
const KIND_TONES: Record<AssimilationKind, string> = {
  evolutiva: 'from-verdigris-900 to-charcoal-900 ring-verdigris-400/40',
  adaptativa: 'from-arcane-900 to-charcoal-900 ring-arcane-400/40',
  inoportuna: 'from-ember-900 to-charcoal-900 ring-ember-400/40',
  singular: 'from-amber-900 to-charcoal-900 ring-amber-400/40',
};

/** Canto da carta: valor e naipe. */
function CardCorner({ rank, suit }: { rank: string; suit: string }) {
  const meta = SUIT_GLYPHS[suit];
  return (
    <span
      className={cx(
        'flex flex-col items-center leading-none font-display',
        meta?.red ? 'text-ember-300' : 'text-parchment-100',
      )}
      aria-label={`${rank} de ${meta?.label ?? suit}`}
    >
      <span className="text-base">{rank}</span>
      <span className="text-sm">{meta?.glyph ?? suit}</span>
    </span>
  );
}

/** Custo de um Nível em símbolos de dado. */
export function CardCost({ cost }: { cost: AssimCard['levels'][number]['cost'] }) {
  const parts = (
    [
      ['sucesso', cost.A],
      ['adaptacao', cost.B],
      ['pressao', cost.C],
    ] as const
  ).filter(([, amount]) => amount > 0);
  if (!parts.length) return <span className="text-xs text-fg-muted">sem custo</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {parts.map(([mark, amount]) => (
        <span key={mark} className="inline-flex items-center gap-0.5 text-xs text-fg">
          {amount}×
          <AssimMarkIcon
            mark={mark}
            className={cx(
              'h-3.5 w-3.5',
              mark === 'sucesso'
                ? 'text-verdigris-300'
                : mark === 'adaptacao'
                  ? 'text-arcane-300'
                  : 'text-ember-300',
            )}
          />
        </span>
      ))}
    </span>
  );
}

/**
 * Carta de Assimilação no modelo do livro: símbolo da categoria no canto esquerdo, valor do
 * baralho no direito, faixa com o nome e a tabela de mutações (custo à esquerda, texto resumido à
 * direita). Os Níveis já adquiridos ficam acesos.
 */
export function AssimCardTile({
  name,
  kind,
  card,
  level,
  actions,
  children,
}: {
  name: string;
  kind: AssimilationKind;
  card: AssimCard | undefined;
  /** Níveis adquiridos (1 = só o primeiro). */
  level: number;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const suit = card ? SUIT_GLYPHS[card.suit] : undefined;
  return (
    <article
      className={cx(
        'relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-b shadow-xl ring-2',
        KIND_TONES[kind],
      )}
    >
      {/* Topo: categoria (naipe) e valor, com o tipo no meio. */}
      <header className="flex items-start justify-between gap-2 p-3 pb-6">
        <span
          title={assimilationKindLabels[kind]}
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-full bg-canvas/70 text-xl ring-1 ring-parchment-300/40',
            suit?.red ? 'text-ember-300' : 'text-parchment-100',
          )}
        >
          {suit?.glyph ?? '✦'}
        </span>
        <span className="mt-1 text-[0.65rem] tracking-[0.2em] text-fg-muted uppercase">
          {assimilationKindLabels[kind]}
        </span>
        <span className="flex items-center gap-1">
          {actions}
          {card ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas/70 font-display text-lg text-fg ring-1 ring-parchment-300/40">
              {card.rank}
            </span>
          ) : null}
        </span>
      </header>
      {/* Faixa com o nome, como o título da carta. */}
      <div className="mx-3 -skew-x-6 rounded-sm bg-canvas/80 px-3 py-1.5 text-center ring-1 ring-parchment-300/30">
        <p className="skew-x-6 font-display text-sm tracking-wide text-fg uppercase">{name}</p>
      </div>
      {card?.levels.length ? (
        <ol className="m-3 flex flex-col divide-y divide-line/60 overflow-hidden rounded-lg bg-canvas/75 ring-1 ring-line">
          {card.levels.map((entry, index) => {
            const owned = index < level;
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => setOpen(open === index ? null : index)}
                  aria-expanded={open === index}
                  className={cx(
                    'grid w-full grid-cols-[4.5rem_1fr] items-center gap-2 px-2 py-1.5 text-left text-xs',
                    owned ? 'text-fg' : 'text-fg-muted opacity-55',
                  )}
                >
                  <span className="flex justify-center border-r border-line/60 pr-2">
                    <CardCost cost={entry.cost} />
                  </span>
                  <span>
                    <span
                      className={cx(
                        'mr-1 rounded px-1 font-semibold uppercase',
                        owned ? 'bg-wine-700/80 text-parchment-50' : 'bg-sunken',
                      )}
                    >
                      {entry.name}
                    </span>
                    {entry.requirement ? (
                      <span className="text-fg-secondary">
                        ({withAssimSymbols(entry.requirement)}){' '}
                      </span>
                    ) : null}
                    {open === index ? null : (
                      <span className="line-clamp-1 text-fg-secondary">
                        {withAssimSymbols(entry.text)}
                      </span>
                    )}
                  </span>
                </button>
                {open === index && entry.text ? (
                  <p className="px-3 pb-2 text-xs text-fg-secondary">
                    {withAssimSymbols(entry.text)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="h-3" />
      )}
      {card?.text ? (
        <p className="mx-3 mb-3 text-xs text-fg-secondary italic">{withAssimSymbols(card.text)}</p>
      ) : null}
      {children ? <div className="flex flex-col gap-2 px-3 pb-3">{children}</div> : null}
    </article>
  );
}

/** Galeria das cartas do livro, por tipo e com busca; escolher abre a carta com "Adicionar". */
export function AssimCardGallery({
  open,
  onClose,
  cards,
  owned,
  onPick,
  title = 'Cartas de Assimilação',
  confirmLabel = 'Adicionar à ficha',
}: {
  open: boolean;
  onClose: () => void;
  cards: AssimCard[];
  owned: readonly string[];
  onPick: (card: AssimCard) => void;
  title?: string;
  confirmLabel?: string;
}) {
  const [kind, setKind] = useState<AssimilationKind | 'todas'>('todas');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<AssimCard | null>(null);
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return cards.filter(
      (card) =>
        (kind === 'todas' || card.kind === kind) &&
        (!term || card.name.toLowerCase().includes(term)),
    );
  }, [cards, kind, query]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {chosen ? (
        <div className="flex flex-col gap-3">
          <AssimCardTile name={chosen.name} kind={chosen.kind} card={chosen} level={1} />
          {chosen.text ? (
            <p className="text-sm text-fg-secondary">{withAssimSymbols(chosen.text)}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setChosen(null)}>
              Voltar
            </Button>
            <Button
              disabled={owned.includes(chosen.name)}
              onClick={() => {
                onPick(chosen);
                setChosen(null);
                onClose();
              }}
            >
              {owned.includes(chosen.name) ? 'Já está na ficha' : confirmLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['todas', ...ASSIMILATION_KINDS] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={kind === key}
                onClick={() => setKind(key)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs ring-1 transition-colors',
                  kind === key ? 'bg-hover text-fg ring-fg-brand' : 'text-fg-secondary ring-line',
                )}
              >
                {key === 'todas' ? 'Todas' : assimilationKindLabels[key]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-md bg-sunken px-3 ring-1 ring-line">
            <Search className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar carta"
              className="h-10 flex-1 bg-transparent text-sm text-fg outline-none"
            />
          </label>
          <ul className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {shown.map((card) => (
              <li key={card.name}>
                <button
                  type="button"
                  onClick={() => setChosen(card)}
                  className={cx(
                    'flex aspect-[5/7] w-full flex-col justify-between rounded-lg bg-gradient-to-br p-2 text-left ring-1 transition-transform hover:-translate-y-0.5',
                    KIND_TONES[card.kind],
                    owned.includes(card.name) && 'opacity-50',
                  )}
                >
                  <CardCorner rank={card.rank} suit={card.suit} />
                  <span className="font-display text-sm text-fg">{card.name}</span>
                  <span className="text-[0.65rem] uppercase text-fg-muted">
                    {assimilationKindLabels[card.kind]} · {card.levels.length} Níveis
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="col-span-full text-sm text-fg-muted">Nenhuma carta encontrada.</li>
            ) : null}
          </ul>
        </div>
      )}
    </Modal>
  );
}
