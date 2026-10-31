import { useState } from 'react';
import { ConflictObjectivesCard } from '@/components/assimilacao/conflict';
import {
  campaignCoverPath,
  getCampaign,
  leaveCampaign,
  listCampaignCharacters,
  listCampaignMembers,
  listSessions,
  sessionStatusLabels,
  setCampaignCover,
  signedMediaUrls,
} from '@codexveil/database';
import { Avatar } from '@/components/ui/avatar';
import { campaignRoleLabels } from '@codexveil/domain';
import { conditionLabel, findSystem, summarizeSheet } from '@codexveil/rpg-systems';
import { campaignSourcebooks, dnd5eCampaignLinks } from '@codexveil/rpg-systems/dnd5e';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  BookOpen,
  CalendarClock,
  Dices,
  ExternalLink,
  Map as MapIcon,
  NotebookPen,
  Swords,
  UserPlus,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  LinkExistingCharacter,
  campaignRuleIssues,
} from '@/components/campaign/link-existing-character';
import { TurnStatus } from '@/components/campaign/turn-status';
import { DiceColorCard } from '@/components/dice/dice-color';
import { CharacterAvatar } from '@/components/character-avatar';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { HealthBar } from '@/components/ui/health-bar';
import { ImageUploadButtons } from '@/components/ui/image-upload';
import { HeroCard, QuickAction, QuickActions, SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { NavGrid, NavTile } from '@/components/ui/nav-tile';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState, Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [linksOpen, setLinksOpen] = useState(false);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const [members, party, sessions] = await Promise.all([
      listCampaignMembers(supabase, campaign.id, campaign.ownerId),
      listCampaignCharacters(supabase, campaign.id),
      listSessions(supabase, campaign.id),
    ]);
    const covers = await signedMediaUrls(supabase, [
      campaign.coverPath,
      ...party.map((character) => character.portraitPath),
    ]);
    return {
      portraits: covers,
      campaign,
      members,
      party,
      sessions,
      coverUrl: campaign.coverPath ? (covers[campaign.coverPath] ?? null) : null,
    };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Campanha não encontrada"
          description="Ela não existe ou você não participa dela."
        />
      </Screen>
    );
  }

  const { campaign, members, party, sessions, coverUrl, portraits } = data;
  const isGm = campaign.role === 'gm';
  const isActive = campaign.status === 'active';
  const ownCharacter = party.find((character) => character.ownerId === userId) ?? null;
  const ownHp = ownCharacter?.resources.find((resource) => resource.display === 'health') ?? null;
  // O próprio personagem fica no destaque; a lista mostra os outros (se o mestre liberar as fichas).
  const others = party.filter((character) => character.id !== ownCharacter?.id);
  const system = findSystem(campaign.systemId);
  const creationRules = system
    ? system.describeCampaignRules(system.parseCampaignRules(campaign.characterRules))
    : [];
  // O app é a ficha de jogo: as regras de criação só aparecem enquanto o personagem do jogador
  // não existe ou ainda não cumpre as regras do mestre (o mestre as vê no site).
  const ownIssues = ownCharacter
    ? campaignRuleIssues(
        campaign.systemId,
        ownCharacter.name,
        ownCharacter.sheet,
        campaign.characterRules,
      )
    : [];
  const campaignLinks =
    campaign.systemId === 'dnd5e'
      ? dnd5eCampaignLinks(
          system?.officialLinks ?? [],
          campaignSourcebooks(campaign.characterRules),
        )
      : (system?.officialLinks ?? []);
  const showCreationRules =
    !isGm && creationRules.length > 0 && (!ownCharacter || ownIssues.length > 0);

  const leave = async () => {
    const confirmed = await confirm({
      title: 'Sair da campanha?',
      message: 'Você perderá o acesso ao conteúdo. Seus personagens continuam com você.',
      confirmLabel: 'Sair',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await leaveCampaign(getSupabase(), campaign.id);
      toast({ tone: 'info', title: 'Você saiu da campanha.' });
      router.back();
    } catch (cause) {
      toast({ tone: 'danger', title: 'Não foi possível sair', description: failureMessage(cause) });
    }
  };

  return (
    <Screen
      eyebrow={campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
      title={campaign.name}
      subtitle={`${findSystem(campaign.systemId)?.shortName ?? campaign.systemId} · Mestre: ${campaign.ownerName}`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Stack.Screen options={{ title: campaign.name }} />
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          accessibilityLabel={`Capa de ${campaign.name}`}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : null}
      {isActive ? <DiceColorCard campaignId={campaign.id} /> : null}
      {campaign.systemId === 'assimilacao' && isActive ? (
        <ConflictObjectivesCard campaignId={campaign.id} />
      ) : null}
      {/* Só o mestre troca a capa (o Storage confere); ela aparece no painel de todos. */}
      {isGm && isActive ? (
        <Card>
          <AppText variant="eyebrow">Capa da campanha</AppText>
          <AppText variant="small">
            Aparece no painel e na lista de campanhas de todos os participantes.
          </AppText>
          <ImageUploadButtons
            preset="scene"
            label="Enviar capa"
            currentPath={campaign.coverPath}
            pathFor={(fileName) => campaignCoverPath(campaign.id, fileName)}
            apply={(path) => setCampaignCover(getSupabase(), campaign.id, path)}
            onDone={() => {
              toast({ tone: 'success', title: 'Capa atualizada.' });
              void reload();
            }}
          />
        </Card>
      ) : null}
      {!isActive ? (
        <Notice
          tone="warning"
          title="Campanha arquivada"
          message="Os dados estão preservados, mas nada pode ser alterado."
        />
      ) : null}
      {campaign.description ? (
        <Card>
          <AppText variant="serif">{campaign.description}</AppText>
        </Card>
      ) : null}
      {showCreationRules ? (
        <Card>
          <AppText variant="eyebrow">Criação de personagens</AppText>
          {creationRules.map((rule) => (
            <AppText key={rule} variant="muted">
              • {rule}
            </AppText>
          ))}
        </Card>
      ) : null}

      {ownCharacter ? (
        <HeroCard
          onPress={() =>
            router.push({ pathname: '/personagem/[id]', params: { id: ownCharacter.id } })
          }
          accessibilityLabel={`Abrir a ficha de ${ownCharacter.name}`}
        >
          <AppText variant="eyebrow" style={{ color: colors.fgBrand }}>
            Meu personagem
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CharacterAvatar
              name={ownCharacter.name}
              systemId={ownCharacter.systemId}
              sheet={ownCharacter.sheet}
              size={56}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="title" numberOfLines={1}>
                {ownCharacter.name}
              </AppText>
              <AppText variant="muted" numberOfLines={1}>
                {summarizeSheet(ownCharacter.systemId, ownCharacter.sheet).subtitle}
              </AppText>
            </View>
          </View>
          {ownHp ? <HealthBar current={ownHp.current} max={ownHp.max} temp={ownHp.temp} /> : null}
          {ownCharacter.conditions.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {ownCharacter.conditions.map((condition) => (
                <Badge
                  key={condition.id}
                  label={conditionLabel(ownCharacter.systemId, condition.key, condition.level)}
                  tone="warning"
                />
              ))}
            </View>
          ) : null}
          <QuickActions>
            <QuickAction
              primary
              icon={<Swords size={16} color={colors.primaryFg} />}
              label="Ficha e turno"
              onPress={() =>
                router.push({ pathname: '/personagem/[id]', params: { id: ownCharacter.id } })
              }
            />
            <QuickAction
              icon={<Dices size={16} color={colors.fg} />}
              label="Dados"
              onPress={() =>
                router.push({ pathname: '/campanha/[id]/dados', params: { id: campaign.id } })
              }
            />
          </QuickActions>
        </HeroCard>
      ) : isActive && !isGm ? (
        <HeroCard>
          <AppText variant="heading">Você ainda não tem personagem aqui</AppText>
          <AppText variant="muted">
            Crie um seguindo as regras da mesa ou traga um que você já tem.
          </AppText>
          <Button
            label="Criar personagem"
            icon={<UserPlus size={16} color={colors.primaryFg} />}
            onPress={() =>
              router.push({ pathname: '/personagem/novo', params: { campanha: campaign.id } })
            }
          />
        </HeroCard>
      ) : null}
      {isActive && !isGm && !ownCharacter && userId ? (
        <LinkExistingCharacter
          userId={userId}
          campaign={{
            id: campaign.id,
            systemId: campaign.systemId,
            characterRules: campaign.characterRules,
            creationQuestions: campaign.creationQuestions,
          }}
          onLinked={reload}
        />
      ) : null}

      <TurnStatus
        campaignId={campaign.id}
        ownCharacterId={ownCharacter?.id ?? null}
        systemId={campaign.systemId}
      />

      <NavGrid>
        <NavTile
          icon={<MapIcon size={20} color={colors.fgAccent} />}
          label="Mapa"
          hint="Grade da sessão e o seu token"
          onPress={() =>
            router.push({ pathname: '/campanha/[id]/mapa', params: { id: campaign.id } })
          }
        />
        <NavTile
          icon={<Dices size={20} color={colors.fgAccent} />}
          label="Dados"
          hint="Rolar e ver o mural"
          onPress={() =>
            router.push({ pathname: '/campanha/[id]/dados', params: { id: campaign.id } })
          }
        />
        <NavTile
          icon={<BookOpen size={20} color={colors.fgAccent} />}
          label="Biblioteca"
          hint="NPCs, monstros e itens revelados"
          onPress={() =>
            router.push({ pathname: '/campanha/[id]/biblioteca', params: { id: campaign.id } })
          }
        />
        <NavTile
          icon={<NotebookPen size={20} color={colors.fgAccent} />}
          label="Anotações"
          onPress={() =>
            router.push({ pathname: '/campanha/[id]/anotacoes', params: { id: campaign.id } })
          }
        />
      </NavGrid>

      {isGm ? (
        <Notice
          tone="info"
          message="Ferramentas do mestre (mesa, sessões, convites e biblioteca) ficam no site; o app é para jogar."
        />
      ) : null}

      {isGm || others.length > 0 || campaign.settings.partySheetsVisible ? (
        <>
          <SectionHeader
            icon={<Users size={14} color={colors.fgAccent} />}
            title={isGm ? `Grupo (${party.length})` : 'Companheiros'}
          />
          {others.length === 0 ? (
            <AppText variant="muted">
              {isGm
                ? 'Nenhum personagem ainda. Os jogadores criam os personagens.'
                : 'Ainda não há personagens de outros jogadores.'}
            </AppText>
          ) : null}
          {others.map((character) => {
            const hp = character.resources.find((resource) => resource.display === 'health');
            return (
              <View key={character.id} style={styles.member}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <CharacterAvatar
                    name={character.name}
                    systemId={character.systemId}
                    sheet={character.sheet}
                    size={52}
                    portraitUrl={character.portraitPath ? (portraits[character.portraitPath] ?? null) : null}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText
                      style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.fg }}
                      numberOfLines={1}
                    >
                      {character.name}
                    </AppText>
                    <AppText variant="small" numberOfLines={1}>
                      {summarizeSheet(character.systemId, character.sheet).subtitle} ·{' '}
                      {character.ownerName}
                    </AppText>
                  </View>
                </View>
                {hp ? <HealthBar current={hp.current} max={hp.max} temp={hp.temp} /> : null}
                {character.conditions.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {character.conditions.map((condition) => (
                      <Badge
                        key={condition.id}
                        label={conditionLabel(character.systemId, condition.key, condition.level)}
                        tone="warning"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      <SectionHeader icon={<CalendarClock size={14} color={colors.fgAccent} />} title="Sessões" />
      <Card>
        {sessions.length === 0 ? (
          <AppText variant="muted">
            {isGm ? 'Nenhuma sessão criada.' : 'Nenhuma sessão publicada ainda.'}
          </AppText>
        ) : null}
        {sessions.map((session) => (
          <ListRow
            key={session.id}
            title={`Sessão ${session.number}: ${session.title}`}
            subtitle={
              sessionStatusLabels[session.status] +
              (isGm && !session.isPublished ? ' · não publicada' : '')
            }
            onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: session.id } })}
          />
        ))}
      </Card>

      {campaignLinks.length > 0 ? (
        <Card>
          {/* Recolhido por padrão: é consulta eventual. */}
          <Pressable
            onPress={() => setLinksOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: linksOpen }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <ExternalLink size={14} color={colors.fgAccent} />
            <AppText variant="eyebrow" style={{ flex: 1 }}>
              Links oficiais ({campaignLinks.length})
            </AppText>
            {linksOpen ? (
              <ChevronUp size={18} color={colors.fgMuted} />
            ) : (
              <ChevronDown size={18} color={colors.fgMuted} />
            )}
          </Pressable>
          {linksOpen ? (
            <AppText variant="muted">
              Dúvidas de regras? Os sites oficiais do sistema (conteúdo da editora, em inglês).
            </AppText>
          ) : null}
          {(linksOpen ? campaignLinks : []).map((link) => (
            <ListRow
              key={link.url}
              title={link.label}
              subtitle={`${link.description}${link.access === 'paid' ? ' (livro vendido pela editora)' : ' (gratuito)'}`}
              trailing={<ExternalLink size={16} color={colors.fgMuted} />}
              accessibilityHint="Abre o site oficial no navegador"
              onPress={() => void Linking.openURL(link.url)}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHeader icon={<Users size={14} color={colors.fgAccent} />} title="Participantes" />
        {members.map((member) => (
          <View
            key={member.userId}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Avatar name={member.displayName} icon={member.avatarIcon} size={32} />
              <AppText>
                {member.displayName}
                {member.userId === userId ? ' (você)' : ''}
              </AppText>
            </View>
            <Badge
              label={member.isOwner ? 'Mestre responsável' : campaignRoleLabels[member.role]}
              tone={member.role === 'gm' ? 'brand' : 'neutral'}
            />
          </View>
        ))}
        {!campaign.isOwner ? (
          <Button label="Sair da campanha" variant="danger" compact onPress={() => void leave()} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: {
    gap: spacing[2],
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
