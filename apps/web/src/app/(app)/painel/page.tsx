import {
  getMyPendingInvites,
  getProfile,
  listMyCampaigns,
  listMyCharacters,
  listMyAttendance,
  listUpcomingSessions,
  signedMediaUrls,
} from '@codexveil/database';
import { findSystem, summarizeSheet } from '@codexveil/rpg-systems';
import { formatInviteCode } from '@codexveil/domain';
import { CalendarClock, KeyRound, Mail, Play, Plus, ScrollText, Swords } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignCover } from '@/components/campaigns/campaign-cover';
import { ArcaneSigil } from '@/components/brand/arcane-sigil';
import { CharacterCard } from '@/components/characters/character-card';
import { AttendanceFrame } from '@/components/sessions/attendance-frame';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { formatDateTime, pluralize } from '@/lib/format';
import { characterPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Painel' };

export default async function DashboardPage({ searchParams }: PageProps<'/painel'>) {
  const user = await requireSessionUser(routes.dashboard);
  const supabase = await createSupabaseServerClient();
  const [profile, campaigns, invites, sessions, characters, params] = await Promise.all([
    getProfile(supabase, user.id),
    listMyCampaigns(supabase, user.id),
    getMyPendingInvites(supabase),
    listUpcomingSessions(supabase),
    listMyCharacters(supabase, user.id),
    searchParams,
  ]);
  const recentCharacters = characters.slice(0, 4);
  // Presença: só nas campanhas em que o usuário joga (o mestre vê as respostas na aba Sessões).
  const playerCampaignIds = new Set(
    campaigns.filter((campaign) => campaign.role !== 'gm').map((campaign) => campaign.id),
  );
  const attendance = await listMyAttendance(
    supabase,
    user.id,
    sessions
      .filter((session) => playerCampaignIds.has(session.campaignId))
      .map((session) => session.id),
  );
  const active = campaigns.filter((campaign) => campaign.status === 'active');
  const shownCampaigns = active.slice(0, 6);
  // Destaque: a campanha da sessão agendada mais próxima; sem agenda, a ativa mais recente.
  const nextSession =
    sessions.find((session) => active.some((campaign) => campaign.id === session.campaignId)) ??
    null;
  const featured =
    (nextSession ? active.find((campaign) => campaign.id === nextSession.campaignId) : undefined) ??
    active[0] ??
    null;
  // Retratos e capas numa só chamada de URLs assinadas.
  const media = await signedMediaUrls(supabase, [
    ...recentCharacters.map((character) => character.portraitPath),
    ...shownCampaigns.map((campaign) => campaign.coverPath),
    featured?.coverPath ?? null,
  ]);

  const archivedCount = campaigns.length - active.length;
  const firstName = (profile?.displayName ?? 'aventureiro').split(' ')[0];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-8">
        {/* Destaque: a campanha em andamento mais recente, com a capa (ou a paisagem dela). */}
        <section
          aria-labelledby="boas-vindas"
          className="relative isolate overflow-hidden rounded-2xl border border-line shadow-[0_30px_70px_-40px_rgb(107_59_198/0.9)]"
        >
          <CampaignCover
            url={featured?.coverPath ? (media[featured.coverPath] ?? null) : null}
            name={featured?.name ?? 'codexveil'}
            className="absolute inset-0 -z-10 h-full w-full"
          />
          <span
            className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal-950 via-charcoal-950/75 to-charcoal-950/10"
            aria-hidden="true"
          />
          {/* Tomo dentro do círculo arcano girando (o mesmo encantamento da página inicial). */}
          <div
            className="pointer-events-none absolute top-1/2 right-6 hidden aspect-square h-[18rem] -translate-y-1/2 items-center justify-center xl:flex 2xl:h-[21rem]"
            aria-hidden="true"
          >
            <ArcaneSigil className="absolute inset-0 h-full w-full" />
            <Image
              src="/mestre/heroi.webp"
              alt=""
              width={640}
              height={598}
              priority
              className="relative h-auto w-[66%] [mask-image:radial-gradient(closest-side,black_55%,transparent)]"
            />
          </div>
          <div className="relative flex min-h-80 max-w-xl flex-col justify-center gap-3 px-6 py-8 sm:px-10 xl:max-w-[calc(100%-19rem)] 2xl:max-w-[calc(100%-22rem)]">
            <p className="eyebrow text-wine-300">Olá, {firstName}</p>
            <h1
              id="boas-vindas"
              className="text-3xl leading-tight [text-shadow:0_2px_18px_rgb(0_0_0/0.8)] sm:text-4xl"
            >
              {featured ? featured.name : 'Que suas próximas sessões sejam lendárias.'}
            </h1>
            <p className="text-sm text-fg-secondary">
              {featured
                ? `${findSystem(featured.systemId)?.name ?? featured.systemId} · ${pluralize(featured.memberCount, 'participante', 'participantes')} · ${featured.isOwner ? 'você mestra' : 'você joga'}`
                : 'Crie uma campanha para mestrar ou entre na mesa de um amigo com o código do convite.'}
            </p>
            {featured && nextSession?.campaignId === featured.id ? (
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-wine-400/40 bg-wine-950/70 px-3 py-1 text-xs text-wine-200 backdrop-blur">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                Próxima sessão: {formatDateTime(nextSession.scheduledAt)} · Sessão{' '}
                {nextSession.number}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              {featured ? (
                <ButtonLink
                  href={`/campanhas/${featured.id}` as Route}
                  icon={<Play className="h-4 w-4" aria-hidden="true" />}
                >
                  Continuar campanha
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink
                    href={routes.newCampaign}
                    icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  >
                    Nova campanha
                  </ButtonLink>
                  {/* Código de convite só quando ainda não há campanha (os atalhos à direita também têm). */}
                  <ButtonLink
                    href="/convite"
                    variant="secondary"
                    icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                  >
                    Entrar com código
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </section>

        <Notice value={params.aviso} />

        {invites.length > 0 ? (
          <section aria-labelledby="convites-pendentes">
            <Card ornate>
              <CardHeader
                icon={<Mail className="h-5 w-5" aria-hidden="true" />}
                title={<span id="convites-pendentes">Convites pendentes</span>}
                description="Mestres convidaram você para estas campanhas."
              />
              <ul className="divide-y divide-line">
                {invites.map((invite) => (
                  <li
                    key={invite.code}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-fg">{invite.campaignName}</p>
                      <p className="text-sm text-fg-muted">
                        Mestre: {invite.ownerName} · expira em {formatDateTime(invite.expiresAt)}
                      </p>
                    </div>
                    <ButtonLink href={`/convite/${formatInviteCode(invite.code)}`} size="sm">
                      Ver convite
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <section aria-labelledby="campanhas-andamento" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="campanhas-andamento" className="text-xl">
              Suas campanhas
            </h2>
            {campaigns.length > 0 ? (
              <Link href={routes.campaigns} className="text-sm text-wine-300 hover:text-wine-200">
                Ver todas
                {archivedCount > 0
                  ? ` (${archivedCount} arquivada${archivedCount > 1 ? 's' : ''})`
                  : ''}{' '}
                →
              </Link>
            ) : null}
          </div>
          {active.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
              title="Nenhuma campanha em andamento"
              description="Crie uma campanha para mestrar ou use o código de convite que o seu mestre enviou."
              action={
                <>
                  <ButtonLink href={routes.newCampaign}>Criar campanha</ButtonLink>
                  <ButtonLink href="/convite" variant="secondary">
                    Tenho um código
                  </ButtonLink>
                </>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {shownCampaigns.map((campaign) => (
                <li key={campaign.id}>
                  <CampaignCard
                    campaign={campaign}
                    coverUrl={campaign.coverPath ? (media[campaign.coverPath] ?? null) : null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Coluna da direita: agenda e personagens (a navegação fica no menu lateral). */}
      <aside aria-label="Atalhos e agenda" className="flex flex-col gap-6">
        <Card>
          <CardHeader
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            title={<span id="proximas-sessoes">Próximas sessões</span>}
          />
          {sessions.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Nenhuma sessão agendada. Mestres podem marcar datas nas sessões de cada campanha.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => {
                const summary = (
                  <Link
                    href={`/campanhas/${session.campaignId}`}
                    className="flex gap-3 rounded-md hover:bg-hover"
                  >
                    <span
                      className="flex w-1 shrink-0 rounded-full bg-wine-500"
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-xs text-wine-300">
                        {formatDateTime(session.scheduledAt)}
                      </span>
                      <span className="block text-sm font-medium text-fg">
                        Sessão {session.number}: {session.title}
                      </span>
                      <span className="block text-xs text-fg-secondary">
                        {session.campaignName}
                      </span>
                    </span>
                  </Link>
                );
                return (
                  <li key={session.id}>
                    {playerCampaignIds.has(session.campaignId) ? (
                      <AttendanceFrame
                        sessionId={session.id}
                        campaignId={session.campaignId}
                        userId={user.id}
                        initial={attendance[session.id] ?? null}
                      >
                        {summary}
                      </AttendanceFrame>
                    ) : (
                      <div className="rounded-lg border border-line px-3 py-2 hover:border-wine-400/40">
                        {summary}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            icon={<Swords className="h-5 w-5" aria-hidden="true" />}
            title="Seus personagens"
            action={
              characters.length > 0 ? (
                <Link
                  href={routes.characters}
                  className="text-sm text-wine-300 hover:text-wine-200"
                >
                  Todos
                </Link>
              ) : undefined
            }
          />
          {recentCharacters.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-fg-muted">Nenhum personagem ainda.</p>
              <ButtonLink href={routes.newCharacter} size="sm" variant="secondary">
                Criar personagem
              </ButtonLink>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentCharacters.map((character) => (
                <li key={character.id}>
                  <CharacterCard
                    href={characterPath(character.id) as Route}
                    name={character.name}
                    subtitle={summarizeSheet(character.systemId, character.sheet).subtitle}
                    portraitUrl={
                      character.portraitPath ? (media[character.portraitPath] ?? null) : null
                    }
                    meta={character.campaignName}
                    className="p-3"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
