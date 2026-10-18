import {
  getMyPendingInvites,
  getProfile,
  listMyCampaigns,
  listMyCharacters,
  listUpcomingSessions,
} from '@codexveil/database';
import { campaignRoleLabels, formatInviteCode } from '@codexveil/domain';
import { summarizeSheet } from '@codexveil/rpg-systems';
import { useRouter } from 'expo-router';
import { CalendarClock, Dices, Mail, ScrollText, Swords } from 'lucide-react-native';
import { View } from 'react-native';
import { CharacterAvatar } from '@/components/character-avatar';
import { HeroCard, IconBubble, QuickAction, QuickActions, SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

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
    return { profile, campaigns, invites, characters, sessions };
  }, userId);

  if (loading) return <LoadingState label="Abrindo o grimório…" />;

  const firstName = (data?.profile?.displayName ?? 'aventureiro').split(' ')[0];
  const active = data?.campaigns.filter((campaign) => campaign.status === 'active') ?? [];
  // Personagem mais recente que está numa campanha ativa: é o "continuar jogando".
  const current = data?.characters.find((character) => character.campaignId && active.some((campaign) => campaign.id === character.campaignId)) ?? null;
  const nextSession = data?.sessions[0] ?? null;

  return (
    <Screen eyebrow="Codexveil" title={`Olá, ${firstName}`} subtitle="Pronto para a próxima aventura?" refreshing={refreshing} onRefresh={reload}>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          {current?.campaignId ? (
            <HeroCard onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: current.id } })} accessibilityLabel={`Continuar jogando com ${current.name}`}>
              <AppText variant="eyebrow" style={{ color: colors.fgBrand }}>
                Continuar jogando
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CharacterAvatar name={current.name} systemId={current.systemId} sheet={current.sheet} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="title" numberOfLines={1}>
                    {current.name}
                  </AppText>
                  <AppText variant="muted" numberOfLines={1}>
                    {summarizeSheet(current.systemId, current.sheet).subtitle}
                  </AppText>
                  <AppText variant="small" numberOfLines={1}>
                    {current.campaignName}
                  </AppText>
                </View>
              </View>
              <QuickActions>
                <QuickAction primary icon={<Swords size={16} color={colors.primaryFg} />} label="Ficha" onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: current.id } })} />
                <QuickAction
                  icon={<Dices size={16} color={colors.fg} />}
                  label="Dados"
                  onPress={() => router.push({ pathname: '/campanha/[id]/dados', params: { id: current.campaignId ?? '' } })}
                />
                <QuickAction
                  icon={<ScrollText size={16} color={colors.fg} />}
                  label="Mesa"
                  onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: current.campaignId ?? '' } })}
                />
              </QuickActions>
            </HeroCard>
          ) : null}

          {nextSession ? (
            <ListRow
              leading={
                <IconBubble tone="brand">
                  <CalendarClock size={18} color={colors.fgAccent} />
                </IconBubble>
              }
              title={`Próxima sessão: ${nextSession.title}`}
              subtitle={`${nextSession.campaignName} · ${dayFormat.format(new Date(nextSession.scheduledAt))}`}
              onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: nextSession.id } })}
            />
          ) : null}

          {data.invites.length > 0 ? (
            <>
              <SectionHeader icon={<Mail size={14} color={colors.fgBrand} />} title={`Convites (${data.invites.length})`} />
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
                  onPress={() => router.push({ pathname: '/convite', params: { codigo: formatInviteCode(invite.code) } })}
                />
              ))}
            </>
          ) : null}

          <SectionHeader
            icon={<ScrollText size={14} color={colors.fgAccent} />}
            title="Suas mesas"
          />
          {active.length === 0 ? (
            <EmptyState title="Nenhuma campanha em andamento" description="Entre com o código do seu mestre ou crie uma campanha na aba Campanhas." />
          ) : (
            active.slice(0, 6).map((campaign) => (
              <ListRow
                key={campaign.id}
                leading={
                  <IconBubble>
                    <ScrollText size={18} color={colors.fgAccent} />
                  </IconBubble>
                }
                title={campaign.name}
                subtitle={`${campaign.memberCount} participante${campaign.memberCount === 1 ? '' : 's'}`}
                trailing={<Badge label={campaign.isOwner ? 'Mestre' : campaignRoleLabels[campaign.role]} tone={campaign.role === 'gm' ? 'brand' : 'neutral'} />}
                onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: campaign.id } })}
              />
            ))
          )}

          <SectionHeader icon={<Swords size={14} color={colors.fgAccent} />} title="Seus personagens" />
          {data.characters.length === 0 ? (
            <EmptyState title="Nenhum personagem" description="Crie o seu na aba Personagens: a criação guiada leva poucos minutos." />
          ) : (
            data.characters
              .filter((character) => character.id !== current?.id)
              .slice(0, 4)
              .map((character) => (
                <ListRow
                  key={character.id}
                  leading={<CharacterAvatar name={character.name} systemId={character.systemId} sheet={character.sheet} />}
                  title={character.name}
                  subtitle={summarizeSheet(character.systemId, character.sheet).subtitle}
                  meta={character.campaignName ?? 'Sem campanha'}
                  onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: character.id } })}
                />
              ))
          )}

          {data.sessions.length > 1 ? (
            <>
              <SectionHeader icon={<CalendarClock size={14} color={colors.fgAccent} />} title="Agenda" />
              {data.sessions.slice(1).map((session) => (
                <ListRow
                  key={session.id}
                  title={`Sessão ${session.number}: ${session.title}`}
                  subtitle={session.campaignName}
                  meta={dateFormat.format(new Date(session.scheduledAt))}
                  onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: session.id } })}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
