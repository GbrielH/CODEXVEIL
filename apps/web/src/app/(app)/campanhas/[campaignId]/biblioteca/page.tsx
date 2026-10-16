import { listCreatures, signedMediaUrls, type CreatureSummary } from '@codexveil/database';
import { creatureKindLabels } from '@codexveil/validation';
import { BookOpen, EyeOff, Skull, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { cx } from '@/lib/cx';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewCreatureForm } from './new-creature-form';

export const metadata: Metadata = { title: 'Biblioteca' };

function CreatureCard({ creature, imageUrl, campaignId, isGm }: { creature: CreatureSummary; imageUrl: string | null; campaignId: string; isGm: boolean }) {
  return (
    <Link
      href={campaignPath(campaignId, `/biblioteca/${creature.id}`) as Route}
      className="flex h-full gap-3 rounded-lg border border-line bg-card p-3 shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised"
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-wine-950 text-parchment-300">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : creature.kind === 'npc' ? (
          <UserRound className="h-7 w-7" aria-hidden="true" />
        ) : (
          <Skull className="h-7 w-7" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg text-fg-accent">{creature.name}</span>
        {creature.subtitle ? <span className="block truncate text-sm text-fg-secondary">{creature.subtitle}</span> : null}
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
  );
}

export default async function LibraryPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/biblioteca'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const kind = query.tipo === 'monstros' ? 'monster' : query.tipo === 'npcs' ? 'npc' : undefined;
  const supabase = await createSupabaseServerClient();
  const creatures = await listCreatures(supabase, campaign.id, kind);
  const images = await signedMediaUrls(supabase, creatures.map((creature) => creature.imagePath));
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const base = campaignPath(campaign.id, '/biblioteca');

  return (
    <div className="flex flex-col gap-6">
      <Notice value={query.aviso} />
      <div className={canManage ? 'grid gap-6 lg:grid-cols-[1fr_20rem]' : 'flex flex-col gap-6'}>
        <section aria-label="Registros da biblioteca" className="flex flex-col gap-4">
          <nav aria-label="Filtrar por tipo" className="flex gap-1 border-b border-line">
            {[
              { href: base, label: 'Todos', active: kind === undefined },
              { href: `${base}?tipo=npcs`, label: 'NPCs', active: kind === 'npc' },
              { href: `${base}?tipo=monstros`, label: 'Monstros', active: kind === 'monster' },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={tab.href as Route}
                aria-current={tab.active ? 'page' : undefined}
                className={cx(
                  '-mb-px flex h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors',
                  tab.active ? 'border-parchment-300 text-fg-accent' : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          {!isGm ? (
            <p className="text-sm text-fg-muted">Personagens e criaturas que o mestre já revelou ao grupo.</p>
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
                  <CreatureCard creature={creature} imageUrl={creature.imagePath ? (images[creature.imagePath] ?? null) : null} campaignId={campaign.id} isGm={isGm} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {canManage ? (
          <aside>
            <Card ornate>
              <CardHeader title="Novo registro" description="Estatísticas e segredos são preenchidos na página do registro." />
              <NewCreatureForm campaignId={campaign.id} defaultKind={kind ?? 'npc'} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
