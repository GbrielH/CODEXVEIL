import {
  assimilationKindLabels,
  safeAssimilacaoBookEntryData,
  type AssimilacaoBookEntryKind,
} from '@codexveil/rpg-systems/assimilacao';
import { AssimSymbol, withAssimSymbols } from '@/components/assimilacao/symbols';
import { BookText } from './book-text';

const SUITS: Record<string, string> = { F: 'Copas', G: 'Ouros', H: 'Espadas', I: 'Paus' };

function Card({ rank, suit }: { rank: string; suit: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-sunken px-2 py-0.5 font-display text-sm text-fg">
      {rank}
      <AssimSymbol code={suit} />
      <span className="sr-only">de {SUITS[suit]}</span>
    </span>
  );
}

function Page({ page }: { page: number }) {
  return page > 0 ? <p className="text-xs text-fg-muted">Livro de Regras, página {page}.</p> : null;
}

/** Entrada de um pacote do Assimilação RPG no leitor de livros. */
export function AssimilacaoEntryView({ kind, data }: { kind: string; data: unknown }) {
  switch (kind as AssimilacaoBookEntryKind) {
    case 'section': {
      const entry = safeAssimilacaoBookEntryData('section', data);
      return entry ? (
        <div className="flex flex-col gap-3">
          <BookText body={entry.body} />
          <Page page={entry.page} />
        </div>
      ) : null;
    }
    case 'characteristic': {
      const entry = safeAssimilacaoBookEntryData('characteristic', data);
      return entry ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-wine-900/60 px-2 py-0.5 text-fg">
              {entry.cost} {entry.cost === 1 ? 'ponto' : 'pontos'} de Experiência
            </span>
            {entry.requirement ? (
              <span className="rounded-full bg-sunken px-2 py-0.5 text-fg-secondary">
                Requisito: {entry.requirement}
              </span>
            ) : null}
          </p>
          <BookText body={entry.text} />
          <Page page={entry.page} />
        </div>
      ) : null;
    }
    case 'assimilation': {
      const entry = safeAssimilacaoBookEntryData('assimilation', data);
      return entry ? (
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
            <Card rank={entry.rank} suit={entry.suit} />
            Assimilação {assimilationKindLabels[entry.kind]}
          </p>
          {entry.text ? <BookText body={entry.text} /> : null}
          <ol className="flex flex-col gap-3">
            {entry.levels.map((level) => (
              <li key={level.name} className="rounded-lg border border-line bg-card/60 p-3">
                <p className="flex flex-wrap items-center gap-2 font-display text-base text-fg">
                  <span className="inline-flex gap-px">
                    {(['A', 'B', 'C'] as const).flatMap((code) =>
                      Array.from({ length: level.cost[code] }, (_, index) => (
                        <AssimSymbol key={`${code}${index}`} code={code} />
                      )),
                    )}
                  </span>
                  {level.name}
                  {level.requirement ? (
                    <span className="text-xs font-normal text-fg-muted">
                      requer {withAssimSymbols(level.requirement)}
                    </span>
                  ) : null}
                </p>
                <BookText
                  body={level.text}
                  className="mt-1 text-sm leading-relaxed text-fg-secondary"
                />
              </li>
            ))}
          </ol>
          <Page page={entry.page} />
        </div>
      ) : null;
    }
    case 'artifact': {
      const entry = safeAssimilacaoBookEntryData('artifact', data);
      return entry ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="rounded-full bg-sunken px-2 py-0.5 text-fg">
              Escassez {entry.scarcity}
            </span>
          </p>
          <BookText body={entry.text} />
          <Page page={entry.page} />
        </div>
      ) : null;
    }
    case 'event': {
      const entry = safeAssimilacaoBookEntryData('event', data);
      return entry ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
            <Card rank={entry.rank} suit={entry.suit} />
            {entry.category}
          </p>
          <BookText body={entry.text} />
          <Page page={entry.page} />
        </div>
      ) : null;
    }
    default:
      return null;
  }
}
