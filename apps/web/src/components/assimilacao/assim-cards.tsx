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
 * Carta de Assimilação na ficha: canto com valor e naipe, tipo, os Níveis com custo (os já
 * adquiridos acesos) e as ações (evoluir, Pressões, remover).
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
  const [open, setOpen] = useState(false);
  return (
    <article
      className={cx(
        'flex flex-col gap-2 rounded-xl bg-gradient-to-br p-3 shadow-lg ring-1',
        KIND_TONES[kind],
      )}
    >
      <header className="flex items-start gap-3">
        {card ? <CardCorner rank={card.rank} suit={card.suit} /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-fg">{name}</p>
          <p className="text-[0.7rem] uppercase tracking-wide text-fg-muted">
            {assimilationKindLabels[kind]}
            {card?.levels.length
              ? ` · Nível ${Math.min(level, card.levels.length)} de ${card.levels.length}`
              : ''}
          </p>
        </div>
        {actions}
      </header>
      {card?.levels.length ? (
        <ol className="flex flex-col gap-1">
          {card.levels.map((entry, index) => {
            const owned = index < level;
            return (
              <li
                key={entry.name}
                className={cx(
                  'rounded-md px-2 py-1 text-sm',
                  owned ? 'bg-canvas/50 text-fg' : 'text-fg-muted opacity-60',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {index + 1}. {entry.name}
                  </span>
                  <CardCost cost={entry.cost} />
                </div>
                {open && entry.text ? (
                  <p className="mt-1 text-xs text-fg-secondary">{withAssimSymbols(entry.text)}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {card && (card.text || card.levels.some((entry) => entry.text)) ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="self-start text-xs text-fg-accent hover:underline"
        >
          {open ? 'Esconder os textos' : 'Ver os textos da carta'}
        </button>
      ) : null}
      {open && card?.text ? (
        <p className="text-xs text-fg-secondary">{withAssimSymbols(card.text)}</p>
      ) : null}
      {children}
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
