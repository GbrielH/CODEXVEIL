'use client';

import '@livekit/components-styles';
import {
  decideCallParticipant,
  endCallRoom,
  inviteToCall,
  leaveCallRoom,
  listCallParticipants,
  type CallParticipant,
  type CallRoomSummary,
} from '@codexveil/database';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import { Check, Copy, Crown, Hourglass, PhoneOff, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { SpeakerBar } from '@/components/call/speaker-bar';
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
        <div className="min-h-[60vh] overflow-hidden rounded-xl border border-line bg-black">
          {entry.state === 'ready' ? (
            <LiveKitRoom
              token={entry.token}
              serverUrl={entry.url}
              connect
              audio
              video={false}
              data-lk-theme="default"
              style={{ height: '70vh' }}
              onDisconnected={() => void leave()}
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
            inCall={entry.state === 'ready'}
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
