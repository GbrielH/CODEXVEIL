import {
  acceptFriend,
  getMyFriendCode,
  listFriends,
  removeFriend,
  requestFriend,
  type Friend,
} from '@codexveil/database';
import { Check, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Button, IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const statusLabels: Record<Friend['status'], string | null> = {
  accepted: null,
  incoming: 'Pediu amizade',
  outgoing: 'Pedido enviado',
};

/** Amigos no Perfil: o seu código, pedidos recebidos e a lista de amigos. */
export function FriendsCard() {
  const userId = useUserId();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { data, reload } = useAsyncData(
    async () => {
      const client = getSupabase();
      const [myCode, friends] = await Promise.all([
        getMyFriendCode(client, userId),
        listFriends(client, userId),
      ]);
      return { myCode, friends };
    },
    `amigos:${userId}`,
  );

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast({ tone: 'success', title: success });
      reload();
    } catch (error) {
      toast({ tone: 'danger', title: 'Não deu certo', description: failureMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const friends = data?.friends ?? [];
  // Pedidos recebidos primeiro: são os que pedem uma ação.
  const ordered = [...friends].sort(
    (a, b) => Number(b.status === 'incoming') - Number(a.status === 'incoming'),
  );

  return (
    <Card>
      <AppText variant="heading">Amigos</AppText>
      {data ? (
        <AppText variant="muted">
          Seu código de amigo: <AppText style={{ color: colors.fgAccent }}>{data.myCode}</AppText>
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Adicionar pelo código"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            maxLength={16}
          />
        </View>
        <Button
          label="Pedir"
          compact
          icon={<UserPlus size={16} color={colors.primaryFg} />}
          disabled={!code.trim()}
          loading={busy === 'pedir'}
          onPress={() =>
            void run(
              'pedir',
              async () => {
                await requestFriend(getSupabase(), { code: code.trim() });
                setCode('');
              },
              'Pedido de amizade enviado.',
            )
          }
        />
      </View>
      {ordered.length === 0 ? (
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          Ninguém por aqui ainda. Passe o seu código para os amigos de mesa.
        </AppText>
      ) : (
        ordered.map((friend) => (
          <View
            key={friend.friendshipId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Avatar name={friend.displayName} icon={friend.avatarIcon} size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText numberOfLines={1}>{friend.displayName}</AppText>
              {statusLabels[friend.status] ? (
                <Badge
                  label={statusLabels[friend.status]!}
                  tone={friend.status === 'incoming' ? 'brand' : 'neutral'}
                />
              ) : null}
            </View>
            {friend.status === 'incoming' ? (
              <IconButton
                icon={<Check size={18} color={colors.fgAccent} />}
                accessibilityLabel={`Aceitar ${friend.displayName}`}
                disabled={busy !== null}
                onPress={() =>
                  void run(
                    friend.friendshipId,
                    () => acceptFriend(getSupabase(), friend.friendshipId),
                    'Amizade aceita.',
                  )
                }
              />
            ) : null}
            <IconButton
              icon={<X size={18} color={colors.fgMuted} />}
              accessibilityLabel={
                friend.status === 'accepted'
                  ? `Desfazer amizade com ${friend.displayName}`
                  : `Recusar ou cancelar pedido de ${friend.displayName}`
              }
              disabled={busy !== null}
              onPress={() =>
                void run(
                  friend.friendshipId,
                  () => removeFriend(getSupabase(), friend.friendshipId),
                  friend.status === 'accepted' ? 'Amizade desfeita.' : 'Pedido removido.',
                )
              }
            />
          </View>
        ))
      )}
    </Card>
  );
}
