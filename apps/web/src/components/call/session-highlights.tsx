'use client';

import {
  CAMPAIGN_MEDIA_BUCKET,
  createSessionHighlight,
  deleteSessionHighlight,
  sessionImagePath,
  updateSessionHighlight,
  type SessionHighlight,
  type TranscriptSegment,
} from '@codexveil/database';
import { HIGHLIGHT_IMAGE_STYLE } from '@codexveil/domain';
import { Copy, ImagePlus, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/use-confirm';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type HighlightCard = SessionHighlight & { imageUrl: string | null };
export interface HighlightCharacter {
  id: string;
  name: string;
  portraitUrl: string | null;
}

/** Um momento em cartão de grimório: imagem (ou o prompt para gerar), resumo, falas e ações. */
function HighlightTile({
  highlight,
  characters,
  canManage,
  campaignId,
  label,
}: {
  highlight: HighlightCard;
  characters: HighlightCharacter[];
  canManage: boolean;
  campaignId: string;
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(highlight.title);
  const [summary, setSummary] = useState(highlight.summary);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const involved = characters.filter((character) => highlight.characterIds.includes(character.id));

  const upload = async (picked: File) => {
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const extension =
        picked.type === 'image/png' ? 'png' : picked.type === 'image/webp' ? 'webp' : 'jpg';
      const path = sessionImagePath(
        campaignId,
        highlight.sessionId,
        `${crypto.randomUUID()}.${extension}`,
      );
      const { error } = await client.storage
        .from(CAMPAIGN_MEDIA_BUCKET)
        .upload(path, picked, { contentType: picked.type, upsert: false });
      if (error) throw error;
      await updateSessionHighlight(client, highlight.id, { imagePath: path });
      if (highlight.imagePath)
        await client.storage.from(CAMPAIGN_MEDIA_BUCKET).remove([highlight.imagePath]);
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'A imagem não foi enviada.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-parchment-400/30 bg-gradient-to-b from-wine-950/40 to-charcoal-900 shadow-lg">
      {confirmDialog}
      {highlight.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- endereço assinado do Storage
        <img
          src={highlight.imageUrl}
          alt={highlight.title}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-sunken/60 p-4 text-center">
          <Sparkles className="h-6 w-6 text-fg-accent" aria-hidden="true" />
          <p className="text-xs text-fg-muted">
            Copie o prompt, gere a imagem na IA da sua preferência (anexe os retratos abaixo) e
            envie aqui.
          </p>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {label ? (
          <p className="text-[0.65rem] tracking-wide text-fg-muted uppercase">{label}</p>
        ) : null}
        {editing ? (
          <>
            <input
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-md border border-line bg-sunken px-2 py-1 font-display text-fg"
            />
            <textarea
              value={summary}
              rows={4}
              maxLength={4000}
              onChange={(event) => setSummary(event.target.value)}
              className="rounded-md border border-line bg-sunken px-2 py-1 text-sm text-fg"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await updateSessionHighlight(getSupabaseBrowserClient(), highlight.id, {
                    title,
                    summary,
                  });
                  setEditing(false);
                  router.refresh();
                }}
              >
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-display text-lg text-fg">{highlight.title}</h3>
            {highlight.summary ? (
              <p className="text-sm text-fg-secondary">{highlight.summary}</p>
            ) : null}
          </>
        )}
        {involved.length ? (
          <p className="text-xs text-fg-muted">
            Com {involved.map((character) => character.name).join(', ')}
          </p>
        ) : null}
        {highlight.quotes.length ? (
          <ul className="flex flex-col gap-1 border-l-2 border-wine-500/60 pl-3 text-sm">
            {highlight.quotes.slice(0, 4).map((quote, index) => (
              <li key={index}>
                <span className="font-medium text-fg-accent">{quote.speaker}:</span>{' '}
                <span className="text-fg-secondary italic">“{quote.text}”</span>
              </li>
            ))}
          </ul>
        ) : null}
        {canManage ? (
          <div className="mt-auto flex flex-wrap gap-1 border-t border-line pt-3">
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy className="h-4 w-4" />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    `${highlight.imagePrompt || `${highlight.title}. ${highlight.summary}`}\n\nStyle: ${HIGHLIGHT_IMAGE_STYLE}.${
                      involved.length
                        ? ` Use the attached portraits as visual reference for: ${involved.map((character) => character.name).join(', ')}.`
                        : ''
                    }`,
                  )
                  .then(() => toast({ tone: 'success', title: 'Prompt da imagem copiado.' }))
              }
            >
              Prompt da imagem
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => file.current?.click()}
            >
              {highlight.imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) void upload(picked);
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Excluir este momento?',
                  confirmLabel: 'Excluir',
                });
                if (!ok) return;
                await deleteSessionHighlight(getSupabaseBrowserClient(), highlight.id);
                router.refresh();
              }}
            >
              Excluir
            </Button>
          </div>
        ) : null}
        {canManage && involved.some((character) => character.portraitUrl) ? (
          <p className="text-xs text-fg-muted">
            Retratos para anexar:{' '}
            {involved
              .filter((character) => character.portraitUrl)
              .map((character, index) => (
                <span key={character.id}>
                  {index ? ', ' : ''}
                  <a
                    href={character.portraitUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-fg-accent underline-offset-2 hover:underline"
                  >
                    {character.name}
                  </a>
                </span>
              ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Criar um momento à mão, escolhendo as falas da transcrição. */
function ManualHighlight({
  sessionId,
  transcript,
  onClose,
}: {
  sessionId: string;
  transcript: TranscriptSegment[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const save = async () => {
    try {
      const chosen = transcript.filter((segment) => picked.includes(segment.id));
      await createSessionHighlight(getSupabaseBrowserClient(), sessionId, {
        title: title.trim(),
        summary: summary.trim(),
        quotes: chosen.map((segment) => ({ speaker: segment.speakerLabel, text: segment.text })),
        segmentIds: chosen.map((segment) => segment.id),
        characterIds: [
          ...new Set(
            chosen.flatMap((segment) => (segment.characterId ? [segment.characterId] : [])),
          ),
        ],
        imagePrompt: `${title.trim()}. ${summary.trim()}`,
        source: 'manual',
      });
      onClose();
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'O momento não foi criado.') });
    }
  };
  return (
    <Modal open onClose={onClose} title="Novo momento" size="lg">
      <div className="flex flex-col gap-3">
        <input
          value={title}
          maxLength={120}
          placeholder="Título do momento"
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-md border border-line bg-sunken px-3 py-2 text-fg"
        />
        <textarea
          value={summary}
          rows={3}
          maxLength={4000}
          placeholder="O que aconteceu"
          onChange={(event) => setSummary(event.target.value)}
          className="rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg"
        />
        <p className="text-sm font-medium text-fg">Falas do momento</p>
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {transcript.map((segment) => (
            <li key={segment.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={picked.includes(segment.id)}
                  onChange={() =>
                    setPicked((current) =>
                      current.includes(segment.id)
                        ? current.filter((id) => id !== segment.id)
                        : [...current, segment.id],
                    )
                  }
                />
                <span>
                  <span className="font-medium text-fg-accent">{segment.speakerLabel}:</span>{' '}
                  <span className="text-fg-secondary">{segment.text}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!title.trim()} onClick={() => void save()}>
            Criar momento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Melhores Momentos da sessão, em galeria de grimório. O mestre gera pela IA (a partir da
 * transcrição), cria à mão, edita, exclui e envia a imagem gerada na IA da preferência dele.
 */
export function SessionHighlights({
  campaignId,
  sessionId,
  highlights,
  characters,
  transcript,
  transcriptExpired,
  canManage,
}: {
  campaignId: string;
  sessionId: string;
  highlights: HighlightCard[];
  characters: HighlightCharacter[];
  transcript: TranscriptSegment[];
  transcriptExpired: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const generate = async () => {
    setGenerating(true);
    setProblem(null);
    try {
      const response = await fetch('/api/sessoes/momentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) setProblem(body.error ?? 'Não foi possível gerar os momentos.');
      else router.refresh();
    } catch {
      setProblem('Sem conexão com o servidor. Tente de novo.');
    } finally {
      setGenerating(false);
    }
  };

  if (!canManage && highlights.length === 0) return null;
  return (
    <Card ornate>
      <CardHeader
        icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
        title="Melhores Momentos"
        description="As cenas marcantes da sessão, tiradas da transcrição. As imagens saem da IA que vocês preferirem, com o prompt pronto."
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={generating}
                icon={
                  highlights.some((h) => h.source === 'ai') ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )
                }
                disabled={transcript.length < 3}
                onClick={() => void generate()}
              >
                {highlights.some((h) => h.source === 'ai')
                  ? 'Gerar de novo'
                  : 'Gerar melhores momentos'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
                disabled={!transcript.length}
                onClick={() => setManual(true)}
              >
                Criar à mão
              </Button>
            </div>
          ) : undefined
        }
      />
      {generating ? <Alert tone="info">Gerando… a IA está lendo a transcrição.</Alert> : null}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
      {canManage && highlights.some((highlight) => highlight.source === 'ai') ? (
        <p className="text-xs text-fg-muted">
          Gerar de novo substitui somente os cartões automáticos sem imagem e que você ainda não
          editou.
        </p>
      ) : null}
      {canManage && transcriptExpired ? (
        <Alert tone="warning">As falas desta sessão já foram apagadas (24 h após a call).</Alert>
      ) : null}
      {canManage && transcript.length < 3 && !transcriptExpired ? (
        <p className="text-sm text-fg-muted">
          Os momentos saem da transcrição da sessão: faça a call vinculada a esta sessão com “Gravar
          transcrição” ligado.
        </p>
      ) : null}
      {highlights.length ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((highlight) => (
            <HighlightTile
              key={highlight.id}
              highlight={highlight}
              characters={characters}
              canManage={canManage}
              campaignId={campaignId}
            />
          ))}
        </div>
      ) : null}
      {manual ? (
        <ManualHighlight
          sessionId={sessionId}
          transcript={transcript}
          onClose={() => setManual(false)}
        />
      ) : null}
    </Card>
  );
}

/** Galeria da campanha: os momentos de todas as sessões (só leitura aqui). */
export function CampaignHighlights({
  campaignId,
  highlights,
  characters,
}: {
  campaignId: string;
  highlights: (HighlightCard & { sessionNumber: number; sessionTitle: string })[];
  characters: HighlightCharacter[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {highlights.map((highlight) => (
        <HighlightTile
          key={highlight.id}
          highlight={highlight}
          characters={characters}
          canManage={false}
          campaignId={campaignId}
          label={`Sessão ${highlight.sessionNumber}: ${highlight.sessionTitle}`}
        />
      ))}
    </div>
  );
}
