import {
  listCampaignCharacters,
  listCampaignNotes,
  listCreatures,
  listSessionBlocks,
  listSessions,
  signedMediaUrls,
} from '@codexveil/database';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { SessionEditor } from '@/components/sessions/session-editor';
import { ForbiddenState } from '@/components/ui/states';
import { sessionPath } from '@/lib/routes';
import { loadSessionOrNotFound } from '@/lib/sessions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Editor de roteiro' };

export default async function SessionEditorPage({ params }: PageProps<'/campanhas/[campaignId]/sessoes/[sessionId]/editar'>) {
  const { campaignId, sessionId } = await params;
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

  const supabase = await createSupabaseServerClient();
  const [blocks, creatures, characters, sessions, notes] = await Promise.all([
    listSessionBlocks(supabase, session.id),
    listCreatures(supabase, campaign.id),
    listCampaignCharacters(supabase, campaign.id),
    listSessions(supabase, campaign.id),
    listCampaignNotes(supabase, campaign.id),
  ]);
  const imageUrls = await signedMediaUrls(
    supabase,
    blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href={sessionPath(campaign.id, session.id) as Route} className="text-sm text-fg-muted hover:text-fg">
        ← Ver sessão {session.number} em modo leitura
      </Link>
      <SessionEditor
        campaignId={campaign.id}
        session={session}
        initialBlocks={blocks}
        initialImageUrls={imageUrls}
        options={{
          creatures: creatures.map((creature) => ({ id: creature.id, name: creature.name, subtitle: creature.subtitle, kind: creature.kind })),
          characters: characters.map((character) => ({ id: character.id, name: character.name })),
          sessions: sessions.filter((entry) => entry.id !== session.id).map((entry) => ({ id: entry.id, number: entry.number, title: entry.title })),
          notes: notes.map((note) => ({ id: note.id, title: note.title })),
        }}
      />
    </div>
  );
}
