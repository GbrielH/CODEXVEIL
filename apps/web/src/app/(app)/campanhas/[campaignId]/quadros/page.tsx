import { getBoard, listBoards } from '@codexveil/database';
import type { Metadata } from 'next';
import { BoardCanvas } from '@/components/boards/board-canvas';
import { parseBoardItems } from '@/components/boards/board-items';
import { BoardManager } from '@/components/boards/board-manager';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Quadros' };

/**
 * Aba Quadros: canvas livre do mestre (notas, textos, molduras e setas arrastáveis) para planejar
 * sessões. Os jogadores veem, sem editar, só os quadros que o mestre deixou visíveis.
 */
export default async function BoardsPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/quadros'>) {
  const { campaignId } = await params;
  const query = await searchParams;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const boards = await listBoards(supabase, campaign.id);
  const wanted = typeof query.quadro === 'string' ? query.quadro : null;
  const activeId = boards.find((board) => board.id === wanted)?.id ?? boards[0]?.id ?? null;
  const board = activeId ? await getBoard(supabase, activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      <BoardManager campaignId={campaign.id} boards={boards} activeId={activeId} canManage={canManage} />
      {board ? (
        <BoardCanvas
          key={board.id}
          boardId={board.id}
          initialItems={parseBoardItems(board.items)}
          initialVersion={board.version}
          readOnly={!canManage}
        />
      ) : (
        <EmptyState
          title={isGm ? 'Nenhum quadro ainda' : 'Nenhum quadro compartilhado'}
          description={
            isGm
              ? 'Crie um quadro para planejar suas sessões com blocos livres: notas, textos, molduras e setas.'
              : 'Quando o mestre compartilhar um quadro, ele aparece aqui.'
          }
        />
      )}
    </div>
  );
}
