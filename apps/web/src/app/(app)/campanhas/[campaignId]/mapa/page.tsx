import { listCampaignCharacters, listCreatures, listSessions } from '@codexveil/database';
import type { Metadata, Route } from 'next';
import { DiceProvider } from '@/components/dice/dice-roller';
import { MapManager } from '@/components/map/map-manager';
import { MapView } from '@/components/map/map-view';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mapa' };

/**
 * Aba Mapa: a grade de combate, separada da aba Sessão.
 *   * Mestre: editor de mapas sempre à mão (prepara cenários antes da sessão e mostra durante).
 *   * Jogadores: o mapa ativo da sessão em andamento.
 */
export default async function MapTabPage({ params }: PageProps<'/campanhas/[campaignId]/mapa'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const [all, party, creatures] = await Promise.all([
    listSessions(supabase, campaign.id),
    listCampaignCharacters(supabase, campaign.id),
    isGm ? listCreatures(supabase, campaign.id) : Promise.resolve([]),
  ]);
  const sessions = isGm ? all : all.filter((session) => session.isPublished);
  const current = sessions.find((session) => session.status === 'in_progress') ?? null;
  // Sessão de referência do editor de mapas do mestre (a iniciada, senão a mais recente).
  const mapSession = current ?? [...all].sort((a, b) => b.number - a.number)[0] ?? null;
  const ownCharacter = isGm ? null : (party.find((character) => character.ownerId === user.id) ?? null);

  const content = isGm ? (
    mapSession ? (
      <MapManager
        campaignId={campaign.id}
        sessions={all.map((entry) => ({ id: entry.id, number: entry.number, title: entry.title }))}
        sessionId={mapSession.id}
        systemId={campaign.systemId}
        characters={party.map((character) => ({ id: character.id, name: character.name }))}
        creatures={creatures.map((creature) => ({ id: creature.id, name: creature.name, size: creature.size }))}
        canManage={campaign.status === 'active'}
      />
    ) : (
      <EmptyState
        title="Nenhuma sessão criada"
        description="Os mapas pertencem a uma sessão. Crie uma em Sessões para preparar o primeiro mapa."
        action={<ButtonLink href={campaignPath(campaign.id, '/sessoes') as Route}>Ir para as sessões</ButtonLink>}
      />
    )
  ) : current ? (
    <div className="mx-auto w-full max-w-6xl">
      <MapView campaignId={campaign.id} systemId={campaign.systemId} myCharacterId={ownCharacter?.id ?? null} />
    </div>
  ) : (
    <EmptyState title="Nenhuma sessão em andamento" description="Quando o mestre iniciar a sessão e mostrar um mapa, ele aparece aqui." />
  );

  // A caixinha de dados da mesa também aparece aqui (rolagens ao vivo durante o combate).
  return (
    <DiceProvider campaignId={campaign.id} characterId={ownCharacter?.id ?? null} sessionGate={!isGm} enabled={campaign.status === 'active'}>
      {content}
    </DiceProvider>
  );
}
