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
import { KeyRound, Mail, Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

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

  return (
    <Screen eyebrow="Painel" title={`Olá, ${firstName}`} refreshing={refreshing} onRefresh={reload}>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Nova campanha" compact icon={<Plus size={16} color={colors.primaryFg} />} onPress={() => router.push('/campanha/nova')} style={{ flex: 1 }} />
            <Button label="Tenho um código" compact variant="secondary" icon={<KeyRound size={16} color={colors.fg} />} onPress={() => router.push('/convite')} style={{ flex: 1 }} />
          </View>

          {data.invites.length > 0 ? (
            <Card ornate>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Mail size={18} color={colors.fgBrand} />
                <AppText variant="heading">Convites pendentes</AppText>
              </View>
              {data.invites.map((invite) => (
                <ListRow
                  key={invite.code}
                  title={invite.campaignName}
                  subtitle={`Mestre: ${invite.ownerName}`}
                  meta={`Expira em ${dateFormat.format(new Date(invite.expiresAt))}`}
                  onPress={() => router.push({ pathname: '/convite', params: { codigo: formatInviteCode(invite.code) } })}
                />
              ))}
            </Card>
          ) : null}

          <AppText variant="heading" accessibilityRole="header">
            Campanhas em andamento
          </AppText>
          {active.length === 0 ? (
            <EmptyState title="Nenhuma campanha em andamento" description="Crie uma campanha para mestrar ou use o código que o seu mestre enviou." />
          ) : (
            active.slice(0, 6).map((campaign) => (
              <ListRow
                key={campaign.id}
                title={campaign.name}
                subtitle={campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
                meta={`${campaign.memberCount} participante${campaign.memberCount === 1 ? '' : 's'}`}
                onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: campaign.id } })}
              />
            ))
          )}

          <AppText variant="heading" accessibilityRole="header">
            Seus personagens
          </AppText>
          {data.characters.length === 0 ? (
            <EmptyState title="Nenhum personagem" action={<Button label="Criar personagem" variant="secondary" onPress={() => router.push('/personagem/novo')} />} />
          ) : (
            data.characters.slice(0, 4).map((character) => (
              <ListRow
                key={character.id}
                title={character.name}
                subtitle={summarizeSheet(character.systemId, character.sheet).subtitle}
                meta={character.campaignName ?? 'Sem campanha'}
                onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: character.id } })}
              />
            ))
          )}

          <AppText variant="heading" accessibilityRole="header">
            Próximas sessões
          </AppText>
          {data.sessions.length === 0 ? (
            <AppText variant="muted">Nenhuma sessão agendada.</AppText>
          ) : (
            data.sessions.map((session) => (
              <ListRow
                key={session.id}
                title={`Sessão ${session.number}: ${session.title}`}
                subtitle={session.campaignName}
                meta={dateFormat.format(new Date(session.scheduledAt))}
                onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: session.id } })}
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
