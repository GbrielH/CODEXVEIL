import {
  CAMPAIGN_MEDIA_BUCKET,
  countTavernUnread,
  deleteTavernMessage,
  signedMediaUrls,
  tavernImagePath,
  listFriends,
  listCampaignMembers,
  listMyCampaigns,
  listTavernMessages,
  sendTavernMessage,
  subscribeToChanges,
  type TavernChannel,
  type TavernMessage,
} from '@codexveil/database';
import { Beer, ImagePlus, Send, X } from 'lucide-react-native';
import Storage from 'expo-sqlite/kv-store';
import { pickImage } from '@/lib/images';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/ui/controls';
import { AppText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

interface ChannelOption {
  id: string;
  label: string;
  channel: TavernChannel;
  ownerId?: string;
}

const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Taverna no app: botão flutuante (por cima de tudo) que abre o chat com os grupos — campanhas em
 * que a pessoa participa e amigos. Mensagens somem depois de 24 horas.
 */
const readKey = (userId: string) => `codexveil:taverna-lidas:${userId}`;
async function readMarks(userId: string): Promise<Record<string, string>> {
  try {
    return JSON.parse((await Storage.getItem(readKey(userId))) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Quem chama o Tomo de fora (ex.: botão do Painel): abre a Taverna com "@tomo " no rascunho. */
const tomoListeners = new Set<() => void>();
export function openTomo() {
  for (const listener of tomoListeners) listener();
}

export function TavernFloating({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [initialDraft, setInitialDraft] = useState('');
  useEffect(() => {
    const listener = () => {
      setInitialDraft('@tomo ');
      setOpen(true);
    };
    tomoListeners.add(listener);
    return () => {
      tomoListeners.delete(listener);
    };
  }, []);
  const [unread, setUnread] = useState<Record<string, number>>({});
  // Não lidas: mensagens de outras pessoas depois da última leitura de cada grupo (até 24 h).
  const refresh = useCallback(async () => {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setUnread(await countTavernUnread(getSupabase(), userId, await readMarks(userId), dayAgo));
    } catch {
      // Tenta de novo na próxima mensagem.
    }
  }, [userId]);
  useEffect(
    () =>
      subscribeToChanges(getSupabase(), 'taverna-aviso', [{ table: 'tavern_messages' }], {
        onChange: () => void refresh(),
      }),
    [refresh],
  );
  const markRead = useCallback(
    (channelId: string) => {
      void readMarks(userId).then((marks) =>
        Storage.setItem(
          readKey(userId),
          JSON.stringify({ ...marks, [channelId]: new Date().toISOString() }),
        ),
      );
      setUnread((current) => ({ ...current, [channelId]: 0 }));
    },
    [userId],
  );
  const total = Object.values(unread).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          total ? `Abrir a Taverna (${total} mensagens não lidas)` : 'Abrir a Taverna'
        }
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
      >
        <Beer size={22} color={colors.fgAccent} />
        {total ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{total > 99 ? '99+' : total}</AppText>
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <TavernModal
          userId={userId}
          unread={unread}
          initialDraft={initialDraft}
          onRead={markRead}
          onClose={() => {
            setOpen(false);
            setInitialDraft('');
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}

function TavernModal({
  userId,
  unread,
  initialDraft = '',
  onRead,
  onClose,
}: {
  userId: string;
  unread: Record<string, number>;
  initialDraft?: string;
  onRead: (channelId: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [current, setCurrent] = useState('');
  const [messages, setMessages] = useState<TavernMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<TavernMessage>>(null);

  useEffect(() => {
    const client = getSupabase();
    Promise.all([listMyCampaigns(client, userId), listFriends(client, userId)])
      .then(([campaigns, friends]) => {
        const options: ChannelOption[] = [
          ...campaigns
            .filter((campaign) => campaign.status === 'active')
            .map((campaign): ChannelOption => ({
              id: `c:${campaign.id}`,
              label: campaign.name,
              channel: { kind: 'campaign', campaignId: campaign.id },
              ownerId: campaign.ownerId,
            })),
          ...friends
            .filter((friend) => friend.status === 'accepted')
            .map((friend): ChannelOption => ({
              id: `f:${friend.userId}`,
              label: friend.displayName,
              channel: { kind: 'direct', friendId: friend.userId },
            })),
        ];
        setChannels(options);
        setCurrent((existing) => existing || options[0]?.id || '');
      })
      .catch(() => setChannels([]));
  }, [userId]);

  const selected = channels?.find((option) => option.id === current) ?? null;
  // "@" no fim do texto sugere o Tomo e as pessoas do grupo (no chat de amigo, o amigo).
  const [members, setMembers] = useState<string[]>([]);
  useEffect(() => {
    if (!selected) return;
    if (selected.channel.kind === 'direct') return;
    let alive = true;
    void listCampaignMembers(getSupabase(), selected.channel.campaignId, selected.ownerId ?? '')
      .then((members) => {
        if (alive)
          setMembers(
            members
              .filter((member) => member.userId !== userId)
              .map((member) => member.displayName),
          );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [selected, userId]);
  const people = selected?.channel.kind === 'direct' ? [selected.label] : members;
  const mention = /(^|\s)@(\w*)$/.exec(draft);
  const partial = mention?.[2]?.toLowerCase() ?? null;
  const suggestions =
    partial === null
      ? []
      : ['Tomo', ...people]
          .filter(
            (name) => name.toLowerCase().startsWith(partial) && name.toLowerCase() !== partial,
          )
          .slice(0, 6);
  const completeMention = (name: string) =>
    setDraft(
      `${draft.slice(0, draft.length - (partial?.length ?? 0) - 1)}@${name === 'Tomo' ? 'tomo' : name} `,
    );
  const load = useCallback(async () => {
    if (!selected) return;
    try {
      setMessages(await listTavernMessages(getSupabase(), userId, selected.channel));
      onRead(selected.id);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  }, [selected, userId, toast, onRead]);

  useEffect(() => {
    if (!selected) return;
    const filter =
      selected.channel.kind === 'campaign'
        ? `campaign_id=eq.${selected.channel.campaignId}`
        : undefined;
    return subscribeToChanges(
      getSupabase(),
      `taverna-${selected.id}`,
      [{ table: 'tavern_messages', ...(filter ? { filter } : {}) }],
      {
        onChange: () => void load(),
      },
    );
  }, [selected, load]);

  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = messages
      .map((message) => message.imagePath)
      .filter((path): path is string => Boolean(path) && !imageUrls[path!]);
    if (!paths.length) return;
    void signedMediaUrls(getSupabase(), paths).then((urls) =>
      setImageUrls((current) => ({ ...current, ...urls })),
    );
  }, [messages, imageUrls]);
  const [image, setImage] = useState<{ bytes: ArrayBuffer; uri: string } | null>(null);
  const [tomoThinking, setTomoThinking] = useState(false);

  const attach = async () => {
    const picked = await pickImage('scene');
    if (!picked) return;
    if (!picked.ok) return toast({ tone: 'danger', title: picked.message });
    setImage({ bytes: picked.bytes, uri: picked.uri });
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !image) || !selected || busy) return;
    setBusy(true);
    try {
      const client = getSupabase();
      let imagePath: string | null = null;
      if (image) {
        imagePath = tavernImagePath(
          selected.channel,
          userId,
          `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`,
        );
        const { error } = await client.storage
          .from(CAMPAIGN_MEDIA_BUCKET)
          .upload(imagePath, image.bytes, { contentType: 'image/webp', upsert: false });
        if (error) throw error;
      }
      await sendTavernMessage(client, selected.channel, body, imagePath);
      setDraft('');
      setImage(null);
      await load();
      // "@tomo" chama o Tomo para responder na conversa (pelo site, com o login do app).
      if (/@tomo\b/i.test(body)) {
        setTomoThinking(true);
        const token = (await client.auth.getSession()).data.session?.access_token;
        void fetch(`${siteUrl}/api/taverna/tomo`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ channel: selected.channel }),
        })
          .then(async (response) => {
            if (!response.ok) toast({ tone: 'warning', title: await response.text() });
            await load();
          })
          .catch(() => toast({ tone: 'warning', title: 'O Tomo não conseguiu responder agora.' }))
          .finally(() => setTomoThinking(false));
      }
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Beer size={18} color={colors.fgAccent} />
          <AppText style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.fg }}>
            Taverna
          </AppText>
          <AppText variant="small">somem em 24 h</AppText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar a Taverna"
            hitSlop={12}
          >
            <X size={22} color={colors.fgMuted} />
          </Pressable>
        </View>
        <FlatList
          horizontal
          data={channels ?? []}
          keyExtractor={(option) => option.id}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            gap: 6,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
          }}
          renderItem={({ item }) => (
            <Chip
              label={
                unread[item.id] && item.id !== current
                  ? `${item.label} (${unread[item.id]})`
                  : item.label
              }
              selected={item.id === current}
              role="radio"
              onPress={() => setCurrent(item.id)}
            />
          )}
        />
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[3], gap: spacing[2] }}
          ListEmptyComponent={
            <AppText variant="small">
              {channels === null
                ? 'Abrindo a Taverna…'
                : channels.length === 0
                  ? 'Entre numa campanha ou adicione amigos para conversar aqui.'
                  : 'Ninguém falou nada nas últimas 24 horas. Puxe uma cadeira!'}
            </AppText>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === userId && !item.fromTomo;
            return (
              <Pressable
                onLongPress={
                  mine
                    ? () => void deleteTavernMessage(getSupabase(), item.id).then(load)
                    : undefined
                }
                style={[
                  styles.bubble,
                  item.fromTomo ? styles.tomo : mine ? styles.mine : styles.theirs,
                ]}
                accessibilityHint={mine ? 'Segure para apagar' : undefined}
              >
                {item.fromTomo ? (
                  <AppText style={{ color: colors.fgAccent, fontSize: 12 }}>
                    Tomo · a pedido de {item.senderName}
                  </AppText>
                ) : !mine ? (
                  <AppText style={{ color: colors.fgAccent, fontSize: 12 }}>
                    {item.senderName}
                  </AppText>
                ) : null}
                {item.imagePath && imageUrls[item.imagePath] ? (
                  <Image
                    source={{ uri: imageUrls[item.imagePath] }}
                    style={{ width: 220, height: 220, borderRadius: 8 }}
                    resizeMode="cover"
                    accessibilityLabel="Imagem enviada"
                  />
                ) : null}
                {item.body ? (
                  <AppText style={{ color: mine ? palette.parchment[50] : colors.fg }}>
                    {item.body}
                  </AppText>
                ) : null}
                <AppText
                  style={{
                    fontSize: 10,
                    opacity: 0.7,
                    alignSelf: 'flex-end',
                    color: mine ? palette.parchment[50] : colors.fgMuted,
                  }}
                >
                  {time(item.createdAt)}
                </AppText>
              </Pressable>
            );
          }}
        />
        {suggestions.length ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[2],
              paddingHorizontal: spacing[3],
            }}
          >
            {suggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => completeMention(name)}
                accessibilityRole="button"
                accessibilityLabel={`Mencionar ${name}`}
                style={{
                  paddingHorizontal: spacing[2],
                  paddingVertical: 4,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.fgAccent,
                }}
              >
                <AppText>
                  @{name}
                  {name === 'Tomo' ? ' · assistente' : ''}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {tomoThinking ? (
          <AppText variant="small" style={{ paddingHorizontal: spacing[3] }}>
            O Tomo está consultando o grimório…
          </AppText>
        ) : null}
        {image ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingHorizontal: spacing[3],
            }}
          >
            <Image source={{ uri: image.uri }} style={{ width: 48, height: 48, borderRadius: 6 }} />
            <Pressable
              onPress={() => setImage(null)}
              accessibilityRole="button"
              accessibilityLabel="Tirar a imagem"
            >
              <X size={18} color={colors.fgMuted} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing[2] }]}>
          <Pressable
            onPress={() => void attach()}
            accessibilityRole="button"
            accessibilityLabel="Anexar imagem"
            style={styles.attach}
            disabled={!selected}
          >
            <ImagePlus size={18} color={colors.fgMuted} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            editable={Boolean(selected)}
            placeholder={selected ? `Mensagem… (@tomo chama o Tomo)` : 'Escolha um grupo'}
            placeholderTextColor={colors.fgMuted}
            accessibilityLabel="Mensagem"
            style={styles.input}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => void send()}
            disabled={busy || (!draft.trim() && !image)}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            style={styles.send}
          >
            <Send size={18} color={palette.parchment[50]} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    elevation: 8,
    zIndex: 1000,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.raised,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: fonts.sansSemiBold },
  tomo: {
    alignSelf: 'flex-start',
    backgroundColor: palette.wine[950],
    borderWidth: 1,
    borderColor: palette.wine[400],
  },
  attach: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: 2,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: palette.wine[800] },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.raised },
  composer: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    color: colors.fg,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.wine[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
