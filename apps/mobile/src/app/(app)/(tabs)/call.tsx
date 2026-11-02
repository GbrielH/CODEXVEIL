import {
  findCallRoom,
  listMyCallInvites,
  listMyCallRooms,
} from '@codexveil/database';
import { useRouter, type Href } from 'expo-router';
import { DoorOpen, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** Aba Call (só jogador): entrar por código ou link, convites e salas abertas. A sala é criada pelo mestre no site. */
export default function CallTab() {
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, refreshing, reload } = useAsyncData(async () => {
    const client = getSupabase();
    const [rooms, invites] = await Promise.all([
      listMyCallRooms(client).catch(() => []),
      listMyCallInvites(client, userId).catch(() => []),
    ]);
    return {
      rooms: rooms.filter((room) => room.status === 'active'),
      invites,
    };
  }, `call:${userId}`);

  // Rota nova: os tipos do expo-router só se atualizam ao rodar o app; o caminho é este.
  const open = (slug: string) => router.push(`/call/${slug}` as Href);

  const join = async () => {
    const ref = code.trim().split('/').filter(Boolean).at(-1) ?? '';
    if (!ref) return;
    setBusy(true);
    try {
      const room = await findCallRoom(getSupabase(), ref);
      if (room) open(room.slug);
      else toast({ tone: 'warning', title: 'Nenhuma sala com esse código.' });
    } catch (error) {
      toast({ tone: 'danger', title: 'Não deu certo', description: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Call"
      subtitle="Voz e vídeo com a mesa."
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Card ornate>
        <AppText variant="heading">Entrar numa sala</AppText>
        <Field
          label="Código ou link"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="RUNA-4821"
          maxLength={200}
        />
        <Button
          label="Entrar"
          variant="secondary"
          icon={<DoorOpen size={16} color={colors.fg} />}
          disabled={!code.trim()}
          loading={busy}
          onPress={() => void join()}
        />
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          A sala é criada pelo mestre no site. Aqui você entra por convite, código ou link.
        </AppText>
      </Card>
      {data?.invites.length ? (
        <>
          <SectionHeader
            icon={<Video size={14} color={colors.fgAccent} />}
            title="Convites para você"
          />
          {data.invites.map((invite) => (
            <ListRow
              key={invite.roomId}
              title={invite.title || 'Call'}
              meta={invite.code}
              onPress={() => open(invite.slug)}
            />
          ))}
        </>
      ) : null}
      {data?.rooms.length ? (
        <>
          <SectionHeader icon={<Video size={14} color={colors.fgAccent} />} title="Salas abertas" />
          {data.rooms.map((room) => (
            <ListRow
              key={room.id}
              title={room.title || 'Call'}
              meta={room.code}
              onPress={() => open(room.slug)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
