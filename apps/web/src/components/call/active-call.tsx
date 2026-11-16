'use client';

import '@livekit/components-styles';
import {
  endCallPresence,
  heartbeatCallPresence,
  leaveCallRoom,
  saveTranscriptSegment,
  startCallPresence,
} from '@codexveil/database';
import { formatCallDuration } from '@codexveil/domain';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { DisconnectReason, LocalAudioTrack, Track } from 'livekit-client';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { createBrowserTranscription } from '@/lib/browser-transcription';
import { failureMessage } from '@/lib/client-errors';
import { RnnoiseProcessor, supportsRnnoise } from '@/lib/rnnoise-processor';
import { callPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/** Call em andamento: continua conectada enquanto a pessoa navega pelo app. */
export interface ActiveCall {
  roomId: string;
  slug: string;
  title: string;
  token: string;
  url: string;
  transcriptionEnabled: boolean;
}

interface ActiveCallValue {
  call: ActiveCall | null;
  connected: boolean;
  connectedAt: Date | null;
  /** Entra (ou troca de sala). */
  join: (call: ActiveCall) => void;
  /** Sai de verdade (registra a saída). */
  leave: () => Promise<void>;
  /** Onde a página da call desenha o vídeo (sem ela, aparece a barrinha flutuante). */
  setStage: (element: HTMLElement | null) => void;
  transcription: {
    supported: boolean;
    paused: boolean;
    setPaused: (paused: boolean) => void;
    problem: string | null;
  };
}

const ActiveCallContext = createContext<ActiveCallValue | null>(null);

export function useActiveCall(): ActiveCallValue | null {
  return useContext(ActiveCallContext);
}

const noSubscribe = () => () => undefined;

/**
 * Redução de ruído do microfone (preferência local, não afeta os outros). Ligada por padrão com o
 * RNNoise, que remove teclado, ventilador e barulho de fundo. Sem suporte no navegador, usa o
 * filtro embutido do WebRTC, reabrindo o microfone (`restartTrack`).
 */
function NoiseReductionControl({ onError }: { onError: (message: string) => void }) {
  const { microphoneTrack } = useLocalParticipant();
  const [enabled, setEnabled] = useState(true);
  const [changing, setChanging] = useState(false);
  const track = microphoneTrack?.audioTrack;
  const ready = track instanceof LocalAudioTrack;
  const appliedTo = useRef<LocalAudioTrack | null>(null);

  const apply = useCallback(async (target: LocalAudioTrack, next: boolean) => {
    if (next && supportsRnnoise()) {
      try {
        await target.setProcessor(new RnnoiseProcessor());
        return;
      } catch {
        await target.stopProcessor().catch(() => undefined);
      }
    } else if (!next) {
      await target.stopProcessor().catch(() => undefined);
    }
    await target.restartTrack({
      echoCancellation: true,
      noiseSuppression: next,
      autoGainControl: true,
    });
  }, []);

  useEffect(() => {
    if (!ready || appliedTo.current === track) return;
    appliedTo.current = track;
    if (!enabled) return;
    void apply(track, true).catch(() =>
      onError('Não foi possível ligar a redução de ruído neste navegador.'),
    );
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

/** Barrinha flutuante quando a pessoa está fora da página da call: microfone, voltar e sair. */
function MiniCallBar({ call, onLeave }: { call: ActiveCall; onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  return (
    <div className="fixed bottom-4 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-raised/95 py-1.5 pr-1.5 pl-4 text-sm shadow-lg backdrop-blur">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-verdigris-400" />
      <span className="max-w-[12rem] truncate text-fg">Na call: {call.title}</span>
      <Button
        size="icon"
        variant="ghost"
        aria-label={isMicrophoneEnabled ? 'Desligar o microfone' : 'Ligar o microfone'}
        onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </Button>
      <Link
        href={callPath(call.slug) as Route}
        className="rounded-full px-3 py-1.5 text-fg-brand hover:bg-hover"
      >
        Voltar à call
      </Link>
      <Button size="icon" variant="danger" aria-label="Sair da call" onClick={onLeave}>
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Mantém a call (LiveKit), a presença e a transcrição vivas no layout do app: trocar de página
 * não derruba mais a pessoa. Queda de conexão (aba em segundo plano, rede) reconecta sozinha;
 * só sai de verdade quando a pessoa sai (ou é removida).
 */
export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const intentional = useRef(false);
  const [provider] = useState(() => createBrowserTranscription());
  const supported = useSyncExternalStore(
    noSubscribe,
    () => provider.supported,
    () => false,
  );

  const join = useCallback((next: ActiveCall) => {
    setCall((current) => {
      if (current && current.roomId !== next.roomId) {
        intentional.current = true;
        void leaveCallRoom(getSupabaseBrowserClient(), current.roomId).catch(() => undefined);
      }
      return next;
    });
    setEnabled(next.transcriptionEnabled);
  }, []);

  const leave = useCallback(async () => {
    const current = call;
    intentional.current = true;
    setCall(null);
    setConnected(false);
    setConnectedAt(null);
    if (current)
      await leaveCallRoom(getSupabaseBrowserClient(), current.roomId).catch(() => undefined);
  }, [call]);

  /** Queda inesperada (aba em segundo plano, rede): pede um token novo e entra de novo. */
  const reconnect = useCallback(
    async (current: ActiveCall) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('/api/call/token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ roomId: current.roomId }),
          });
          const body = (await response.json()) as { token?: string; url?: string };
          if (body.token && body.url) {
            const { token, url } = body;
            setCall((now) => (now?.roomId === current.roomId ? { ...now, token, url } : now));
            return;
          }
        } catch {
          // Sem rede agora: tenta de novo em instantes.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 3_000));
      }
      toast({
        tone: 'danger',
        title: 'A conexão com a call caiu.',
        description: 'Entre de novo pela página da call.',
      });
      await leave();
    },
    [leave, toast],
  );

  // Presença (tempo de call) enquanto conectado.
  useEffect(() => {
    if (!call || !connected) return;
    const roomId = call.roomId;
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
      if (presenceId)
        void endCallPresence(getSupabaseBrowserClient(), presenceId).catch(() => undefined);
    };
  }, [call?.roomId, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // O dono liga ou desliga a gravação da transcrição: todos recebem na hora.
  useRealtimeRefresh(
    `transcricao-ativa:${call?.roomId ?? 'nenhuma'}`,
    [{ table: 'call_rooms', filter: `id=eq.${call?.roomId ?? ''}` }],
    () => {
      if (!call) return;
      void getSupabaseBrowserClient()
        .from('call_rooms')
        .select('transcription_enabled')
        .eq('id', call.roomId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setEnabled(data.transcription_enabled);
        });
    },
    Boolean(call),
  );

  // Transcreve a própria voz enquanto conectado, com a gravação ligada e sem pausa (em qualquer página).
  const roomId = call?.roomId ?? null;
  useEffect(() => {
    if (!roomId || !connected || !enabled || paused || !provider.supported) return;
    provider.start(
      (speech) => {
        setProblem(null);
        void saveTranscriptSegment(getSupabaseBrowserClient(), roomId, speech).catch(
          (error: unknown) => setProblem(failureMessage(error, 'Um trecho não foi salvo.')),
        );
      },
      (message) => setProblem(message),
    );
    return () => provider.stop();
  }, [roomId, connected, enabled, paused, provider]);

  const value = useMemo<ActiveCallValue>(
    () => ({
      call,
      connected,
      connectedAt,
      join,
      leave,
      setStage,
      transcription: { supported, paused, setPaused, problem },
    }),
    [call, connected, connectedAt, join, leave, supported, paused, problem],
  );

  const reportNoise = useCallback(
    (message: string) =>
      toast({ tone: 'warning', title: 'Redução de ruído', description: message }),
    [toast],
  );

  return (
    <ActiveCallContext.Provider value={value}>
      {children}
      {call ? (
        <LiveKitRoom
          key={call.token}
          token={call.token}
          serverUrl={call.url}
          connect
          audio
          video={false}
          style={{ display: 'contents' }}
          onConnected={() => {
            intentional.current = false;
            setConnected(true);
            setConnectedAt((at) => at ?? new Date());
          }}
          onDisconnected={(reason) => {
            setConnected(false);
            if (intentional.current) return;
            const left =
              reason === DisconnectReason.CLIENT_INITIATED ||
              reason === DisconnectReason.ROOM_DELETED ||
              reason === DisconnectReason.PARTICIPANT_REMOVED ||
              reason === DisconnectReason.DUPLICATE_IDENTITY;
            if (left) void leave();
            else void reconnect(call);
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
          <RoomAudioRenderer />
          {stage ? (
            createPortal(
              <div data-lk-theme="default" className="relative h-full">
                <VideoConference />
                <NoiseReductionControl onError={reportNoise} />
                <CallLiveStatus startedAt={connectedAt} />
              </div>,
              stage,
            )
          ) : (
            <MiniCallBar call={call} onLeave={() => void leave()} />
          )}
        </LiveKitRoom>
      ) : null}
    </ActiveCallContext.Provider>
  );
}
