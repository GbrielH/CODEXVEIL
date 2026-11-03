import {
  endCallPresence,
  findCallRoom,
  heartbeatCallPresence,
  leaveCallRoom,
  listCallParticipants,
  startCallPresence,
} from '@codexveil/database';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { CallStage } from '@/components/call/call-stage';
import { CallTranscript } from '@/components/call/call-transcript';
import { Button } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { callsEnabled } from '@/lib/livekit';
import { getSupabase, siteUrl } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Entry =
  | { state: 'loading' }
  | { state: 'waiting' }
  | { state: 'ready'; token: string; url: string }
  | { state: 'error'; message: string };

/** Sala de call no app (também pelo link `codexveil://call/<slug>`). */
export default function CallRoomScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const toast = useToast();
  const [entry, setEntry] = useState<Entry>({ state: 'loading' });
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [usageNearLimit, setUsageNearLimit] = useState(false);
  const room = useAsyncData(() => findCallRoom(getSupabase(), slug), `sala:${slug}`);
  const roomId = room.data?.id ?? null;
  const participants = useAsyncData(
    () => (roomId ? listCallParticipants(getSupabase(), roomId) : Promise.resolve([])),
    `participantes:${roomId ?? ''}`,
  );

  const requestToken = useCallback(async () => {
    if (!roomId) return;
    try {
      const token = (await getSupabase().auth.getSession()).data.session?.access_token;
      const response = await fetch(`${siteUrl}/api/call/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ roomId }),
      });
      const body = (await response.json()) as {
        status?: string;
        token?: string;
        url?: string;
        error?: string;
      };
      if (body.token && body.url) setEntry({ state: 'ready', token: body.token, url: body.url });
      else if (body.status === 'waiting') setEntry({ state: 'waiting' });
      else if (body.status === 'denied')
        setEntry({ state: 'error', message: 'Quem criou a sala recusou a sua entrada.' });
      else setEntry({ state: 'error', message: body.error ?? 'Não foi possível entrar na call.' });
    } catch {
      setEntry({ state: 'error', message: 'Sem conexão com o servidor. Tente de novo.' });
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const timer = setTimeout(() => void requestToken(), 0);
    return () => clearTimeout(timer);
  }, [roomId, requestToken]);

  useRealtimeRefresh(
    `call-app:${roomId ?? ''}`,
    roomId ? [{ table: 'call_participants', filter: `room_id=eq.${roomId}` }] : [],
    () => {
      participants.reload();
      if (entry.state === 'waiting') void requestToken();
    },
  );

  useEffect(() => {
    if (!roomId || !connectedAt) return;
    let active = true;
    let presenceId: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    void startCallPresence(getSupabase(), roomId)
      .then((id) => {
        if (!active) {
          void endCallPresence(getSupabase(), id).catch(() => undefined);
          return;
        }
        presenceId = id;
        timer = setInterval(
          () => void heartbeatCallPresence(getSupabase(), id).catch(() => undefined),
          60_000,
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (presenceId) void endCallPresence(getSupabase(), presenceId).catch(() => undefined);
    };
  }, [connectedAt, roomId]);

  useEffect(() => {
    if (!connectedAt) return;
    const load = async () => {
      const token = (await getSupabase().auth.getSession()).data.session?.access_token;
      if (!token) return;
      const response = await fetch(`${siteUrl}/api/call/usage?roomId=${roomId ?? ''}`, {
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!response?.ok) return;
      const body = (await response.json()) as { nearLimit?: boolean };
      if (active) setUsageNearLimit(Boolean(body.nearLimit));
    };
    let active = true;
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connectedAt, roomId]);

  const leave = async () => {
    if (roomId) await leaveCallRoom(getSupabase(), roomId).catch(() => undefined);
    router.back();
  };

  if (!callsEnabled) return <ErrorState message="A call ainda não está liberada." />;
  if (room.loading) return <LoadingState label="Abrindo a sala…" />;
  if (!room.data) return <ErrorState message="Sala não encontrada." />;
  if (Platform.OS === 'web')
    return <ErrorState message="A call do app só funciona no celular. No navegador, use o site." />;

  if (entry.state === 'ready')
    return (
      <>
        <Stack.Screen options={{ title: room.data.title || 'Call' }} />
        <CallStage
          token={entry.token}
          url={entry.url}
          participants={participants.data ?? []}
          connectedAt={connectedAt}
          usageNearLimit={usageNearLimit}
          onConnected={() => setConnectedAt(new Date())}
          onLeave={() => void leave()}
          onError={(message) =>
            toast({ tone: 'danger', title: 'Problema na call', description: message })
          }
        />
        <CallTranscript roomId={room.data.id} />
      </>
    );

  return (
    <Screen title={room.data.title || 'Call'} subtitle={`Código ${room.data.code}`}>
      <Stack.Screen options={{ title: 'Call' }} />
      <Card>
        <AppText>
          {entry.state === 'loading'
            ? 'Entrando…'
            : entry.state === 'waiting'
              ? 'Aguardando quem criou a sala aprovar a sua entrada. A tela entra sozinha.'
              : entry.message}
        </AppText>
        {entry.state === 'error' ? (
          <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
        ) : null}
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          {room.data.campaignName ? `${room.data.campaignName} · ` : ''}Criada por{' '}
          {room.data.ownerName}
        </AppText>
      </Card>
    </Screen>
  );
}
