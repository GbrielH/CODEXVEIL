import {
  deleteTavernMessage,
  listFriends,
  listMyCampaigns,
  listTavernMessages,
  sendTavernMessage,
  subscribeToChanges,
  type TavernChannel,
  type TavernMessage,
} from '@codexveil/database';
import { Beer, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/ui/controls';
import { AppText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

interface ChannelOption {
  id: string;
  label: string;
  channel: TavernChannel;
}

const time = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Taverna no app: botão flutuante (por cima de tudo) que abre o chat com os grupos — campanhas em
 * que a pessoa participa e amigos. Mensagens somem depois de 24 horas.
 */
export function TavernFloating({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    let first = true;
    return subscribeToChanges(getSupabase(), 'taverna-aviso', [{ table: 'tavern_messages' }], {
      onChange: () => {
        if (first) {
          first = false;
          return;
        }
        if (!openRef.current) setUnread(true);
      },
    });
  }, []);

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          setUnread(false);
        }}
        accessibilityRole="button"
        accessibilityLabel="Abrir a Taverna"
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
      >
        <Beer size={22} color={colors.fgAccent} />
        {unread ? <View style={styles.dot} /> : null}
      </Pressable>
      {open ? <TavernModal userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TavernModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [current, setCurrent] = useState('');
  const [messages, setMessages] = useState<TavernMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<TavernMessage>>(null);

  useEffect(() => {
    const client = getSupabase();
    Promise.all([listMyCampaigns(client, userId), listFriends(client, userId)])
      .then(([campaigns, friends]) => {
        const options: ChannelOption[] = [
          ...campaigns
            .filter((campaign) => campaign.status === 'active')
            .map((campaign): ChannelOption => ({ id: `c:${campaign.id}`, label: campaign.name, channel: { kind: 'campaign', campaignId: campaign.id } })),
          ...friends
            .filter((friend) => friend.status === 'accepted')
            .map((friend): ChannelOption => ({ id: `f:${friend.userId}`, label: friend.displayName, channel: { kind: 'direct', friendId: friend.userId } })),
        ];
        setChannels(options);
        setCurrent((existing) => existing || options[0]?.id || '');
      })
      .catch(() => setChannels([]));
  }, [userId]);

  const selected = channels?.find((option) => option.id === current) ?? null;
  const load = useCallback(async () => {
    if (!selected) return;
    try {
      setMessages(await listTavernMessages(getSupabase(), userId, selected.channel));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    }
  }, [selected, userId, toast]);

  useEffect(() => {
    if (!selected) return;
    const filter = selected.channel.kind === 'campaign' ? `campaign_id=eq.${selected.channel.campaignId}` : undefined;
    return subscribeToChanges(getSupabase(), `taverna-${selected.id}`, [{ table: 'tavern_messages', ...(filter ? { filter } : {}) }], {
      onChange: () => void load(),
    });
  }, [selected, load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !selected || busy) return;
    setBusy(true);
    try {
      await sendTavernMessage(getSupabase(), selected.channel, body);
      setDraft('');
      await load();
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Beer size={18} color={colors.fgAccent} />
          <AppText style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.fg }}>Taverna</AppText>
          <AppText variant="small">somem em 24 h</AppText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar a Taverna" hitSlop={12}>
            <X size={22} color={colors.fgMuted} />
          </Pressable>
        </View>
        <FlatList
          horizontal
          data={channels ?? []}
          keyExtractor={(option) => option.id}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
          renderItem={({ item }) => <Chip label={item.label} selected={item.id === current} role="radio" onPress={() => setCurrent(item.id)} />}
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
            const mine = item.senderId === userId;
            return (
              <Pressable
                onLongPress={mine ? () => void deleteTavernMessage(getSupabase(), item.id).then(load) : undefined}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                accessibilityHint={mine ? 'Segure para apagar' : undefined}
              >
                {!mine ? <AppText style={{ color: colors.fgAccent, fontSize: 12 }}>{item.senderName}</AppText> : null}
                <AppText style={{ color: mine ? palette.parchment[50] : colors.fg }}>{item.body}</AppText>
                <AppText style={{ fontSize: 10, opacity: 0.7, alignSelf: 'flex-end', color: mine ? palette.parchment[50] : colors.fgMuted }}>{time(item.createdAt)}</AppText>
              </Pressable>
            );
          }}
        />
        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing[2] }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            editable={Boolean(selected)}
            placeholder={selected ? `Mensagem para ${selected.label}…` : 'Escolha um grupo'}
            placeholderTextColor={colors.fgMuted}
            accessibilityLabel="Mensagem"
            style={styles.input}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <Pressable onPress={() => void send()} disabled={busy || !draft.trim()} accessibilityRole="button" accessibilityLabel="Enviar" style={styles.send}>
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
  dot: { position: 'absolute', top: 6, right: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.ember[400] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.line },
  bubble: { maxWidth: '80%', borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: palette.wine[800] },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.raised },
  composer: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: 10, color: colors.fg },
  send: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.wine[600], alignItems: 'center', justifyContent: 'center' },
});
