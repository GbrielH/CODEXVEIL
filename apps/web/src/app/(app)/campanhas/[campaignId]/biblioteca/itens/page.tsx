import { listCampaignItems, type CampaignItem } from '@codexveil/database';
import { itemCategoryLabels } from '@codexveil/domain';
import { EyeOff, Gem, Package } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ItemVisibilityToggle } from '@/components/library/item-editor';
import { LibraryNav } from '@/components/library/library-nav';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewItemForm } from './new-item-form';

export const metadata: Metadata = { title: 'Itens' };

function ItemCard({ item, campaignId, isGm, canManage }: { item: CampaignItem; campaignId: string; isGm: boolean; canManage: boolean }) {
  return (
    <div className="flex h-full items-start gap-1 rounded-lg border border-line bg-card shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised">
      <Link href={campaignPath(campaignId, `/biblioteca/itens/${item.id}`) as Route} className="flex min-w-0 flex-1 gap-3 rounded-lg p-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-wine-950 text-parchment-300">
          {item.srdName ? <Gem className="h-6 w-6" aria-hidden="true" /> : <Package className="h-6 w-6" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg text-fg-accent">{item.name}</span>
          {item.rarity ? <span className="block truncate text-sm text-fg-secondary">{item.rarity}</span> : null}
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{itemCategoryLabels[item.category]}</Badge>
            {item.requiresAttunement ? <Badge tone="info">Sintonia</Badge> : null}
            <Badge tone={item.srdName ? 'parchment' : 'brand'}>{item.srdName ? 'SRD' : 'Do mestre'}</Badge>
            {isGm && item.visibility === 'gm' ? (
              <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                Oculto
              </Badge>
            ) : null}
          </span>
        </span>
      </Link>
      {canManage ? (
        <div className="shrink-0 p-2">
          <ItemVisibilityToggle itemId={item.id} name={item.name} visibility={item.visibility} />
        </div>
      ) : null}
    </div>
  );
}

/** Itens da campanha: criados pelo mestre ou copiados do SRD; jogadores veem os revelados. */
export default async function ItemsPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/biblioteca/itens'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const items = await listCampaignItems(supabase, campaign.id);
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';

  return (
    <div className="flex flex-col gap-6">
      <Notice value={query.aviso} />
      <div className={canManage ? 'grid gap-6 lg:grid-cols-[1fr_22rem]' : 'flex flex-col gap-6'}>
        <section aria-label="Itens da campanha" className="flex min-w-0 flex-col gap-4">
          <LibraryNav campaignId={campaign.id} active="items" isGm={isGm} systemId={campaign.systemId} />
          <p className="text-sm text-fg-muted">
            {isGm
              ? 'Itens criados por você (fora do livro) e itens mágicos copiados do SRD. Entregue-os aos personagens pela página do item.'
              : 'Itens que o mestre revelou ao grupo.'}
          </p>
          {items.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" aria-hidden="true" />}
              title={isGm ? 'Nenhum item ainda' : 'Nada revelado ainda'}
              description={
                isGm
                  ? campaign.systemId === 'dnd5e'
                    ? 'Crie um item ao lado ou copie um item mágico pela aba “Itens mágicos SRD”.'
                    : 'Crie um item ao lado ou copie itens dos livros importados (aba Livros).'
                  : 'Quando o mestre revelar itens, eles aparecerão aqui.'
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} campaignId={campaign.id} isGm={isGm} canManage={canManage} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {canManage ? (
          <aside>
            <Card ornate>
              <CardHeader title="Novo item" description="Um item que não está no livro: arma, relíquia, chave, poção da casa…" />
              <NewItemForm campaignId={campaign.id} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
