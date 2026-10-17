import { getCampaignItem, listCampaignCharacters } from '@codexveil/database';
import { itemCategoryLabels } from '@codexveil/domain';
import { uuidSchema } from '@codexveil/validation';
import { EyeOff, Gem, Package } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteItemCard, GiveItemCard, ItemEditor } from '@/components/library/item-editor';
import { Badge } from '@/components/ui/badge';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Props = PageProps<'/campanhas/[campaignId]/biblioteca/itens/[itemId]'>;

async function load(campaignId: string, itemId: string) {
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (!uuidSchema.safeParse(itemId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const item = await getCampaignItem(supabase, itemId);
  if (!item || item.campaignId !== campaign.id) notFound();
  return { campaign, item, supabase };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId, itemId } = await params;
  const { item } = await load(campaignId, itemId);
  return { title: item.name };
}

export default async function ItemPage({ params }: Props) {
  const { campaignId, itemId } = await params;
  const { campaign, item, supabase } = await load(campaignId, itemId);
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const party = canManage ? await listCampaignCharacters(supabase, campaign.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <Link href={campaignPath(campaign.id, '/biblioteca/itens') as Route} className="text-sm text-fg-muted hover:text-fg">
        ← Itens
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-parchment-400/30 bg-wine-950 text-parchment-300 shadow-card">
          {item.srdName ? <Gem className="h-9 w-9" aria-hidden="true" /> : <Package className="h-9 w-9" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{itemCategoryLabels[item.category]}</Badge>
            {item.requiresAttunement ? <Badge tone="info">Exige sintonia</Badge> : null}
            <Badge tone={item.srdName ? 'parchment' : 'brand'}>{item.srdName ? 'SRD 5.2.1' : 'Criado pelo mestre'}</Badge>
            {isGm && item.visibility === 'gm' ? (
              <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                Oculto dos jogadores
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-2 text-3xl leading-tight">{item.name}</h2>
          <p className="text-fg-secondary">
            {[item.rarity, item.value ? `Valor: ${item.value}` : null, item.weight !== null ? `Peso: ${item.weight.toLocaleString('pt-BR')}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {item.description ? (
            <p className="mt-3 max-w-3xl whitespace-pre-line font-serif text-lg leading-relaxed text-fg">{item.description}</p>
          ) : (
            <p className="mt-3 text-sm text-fg-muted">Sem descrição.</p>
          )}
          {item.srdName ? (
            <p className="mt-3 text-xs text-fg-subtle">
              Texto do System Reference Document 5.2.1 (Wizards of the Coast, CC-BY-4.0), no original em inglês. Veja as{' '}
              <Link href="/licencas" className="underline underline-offset-4">
                licenças
              </Link>
              .
            </p>
          ) : null}
        </div>
      </header>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <ItemEditor item={item} />
          <div className="flex flex-col gap-6">
            <GiveItemCard item={item} party={party.map((character) => ({ id: character.id, name: character.name, ownerName: character.ownerName }))} />
            <DeleteItemCard campaignId={campaign.id} itemId={item.id} name={item.name} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
