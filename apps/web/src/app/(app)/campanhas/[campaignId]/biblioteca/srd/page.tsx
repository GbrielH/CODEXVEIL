import { CHALLENGE_RATINGS, describeSrdMonster, loadSrdMonsters, srdCreatureTypes, srdSlug } from '@codexveil/rpg-systems/dnd5e';
import { Search, Skull } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LibraryNav } from '@/components/library/library-nav';
import { buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';

export const metadata: Metadata = { title: 'Bestiário SRD' };

const PAGE_SIZE = 48;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Monstros e animais do SRD 5.2.1 para o mestre copiar à biblioteca da campanha. */
export default async function SrdBestiaryPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/biblioteca/srd'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  // O SRD é de D&D 5e: outras mesas usam as ameaças e itens dos próprios livros.
  if (campaign.systemId !== 'dnd5e') notFound();
  if (campaign.role !== 'gm' || campaign.systemId !== 'dnd5e') notFound();

  const term = single(query.q);
  const type = single(query.tipo);
  const challenge = single(query.nd);
  const page = Math.max(1, Number(single(query.pagina)) || 1);
  const monsters = await loadSrdMonsters();
  const needle = normalize(term);
  const filtered = monsters.filter(
    (monster) =>
      (!needle || normalize(`${monster.namePt} ${monster.name} ${describeSrdMonster(monster)}`).includes(needle)) &&
      (!type || monster.type === type) &&
      (!challenge || monster.cr === challenge),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = campaignPath(campaign.id, '/biblioteca/srd');
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (term) search.set('q', term);
    if (type) search.set('tipo', type);
    if (challenge) search.set('nd', challenge);
    if (target > 1) search.set('pagina', String(target));
    const text = search.toString();
    return (text ? `${base}?${text}` : base) as Route;
  };

  return (
    <div className="flex flex-col gap-5">
      <LibraryNav campaignId={campaign.id} active="srd-monsters" isGm />
      <p className="text-sm text-fg-muted">
        Os {monsters.length} monstros e animais do SRD 5.2.1, a parte aberta das regras de D&D. Copie um para a biblioteca e ele
        vira um registro da campanha (oculto dos jogadores), com o bloco de estatísticas pronto para a cena. Os campos técnicos
        estão em português; ações e traços seguem o texto original, em inglês.
      </p>

      <form method="get" className="grid gap-3 rounded-lg border border-line bg-card p-3 sm:grid-cols-[1fr_12rem_8rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Buscar
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Nome (em inglês) ou tipo"
              className="h-11 w-full rounded-md border border-line-strong bg-sunken pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none"
            />
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="srd-tipo" className="text-sm font-medium">
            Tipo
          </label>
          <Select id="srd-tipo" name="tipo" defaultValue={type}>
            <option value="">Todos</option>
            {srdCreatureTypes.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="srd-nd" className="text-sm font-medium">
            ND
          </label>
          <Select id="srd-nd" name="nd" defaultValue={challenge}>
            <option value="">Todos</option>
            {CHALLENGE_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className={buttonClasses('secondary', 'md')}>
          Filtrar
        </button>
      </form>

      <p className="text-sm text-fg-muted" aria-live="polite">
        {filtered.length === monsters.length ? `${filtered.length} criaturas` : `${filtered.length} de ${monsters.length} criaturas`}
        {pages > 1 ? ` · página ${page} de ${pages}` : ''}
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={<Skull className="h-8 w-8" aria-hidden="true" />} title="Nenhuma criatura encontrada" description="Tente outro nome ou limpe os filtros." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((monster) => (
            <li key={monster.name}>
              <Link
                href={campaignPath(campaign.id, `/biblioteca/srd/${srdSlug(monster.name)}`) as Route}
                className="flex h-full flex-col rounded-lg border border-line bg-card px-3 py-2.5 shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised"
              >
                <span className="font-display text-base text-fg-accent">
                  {monster.namePt}
                  {monster.namePt !== monster.name ? <span className="ml-2 font-sans text-xs text-fg-subtle">{monster.name}</span> : null}
                </span>
                <span className="text-xs text-fg-secondary">{describeSrdMonster(monster)}</span>
                <span className="mt-1 text-xs text-fg-muted">
                  CA {monster.ac} · PV {monster.hp}
                  {monster.animal ? ' · Animal' : ''}
                </span>
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
