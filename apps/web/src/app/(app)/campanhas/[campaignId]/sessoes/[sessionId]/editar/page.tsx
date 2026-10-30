import {
  getBoard,
  listBoards,
  listCampaignCharacters,
  listCampaignNotes,
  listCreatures,
  listSessionBlocks,
  listSessions,
  signedMediaUrls,
} from '@codexveil/database';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { BoardCanvas } from '@/components/boards/board-canvas';
import { parseBoardItems } from '@/components/boards/board-items';
import { BoardManager } from '@/components/boards/board-manager';
import { SessionCoverEditor } from '@/components/sessions/session-cover-editor';
import { SessionEditor } from '@/components/sessions/session-editor';
import { EmptyState, ForbiddenState } from '@/components/ui/states';
import { sessionPath } from '@/lib/routes';
import { loadSessionOrNotFound } from '@/lib/sessions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Editor de roteiro' };

/**
 * Editor da sessão, em duas abas: o Roteiro (blocos que o mestre libera na mesa) e o Quadro
 * (canvas livre para planejar esta sessão: notas, textos, imagens, molduras e setas; só o mestre vê).
 */
export default async function SessionEditorPage({
  params,
  searchParams,
}: PageProps<'/campanhas/[campaignId]/sessoes/[sessionId]/editar'>) {
  const [{ campaignId, sessionId }, query] = await Promise.all([params, searchParams]);
  const { campaign, session } = await loadSessionOrNotFound(campaignId, sessionId);

  if (campaign.role !== 'gm' || campaign.status !== 'active') {
    return (
      <ForbiddenState
        description={
          campaign.status !== 'active'
            ? 'A campanha está arquivada: roteiros ficam disponíveis apenas para leitura.'
            : 'Somente mestres editam roteiros.'
        }
      />
    );
  }

  const editorPath = `${sessionPath(campaign.id, session.id)}/editar`;
  const onBoard = query.aba === 'quadro';
  const tabClass =
    'rounded-full border border-line px-4 py-1.5 text-sm text-fg-secondary hover:bg-hover aria-[current=page]:border-fg-brand aria-[current=page]:bg-hover aria-[current=page]:text-fg';
  const tabs = (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Editor da sessão">
      <Link href={editorPath as Route} aria-current={onBoard ? undefined : 'page'} className={tabClass}>
        Roteiro
      </Link>
      <Link href={`${editorPath}?aba=quadro` as Route} aria-current={onBoard ? 'page' : undefined} className={tabClass}>
        Quadro
      </Link>
    </nav>
  );
  const back = (
    <Link href={sessionPath(campaign.id, session.id) as Route} className="text-sm text-fg-muted hover:text-fg">
      ← Ver sessão {session.number} em modo leitura
    </Link>
  );

  const supabase = await createSupabaseServerClient();

  if (onBoard) {
    const boards = await listBoards(supabase, campaign.id, session.id);
    const wanted = typeof query.quadro === 'string' ? query.quadro : null;
    const activeId = boards.find((board) => board.id === wanted)?.id ?? boards[0]?.id ?? null;
    const board = activeId ? await getBoard(supabase, activeId) : null;
    const items = board ? parseBoardItems(board.items) : [];
    const imagePaths = items.flatMap((item) => (item.type === 'image' ? [item.path] : []));
    const imageUrls = imagePaths.length ? await signedMediaUrls(supabase, imagePaths) : {};
    return (
      <div className="flex flex-col gap-5">
        {back}
        {tabs}
        <BoardManager
          campaignId={campaign.id}
          sessionId={session.id}
          basePath={`${editorPath}?aba=quadro`}
          boards={boards}
          activeId={activeId}
          canManage
        />
        {board ? (
          <BoardCanvas
            key={board.id}
            campaignId={campaign.id}
            boardId={board.id}
            initialItems={items}
            initialImageUrls={imageUrls}
            initialVersion={board.version}
            readOnly={false}
          />
        ) : (
          <EmptyState
            title="Nenhum quadro nesta sessão"
            description="Crie um quadro para planejar a sessão com blocos livres: notas, textos, imagens, molduras e setas. Só você vê."
          />
        )}
      </div>
    );
  }

  const [blocks, creatures, characters, sessions, notes] = await Promise.all([
    listSessionBlocks(supabase, session.id),
    listCreatures(supabase, campaign.id),
    listCampaignCharacters(supabase, campaign.id),
    listSessions(supabase, campaign.id),
    listCampaignNotes(supabase, campaign.id),
  ]);
  const imageUrls = await signedMediaUrls(supabase, [
    ...blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    session.coverPath,
  ]);

  return (
    <div className="flex flex-col gap-5">
      {back}
      {tabs}
      <SessionCoverEditor
        campaignId={campaign.id}
        sessionId={session.id}
        coverPath={session.coverPath}
        coverUrl={session.coverPath ? (imageUrls[session.coverPath] ?? null) : null}
      />
      <SessionEditor
        campaignId={campaign.id}
        session={session}
        initialBlocks={blocks}
        initialImageUrls={imageUrls}
        options={{
          creatures: creatures.map((creature) => ({
            id: creature.id,
            name: creature.name,
            subtitle: creature.subtitle,
            kind: creature.kind,
          })),
          characters: characters.map((character) => ({ id: character.id, name: character.name })),
          sessions: sessions
            .filter((entry) => entry.id !== session.id)
            .map((entry) => ({ id: entry.id, number: entry.number, title: entry.title })),
          notes: notes.map((note) => ({ id: note.id, title: note.title })),
        }}
      />
    </div>
  );
}
