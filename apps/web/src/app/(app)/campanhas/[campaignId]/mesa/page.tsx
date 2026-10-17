import {
  getOpenEncounter,
  listCampaignCharacters,
  listCampaignNotes,
  listCreatureStats,
  listCreatures,
  listDiceRolls,
  listSceneEntities,
  listSessionBlocks,
  listSessions,
  pickCurrentSession,
  signedMediaUrls,
} from '@codexveil/database';
import { findSystem } from '@codexveil/rpg-systems';
import { CalendarPlus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { GmTable, type LibraryOption } from '@/components/gm/gm-table';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ForbiddenState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mesa do mestre' };

export default async function GmTablePage({ params }: PageProps<'/campanhas/[campaignId]/mesa'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm') {
    return <ForbiddenState description="A mesa do mestre reúne informações privadas da campanha e é exclusiva dos mestres." />;
  }

  const supabase = await createSupabaseServerClient();
  const [sessions, party, creatures, notes] = await Promise.all([
    listSessions(supabase, campaign.id),
    listCampaignCharacters(supabase, campaign.id),
    listCreatures(supabase, campaign.id),
    listCampaignNotes(supabase, campaign.id),
  ]);
  const session = pickCurrentSession(sessions);

  if (!session) {
    return (
      <EmptyState
        icon={<CalendarPlus className="h-8 w-8" aria-hidden="true" />}
        title="Nenhuma sessão planejada"
        description="A mesa do mestre acompanha a sessão em andamento ou a próxima planejada. Crie uma sessão para começar."
        action={<ButtonLink href={campaignPath(campaign.id, '/sessoes') as Route}>Ir para as sessões</ButtonLink>}
      />
    );
  }

  const [entities, encounter, blocks, stats, portraits, rolls] = await Promise.all([
    listSceneEntities(supabase, session.id),
    getOpenEncounter(supabase, session.id),
    listSessionBlocks(supabase, session.id),
    listCreatureStats(supabase, creatures.map((creature) => creature.id)),
    signedMediaUrls(supabase, party.map((character) => character.portraitPath)),
    listDiceRolls(supabase, campaign.id, 30),
  ]);

  // Valores iniciais da instância na cena, calculados pelo módulo do sistema da campanha.
  const system = findSystem(campaign.systemId);
  const library: LibraryOption[] = creatures.map((creature) => {
    let defaults = { hitPoints: null as number | null, armorClass: null as number | null, initiativeBonus: 0 };
    if (system) {
      try {
        defaults = system.combatDefaults(system.parseStatBlock(stats[creature.id] ?? {}));
      } catch {
        // Estatísticas fora do formato: a instância começa sem valores e o mestre os informa.
      }
    }
    return { id: creature.id, name: creature.name, subtitle: creature.subtitle, kind: creature.kind, ...defaults };
  });

  const outline = blocks
    .filter((block) => block.content?.type === 'heading' || block.content?.type === 'subheading' || block.content?.type === 'gm_note')
    .map((block) => ({
      id: block.id,
      type: block.content?.type ?? 'paragraph',
      text: block.content && 'text' in block.content.data ? block.content.data.text : '',
    }));

  return (
    <GmTable
      campaignId={campaign.id}
      systemId={campaign.systemId}
      currentUserId={user.id}
      isActive={campaign.status === 'active'}
      session={{ id: session.id, number: session.number, title: session.title, status: session.status, scheduledAt: session.scheduledAt }}
      initialParty={party}
      initialEntities={entities}
      initialEncounter={encounter}
      portraits={portraits}
      library={library}
      outline={outline}
      notes={notes.filter((note) => note.isPinned || note.visibility === 'gm').slice(0, 6)}
      turnSettings={campaign.turnSettings}
      rolls={rolls}
    />
  );
}
