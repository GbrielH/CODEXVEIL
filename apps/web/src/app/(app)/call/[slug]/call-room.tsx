'use client';

import '@livekit/components-styles';
import { RnnoiseProcessor, supportsRnnoise } from '@/lib/rnnoise-processor';
import {
  decideCallParticipant,
  endCallPresence,
  endCallRoom,
  heartbeatCallPresence,
  inviteToCall,
  leaveCallRoom,
  listCallParticipants,
  startCallPresence,
  type CallParticipant,
  type CallRoomSummary,
} from '@codexveil/database';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { formatCallDuration } from '@codexveil/domain';
import { LocalAudioTrack, Track } from 'livekit-client';
import {
  Check,
  Copy,
  Crown,
  Hourglass,
  PhoneOff,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { SpeakerBar } from '@/components/call/speaker-bar';
import { CallUsageMeter, useCallUsage } from '@/components/call/call-usage';
import { TranscriptPanel } from '@/components/call/transcript-panel';
import { useConfirm } from '@/components/ui/use-confirm';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

type Entry =
  | { state: 'loading' }
  | { state: 'waiting' }
  | { state: 'ready'; token: string; url: string }
  | { state: 'error'; message: string };

/**
 * Redução de ruído do microfone (preferência local, não afeta os outros). Ligada por padrão com o
 * RNNoise, que remove teclado, ventilador e barulho de fundo. Sem suporte no navegador, usa o
 * filtro embutido do WebRTC, reabrindo o microfone (`restartTrack`): o `applyConstraints` usado
 * antes não religava a supressão num microfone já aberto, e o botão não fazia efeito.
 */
function NoiseReductionControl({ onError }: { onError: (message: string) => void }) {
  const { microphoneTrack } = useLocalParticipant();
  const [enabled, setEnabled] = useState(true);
  const [changing, setChanging] = useState(false);
  const track = microphoneTrack?.audioTrack;
  const ready = track instanceof LocalAudioTrack;
  const appliedTo = useRef<LocalAudioTrack | null>(null);

  const apply = useCallback(
    async (target: LocalAudioTrack, next: boolean) => {
      if (next && supportsRnnoise()) {
        try {
          await target.setProcessor(new RnnoiseProcessor());
          return;
        } catch {
          // Sem o RNNoise (navegador antigo ou bloqueio de áudio): cai para o filtro embutido.
          await target.stopProcessor().catch(() => undefined);
        }
      } else if (!next) {
        await target.stopProcessor().catch(() => undefined);
      }
      await target.restartTrack({ echoCancellation: true, noiseSuppression: next, autoGainControl: true });
    },
    [],
  );

  // Liga a redução forte assim que o microfone é publicado (e de novo se ele for trocado).
  useEffect(() => {
    if (!ready || appliedTo.current === track) return;
    appliedTo.current = track;
    if (!enabled) return;
    void apply(track, true).catch(() => onError('Não foi possível ligar a redução de ruído neste navegador.'));
  }, [apply, enabled, onError, ready, track]);

  if (!ready) return null;

  const toggle = async () => {
    const next = !enabled;
    setChanging(true);
    try {
      await apply(track, next);
      setEnabled(next);
    } catch {
      onError('O navegador não conseguiu alterar a redução de ruído deste microfone.');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="absolute top-3 right-3 z-20">
      <Button
        size="sm"
        variant={enabled ? 'secondary' : 'ghost'}
        icon={enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        disabled={changing}
        onClick={() => void toggle()}
      >
        Reduzir ruído: {enabled ? 'ligado' : 'desligado'}
      </Button>
    </div>
  );
}

function useCallPresence(roomId: string, connected: boolean): void {
  useEffect(() => {
    if (!connected) return;
    let active = true;
    let presenceId: string | null = null;
    let timer: number | null = null;
    void startCallPresence(getSupabaseBrowserClient(), roomId)
      .then((id) => {
        if (!active) {
          void endCallPresence(getSupabaseBrowserClient(), id).catch(() => undefined);
          return;
        }
        presenceId = id;
        timer = window.setInterval(
          () => void heartbeatCallPresence(getSupabaseBrowserClient(), id).catch(() => undefined),
          60_000,
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      if (presenceId) {
        void endCallPresence(getSupabaseBrowserClient(), presenceId).catch(() => undefined);
      }
    };
  }, [connected, roomId]);
}

function CallLiveStatus({ startedAt }: { startedAt: Date | null }) {
  const [now, setNow] = useState(() => new Date());
  const cameras = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: false,
  }).filter((track) => track.publication && !track.publication.isMuted).length;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="absolute top-3 left-3 z-20 max-w-[65%] rounded-md bg-black/75 px-3 py-2 text-xs text-white">
      <p className="font-medium">
        {startedAt ? formatCallDuration(startedAt, now) : 'Conectando…'}
      </p>
      <p>
        {cameras} {cameras === 1 ? 'pessoa está' : 'pessoas estão'} com a câmera ligada
      </p>
      <p className="text-white/70">Vídeo gasta mais; desligue a câmera para economizar.</p>
    </div>
  );
}

/**
 * Sala de call: pede o token ao servidor (que confere as regras da sala), mostra a espera de
 * aprovação e abre a chamada do LiveKit, com a lista de quem está na mesa e o personagem de cada um.
 */
export function CallRoomView({
  room,
  isOwner,
  transcriptionEnabled,
  userId,
  friends,
}: {
  room: CallRoomSummary;
  isOwner: boolean;
  transcriptionEnabled: boolean;
  userId: string;
  friends: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [entry, setEntry] = useState<Entry>(
    room.status === 'ended'
      ? { state: 'error', message: 'Esta call já foi encerrada.' }
      : { state: 'loading' },
  );
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  useCallPresence(room.id, connected);
  const usage = useCallUsage(room.id, entry.state === 'ready');

  const requestToken = useCallback(async () => {
    try {
      const response = await fetch('/api/call/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
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
  }, [room.id]);

  const reloadParticipants = useCallback(() => {
    listCallParticipants(getSupabaseBrowserClient(), room.id)
      .then(setParticipants)
      .catch(() => undefined);
  }, [room.id]);

  useEffect(() => {
    if (room.status === 'ended') return;
    // Fora do ciclo do efeito: o pedido de token atualiza o estado só quando responde.
    const timer = window.setTimeout(() => void requestToken(), 0);
    return () => window.clearTimeout(timer);
  }, [requestToken, room.status]);

  // Sala de espera e lista: atualizam sozinhas quando alguém entra, sai ou é aprovado.
  useRealtimeRefresh(
    `call:${room.id}`,
    [{ table: 'call_participants', filter: `room_id=eq.${room.id}` }],
    () => {
      reloadParticipants();
      if (entry.state === 'waiting') void requestToken();
    },
  );
  useEffect(() => {
    reloadParticipants();
  }, [reloadParticipants]);

  const leave = async () => {
    await leaveCallRoom(getSupabaseBrowserClient(), room.id).catch(() => undefined);
    router.push(routes.call);
  };

  const end = async () => {
    const ok = await confirm({
      title: 'Encerrar a call para todos?',
      description: 'Ninguém mais consegue entrar nesta sala.',
      confirmLabel: 'Encerrar',
    });
    if (!ok) return;
    try {
      await endCallRoom(getSupabaseBrowserClient(), room.id);
      router.push(routes.call);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'A call não foi encerrada.') });
    }
  };

  const link = typeof window !== 'undefined' ? window.location.href : '';
  const waiting = participants.filter((entry) => entry.status === 'waiting');
  const present = participants.filter((entry) => entry.status === 'approved' && !entry.leftAt);

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl text-fg">{room.title || 'Call'}</h1>
          <p className="text-sm text-fg-muted">
            {room.campaignName ? `${room.campaignName} · ` : ''}Criada por {room.ownerName}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Copy className="h-4 w-4" />}
          onClick={() =>
            void navigator.clipboard
              .writeText(`${link}\nCódigo: ${room.code}`)
              .then(() => toast({ tone: 'success', title: 'Link e código copiados.' }))
          }
        >
          <span className="font-mono">{room.code}</span>
        </Button>
        {isOwner ? (
          <Button
            size="sm"
            variant="danger"
            icon={<PhoneOff className="h-4 w-4" />}
            onClick={() => void end()}
          >
            Encerrar para todos
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative min-h-[60vh] overflow-hidden rounded-xl border border-line bg-black">
          {entry.state === 'ready' ? (
            <LiveKitRoom
              token={entry.token}
              serverUrl={entry.url}
              connect
              audio
              video={false}
              data-lk-theme="default"
              style={{ height: '70vh' }}
              onConnected={() => {
                setConnected(true);
                setConnectedAt(new Date());
              }}
              onDisconnected={() => {
                setConnected(false);
                setConnectedAt(null);
                void leave();
              }}
              onError={(error) =>
                toast({ tone: 'danger', title: 'Problema na call', description: error.message })
              }
              onMediaDeviceFailure={() =>
                toast({
                  tone: 'warning',
                  title: 'Microfone ou câmera bloqueados',
                  description: 'Libere o acesso no cadeado da barra de endereço e tente de novo.',
                })
              }
              options={{
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                publishDefaults: { simulcast: true, red: true, dtx: true },
              }}
            >
              <VideoConference />
              <RoomAudioRenderer />
              <NoiseReductionControl
                onError={(message) =>
                  toast({ tone: 'warning', title: 'Redução de ruído', description: message })
                }
              />
              <CallLiveStatus startedAt={connectedAt} />
            </LiveKitRoom>
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
              {entry.state === 'loading' ? (
                <p className="text-fg-muted">Abrindo a sala…</p>
              ) : entry.state === 'waiting' ? (
                <>
                  <Hourglass className="h-8 w-8 text-fg-accent" aria-hidden="true" />
                  <p className="text-fg">Aguardando quem criou a sala aprovar a sua entrada.</p>
                  <p className="text-sm text-fg-muted">A tela entra sozinha quando aprovarem.</p>
                </>
              ) : (
                <>
                  <Alert tone="danger">{entry.message}</Alert>
                  <Button variant="secondary" onClick={() => router.push(routes.call)}>
                    Voltar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <CallUsageMeter usage={usage} />
          {isOwner && waiting.length ? (
            <Card ornate>
              <CardHeader title="Sala de espera" description="Quem quer entrar." />
              <ul className="flex flex-col gap-2">
                {waiting.map((person) => (
                  <li key={person.userId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{person.displayName}</span>
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label={`Aprovar ${person.displayName}`}
                      onClick={() =>
                        void decideCallParticipant(
                          getSupabaseBrowserClient(),
                          room.id,
                          person.userId,
                          true,
                        )
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Recusar ${person.displayName}`}
                      onClick={() =>
                        void decideCallParticipant(
                          getSupabaseBrowserClient(),
                          room.id,
                          person.userId,
                          false,
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Na mesa" description="Quem está na call e com qual personagem." />
            {present.length === 0 ? (
              <p className="text-sm text-fg-muted">Ninguém ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {present.map((person) => (
                  <li key={person.userId} className="flex items-center gap-2 text-sm">
                    {person.role === 'master' ? (
                      <Crown className="h-4 w-4 text-amber-300" aria-label="Mestre" />
                    ) : (
                      <span className="h-4 w-4" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          'block truncate',
                          person.userId === userId && 'text-fg-accent',
                        )}
                      >
                        {person.role === 'master'
                          ? 'Mestre'
                          : (person.characterName ?? person.displayName)}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">
                        {person.displayName}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {entry.state === 'ready' &&
          participants.some((person) => person.userId === userId && person.role === 'master') ? (
            <SpeakerBar roomId={room.id} />
          ) : null}

          <TranscriptPanel
            roomId={room.id}
            initialEnabled={transcriptionEnabled}
            isOwner={isOwner}
            canEdit={
              isOwner ||
              participants.some((person) => person.userId === userId && person.role === 'master')
            }
            inCall={connected}
            header={{ campaign: room.campaignName, title: room.title || 'Call' }}
          />

          {friends.length ? (
            <Card>
              <CardHeader
                title="Convidar amigos"
                description="O convite aparece para eles na hora."
              />
              <ul className="flex flex-col gap-2">
                {friends.map((friend) => (
                  <li key={friend.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{friend.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={invited.includes(friend.id)}
                      icon={<UserPlus className="h-4 w-4" />}
                      onClick={async () => {
                        try {
                          await inviteToCall(getSupabaseBrowserClient(), room.id, friend.id);
                          setInvited((current) => [...current, friend.id]);
                          toast({ tone: 'success', title: `${friend.name} foi convidado.` });
                        } catch (error) {
                          toast({
                            tone: 'danger',
                            title: failureMessage(error, 'O convite não foi enviado.'),
                          });
                        }
                      }}
                    >
                      {invited.includes(friend.id) ? 'Convidado' : 'Convidar'}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
