import {
  getMyPendingInvites,
  getProfile,
  listMyCampaigns,
  listMyCharacters,
  listUpcomingSessions,
  signedMediaUrls,
} from '@codexveil/database';
import { formatInviteCode } from '@codexveil/domain';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { useRouter } from 'expo-router';
import { CalendarClock, Mail, ScrollText, Swords } from 'lucide-react-native';
import { View } from 'react-native';
import { CampaignCoverCard } from '@/components/campaign-cover-card';
import { CharacterAvatar } from '@/components/character-avatar';
import { IconBubble, SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { AttendanceCard } from '@/components/sessions/attendance';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Painel: o que jogar agora em destaque, depois convites, mesas, fichas e agenda. */
export default function DashboardScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const [profile, campaigns, invites, characters, sessions] = await Promise.all([
      getProfile(supabase, userId),
      listMyCampaigns(supabase, userId),
      getMyPendingInvites(supabase),
      listMyCharacters(supabase, userId),
      listUpcomingSessions(supabase),
    ]);
    // Capas das mesas em andamento mostradas no painel.
    const covers = await signedMediaUrls(
      supabase,
      campaigns
        .filter((campaign) => campaign.status === 'active')
        .slice(0, 6)
        .map((campaign) => campaign.coverPath),
    );
    return { profile, campaigns, invites, characters, sessions, covers };
  }, userId);

  if (loading) return <LoadingState label="Abrindo o grimório…" />;

  const firstName = (data?.profile?.displayName ?? 'aventureiro').split(' ')[0];
  const active = data?.campaigns.filter((campaign) => campaign.status === 'active') ?? [];
  // Personagem mais recente que está numa campanha ativa: é o "continuar jogando".
  const current =
    data?.characters.find(
      (character) =>
        character.campaignId && active.some((campaign) => campaign.id === character.campaignId),
    ) ?? null;
  const nextSession = data?.sessions[0] ?? null;
  // Presença só nas campanhas em que o usuário joga (o mestre vê as respostas na sessão).
  const plays = (campaignId: string) =>
    data?.campaigns.some((campaign) => campaign.id === campaignId && campaign.role !== 'gm') ??
    false;

  return (
    <Screen
      title={`Olá, ${firstName}`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>


          {nextSession ? (
            <ListRow
              leading={
                <IconBubble tone="brand">
                  <CalendarClock size={18} color={colors.fgAccent} />
                </IconBubble>
              }
              title={`Próxima sessão: ${nextSession.title}`}
              subtitle={`${nextSession.campaignName} · ${dayFormat.format(new Date(nextSession.scheduledAt))}`}
              onPress={() =>
                router.push({ pathname: '/sessao/[id]', params: { id: nextSession.id } })
              }
            />
          ) : null}
          {nextSession && plays(nextSession.campaignId) ? (
            <AttendanceCard sessionId={nextSession.id} campaignId={nextSession.campaignId} />
          ) : null}

          {data.invites.length > 0 ? (
            <>
              <SectionHeader
                icon={<Mail size={14} color={colors.fgBrand} />}
                title={`Convites (${data.invites.length})`}
              />
              {data.invites.map((invite) => (
                <ListRow
                  key={invite.code}
                  leading={
                    <IconBubble tone="brand">
                      <Mail size={18} color={colors.fgAccent} />
                    </IconBubble>
                  }
                  title={invite.campaignName}
                  subtitle={`Mestre: ${invite.ownerName}`}
                  meta={`Expira em ${dateFormat.format(new Date(invite.expiresAt))}`}
                  onPress={() =>
                    router.push({
                      pathname: '/convite',
                      params: { codigo: formatInviteCode(invite.code) },
                    })
                  }
                />
              ))}
            </>
          ) : null}

          <SectionHeader
            icon={<ScrollText size={14} color={colors.fgAccent} />}
            title="Suas mesas"
          />
          {active.length === 0 ? (
            <EmptyState
              title="Nenhuma campanha em andamento"
              description="Entre com o código do seu mestre ou crie uma campanha na aba Campanhas."
            />
          ) : (
            active
              .slice(0, 4)
              .map((campaign) => (
                <CampaignCoverCard
                  key={campaign.id}
                  campaign={campaign}
                  coverUrl={campaign.coverPath ? (data.covers[campaign.coverPath] ?? null) : null}
                  onPress={() =>
                    router.push({ pathname: '/campanha/[id]', params: { id: campaign.id } })
                  }
                />
              ))
          )}

          <SectionHeader
            icon={<Swords size={14} color={colors.fgAccent} />}
            title="Seus personagens"
          />
          {data.characters.length === 0 ? (
            <EmptyState
              title="Nenhum personagem"
              description="Crie o seu na aba Personagens: a criação guiada leva poucos minutos."
            />
          ) : (
            data.characters
              .filter((character) => character.id !== current?.id)
              .slice(0, 3)
              .map((character) => (
                <ListRow
                  key={character.id}
                  leading={
                    <CharacterAvatar
                      name={character.name}
                      systemId={character.systemId}
                      sheet={character.sheet}
                    />
                  }
                  title={character.name}
                  subtitle={summarizeSheet(character.systemId, character.sheet).subtitle}
                  meta={character.campaignName ?? 'Sem campanha'}
                  onPress={() =>
                    router.push({ pathname: '/personagem/[id]', params: { id: character.id } })
                  }
                />
              ))
          )}

          {data.sessions.length > 1 ? (
            <>
              <SectionHeader
                icon={<CalendarClock size={14} color={colors.fgAccent} />}
                title="Agenda"
              />
              {data.sessions.slice(1).map((session) => (
                <View key={session.id} style={{ gap: 6 }}>
                  <ListRow
                    title={`Sessão ${session.number}: ${session.title}`}
                    subtitle={session.campaignName}
                    meta={dateFormat.format(new Date(session.scheduledAt))}
                    onPress={() =>
                      router.push({ pathname: '/sessao/[id]', params: { id: session.id } })
                    }
                  />
                  {plays(session.campaignId) ? (
                    <AttendanceCard sessionId={session.id} campaignId={session.campaignId} />
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
