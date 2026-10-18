import { findSystem, type OfficialLink } from '@codexveil/rpg-systems';
import { dnd5eCampaignLinks, parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, ExternalLink, Gift } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';

export const metadata: Metadata = { title: 'Links' };

function LinkList({ links }: { links: readonly OfficialLink[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {links.map((link) => (
        <li key={link.url}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-md px-2 py-3 hover:bg-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg-accent underline-offset-4 group-hover:underline">{link.label}</span>
              <span className="mt-0.5 block text-sm text-fg-secondary">{link.description}</span>
              <span className="mt-1 block truncate text-xs text-fg-subtle">{link.url.replace(/^https:\/\//, '')}</span>
            </span>
            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="sr-only">(abre o site oficial em outra aba)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Fontes oficiais do sistema da campanha, para as dúvidas de regras durante o jogo. */
export default async function LinksPage({ params }: PageProps<'/campanhas/[campaignId]/links'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const system = findSystem(campaign.systemId);
  // Gratuitos sempre; livros pagos só os que o mestre liberou nas regras da campanha.
  const links =
    campaign.systemId === 'dnd5e'
      ? dnd5eCampaignLinks(system?.officialLinks ?? [], parseDnd5eCampaignRules(campaign.characterRules).sourcebooks)
      : (system?.officialLinks ?? []);
  const free = links.filter((link) => link.access === 'free');
  const paid = links.filter((link) => link.access === 'paid');

  if (links.length === 0) {
    return <EmptyState title="Nenhum link oficial" description="O sistema desta campanha ainda não tem fontes oficiais cadastradas." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-fg-muted">
        Dúvidas de regras? Estes são os sites oficiais de {system?.name ?? 'regras'}. O conteúdo deles é da editora e fica em
        inglês; o Codexveil traz apenas a parte aberta das regras ({system?.rulesReference}).
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Gift className="h-5 w-5" aria-hidden="true" />} title="Gratuitos" description="Leitura livre, direto no site oficial." />
          <LinkList links={free} />
        </Card>
        <Card>
          <CardHeader
            icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
            title="Livros da campanha"
            description="Os livros que o mestre liberou. São pagos: compre ou leia na página oficial de cada um."
          />
          {paid.length > 0 ? <LinkList links={paid} /> : <p className="text-sm text-fg-muted">Campanha no sistema base: só o conteúdo gratuito (SRD).</p>}
        </Card>
      </div>
    </div>
  );
}
