import { listCreatures, listMyCampaigns, signedMediaUrls, type CreatureSummary } from '@codexveil/database';
import { CopyFromCampaign } from '@/components/library/copy-from-campaign';
import { ZoomableImage } from '@/components/ui/zoomable-image';
import { creatureKindLabels } from '@codexveil/validation';
import { BookOpen, EyeOff, Skull, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { LibraryNav } from '@/components/library/library-nav';
import { VisibilityToggle } from '@/components/library/visibility-toggle';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewCreatureForm } from './new-creature-form';

export const metadata: Metadata = { title: 'Biblioteca' };

interface CreatureCardProps {
  creature: CreatureSummary;
  imageUrl: string | null;
  campaignId: string;
  isGm: boolean;
  /** Mostra o botão de ocultar/liberar (mestre de campanha ativa). */
  canManage: boolean;
}

function CreatureCard({ creature, imageUrl, campaignId, isGm, canManage }: CreatureCardProps) {
  return (
    <div className="flex h-full items-start gap-1 rounded-lg border border-line bg-card shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised">
      <Link
        href={campaignPath(campaignId, `/biblioteca/${creature.id}`) as Route}
        className="flex min-w-0 flex-1 gap-3 rounded-lg p-3"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-wine-950 text-parchment-300">
          {imageUrl ? (
            <ZoomableImage
              src={imageUrl}
              alt={creature.name}
              className="h-full w-full object-cover"
            />
          ) : creature.kind === 'npc' ? (
            <UserRound className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Skull className="h-7 w-7" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg text-fg-accent">
            {creature.name}
          </span>
          {creature.subtitle ? (
            <span className="block truncate text-sm text-fg-secondary">{creature.subtitle}</span>
          ) : null}
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{creatureKindLabels[creature.kind]}</Badge>
            {isGm && creature.visibility === 'gm' ? (
              <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                Oculto
              </Badge>
            ) : null}
          </span>
        </span>
      </Link>
      {canManage ? (
        <div className="shrink-0 p-2">
          <VisibilityToggle
            creatureId={creature.id}
            name={creature.name}
            visibility={creature.visibility}
          />
        </div>
      ) : null}
    </div>
  );
}

export default async function LibraryPage({
  params,
  searchParams,
}: PageProps<'/campanhas/[campaignId]/biblioteca'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const kind = query.tipo === 'monstros' ? 'monster' : query.tipo === 'npcs' ? 'npc' : undefined;
  const supabase = await createSupabaseServerClient();
  const creatures = await listCreatures(supabase, campaign.id, kind);
  const images = await signedMediaUrls(
    supabase,
    creatures.map((creature) => creature.imagePath),
  );
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  // Biblioteca reaproveitável: registros das outras campanhas (mesmo sistema) em que a pessoa é mestre.
  const otherLibraries = canManage
    ? (
        await Promise.all(
          (await listMyCampaigns(supabase, user.id))
            .filter((other) => other.id !== campaign.id && other.role === 'gm' && other.systemId === campaign.systemId)
            .map(async (other) => ({
              id: other.id,
              name: other.name,
              creatures: (await listCreatures(supabase, other.id)).map((creature) => ({
                id: creature.id,
                name: creature.name,
                subtitle: creature.subtitle,
                kind: creature.kind,
              })),
            })),
        )
      ).filter((other) => other.creatures.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Notice value={query.aviso} />
      <div className={canManage ? 'grid gap-6 lg:grid-cols-[1fr_20rem]' : 'flex flex-col gap-6'}>
        <section aria-label="Registros da biblioteca" className="flex flex-col gap-4">
          <LibraryNav
            campaignId={campaign.id}
            active={kind ?? 'all'}
            isGm={isGm}
            systemId={campaign.systemId}
          />
          {!isGm ? (
            <p className="text-sm text-fg-muted">
              Personagens e criaturas que o mestre já revelou ao grupo.
            </p>
          ) : null}
          {creatures.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
              title={isGm ? 'Biblioteca vazia' : 'Nada revelado ainda'}
              description={
                isGm
                  ? 'Cadastre NPCs e monstros uma vez e reutilize-os em qualquer sessão, sem precisar recriá-los.'
                  : 'Quando o mestre revelar NPCs ou criaturas, eles aparecerão aqui.'
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {creatures.map((creature) => (
                <li key={creature.id}>
                  <CreatureCard
                    creature={creature}
                    imageUrl={creature.imagePath ? (images[creature.imagePath] ?? null) : null}
                    campaignId={campaign.id}
                    isGm={isGm}
                    canManage={canManage}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        {canManage ? (
          <aside>
            <Card ornate>
              <CardHeader
                title="Novo registro"
                description="Estatísticas e segredos são preenchidos na página do registro."
              />
              <NewCreatureForm
                campaignId={campaign.id}
                systemId={campaign.systemId}
                defaultKind={kind ?? 'npc'}
              />
            </Card>
            <Card className="mt-6">
              <CardHeader title="Trazer de outra campanha" description="Reaproveite NPCs e monstros que você já criou em outras mesas." />
              <CopyFromCampaign campaignId={campaign.id} campaigns={otherLibraries} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
