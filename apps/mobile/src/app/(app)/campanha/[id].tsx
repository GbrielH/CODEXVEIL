import {
  createCampaignInvite,
  getCampaign,
  leaveCampaign,
  listCampaignCharacters,
  listCampaignMembers,
  listSessions,
  sessionStatusLabels,
} from '@codexveil/database';
import { campaignRoleLabels, formatInviteCode } from '@codexveil/domain';
import { conditionLabel, findSystem, summarizeSheet } from '@codexveil/rpg-systems';
import { inviteCreateSchema } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Share2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert as NativeAlert, Share, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { HealthBar } from '@/components/ui/health-bar';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState, Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [inviteBusy, setInviteBusy] = useState(false);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const [members, party, sessions] = await Promise.all([
      listCampaignMembers(supabase, campaign.id, campaign.ownerId),
      listCampaignCharacters(supabase, campaign.id),
      listSessions(supabase, campaign.id),
    ]);
    return { campaign, members, party, sessions };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }

  const { campaign, members, party, sessions } = data;
  const isGm = campaign.role === 'gm';
  const isActive = campaign.status === 'active';
  const hasOwnCharacter = party.some((character) => character.ownerId === userId);

  const invite = async () => {
    setInviteBusy(true);
    try {
      const input = inviteCreateSchema.parse({ expiresInDays: 7, maxUses: 1, invitedEmail: null });
      const created = await createCampaignInvite(getSupabase(), campaign.id, input);
      const code = formatInviteCode(created.code);
      await Share.share({
        message: `Você foi convidado para a campanha “${campaign.name}” no Codexveil. Código: ${code}\n${siteUrl}/convite/${code}`,
      });
    } catch (cause) {
      toast({ tone: 'danger', title: 'O convite não foi criado', description: failureMessage(cause) });
    } finally {
      setInviteBusy(false);
    }
  };

  const leave = () =>
    NativeAlert.alert('Sair da campanha?', 'Você perderá o acesso ao conteúdo. Seus personagens continuam com você.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () =>
          void leaveCampaign(getSupabase(), campaign.id)
            .then(() => {
              toast({ tone: 'info', title: 'Você saiu da campanha.' });
              router.back();
            })
            .catch((cause: unknown) => toast({ tone: 'danger', title: 'Não foi possível sair', description: failureMessage(cause) })),
      },
    ]);

  return (
    <Screen
      eyebrow={campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
      title={campaign.name}
      subtitle={`${findSystem(campaign.systemId)?.shortName ?? campaign.systemId} · Mestre: ${campaign.ownerName}`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Stack.Screen options={{ title: campaign.name }} />
      {!isActive ? <Notice tone="warning" title="Campanha arquivada" message="Os dados estão preservados, mas nada pode ser alterado." /> : null}
      {campaign.description ? (
        <Card>
          <AppText variant="serif">{campaign.description}</AppText>
        </Card>
      ) : null}

      {isGm && isActive ? (
        <Button label="Convidar jogador" variant="secondary" icon={<Share2 size={16} color={colors.fg} />} onPress={() => void invite()} loading={inviteBusy} />
      ) : null}

      <Card ornate>
        <AppText variant="heading">Grupo</AppText>
        {party.length === 0 ? <AppText variant="muted">Nenhum personagem vinculado ainda.</AppText> : null}
        {party.map((character) => {
          const hp = character.resources.find((resource) => resource.display === 'health');
          return (
            <View key={character.id} style={{ gap: 6 }}>
              <ListRow
                title={character.name}
                subtitle={`${summarizeSheet(character.systemId, character.sheet).subtitle} · ${character.ownerName}`}
                trailing={character.ownerId === userId ? <Badge label="Seu" tone="brand" /> : undefined}
                onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: character.id } })}
              />
              {hp ? <HealthBar current={hp.current} max={hp.max} temp={hp.temp} /> : null}
              {character.conditions.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {character.conditions.map((condition) => (
                    <Badge key={condition.id} label={conditionLabel(character.systemId, condition.key, condition.level)} tone="warning" />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {isActive && !hasOwnCharacter ? (
          <Button
            label="Criar personagem nesta campanha"
            variant="secondary"
            icon={<UserPlus size={16} color={colors.fg} />}
            onPress={() => router.push({ pathname: '/personagem/novo', params: { campanha: campaign.id } })}
          />
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">Sessões</AppText>
        {sessions.length === 0 ? <AppText variant="muted">{isGm ? 'Nenhuma sessão criada.' : 'Nenhuma sessão publicada ainda.'}</AppText> : null}
        {sessions.map((session) => (
          <ListRow
            key={session.id}
            title={`Sessão ${session.number}: ${session.title}`}
            subtitle={sessionStatusLabels[session.status] + (isGm && !session.isPublished ? ' · não publicada' : '')}
            onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: session.id } })}
          />
        ))}
      </Card>

      <Card>
        <AppText variant="heading">Participantes</AppText>
        {members.map((member) => (
          <View key={member.userId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
            <AppText>
              {member.displayName}
              {member.userId === userId ? ' (você)' : ''}
            </AppText>
            <Badge label={member.isOwner ? 'Mestre responsável' : campaignRoleLabels[member.role]} tone={member.role === 'gm' ? 'brand' : 'neutral'} />
          </View>
        ))}
        {!campaign.isOwner ? <Button label="Sair da campanha" variant="danger" compact onPress={leave} /> : null}
      </Card>
    </Screen>
  );
}
