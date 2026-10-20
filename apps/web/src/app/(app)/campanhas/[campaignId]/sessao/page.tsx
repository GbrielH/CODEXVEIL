import { listSessionBlocks, listSessions, pickCurrentSession, resolveBlockReferences, signedMediaUrls } from '@codexveil/database';
import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/sessions/block-renderer';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LiveRefresh } from './live-refresh';

export const metadata: Metadata = { title: 'Sessão' };

/**
 * Aba Sessão: os trechos da lore que o mestre liberou na sessão atual, em tempo real.
 * Jogadores só recebem do banco os blocos liberados; o mestre vê aqui o mesmo que eles.
 */
export default async function SessionTabPage({ params }: PageProps<'/campanhas/[campaignId]/sessao'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const sessions = (await listSessions(supabase, campaign.id)).filter((session) => session.isPublished);
  const session = pickCurrentSession(sessions) ?? [...sessions].sort((a, b) => b.number - a.number)[0] ?? null;
  const isGm = campaign.role === 'gm';

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <LiveRefresh campaignId={campaign.id} />
        </div>
        <EmptyState title="Nada liberado ainda" description="Quando o mestre liberar trechos da sessão (textos, imagens de NPCs, falas), eles aparecem aqui." />
      </div>
    );
  }

  const blocks = (await listSessionBlocks(supabase, session.id)).filter((block) => block.visibility === 'members');
  const [references, imageUrls] = await Promise.all([
    resolveBlockReferences(supabase, blocks),
    signedMediaUrls(
      supabase,
      blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    ),
  ]);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Badge tone="parchment">Sessão {session.number}</Badge>
        <h2 className="min-w-0 flex-1 text-2xl leading-tight">{session.title}</h2>
        <LiveRefresh campaignId={campaign.id} />
      </header>
      {isGm ? <Alert tone="info">Esta é a visão dos jogadores. Libere ou oculte trechos na Mesa do mestre.</Alert> : null}
      {blocks.length === 0 ? (
        <EmptyState title="Nada liberado ainda" description="O mestre ainda não liberou trechos desta sessão. Eles aparecem aqui assim que forem liberados." />
      ) : (
        blocks.map((block) => <BlockRenderer key={block.id} block={block} campaignId={campaign.id} references={references} imageUrls={imageUrls} showVisibility={false} />)
      )}
    </article>
  );
}
