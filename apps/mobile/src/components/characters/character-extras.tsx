import {
  getCharacterAnswers,
  listCharacterShares,
  listFriends,
  listMyDice,
  saveCharacterAnswers,
  setCharacterDice,
  shareCharacter,
  unshareCharacter,
  type CreationAnswer,
  type SavedDice,
} from '@codexveil/database';
import {
  characterImagePrompt,
  characterTokenPrompt,
  diceSkinPrompt,
  type CharacterImageInput,
} from '@codexveil/domain';
import * as Clipboard from 'expo-clipboard';
import { Copy, Dices, MessageCircleQuestion, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

/** Bloco com um texto para copiar (prompts de IA). */
function PromptCard({ title, hint, prompt }: { title: string; hint: string; prompt: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <AppText variant="heading">{title}</AppText>
        <AppText variant="small">{hint}</AppText>
      </Pressable>
      {open ? (
        <>
          <AppText
            variant="small"
            selectable
            style={{
              padding: spacing[3],
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.line,
              color: colors.fgSecondary,
            }}
          >
            {prompt}
          </AppText>
          <Button
            label="Copiar"
            compact
            variant="secondary"
            icon={<Copy size={16} color={colors.fg} />}
            onPress={() =>
              void Clipboard.setStringAsync(prompt).then(() =>
                toast({ tone: 'success', title: 'Prompt copiado.' }),
              )
            }
          />
        </>
      ) : null}
    </Card>
  );
}

/** Respostas às perguntas do mestre: o dono corrige depois de criado o personagem. */
function AnswersCard({
  characterId,
  campaignId,
  isOwner,
}: {
  characterId: string;
  campaignId: string;
  isOwner: boolean;
}) {
  const toast = useToast();
  const { data, reload } = useAsyncData(
    () => getCharacterAnswers(getSupabase(), characterId).catch(() => null),
    `respostas:${characterId}`,
  );
  const [editing, setEditing] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data?.length) return null;
  const save = async () => {
    if (!editing) return;
    if (editing.some((answer) => !answer.trim()))
      return toast({ tone: 'warning', title: 'Responda todas as perguntas.' });
    setBusy(true);
    try {
      const answers: CreationAnswer[] = data.map((entry, index) => ({
        question: entry.question,
        answer: editing[index]!.trim(),
      }));
      await saveCharacterAnswers(getSupabase(), characterId, campaignId, answers);
      toast({ tone: 'success', title: 'Respostas atualizadas.' });
      setEditing(null);
      reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'Não deu certo', description: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MessageCircleQuestion size={18} color={colors.fgAccent} />
        <AppText variant="heading" style={{ flex: 1 }}>
          Perguntas do mestre
        </AppText>
      </View>
      <AppText variant="small">Visível só para o jogador e para o mestre.</AppText>
      {editing
        ? data.map((entry, index) => (
            <Field
              key={index}
              label={entry.question}
              value={editing[index] ?? ''}
              multiline
              maxLength={2000}
              onChangeText={(text) =>
                setEditing((current) => current!.map((value, i) => (i === index ? text : value)))
              }
            />
          ))
        : data.map((entry, index) => (
            <View key={index} style={{ gap: 2 }}>
              <AppText style={{ color: colors.fg }}>{entry.question}</AppText>
              <AppText variant="muted">{entry.answer}</AppText>
            </View>
          ))}
      {isOwner ? (
        editing ? (
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Button label="Salvar" compact loading={busy} onPress={() => void save()} />
            <Button label="Cancelar" compact variant="ghost" onPress={() => setEditing(null)} />
          </View>
        ) : (
          <Button
            label="Editar respostas"
            compact
            variant="secondary"
            onPress={() => setEditing(data.map((entry) => entry.answer))}
          />
        )
      ) : null}
    </Card>
  );
}

/** Compartilhar a ficha com amigos (eles leem a ficha, sem editar). */
function ShareCard({ characterId }: { characterId: string }) {
  const userId = useUserId();
  const toast = useToast();
  const { data, reload } = useAsyncData(async () => {
    const client = getSupabase();
    const [friends, shared] = await Promise.all([
      listFriends(client, userId),
      listCharacterShares(client, characterId),
    ]);
    return { friends: friends.filter((friend) => friend.status === 'accepted'), shared };
  }, `compartilhar:${characterId}`);
  if (!data) return null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Share2 size={18} color={colors.fgAccent} />
        <AppText variant="heading">Compartilhar com amigos</AppText>
      </View>
      {data.friends.length === 0 ? (
        <AppText variant="small">Adicione amigos no Perfil para compartilhar a ficha.</AppText>
      ) : (
        data.friends.map((friend) => (
          <CheckRow
            key={friend.userId}
            label={friend.displayName}
            checked={data.shared.includes(friend.userId)}
            onChange={async (next) => {
              try {
                if (next) await shareCharacter(getSupabase(), characterId, friend.userId);
                else await unshareCharacter(getSupabase(), characterId, friend.userId);
                reload();
              } catch (error) {
                toast({
                  tone: 'danger',
                  title: 'Não deu certo',
                  description: failureMessage(error),
                });
              }
            }}
          />
        ))
      )}
    </Card>
  );
}

/** Dado do personagem: um dos dados salvos em "Meus dados" (no site) e o prompt da skin. */
function DiceCard({ characterId, summary }: { characterId: string; summary: string }) {
  const userId = useUserId();
  const toast = useToast();
  const [description, setDescription] = useState('');
  const { data, mutate } = useAsyncData(async () => {
    const client = getSupabase();
    const [dice, character] = await Promise.all([
      listMyDice(client, userId),
      client.from('characters').select('dice_id').eq('id', characterId).maybeSingle(),
    ]);
    return { dice, current: character.data?.dice_id ?? null };
  }, `dado:${characterId}`);
  const choose = async (id: string | null) => {
    try {
      await setCharacterDice(getSupabase(), characterId, id);
      mutate((current) => ({ ...current, current: id }));
      toast({
        tone: 'success',
        title: id ? 'Dado vinculado ao personagem.' : 'Usa o seu dado padrão.',
      });
    } catch (error) {
      toast({ tone: 'danger', title: 'Não deu certo', description: failureMessage(error) });
    }
  };
  const option = (id: string | null, label: string) => (
    <CheckRow
      key={id ?? 'padrao'}
      label={label}
      checked={data?.current === id}
      onChange={() => void choose(id)}
    />
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Dices size={18} color={colors.fgAccent} />
        <AppText variant="heading">Dado do personagem</AppText>
      </View>
      <AppText variant="small">
        As rolagens deste personagem aparecem com o dado escolhido para toda a mesa. Os dados são
        criados em “Meus dados”, no site.
      </AppText>
      {data
        ? [
            option(null, 'Meu dado padrão'),
            ...data.dice.map((entry: SavedDice) => option(entry.id, entry.name)),
          ]
        : null}
      <Field
        label="Descrição da skin (obrigatória para o prompt)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={600}
        placeholder="Ex.: obsidiana com veios de lava"
      />
      <Button
        label="Copiar prompt da skin"
        compact
        variant="secondary"
        disabled={!description.trim()}
        icon={<Copy size={16} color={colors.fg} />}
        onPress={() =>
          void Clipboard.setStringAsync(diceSkinPrompt(description, summary)).then(() =>
            toast({ tone: 'success', title: 'Prompt copiado.' }),
          )
        }
      />
    </Card>
  );
}

/**
 * Parte comum da aba Personagem das fichas do app (D&D, T20 e Assimilação): respostas ao mestre,
 * prompts de retrato e token, compartilhar com amigos e o dado do personagem.
 */
export function CharacterExtras({
  characterId,
  campaignId,
  isOwner,
  imageInput,
}: {
  characterId: string;
  campaignId: string | null;
  isOwner: boolean;
  imageInput: CharacterImageInput;
}) {
  const summary = [imageInput.name, imageInput.species, imageInput.className, imageInput.appearance]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ gap: spacing[3] }}>
      {campaignId ? (
        <AnswersCard characterId={characterId} campaignId={campaignId} isOwner={isOwner} />
      ) : null}
      {isOwner ? (
        <>
          <PromptCard
            title="Prompt para o retrato"
            hint="Toque para ver e copiar. Cole numa IA de imagens e envie o resultado como retrato."
            prompt={characterImagePrompt(imageInput)}
          />
          <PromptCard
            title="Prompt para o token"
            hint="Anexe o retrato na IA de imagens e cole este prompt."
            prompt={characterTokenPrompt(imageInput)}
          />
          <DiceCard characterId={characterId} summary={summary} />
          <ShareCard characterId={characterId} />
        </>
      ) : null}
    </View>
  );
}
