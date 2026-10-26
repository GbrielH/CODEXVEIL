import { getBoard, listBoards, signedMediaUrls } from '@codexveil/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BoardCanvas } from '@/components/boards/board-canvas';
import { parseBoardItems } from '@/components/boards/board-items';
import { BoardManager } from '@/components/boards/board-manager';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Quadros' };

/**
 * Aba Quadros: canvas livre do mestre (notas, textos, molduras e setas arrastáveis) para planejar
 * sessões. Só o mestre vê; os jogadores continuam vendo o que ele libera nas outras abas.
 */
export default async function BoardsPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/quadros'>) {
  const { campaignId } = await params;
  const query = await searchParams;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  if (campaign.role !== 'gm') notFound();
  const canManage = campaign.status === 'active';
  const boards = await listBoards(supabase, campaign.id);
  const wanted = typeof query.quadro === 'string' ? query.quadro : null;
  const activeId = boards.find((board) => board.id === wanted)?.id ?? boards[0]?.id ?? null;
  const board = activeId ? await getBoard(supabase, activeId) : null;
  const items = board ? parseBoardItems(board.items) : [];
  const imagePaths = items.flatMap((item) => (item.type === 'image' ? [item.path] : []));
  const imageUrls = imagePaths.length ? await signedMediaUrls(supabase, imagePaths) : {};

  return (
    <div className="flex flex-col gap-4">
      <BoardManager campaignId={campaign.id} boards={boards} activeId={activeId} canManage={canManage} />
      {board ? (
        <BoardCanvas
          key={board.id}
          campaignId={campaign.id}
          boardId={board.id}
          initialItems={items}
          initialImageUrls={imageUrls}
          initialVersion={board.version}
          readOnly={!canManage}
        />
      ) : (
        <EmptyState
          title="Nenhum quadro ainda"
          description="Crie um quadro para planejar suas sessões com blocos livres: notas, textos, imagens, molduras e setas. Só você vê."
        />
      )}
    </div>
  );
}
