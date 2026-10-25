'use client';

import {
  DND5E_SOURCEBOOKS,
  dnd5eOfficialLinks,
  sourcebookUrl,
} from '@codexveil/rpg-systems/dnd5e';
import Link from 'next/link';
import { useId, useState } from 'react';
import { CheckboxField } from '@/components/ui/field';
import { describeBookCounts } from '@/lib/book-counts';
import { routes } from '@/lib/routes';

/** Livro importado em "Meus livros" (conteúdo do exemplar do usuário, guardado na conta dele). */
export interface CampaignBookOption {
  /** Sistema do livro (`dnd5e`, `tormenta20`): cada campanha só mostra os do seu sistema. */
  systemId: string;
  bookKey: string;
  name: string;
  category: string;
  edition: string;
  entryCounts: Record<string, number>;
}

interface SourcebookPickerProps {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** Quem usa os livros: a mesa (regras da campanha) ou um personagem (ficha pessoal). */
  audience: 'campaign' | 'character';
  /** Nomes dos campos quando o seletor está dentro de um formulário enviado ao servidor. */
  fieldName?: string;
  modeFieldName?: string;
  /** Livros importados pelo usuário: o conteúdo deles entra na criação e na biblioteca. */
  books?: readonly CampaignBookOption[];
}

/**
 * Sistema base (só o SRD) ou com os livros importados em "Meus livros", numa lista só: cada livro
 * traz junto tudo o que tem (espécies, classes, magias, monstros, itens).
 */
export function SourcebookPicker({
  selected,
  onChange,
  audience,
  fieldName,
  modeFieldName,
  books = [],
}: SourcebookPickerProps) {
  const imported = new Set(books.map((book) => book.bookKey));
  // Livros marcados antes desta tela mostrar só os importados.
  const legacy = selected.filter((bookId) => !imported.has(bookId));
  const id = useId();
  const [mode, setMode] = useState<'base' | 'expanded'>(selected.length > 0 ? 'expanded' : 'base');
  const toggle = (bookId: string, checked: boolean) =>
    onChange(checked ? [...selected, bookId] : selected.filter((entry) => entry !== bookId));
  /** Marca ou desmarca todos os livros de um grupo de uma vez. */
  const toggleGroup = (ids: readonly string[], checked: boolean) =>
    onChange(
      checked
        ? [...new Set([...selected, ...ids])]
        : selected.filter((entry) => !ids.includes(entry)),
    );
  const selectAll = (key: string, ids: readonly string[]) =>
    ids.length > 1 ? (
      <label
        htmlFor={`${id}-all-${key}`}
        className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-fg-secondary"
      >
        <input
          id={`${id}-all-${key}`}
          type="checkbox"
          className="h-4 w-4 cursor-pointer accent-wine-500"
          checked={ids.every((bookId) => selected.includes(bookId))}
          onChange={(event) => toggleGroup(ids, event.target.checked)}
        />
        Selecionar todos
      </label>
    ) : null;
  const who = audience === 'campaign' ? 'a mesa usa' : 'este personagem usa';
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-fg">Conteúdo do sistema</p>
      {modeFieldName ? <input type="hidden" name={modeFieldName} value={mode} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {(['base', 'expanded'] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer flex-col gap-1 rounded-md border border-line p-3 text-sm has-[:checked]:border-parchment-300/70 has-[:checked]:bg-parchment-200/10"
          >
            <span className="flex items-center gap-2 font-medium text-fg">
              <input
                type="radio"
                name={`${id}-mode`}
                checked={mode === option}
                onChange={() => {
                  setMode(option);
                  if (option === 'base') onChange([]);
                }}
                className="accent-wine-500"
              />
              {option === 'base' ? 'Sistema base' : 'Base + livros'}
            </span>
            <span className="text-xs text-fg-muted">
              {option === 'base'
                ? 'Só o SRD 5.2.1, gratuito e já pronto no Codexveil. Sem nada para escolher.'
                : `Escolha os livros que ${who}. Cada livro importado em "Meus livros" traz tudo o que tem: espécies, classes, antecedentes, magias, monstros e itens.`}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        Gratuitos:{' '}
        {dnd5eOfficialLinks
          .filter((link) => link.access === 'free')
          .map((link, index) => (
            <span key={link.url}>
              {index > 0 ? ' · ' : ''}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg-brand underline-offset-2 hover:underline"
              >
                {link.label}
              </a>
            </span>
          ))}
      </p>
      {mode === 'expanded' ? (
        <div className="flex flex-col gap-3">
          {books.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border border-parchment-300/40 bg-parchment-200/5 p-3">
              {selectAll(
                'own',
                books.map((book) => book.bookKey),
              )}
              <div className="grid gap-2 sm:grid-cols-2 @3xl:grid-cols-3">
                {books.map((book) => (
                  <CheckboxField
                    key={book.bookKey}
                    id={`${id}-own-${book.bookKey}`}
                    {...(fieldName ? { name: fieldName } : {})}
                    value={book.bookKey}
                    label={book.name}
                    description={[
                      describeBookCounts(book.entryCounts),
                      book.edition === '2024' ? 'regras de 2024' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    checked={selected.includes(book.bookKey)}
                    onChange={(event) => toggle(book.bookKey, event.target.checked)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-line p-3 text-sm text-fg-muted">
              Nenhum livro importado ainda. Em{' '}
              <Link
                href={routes.books}
                className="text-fg-brand underline-offset-2 hover:underline"
              >
                Meus livros
              </Link>{' '}
              você importa o conteúdo dos seus livros; ele aparece aqui, na criação de personagens e
              na biblioteca.
            </p>
          )}
          {/* Escolhas antigas de livros sem conteúdo: continuam valendo até serem desmarcadas. */}
          {legacy.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-fg-muted">
                Marcados antes, sem conteúdo no Codexveil (desmarque para tirar):
              </p>
              <div className="grid gap-2 sm:grid-cols-2 @3xl:grid-cols-3">
                {legacy.map((bookId) => (
                  <CheckboxField
                    key={bookId}
                    id={`${id}-book-${bookId}`}
                    {...(fieldName ? { name: fieldName } : {})}
                    value={bookId}
                    label={DND5E_SOURCEBOOKS.find((book) => book.id === bookId)?.name ?? bookId}
                    checked
                    onChange={(event) => toggle(bookId, event.target.checked)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Livros escolhidos (pelo mestre ou na ficha), cada um com o link da página oficial. */
export function SourcebookLinks({ ids, label }: { ids: readonly string[]; label: string }) {
  if (ids.length === 0)
    return <p className="text-sm text-fg-muted">Sistema base: só o SRD 5.2.1, gratuito.</p>;
  return (
    <p className="text-sm text-fg-secondary">
      {label}{' '}
      {ids.map((bookId, index) => (
        <span key={bookId}>
          {index > 0 ? ' · ' : ''}
          <a
            href={sourcebookUrl(bookId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-brand underline-offset-2 hover:underline"
          >
            {DND5E_SOURCEBOOKS.find((book) => book.id === bookId)?.name ?? bookId}
          </a>
        </span>
      ))}
      <span className="text-fg-muted"> (pagos, na página oficial)</span>
    </p>
  );
}
