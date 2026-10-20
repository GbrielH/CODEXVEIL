import { describeSrdMagicItem, loadSrdMagicItems, srdSlug } from '@codexveil/rpg-systems/dnd5e';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SrdImportItem } from '@/components/library/srd-import';
import { Card, CardHeader } from '@/components/ui/card';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';

type Props = PageProps<'/campanhas/[campaignId]/biblioteca/srd-itens/[slug]'>;

async function load(campaignId: string, slug: string) {
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm' || campaign.systemId !== 'dnd5e') notFound();
  const item = (await loadSrdMagicItems()).find((entry) => srdSlug(entry.name) === slug);
  if (!item) notFound();
  return { campaign, item };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId, slug } = await params;
  const { item } = await load(campaignId, slug);
  return { title: `${item.namePt} (SRD)` };
}

export default async function SrdItemPage({ params }: Props) {
  const { campaignId, slug } = await params;
  const { campaign, item } = await load(campaignId, slug);

  return (
    <div className="flex flex-col gap-6">
      <Link href={campaignPath(campaign.id, '/biblioteca/srd-itens') as Route} className="text-sm text-fg-muted hover:text-fg">
        ← Itens mágicos SRD
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="parchment ornate min-w-0 rounded-lg px-5 py-4 text-ink">
          <p className="text-xs tracking-[0.18em] text-ink-muted uppercase">SRD 5.2.1</p>
          <h2 className="mt-1 font-display text-2xl text-wine-800">{item.namePt}</h2>
          {item.namePt !== item.name ? <p className="text-sm text-ink/70">{item.name}</p> : null}
          <p className="text-sm italic text-ink-muted">{describeSrdMagicItem(item)}</p>
          <hr className="my-3 border-wine-700/40" />
          <div className="flex flex-col gap-2 font-serif text-base leading-relaxed">
            {item.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            System Reference Document 5.2.1 (Wizards of the Coast, CC-BY-4.0), texto original em inglês.
          </p>
        </article>
        {campaign.status === 'active' ? (
          <aside>
            <Card ornate>
              <CardHeader title="Usar na campanha" description="Copia o item para a biblioteca de itens, oculto dos jogadores. Depois é só entregá-lo." />
              <SrdImportItem campaignId={campaign.id} slug={slug} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
