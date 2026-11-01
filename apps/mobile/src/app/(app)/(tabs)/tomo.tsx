import { Send, Sparkles, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, TextInput, View, type ImageSourcePropType } from 'react-native';
import { IconButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

const TOMO_HERO = require('../../../../assets/images/tomo-heroi.webp') as ImageSourcePropType;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** Blocos de ação do Tomo (as confirmações de criar/alterar ficam no site). */
const ACTION_BLOCK = /```tomo-acao[\s\S]*?(```|$)/g;

const SUGGESTIONS = [
  'Como funciona um teste no meu sistema?',
  'Me dê 3 ganchos para a próxima sessão.',
  'Sugira um nome e uma aparência para um NPC taverneiro.',
];

/**
 * Tomo, o assistente do Codexveil, no app: conversa pelo mesmo serviço do site (com o login do
 * app). As ações que ele propõe (criar NPC, encontro, roteiro…) são confirmadas no site.
 */
export default function TomoScreen() {
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
          pathname: '/painel',
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = await response.text();
      const hadActions = /```tomo-acao/.test(body);
      const answer = response.ok
        ? `${body.replace(ACTION_BLOCK, '').trim()}${
            hadActions
              ? '\n\n(Para criar ou alterar algo com o Tomo, peça pelo site: lá você confirma no cartão.)'
              : ''
          }`
        : body || 'O Tomo não conseguiu responder agora.';
      setMessages((current) => [
        ...current,
        { id: `a-${(counter.current += 1)}`, role: 'assistant', content: answer },
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

  return (
    <Screen scroll={false} edges={[]}>
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
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.mine : styles.theirs,
            ]}
          >
            {item.role === 'assistant' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color={colors.fgAccent} />
                <AppText variant="eyebrow">Tomo</AppText>
              </View>
            ) : null}
            <AppText selectable style={{ color: colors.fg }}>
              {item.content}
            </AppText>
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
