import {
  describeSrdMagicItem,
  loadSrdMagicItems,
  srdMagicItemCategories,
  srdMagicItemRarities,
  srdSlug,
} from '@codexveil/rpg-systems/dnd5e';
import { Gem, Search } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LibraryNav } from '@/components/library/library-nav';
import { buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';

export const metadata: Metadata = { title: 'Itens mágicos SRD' };

const PAGE_SIZE = 48;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** "Uncommon (+1), Rare (+2), or Very Rare (+3)" → ["Uncommon", "Rare", "Very Rare"]. */
function rarityTerms(text: string): string[] {
  return text
    .split(/,|\bor\b/)
    .map((part) => part.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Itens mágicos do SRD 5.2.1 para o mestre copiar aos itens da campanha. */
export default async function SrdItemsPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/biblioteca/srd-itens'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm' || campaign.systemId !== 'dnd5e') notFound();

  const term = single(query.q);
  const category = single(query.categoria);
  const rarity = single(query.raridade);
  const page = Math.max(1, Number(single(query.pagina)) || 1);
  const items = await loadSrdMagicItems();
  const needle = normalize(term);
  const filtered = items.filter(
    (item) =>
      (!needle || normalize(`${item.namePt} ${item.name} ${describeSrdMagicItem(item)}`).includes(needle)) &&
      (!category || item.category === category) &&
      (!rarity || rarityTerms(item.rarity).includes(rarity)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = campaignPath(campaign.id, '/biblioteca/srd-itens');
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (term) search.set('q', term);
    if (category) search.set('categoria', category);
    if (rarity) search.set('raridade', rarity);
    if (target > 1) search.set('pagina', String(target));
    const text = search.toString();
    return (text ? `${base}?${text}` : base) as Route;
  };

  return (
    <div className="flex flex-col gap-5">
      <LibraryNav campaignId={campaign.id} active="srd-items" isGm />
      <p className="text-sm text-fg-muted">
        Os {items.length} itens mágicos do SRD 5.2.1. Copie um para os itens da campanha (oculto dos jogadores) e entregue-o aos
        personagens. Nomes e descrições seguem o original, em inglês.
      </p>

      <form method="get" className="grid gap-3 rounded-lg border border-line bg-card p-3 sm:grid-cols-[1fr_12rem_11rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Buscar
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Nome (em inglês)"
              className="h-11 w-full rounded-md border border-line-strong bg-sunken pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none"
            />
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="srd-categoria" className="text-sm font-medium">
            Categoria
          </label>
          <Select id="srd-categoria" name="categoria" defaultValue={category}>
            <option value="">Todas</option>
            {srdMagicItemCategories.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="srd-raridade" className="text-sm font-medium">
            Raridade
          </label>
          <Select id="srd-raridade" name="raridade" defaultValue={rarity}>
            <option value="">Todas</option>
            {srdMagicItemRarities.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className={buttonClasses('secondary', 'md')}>
          Filtrar
        </button>
      </form>

      <p className="text-sm text-fg-muted" aria-live="polite">
        {filtered.length === items.length ? `${filtered.length} itens` : `${filtered.length} de ${items.length} itens`}
        {pages > 1 ? ` · página ${page} de ${pages}` : ''}
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={<Gem className="h-8 w-8" aria-hidden="true" />} title="Nenhum item encontrado" description="Tente outro nome ou limpe os filtros." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <li key={item.name}>
              <Link
                href={campaignPath(campaign.id, `/biblioteca/srd-itens/${srdSlug(item.name)}`) as Route}
                className="flex h-full flex-col rounded-lg border border-line bg-card px-3 py-2.5 shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised"
              >
                <span className="font-display text-base text-fg-accent">
                  {item.namePt}
                  {item.namePt !== item.name ? <span className="ml-2 font-sans text-xs text-fg-subtle">{item.name}</span> : null}
                </span>
                <span className="text-xs text-fg-secondary">{describeSrdMagicItem(item)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex flex-wrap items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClasses('ghost', 'sm')}>
              ← Anterior
            </Link>
          ) : null}
          <span className="text-sm text-fg-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClasses('ghost', 'sm')}>
              Próxima →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
