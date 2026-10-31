import { listBookEntryIndex } from '@codexveil/database';
import { BookOpen, Gem, ScrollText, Search, Skull, Sparkles, Swords } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LibraryNav } from '@/components/library/library-nav';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { BOOK_KIND_SLUGS, campaignBookPacks } from '@/lib/books';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { bookPath, campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ameaças e itens dos livros' };

/** O que cada sistema traz de "ameaças e itens" nos livros importados. */
const KINDS: Record<string, { kind: string; label: string; icon: ReactNode }[]> = {
  tormenta20: [
    { kind: 'monster', label: 'Ameaças', icon: <Skull className="h-4 w-4" /> },
    { kind: 'magic_item', label: 'Itens mágicos', icon: <Gem className="h-4 w-4" /> },
    { kind: 'equipment', label: 'Equipamentos', icon: <Swords className="h-4 w-4" /> },
  ],
  assimilacao: [
    { kind: 'artifact', label: 'Artefatos', icon: <Gem className="h-4 w-4" /> },
    {
      kind: 'assimilation',
      label: 'Cartas de Assimilação',
      icon: <Sparkles className="h-4 w-4" />,
    },
    { kind: 'characteristic', label: 'Características', icon: <ScrollText className="h-4 w-4" /> },
  ],
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/**
 * Ameaças e itens dos livros liberados na campanha (Tormenta20, Assimilação…), listados como o
 * bestiário do SRD: busca, tipo e link para a ficha no livro.
 */
export default async function BookCatalogPage({
  params,
  searchParams,
}: PageProps<'/campanhas/[campaignId]/biblioteca/livros'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm' || campaign.systemId === 'dnd5e') notFound();
  const kinds = KINDS[campaign.systemId] ?? [];
  const active = kinds.find((entry) => entry.kind === single(query.tipo)) ?? kinds[0];
  const term = single(query.q);
  const supabase = await createSupabaseServerClient();
  const packs = await campaignBookPacks(supabase, campaign);
  const entries = active
    ? await listBookEntryIndex(
        supabase,
        packs.map((pack) => pack.id),
        active.kind,
      )
    : [];
  const needle = normalize(term);
  const shown = entries.filter((entry) => !needle || normalize(entry.name).includes(needle));
  const packName = new Map(packs.map((pack) => [pack.id, pack.name]));
  const base = campaignPath(campaign.id, '/biblioteca/livros');

  return (
    <div className="flex flex-col gap-4">
      <LibraryNav campaignId={campaign.id} active="books" isGm systemId={campaign.systemId} />
      {packs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
          title="Nenhum livro liberado"
          description="Importe livros em Meus livros e libere-os em Configurações → Conteúdo do sistema."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {kinds.map((entry) => (
              <Link
                key={entry.kind}
                href={`${base}?tipo=${entry.kind}` as Route}
                aria-current={entry.kind === active?.kind ? 'page' : undefined}
                className={buttonClasses(
                  entry.kind === active?.kind ? 'primary' : 'secondary',
                  'sm',
                )}
              >
                {entry.icon}
                {entry.label}
              </Link>
            ))}
            <form className="ml-auto flex items-center gap-2" action={base}>
              <input type="hidden" name="tipo" value={active?.kind ?? ''} />
              <label className="flex items-center gap-2 rounded-md bg-sunken px-3 ring-1 ring-line">
                <Search className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={term}
                  placeholder="Buscar pelo nome"
                  className="h-9 w-48 bg-transparent text-sm text-fg outline-none"
                />
              </label>
            </form>
          </div>
          <p className="text-sm text-fg-muted">
            {shown.length} {shown.length === 1 ? 'resultado' : 'resultados'} nos livros liberados.
            Abra um para ver a ficha completa e copiá-lo para a biblioteca da campanha.
          </p>
          {shown.length === 0 ? (
            <EmptyState title="Nada encontrado" description="Tente outro nome ou outro tipo." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={
                      bookPath(
                        entry.packId,
                        `/${BOOK_KIND_SLUGS[entry.kind] ?? entry.kind}/${entry.key}`,
                        campaign.id,
                      ) as Route
                    }
                    className="flex h-full flex-col gap-1 rounded-lg border border-line bg-card p-3 transition-colors hover:border-parchment-400/60 hover:bg-hover"
                  >
                    <span className="flex items-center gap-2 font-medium text-fg">
                      <span className="text-fg-accent">{active?.icon}</span>
                      {entry.name}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {[entry.meta.category, entry.meta.group, packName.get(entry.packId)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
