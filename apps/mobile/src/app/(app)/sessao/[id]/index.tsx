import {
  getCampaign,
  getSession,
  listSessionBlocks,
  resolveBlockReferences,
  sessionStatusLabels,
  signedMediaUrls,
  type BlockReferences,
  type StoredSessionBlock,
} from '@codexveil/database';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { Image, View } from 'react-native';
import { AppText, Badge, Card, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, palette, radii } from '@/lib/theme';

function BlockView({
  block,
  references,
  imageUrls,
}: {
  block: StoredSessionBlock;
  references: BlockReferences;
  imageUrls: Record<string, string>;
}) {
  const content = block.content;
  if (!content) return <AppText variant="muted">Bloco em formato não reconhecido.</AppText>;
  switch (content.type) {
    case 'heading':
      return (
        <AppText variant="title" accessibilityRole="header">
          {content.data.text}
        </AppText>
      );
    case 'subheading':
      return <AppText variant="heading">{content.data.text}</AppText>;
    case 'paragraph':
      return <AppText variant="serif">{content.data.text}</AppText>;
    case 'gm_note':
      return (
        <View
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: palette.wine[400],
            backgroundColor: palette.wine[950],
            borderRadius: radii.md,
            padding: 12,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Lock size={14} color={palette.wine[300]} />
            <AppText variant="small" style={{ color: palette.wine[300] }}>
              Nota privada do mestre
            </AppText>
          </View>
          <AppText variant="serif">{content.data.text}</AppText>
        </View>
      );
    case 'callout':
      return (
        <View
          style={{
            backgroundColor: content.data.tone === 'lore' ? colors.parchment : colors.raised,
            borderRadius: radii.md,
            padding: 14,
            gap: 4,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {content.data.title ? (
            <AppText
              style={{
                fontFamily: 'Cinzel_600SemiBold',
                color: content.data.tone === 'lore' ? colors.ink : colors.fgAccent,
              }}
            >
              {content.data.title}
            </AppText>
          ) : null}
          <AppText
            variant="serif"
            style={{ color: content.data.tone === 'lore' ? colors.ink : colors.fg }}
          >
            {content.data.text}
          </AppText>
        </View>
      );
    case 'image': {
      const url = content.data.path ? imageUrls[content.data.path] : undefined;
      return url ? (
        <View style={{ gap: 6 }}>
          <Image
            source={{ uri: url }}
            accessibilityLabel={content.data.alt}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radii.md }}
            resizeMode="contain"
          />
          {content.data.caption ? (
            <AppText variant="small" style={{ textAlign: 'center', fontStyle: 'italic' }}>
              {content.data.caption}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="muted">Imagem indisponível.</AppText>
      );
    }
    case 'divider':
      return <Divider />;
    case 'list':
      return (
        <View style={{ gap: 4 }}>
          {content.data.items
            .filter((item) => item.trim())
            .map((item, index) => (
              <AppText key={index} variant="serif">
                {content.data.style === 'numbered' ? `${index + 1}. ` : '• '}
                {item}
              </AppText>
            ))}
        </View>
      );
    case 'checklist':
      return (
        <View style={{ gap: 4 }}>
          {content.data.items.map((item) => (
            <AppText
              key={item.id}
              style={
                item.checked
                  ? { color: colors.fgMuted, textDecorationLine: 'line-through' }
                  : undefined
              }
              accessibilityLabel={`${item.checked ? 'Concluído' : 'Pendente'}: ${item.text}`}
            >
              {item.checked ? '☑ ' : '☐ '}
              {item.text}
            </AppText>
          ))}
        </View>
      );
    case 'npc_ref':
    case 'monster_ref': {
      const target = content.data.creatureId
        ? references.creatures[content.data.creatureId]
        : undefined;
      return (
        <Card>
          <AppText style={{ fontFamily: 'Cinzel_600SemiBold', color: colors.fgAccent }}>
            {target?.name ?? 'Registro indisponível'}
          </AppText>
          {target?.subtitle ? <AppText variant="muted">{target.subtitle}</AppText> : null}
          {content.data.note ? <AppText variant="small">{content.data.note}</AppText> : null}
        </Card>
      );
    }
    case 'character_ref': {
      const target = content.data.characterId
        ? references.characters[content.data.characterId]
        : undefined;
      return (
        <Card>
          <AppText style={{ fontFamily: 'Cinzel_600SemiBold', color: colors.fgAccent }}>
            {target?.name ?? 'Personagem indisponível'}
          </AppText>
          {content.data.note ? <AppText variant="small">{content.data.note}</AppText> : null}
        </Card>
      );
    }
    case 'content_ref': {
      const session =
        content.data.kind === 'session' ? references.sessions[content.data.targetId] : undefined;
      const note =
        content.data.kind === 'note' ? references.notes[content.data.targetId] : undefined;
      return (
        <Card>
          <AppText style={{ fontFamily: 'Cinzel_600SemiBold', color: colors.fgAccent }}>
            {session
              ? `Sessão ${session.number}: ${session.title}`
              : (note?.title ?? 'Conteúdo indisponível')}
          </AppText>
          {content.data.note ? <AppText variant="small">{content.data.note}</AppText> : null}
        </Card>
      );
    }
  }
}

/** Leitura do roteiro. Jogadores recebem do banco somente blocos públicos de sessões publicadas. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const session = await getSession(supabase, id);
    if (!session) return null;
    const [blocks, campaign] = await Promise.all([
      listSessionBlocks(supabase, session.id),
      getCampaign(supabase, session.campaignId, userId),
    ]);
    const [references, imageUrls] = await Promise.all([
      resolveBlockReferences(supabase, blocks),
      signedMediaUrls(
        supabase,
        blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
      ),
    ]);
    return { session, blocks, references, imageUrls, campaignName: campaign?.name ?? null };
  }, `${id}:${userId}`);
  // Trechos liberados pelo mestre durante a sessão chegam na hora.
  useRealtimeRefresh(
    `sessao:${id}`,
    [{ table: 'session_blocks', filter: `session_id=eq.${id}` }],
    () => void reload(),
  );

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Sessão indisponível"
          description="Ela não existe, não foi publicada ou você não participa da campanha."
        />
      </Screen>
    );
  }

  const { session, blocks, references, imageUrls, campaignName } = data;
  return (
    <Screen
      eyebrow={
        campaignName ? `${campaignName} · Sessão ${session.number}` : `Sessão ${session.number}`
      }
      title={session.title}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Stack.Screen options={{ title: `Sessão ${session.number}` }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Badge
          label={sessionStatusLabels[session.status]}
          tone={session.status === 'in_progress' ? 'brand' : 'neutral'}
        />
      </View>
      {session.recap ? (
        <View
          style={{ backgroundColor: colors.parchment, borderRadius: radii.lg, padding: 16, gap: 6 }}
        >
          <AppText style={{ fontFamily: 'Cinzel_600SemiBold', color: colors.ink }}>Resumo</AppText>
          <AppText variant="serif" style={{ color: colors.ink }}>
            {session.recap}
          </AppText>
        </View>
      ) : null}
      {blocks.length === 0 ? (
        <EmptyState
          title="Roteiro vazio"
          description="O mestre ainda não liberou conteúdo desta sessão."
        />
      ) : (
        <Divider />
      )}
      {blocks.map((block) => (
        <View
          key={block.id}
          style={
            block.visibility === 'gm' && block.content?.type !== 'gm_note'
              ? { borderLeftWidth: 2, borderLeftColor: palette.wine[400], paddingLeft: 10 }
              : undefined
          }
        >
          <BlockView block={block} references={references} imageUrls={imageUrls} />
        </View>
      ))}
    </Screen>
  );
}
