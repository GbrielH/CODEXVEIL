import { describeSrdMonster, loadSrdMonsters, srdMonsterDefaultKind, srdMonsterToStatBlock, srdSlug } from '@codexveil/rpg-systems/dnd5e';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SrdImportMonster } from '@/components/library/srd-import';
import { StatBlockView } from '@/components/library/stat-block-view';
import { Card, CardHeader } from '@/components/ui/card';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';

type Props = PageProps<'/campanhas/[campaignId]/biblioteca/srd/[slug]'>;

async function load(campaignId: string, slug: string) {
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm' || campaign.systemId !== 'dnd5e') notFound();
  const monster = (await loadSrdMonsters()).find((entry) => srdSlug(entry.name) === slug);
  if (!monster) notFound();
  return { campaign, monster };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId, slug } = await params;
  const { monster } = await load(campaignId, slug);
  return { title: `${monster.namePt} (SRD)` };
}

/** Bloco de estatísticas do SRD, com a opção de copiar para a biblioteca da campanha. */
export default async function SrdMonsterPage({ params }: Props) {
  const { campaignId, slug } = await params;
  const { campaign, monster } = await load(campaignId, slug);
  const statBlock = srdMonsterToStatBlock(monster);
  const canManage = campaign.status === 'active';

  return (
    <div className="flex flex-col gap-6">
      <Link href={campaignPath(campaign.id, '/biblioteca/srd') as Route} className="text-sm text-fg-muted hover:text-fg">
        ← Bestiário SRD
      </Link>
      <header>
        <p className="eyebrow">SRD 5.2.1{monster.animal ? ' · Animal' : ''}</p>
        <h2 className="mt-1 text-3xl leading-tight">{monster.namePt}</h2>
        {monster.namePt !== monster.name ? <p className="text-sm text-fg-subtle">{monster.name}</p> : null}
        <p className="text-fg-secondary">{describeSrdMonster(monster)}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <StatBlockView name={monster.name} statBlock={statBlock} />
          <p className="text-xs text-fg-subtle">
            Iniciativa {monster.initiative}
            {monster.gear ? ` · Equipamento: ${monster.gear}` : ''}
            {monster.crDetail ? ` · ${monster.crDetail}` : ''}
          </p>
          <p className="text-xs text-fg-subtle">
            System Reference Document 5.2.1 (Wizards of the Coast, CC-BY-4.0). Campos técnicos traduzidos e distâncias em metros
            pelo Codexveil; ações e traços no original, em inglês.
          </p>
        </div>
        {canManage ? (
          <aside>
            <Card ornate>
              <CardHeader title="Copiar para a biblioteca" description="Vira um registro da campanha, oculto dos jogadores, pronto para a cena." />
              <SrdImportMonster campaignId={campaign.id} slug={slug} defaultKind={srdMonsterDefaultKind(monster)} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
