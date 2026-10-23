import {
  getMyPendingInvites,
  getProfile,
  listMyCampaigns,
  listMyCharacters,
  listUpcomingSessions,
  signedMediaUrls,
} from '@codexveil/database';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { formatInviteCode } from '@codexveil/domain';
import { CalendarCheck, CalendarClock, KeyRound, Mail, Plus, ScrollText, Swords, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CharacterCard } from '@/components/characters/character-card';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { requireSessionUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
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
  const active = campaigns.filter((campaign) => campaign.status === 'active');
  const shownCampaigns = active.slice(0, 6);
  // Retratos e capas numa só chamada de URLs assinadas.
  const media = await signedMediaUrls(supabase, [
    ...recentCharacters.map((character) => character.portraitPath),
    ...shownCampaigns.map((campaign) => campaign.coverPath),
  ]);

  const archivedCount = campaigns.length - active.length;
  const firstName = (profile?.displayName ?? 'aventureiro').split(' ')[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Boas-vindas com o Tomo (redesign "Grimório Arcano"). */}
      <section
        aria-labelledby="boas-vindas"
        className="relative overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_140%_at_85%_20%,rgb(107_59_198/0.35),transparent_60%),linear-gradient(135deg,var(--color-charcoal-850),var(--color-charcoal-950))] px-6 py-8 shadow-[0_20px_50px_-30px_rgb(107_59_198/0.8)] sm:px-10 sm:py-10"
      >
        <Image
          src="/mestre/heroi.webp"
          alt=""
          width={640}
          height={598}
          priority
          className="pointer-events-none absolute -right-10 -bottom-16 hidden h-[130%] w-auto opacity-90 [mask-image:radial-gradient(closest-side,black_55%,transparent)] md:block"
        />
        <div className="relative flex max-w-xl flex-col gap-4">
          <p className="eyebrow text-wine-300">Painel</p>
          <h1 id="boas-vindas" className="text-3xl leading-tight sm:text-4xl">
            Bem-vindo de volta, {firstName}!
          </h1>
          <p className="text-fg-secondary">Que suas próximas sessões sejam lendárias.</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href={routes.newCampaign} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Nova campanha
            </ButtonLink>
            <ButtonLink href="/convite" variant="secondary" icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}>
              Entrar com código
            </ButtonLink>
          </div>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3" aria-label="Resumo">
        {[
          { href: routes.campaigns, icon: <ScrollText className="h-5 w-5" aria-hidden="true" />, title: 'Minhas campanhas', value: `${active.length} ${active.length === 1 ? 'ativa' : 'ativas'}` },
          { href: routes.campaigns, icon: <CalendarCheck className="h-5 w-5" aria-hidden="true" />, title: 'Próximas sessões', value: `${sessions.length} ${sessions.length === 1 ? 'agendada' : 'agendadas'}` },
          { href: routes.characters, icon: <UserRound className="h-5 w-5" aria-hidden="true" />, title: 'Personagens', value: `${characters.length} ${characters.length === 1 ? 'ficha' : 'fichas'}` },
        ].map((stat) => (
          <li key={stat.title}>
            <Link
              href={stat.href as Route}
              className="flex items-center gap-4 rounded-lg border border-line bg-card px-4 py-4 transition-colors hover:border-wine-400/50 hover:bg-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-md border border-wine-400/30 bg-wine-900/60 text-wine-300">{stat.icon}</span>
              <span>
                <span className="block text-sm font-medium text-fg">{stat.title}</span>
                <span className="block text-xs text-fg-muted">{stat.value}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

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
                <li key={invite.code} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="campanhas-andamento" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="campanhas-andamento" className="text-xl">
              Campanhas recentes
            </h2>
            {campaigns.length > 0 ? (
              <Link href={routes.campaigns} className="text-sm text-wine-300 hover:text-wine-200">
                Ver todas{archivedCount > 0 ? ` (${archivedCount} arquivada${archivedCount > 1 ? 's' : ''})` : ''} →
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
            <ul className="grid gap-4 sm:grid-cols-2">
              {shownCampaigns.map((campaign) => (
                <li key={campaign.id}>
                  <CampaignCard campaign={campaign} coverUrl={campaign.coverPath ? (media[campaign.coverPath] ?? null) : null} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="proximas-sessoes" className="flex flex-col gap-6">
          <Card>
            <CardHeader
              icon={<Swords className="h-5 w-5" aria-hidden="true" />}
              title="Seus personagens"
              action={
                characters.length > 0 ? (
                  <Link href={routes.characters} className="text-sm text-fg-secondary underline underline-offset-4 hover:text-fg">
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
                      portraitUrl={character.portraitPath ? (media[character.portraitPath] ?? null) : null}
                      meta={character.campaignName}
                      className="p-3"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
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
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/campanhas/${session.campaignId}`}
                      className="block rounded-md border border-line px-3 py-2 hover:border-parchment-400/40 hover:bg-hover"
                    >
                      <p className="text-xs text-fg-muted">{formatDateTime(session.scheduledAt)}</p>
                      <p className="text-sm font-medium text-fg">
                        Sessão {session.number}: {session.title}
                      </p>
                      <p className="text-xs text-fg-secondary">{session.campaignName}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
