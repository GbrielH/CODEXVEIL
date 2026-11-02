import { listMyCampaigns } from '@codexveil/database';
import { describeTomoAction, extractTomoActions, type TomoAction } from '@codexveil/validation';
import { Send, Sparkles, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

const TOMO_HERO = require('../../../../assets/images/tomo-heroi.webp') as ImageSourcePropType;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Propostas do Tomo (criar anotação, item, NPC…): só gravam quando a pessoa confirma. */
  actions?: { action: TomoAction; state: 'pending' | 'done' | 'cancelled'; result?: string }[];
}

const SUGGESTIONS = [
  'Como funciona um teste no meu sistema?',
  'Me dê 3 ganchos para a próxima sessão.',
  'Sugira um nome e uma aparência para um NPC taverneiro.',
];

/**
 * Tomo, o assistente do Codexveil, no app: conversa pelo mesmo serviço do site (com o login do
 * app). Escolhendo a campanha, ele conhece a mesa e o seu personagem nela; as ações que propõe
 * aparecem num cartão e só são gravadas ao tocar em Confirmar (`/api/assistente/acao`).
 */
export default function TomoScreen() {
  const toast = useToast();
  const userId = useUserId();
  const campaigns = useAsyncData(
    async () =>
      (await listMyCampaigns(getSupabase(), userId)).filter(
        (campaign) => campaign.status === 'active',
      ),
    `tomo:${userId}`,
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const campaign = campaigns.data?.find((entry) => entry.id === campaignId) ?? null;
  // O Tomo entende a "página": na campanha, o jogador está no próprio personagem; o mestre, na mesa.
  const pathname = campaign
    ? campaign.role === 'gm'
      ? `/campanhas/${campaign.id}`
      : `/campanhas/${campaign.id}/personagem`
    : '/painel';
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const counter = useRef(0);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    const history: Message[] = [
      ...messages,
      { id: `u-${(counter.current += 1)}`, role: 'user', content: question },
    ];
    setMessages(history);
    setDraft('');
    setThinking(true);
    try {
      const token = (await getSupabase().auth.getSession()).data.session?.access_token;
      const response = await fetch(`${siteUrl}/api/assistente`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pathname,
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = await response.text();
      const extracted = response.ok
        ? extractTomoActions(body)
        : { text: body || 'O Tomo não conseguiu responder agora.', actions: [] };
      setMessages((current) => [
        ...current,
        {
          id: `a-${(counter.current += 1)}`,
          role: 'assistant',
          content: extracted.text.trim(),
          actions: extracted.actions.map((action) => ({ action, state: 'pending' as const })),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `a-${(counter.current += 1)}`,
          role: 'assistant',
          content: 'Não consegui falar com o Tomo agora. Confira a conexão e tente de novo.',
        },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const setActionState = (
    messageId: string,
    index: number,
    state: 'done' | 'cancelled',
    result?: string,
  ) =>
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              actions: message.actions?.map((entry, position) =>
                position === index ? { ...entry, state, ...(result ? { result } : {}) } : entry,
              ),
            }
          : message,
      ),
    );

  const confirm = async (messageId: string, index: number, action: TomoAction) => {
    try {
      const token = (await getSupabase().auth.getSession()).data.session?.access_token;
      const response = await fetch(`${siteUrl}/api/assistente/acao`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ scope: { campaignId: campaign?.id ?? null }, action }),
      });
      const result = (await response.json()) as { ok: boolean; message: string };
      if (!result.ok) {
        toast({ tone: 'danger', title: 'Não foi feito', description: result.message });
        return;
      }
      setActionState(messageId, index, 'done', result.message);
      toast({ tone: 'success', title: result.message });
    } catch {
      toast({ tone: 'danger', title: 'Sem conexão com o site', description: 'Tente de novo.' });
    }
  };

  return (
    <Screen scroll={false} edges={[]}>
      {campaigns.data?.length ? (
        <View style={styles.campaigns}>
          <Chip label="Sem campanha" selected={!campaign} onPress={() => setCampaignId(null)} />
          {campaigns.data.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.name}
              selected={campaign?.id === entry.id}
              onPress={() => setCampaignId(entry.id)}
            />
          ))}
        </View>
      ) : null}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[3] }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Image
              source={TOMO_HERO}
              style={{ width: 96, height: 90 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <AppText variant="title">Tomo</AppText>
            <AppText variant="muted" style={{ textAlign: 'center' }}>
              O grimório do Codexveil: regras, ideias, nomes, cenas e dúvidas da sua mesa.
            </AppText>
            {messages.length === 0
              ? SUGGESTIONS.map((suggestion) => (
                  <AppText
                    key={suggestion}
                    onPress={() => void ask(suggestion)}
                    style={styles.suggestion}
                    accessibilityRole="button"
                  >
                    {suggestion}
                  </AppText>
                ))
              : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.mine : styles.theirs]}>
            {item.role === 'assistant' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color={colors.fgAccent} />
                <AppText variant="eyebrow">Tomo</AppText>
              </View>
            ) : null}
            <AppText selectable style={{ color: colors.fg }}>
              {item.content}
            </AppText>
            {item.actions?.map((entry, index) => {
              const summary = describeTomoAction(entry.action);
              return (
                <View key={index} style={styles.action}>
                  <AppText style={{ color: colors.fg, fontFamily: fonts.sansSemiBold }}>
                    {summary.title}
                  </AppText>
                  {summary.detail ? <AppText variant="small">{summary.detail}</AppText> : null}
                  {entry.state === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                      <Button
                        label="Confirmar"
                        compact
                        onPress={() => void confirm(item.id, index, entry.action)}
                      />
                      <Button
                        label="Cancelar"
                        variant="ghost"
                        compact
                        onPress={() => setActionState(item.id, index, 'cancelled')}
                      />
                    </View>
                  ) : (
                    <AppText variant="small">
                      {entry.state === 'done' ? `Feito. ${entry.result ?? ''}` : 'Cancelado.'}
                    </AppText>
                  )}
                </View>
              );
            })}
          </View>
        )}
        ListFooterComponent={
          thinking ? (
            <AppText variant="muted" style={{ fontStyle: 'italic' }}>
              O Tomo está folheando o grimório…
            </AppText>
          ) : null
        }
      />
      <View style={styles.composer}>
        {messages.length ? (
          <IconButton
            icon={<Trash2 size={18} color={colors.fgMuted} />}
            accessibilityLabel="Limpar a conversa"
            disabled={thinking}
            onPress={() => setMessages([])}
          />
        ) : null}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Pergunte ao Tomo…"
          placeholderTextColor={colors.fgMuted}
          multiline
          maxLength={2000}
          style={styles.input}
          accessibilityLabel="Pergunta para o Tomo"
        />
        <IconButton
          icon={<Send size={20} color={draft.trim() ? colors.fgAccent : colors.fgMuted} />}
          accessibilityLabel="Enviar"
          disabled={!draft.trim() || thinking}
          onPress={() => void ask(draft)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  suggestion: {
    alignSelf: 'stretch',
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.fgSecondary,
  },
  bubble: { gap: 4, padding: spacing[3], borderRadius: radii.lg, maxWidth: '92%' },
  mine: { alignSelf: 'flex-end', backgroundColor: 'rgba(107, 59, 198, 0.28)' },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  campaigns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingBottom: spacing[2] },
  action: {
    gap: 4,
    marginTop: spacing[2],
    padding: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.sunken,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.sunken,
    color: colors.fg,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
});
