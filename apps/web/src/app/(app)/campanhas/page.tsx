import { listMyCampaigns, signedMediaUrls } from '@codexveil/database';
import { KeyRound, Plus, ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Campanhas' };

export default async function CampaignsPage({ searchParams }: PageProps<'/campanhas'>) {
  const user = await requireSessionUser(routes.campaigns);
  const supabase = await createSupabaseServerClient();
  const [campaigns, params] = await Promise.all([listMyCampaigns(supabase, user.id), searchParams]);
  const active = campaigns.filter((campaign) => campaign.status === 'active');
  const archived = campaigns.filter((campaign) => campaign.status === 'archived');
  const covers = await signedMediaUrls(supabase, campaigns.map((campaign) => campaign.coverPath));
  const coverOf = (path: string | null) => (path ? (covers[path] ?? null) : null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Minhas campanhas"
        title="Campanhas"
        description="Mesas em que você é mestre ou jogador."
        actions={
          <>
            <ButtonLink href={routes.newCampaign} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Nova campanha
            </ButtonLink>
            <ButtonLink href="/convite" variant="secondary" icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}>
              Entrar com código
            </ButtonLink>
          </>
        }
      />
      <Notice value={params.aviso} />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
          title="Você ainda não participa de nenhuma campanha"
          description="Crie a sua para mestrar ou peça ao seu mestre um código de convite."
          action={<ButtonLink href={routes.newCampaign}>Criar primeira campanha</ButtonLink>}
        />
      ) : (
        <>
          <section aria-labelledby="em-andamento" className="flex flex-col gap-4">
            <h2 id="em-andamento" className="text-xl">
              Em andamento
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-fg-muted">Nenhuma campanha ativa no momento.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((campaign) => (
                  <li key={campaign.id}>
                    <CampaignCard campaign={campaign} coverUrl={coverOf(campaign.coverPath)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {archived.length > 0 ? (
            <section aria-labelledby="arquivadas" className="flex flex-col gap-4">
              <h2 id="arquivadas" className="text-xl">
                Arquivadas
              </h2>
              <p className="text-sm text-fg-muted">
                Campanhas arquivadas ficam somente para consulta. O mestre responsável pode reabri-las.
              </p>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((campaign) => (
                  <li key={campaign.id}>
                    <CampaignCard campaign={campaign} coverUrl={coverOf(campaign.coverPath)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
