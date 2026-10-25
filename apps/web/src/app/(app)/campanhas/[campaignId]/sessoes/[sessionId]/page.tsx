import {
  listSessionBlocks,
  resolveBlockReferences,
  sessionStatusLabels,
  signedMediaUrls,
} from '@codexveil/database';
import { ZoomableImage } from '@/components/ui/zoomable-image';
import { CalendarClock, EyeOff } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { BlockRenderer } from '@/components/sessions/block-renderer';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Divider } from '@/components/ui/divider';
import { EmptyState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';
import { campaignPath } from '@/lib/routes';
import { loadSessionOrNotFound } from '@/lib/sessions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SessionActions } from './session-actions';

export async function generateMetadata({
  params,
}: PageProps<'/campanhas/[campaignId]/sessoes/[sessionId]'>): Promise<Metadata> {
  const { campaignId, sessionId } = await params;
  const { session } = await loadSessionOrNotFound(campaignId, sessionId);
  return { title: `Sessão ${session.number}: ${session.title}` };
}

/** Modo leitura do roteiro. Jogadores recebem do banco apenas os blocos públicos. */
export default async function SessionReaderPage({
  params,
}: PageProps<'/campanhas/[campaignId]/sessoes/[sessionId]'>) {
  const { campaignId, sessionId } = await params;
  const { campaign, session } = await loadSessionOrNotFound(campaignId, sessionId);
  const supabase = await createSupabaseServerClient();
  const blocks = await listSessionBlocks(supabase, session.id);
  const [references, imageUrls] = await Promise.all([
    resolveBlockReferences(supabase, blocks),
    signedMediaUrls(supabase, [
      ...blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
      session.coverPath,
    ]),
  ]);
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';

  return (
    <article className="flex flex-col gap-6">
      <Link
        href={campaignPath(campaign.id, '/sessoes') as Route}
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Sessões
      </Link>
      {session.coverPath && imageUrls[session.coverPath] ? (
        <ZoomableImage
          src={imageUrls[session.coverPath]!}
          alt={`Capa da sessão ${session.number}`}
          className="aspect-[3/1] w-full rounded-xl border border-line object-cover"
        />
      ) : null}
      <header className="flex flex-col gap-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="parchment">Sessão {session.number}</Badge>
          <Badge tone={session.status === 'in_progress' ? 'brand' : 'neutral'}>
            {sessionStatusLabels[session.status]}
          </Badge>
          {isGm && !session.isPublished ? (
            <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
              Não publicada
            </Badge>
          ) : null}
          {session.scheduledAt ? (
            <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {formatDateTime(session.scheduledAt)}
            </span>
          ) : null}
        </div>
        <h2 className="text-3xl leading-tight">{session.title}</h2>
        {canManage ? (
          <SessionActions
            campaignId={campaign.id}
            sessionId={session.id}
            title={session.title}
            status={session.status}
          />
        ) : null}
      </header>

      {isGm ? (
        <Alert tone="info">
          Você está vendo o roteiro completo. Jogadores veem apenas blocos públicos
          {session.isPublished ? '' : ' — e só depois que a sessão for publicada'}.
        </Alert>
      ) : null}

      {session.recap ? (
        <section aria-labelledby="resumo" className="parchment ornate rounded-lg px-5 py-4">
          <h3 id="resumo" className="font-display text-lg text-ink">
            Resumo
          </h3>
          <p className="mt-1 whitespace-pre-line font-serif text-lg leading-relaxed text-ink">
            {session.recap}
          </p>
        </section>
      ) : null}

      {blocks.length === 0 ? (
        <EmptyState
          title="Roteiro vazio"
          description={
            canManage
              ? 'Abra o editor para escrever o roteiro em blocos.'
              : 'O mestre ainda não liberou conteúdo desta sessão.'
          }
        />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <Divider label="Roteiro" />
          {blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              campaignId={campaign.id}
              references={references}
              imageUrls={imageUrls}
              showVisibility={isGm}
            />
          ))}
        </div>
      )}
    </article>
  );
}
