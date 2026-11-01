'use client';

import {
  listTranscript,
  saveTranscriptSegment,
  setCallTranscription,
  updateTranscriptSegment,
  type TranscriptSegment,
} from '@codexveil/database';
import { formatTranscript } from '@codexveil/domain';
import { Copy, Download, Mic, MicOff, Pencil, ScrollText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { createBrowserTranscription } from '@/lib/browser-transcription';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

const noSubscribe = () => () => undefined;

const time = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** Copiar e baixar (.md e .txt) a transcrição inteira, com cabeçalho. */
export function TranscriptExport({
  segments,
  header,
}: {
  segments: TranscriptSegment[];
  header: { campaign?: string | null; session?: string | null; title: string };
}) {
  const { toast } = useToast();
  const text = () =>
    formatTranscript(segments, {
      campaign: header.campaign,
      session: header.session,
      date: segments[0]?.startedAt ?? new Date().toISOString(),
      characters: [
        ...new Set(segments.filter((s) => s.speakerType === 'player').map((s) => s.speakerLabel)),
      ],
    });
  const download = (extension: 'md' | 'txt') => {
    const blob = new Blob([text()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcricao-${(header.session ?? header.title ?? 'call').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        icon={<Copy className="h-4 w-4" />}
        disabled={!segments.length}
        onClick={() =>
          void navigator.clipboard
            .writeText(text())
            .then(() => toast({ tone: 'success', title: 'Transcrição copiada.' }))
        }
      >
        Copiar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Download className="h-4 w-4" />}
        disabled={!segments.length}
        onClick={() => download('md')}
      >
        .md
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Download className="h-4 w-4" />}
        disabled={!segments.length}
        onClick={() => download('txt')}
      >
        .txt
      </Button>
    </div>
  );
}

/** Lista das falas; o mestre corrige o texto de um trecho (opcional). */
export function TranscriptList({
  segments,
  canEdit,
  onEdited,
}: {
  segments: TranscriptSegment[];
  canEdit: boolean;
  onEdited: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  if (!segments.length)
    return <p className="text-sm text-fg-muted">Nenhuma fala transcrita ainda.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {segments.map((segment) => (
        <li key={segment.id} className="text-sm">
          <span className="text-xs text-fg-muted">{time(segment.startedAt)} </span>
          <span
            className={
              segment.speakerType === 'master'
                ? 'font-medium text-amber-300'
                : 'font-medium text-fg-accent'
            }
          >
            {segment.speakerLabel}:
          </span>{' '}
          {editing?.id === segment.id ? (
            <span className="mt-1 flex flex-col gap-1">
              <textarea
                value={editing.text}
                onChange={(event) => setEditing({ id: segment.id, text: event.target.value })}
                rows={2}
                maxLength={4000}
                className="rounded-md border border-line bg-sunken px-2 py-1 text-sm text-fg"
              />
              <span className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await updateTranscriptSegment(
                        getSupabaseBrowserClient(),
                        segment.id,
                        editing.text,
                      );
                      setEditing(null);
                      onEdited();
                    } catch (error) {
                      toast({
                        tone: 'danger',
                        title: failureMessage(error, 'A correção não foi salva.'),
                      });
                    }
                  }}
                >
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </span>
            </span>
          ) : (
            <>
              <span className="text-fg-secondary">{segment.text}</span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Corrigir este trecho"
                  onClick={() => setEditing({ id: segment.id, text: segment.text })}
                  className="ml-1 inline-flex rounded p-0.5 text-fg-muted align-middle hover:text-fg"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Transcrição dentro da call: o dono liga "Gravar transcrição"; cada pessoa transcreve a própria
 * voz no navegador (grátis) e pode pausar; todos veem o aviso e as falas chegando ao vivo.
 */
export function TranscriptPanel({
  roomId,
  initialEnabled,
  isOwner,
  canEdit,
  inCall,
  header,
}: {
  roomId: string;
  initialEnabled: boolean;
  isOwner: boolean;
  canEdit: boolean;
  /** Só transcreve com a pessoa dentro da call. */
  inCall: boolean;
  header: { campaign?: string | null; session?: string | null; title: string };
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [paused, setPaused] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Criado uma vez (o navegador decide se suporta).
  const [provider] = useState(() => createBrowserTranscription());
  // No servidor não há reconhecimento de fala: o suporte só é lido no navegador.
  const supported = useSyncExternalStore(
    noSubscribe,
    () => provider.supported,
    () => false,
  );
  const list = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    listTranscript(getSupabaseBrowserClient(), roomId)
      .then((next) => {
        setSegments(next);
        window.setTimeout(() => list.current?.scrollTo({ top: list.current.scrollHeight }), 50);
      })
      .catch(() => undefined);
  }, [roomId]);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useRealtimeRefresh(
    `transcricao:${roomId}`,
    [{ table: 'transcript_segments', filter: `room_id=eq.${roomId}` }],
    reload,
  );
  // O dono liga ou desliga: todos recebem na hora.
  useRealtimeRefresh(
    `transcricao-sala:${roomId}`,
    [{ table: 'call_rooms', filter: `id=eq.${roomId}` }],
    () => {
      void getSupabaseBrowserClient()
        .from('call_rooms')
        .select('transcription_enabled')
        .eq('id', roomId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setEnabled(data.transcription_enabled);
        });
    },
  );

  // Ouve a própria voz enquanto a gravação está ligada, sem pausa e dentro da call.
  useEffect(() => {
    const current = provider;
    if (!enabled || paused || !inCall || !current.supported) return;
    current.start(
      (speech) => {
        void saveTranscriptSegment(getSupabaseBrowserClient(), roomId, speech).catch(
          (error: unknown) => setProblem(failureMessage(error, 'Um trecho não foi salvo.')),
        );
      },
      (message) => setProblem(message),
    );
    return () => current.stop();
  }, [enabled, paused, inCall, roomId, provider]);

  const toggle = async () => {
    try {
      await setCallTranscription(getSupabaseBrowserClient(), roomId, !enabled);
      setEnabled(!enabled);
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'Não foi possível mudar a gravação.') });
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
        title="Transcrição"
        description="Cada fala com o personagem de quem falou (o mestre aparece como Mestre)."
      />
      {enabled ? (
        <Alert tone="warning">
          Esta call está sendo transcrita.{' '}
          {supported
            ? paused
              ? 'A sua voz está pausada.'
              : 'A sua voz está sendo transcrita.'
            : 'Seu navegador não transcreve (use Chrome ou Edge); as falas dos outros continuam chegando.'}
        </Alert>
      ) : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {isOwner ? (
          <Button
            size="sm"
            variant={enabled ? 'secondary' : 'primary'}
            onClick={() => void toggle()}
          >
            {enabled ? 'Parar de gravar' : 'Gravar transcrição'}
          </Button>
        ) : null}
        {enabled && supported ? (
          <Button
            size="sm"
            variant="ghost"
            icon={paused ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? 'Retomar minha transcrição' : 'Pausar minha transcrição'}
          </Button>
        ) : null}
      </div>
      <div ref={list} className="mt-3 max-h-80 overflow-y-auto pr-1">
        <TranscriptList segments={segments} canEdit={canEdit} onEdited={reload} />
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <TranscriptExport segments={segments} header={header} />
      </div>
    </Card>
  );
}
