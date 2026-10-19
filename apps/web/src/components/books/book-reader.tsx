import { getBookEntry, listBookEntryIndex, type BookEntryListing } from '@codexveil/database';
import {
  findSourcebook,
  isSourcebookId,
  sourcebookCategoryLabels,
  spellSchoolLabels,
  type BookEntryKind,
  type SourcebookCategory,
  type SpellSchool,
} from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { BOOK_KIND_SLUGS, bookKindFromSlug, bookKindLabel, type BookReaderContext } from '@/lib/books';
import { cx } from '@/lib/cx';
import { bookPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BookCopy } from './book-copy';
import { BookEntryView } from './book-entry-view';
import { T20BookEntryView } from './t20-entry-view';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Tipos com conteúdo que o usuário pode ler, na ordem do pacote. */
function availableKinds(reader: BookReaderContext): string[] {
  return reader.kinds.filter((kind) => (reader.pack.entryCounts[kind] ?? 0) > 0);
}

function BookHeader({ reader }: { reader: BookReaderContext }) {
  const { pack } = reader;
  const category = sourcebookCategoryLabels[pack.category as SourcebookCategory]?.name ?? pack.category;
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="parchment">{category}</Badge>
        {pack.systemId === 'tormenta20' ? (
          <Badge>Tormenta20 · {pack.edition}</Badge>
        ) : (
          <Badge>{pack.edition === '2024' ? 'Regras de 2024' : 'Regras de 2014'}</Badge>
        )}
        {isSourcebookId(pack.bookKey) ? <Badge tone="info">Livro oficial: {findSourcebook(pack.bookKey)?.name}</Badge> : null}
      </div>
      <h2 className="text-2xl leading-tight sm:text-3xl">{pack.name}</h2>
      {pack.origin ? <p className="text-sm text-fg-muted">{pack.origin}</p> : null}
    </header>
  );
}

function entryMeta(entry: BookEntryListing): string {
  // Tormenta20 (os campos só existem nos pacotes desse sistema).
  if (entry.meta.circle) return `${entry.meta.spellType ? `${entry.meta.spellType[0]!.toUpperCase()}${entry.meta.spellType.slice(1)} ` : ''}${entry.meta.circle}º círculo · ${entry.meta.school ?? ''}`;
  if (entry.meta.challenge) return [entry.meta.type, `ND ${entry.meta.challenge}`].filter(Boolean).join(' · ');
  if (entry.meta.itemKind) return [entry.meta.itemKind.replace(/-/g, ' '), entry.meta.price].filter(Boolean).join(' · ');
  if (entry.meta.group && entry.kind === 'feat') return [`Poder ${entry.meta.group === 'concedidos' ? 'concedido' : `de ${entry.meta.group}`}`, entry.meta.prerequisite].filter(Boolean).join(' · ');
  if (entry.meta.group && entry.kind === 'equipment') return [entry.meta.category, entry.meta.price].filter(Boolean).join(' · ');
  if (entry.meta.energy) return `Energia ${entry.meta.energy.toLowerCase()}`;
  switch (entry.kind) {
    case 'section':
      return entry.meta.page && entry.meta.page !== '0' ? `p. ${entry.meta.page}` : '';
    case 'spell': {
      const level = Number(entry.meta.level);
      const school = spellSchoolLabels[entry.meta.school as SpellSchool] ?? '';
      return `${level === 0 ? 'Truque' : `${level}º círculo`}${school ? ` · ${school}` : ''}`;
    }
    case 'monster':
      return [entry.meta.size, entry.meta.type, entry.meta.cr ? `ND ${entry.meta.cr}` : ''].filter(Boolean).join(' · ');
    case 'magic_item':
      return [entry.meta.type, entry.meta.rarity].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

/** Índice do livro: abas por tipo de conteúdo, busca e a lista de entradas. */
export async function BookIndexScreen({ reader, kindSlug, term }: { reader: BookReaderContext; kindSlug: string; term: string }) {
  const kinds = availableKinds(reader);
  if (kinds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <BookHeader reader={reader} />
        <EmptyState icon={<BookOpen className="h-8 w-8" aria-hidden="true" />} title="Nada para ler aqui" description="Este livro não tem conteúdo que você possa abrir." />
      </div>
    );
  }
  const requested = bookKindFromSlug(kindSlug);
  const kind = requested && kinds.includes(requested) ? requested : kinds[0]!;
  const supabase = await createSupabaseServerClient();
  const entries = await listBookEntryIndex(supabase, [reader.pack.id], kind);
  const needle = normalize(term.trim());
  const shown = needle ? entries.filter((entry) => normalize(`${entry.name} ${Object.values(entry.meta).join(' ')}`).includes(needle)) : entries;
  const base = bookPath(reader.pack.id, '', reader.campaignId);
  const entryHref = (entry: BookEntryListing) => bookPath(reader.pack.id, `/${BOOK_KIND_SLUGS[kind]}/${entry.key}`, reader.campaignId) as Route;

  // Texto do livro agrupado por capítulo (sumário).
  const chapters: { chapter: string; entries: BookEntryListing[] }[] = [];
  if (kind === 'section') {
    for (const entry of shown) {
      const chapter = entry.meta.chapter || 'Sem capítulo';
      const last = chapters[chapters.length - 1];
      if (last?.chapter === chapter) last.entries.push(entry);
      else chapters.push({ chapter, entries: [entry] });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <BookHeader reader={reader} />
      <nav aria-label="Conteúdo do livro" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-line">
          {kinds.map((entry) => (
            <Link
              key={entry}
              href={`${base}?tipo=${BOOK_KIND_SLUGS[entry]}` as Route}
              aria-current={entry === kind ? 'page' : undefined}
              className={cx(
                '-mb-px flex h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                entry === kind ? 'border-parchment-300 text-fg-accent' : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {bookKindLabel(reader.pack.systemId, entry)}
              <span className="text-xs text-fg-subtle tabular">{reader.pack.entryCounts[entry]}</span>
            </Link>
          ))}
        </div>
      </nav>

      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="tipo" value={BOOK_KIND_SLUGS[kind]} />
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar em {bookKindLabel(reader.pack.systemId, kind).toLowerCase()}
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Nome"
              className="h-11 w-full rounded-md border border-line-strong bg-sunken pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none"
            />
          </span>
        </label>
        <button type="submit" className={buttonClasses('secondary', 'md')}>
          Buscar
        </button>
      </form>

      <p className="text-sm text-fg-muted" aria-live="polite">
        {shown.length === entries.length ? `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}` : `${shown.length} de ${entries.length} entradas`}
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" aria-hidden="true" />} title="Nada encontrado" description="Tente outro nome." />
      ) : kind === 'section' ? (
        <div className="flex flex-col gap-4">
          {chapters.map((group, index) => (
            <Card key={`${group.chapter}-${index}`}>
              <CardHeader title={group.chapter} />
              <ol className="flex flex-col divide-y divide-line">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link href={entryHref(entry)} className="flex items-baseline justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-hover">
                      <span className="font-medium text-fg-accent">{entry.name}</span>
                      <span className="shrink-0 text-xs text-fg-subtle">{entryMeta(entry)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link href={entryHref(entry)} className="flex h-full flex-col gap-0.5 rounded-lg border border-line bg-card px-4 py-3 hover:border-line-strong hover:bg-hover">
                <span className="font-medium text-fg-accent">{entry.name}</span>
                {entryMeta(entry) ? <span className="text-xs text-fg-muted">{entryMeta(entry)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uma entrada do livro, com a volta ao índice e, no texto, o capítulo anterior e o seguinte. */
export async function BookEntryScreen({ reader, kindSlug, entryKey }: { reader: BookReaderContext; kindSlug: string; entryKey: string }) {
  const kind = bookKindFromSlug(kindSlug);
  if (!kind || !reader.kinds.includes(kind)) notFound();
  const supabase = await createSupabaseServerClient();
  const entry = await getBookEntry(supabase, reader.pack.id, kind, entryKey);
  if (!entry) notFound();

  let previous: BookEntryListing | undefined;
  let next: BookEntryListing | undefined;
  let path: string[] = [];
  if (kind === 'section') {
    const sections = await listBookEntryIndex(supabase, [reader.pack.id], 'section');
    const position = sections.findIndex((section) => section.key === entry.key);
    previous = position > 0 ? sections[position - 1] : undefined;
    next = position >= 0 ? sections[position + 1] : undefined;
    const data = entry.data as { path?: unknown };
    path = Array.isArray(data.path) ? data.path.filter((part): part is string => typeof part === 'string').slice(0, -1) : [];
  }
  const indexHref = `${bookPath(reader.pack.id, '', reader.campaignId)}?tipo=${kindSlug}` as Route;
  const sectionHref = (section: BookEntryListing) => bookPath(reader.pack.id, `/${kindSlug}/${section.key}`, reader.campaignId) as Route;
  const copyKind = reader.canCopy && reader.campaignId && reader.pack.systemId === 'dnd5e' && (kind === 'monster' || kind === 'magic_item') ? kind : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href={indexHref} className="text-sm text-fg-muted hover:text-fg">
        ← {reader.pack.name}: {bookKindLabel(reader.pack.systemId, kind)}
      </Link>
      <header>
        <p className="eyebrow">{path.length ? path.join(' › ') : bookKindLabel(reader.pack.systemId, kind, 'one')}</p>
        <h2 className="mt-1 text-3xl leading-tight">{entry.name}</h2>
      </header>
      <div className={cx('grid gap-6', copyKind && 'lg:grid-cols-[1fr_22rem]')}>
        <article className="min-w-0 max-w-3xl">
          {reader.pack.systemId === 'tormenta20' ? (
            <T20BookEntryView kind={kind} data={entry.data} />
          ) : (
            <BookEntryView kind={kind as BookEntryKind} name={entry.name} data={entry.data} />
          )}
        </article>
        {copyKind && reader.campaignId ? (
          <aside>
            <Card ornate>
              <CardHeader title="Copiar para a campanha" description="Vira um registro da campanha, oculto dos jogadores, pronto para a cena." />
              <BookCopy campaignId={reader.campaignId} packId={reader.pack.id} entryKey={entry.key} kind={copyKind} />
            </Card>
          </aside>
        ) : null}
      </div>
      {previous || next ? (
        <nav aria-label="Capítulos" className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
          {previous ? (
            <Link href={sectionHref(previous)} className={buttonClasses('ghost', 'md', 'justify-start')}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {previous.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={sectionHref(next)} className={buttonClasses('ghost', 'md', 'justify-end')}>
              {next.name}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
