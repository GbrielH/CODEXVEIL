import {
  getCampaignTurn,
  getSessionState,
  listCampaignCharacters,
  listCreatures,
  listDiceRolls,
  listNpcCharacterCandidates,
  listSessions,
} from '@codexveil/database';
import { characterAttributeBonuses, characterSkillBonuses, conditionLabel, summarizeSheet } from '@codexveil/rpg-systems';
import type { Metadata, Route } from 'next';
import { DicePanel, DiceProvider } from '@/components/dice/dice-roller';
import { DiceTable } from '@/components/dice/dice-table';
import { RollFeed } from '@/components/dice/roll-feed';
import { TurnStatus } from '@/components/campaigns/turn-status';
import { GameWorkspace } from '@/components/game/game-workspace';
import { ResourceStepper } from '@/components/game/resource-stepper';
import { MapManager } from '@/components/map/map-manager';
import { MapView } from '@/components/map/map-view';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { callsEnabled } from '@/lib/env';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { gameBlocks } from '@/lib/game-blocks';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Jogo' };

export default async function GamePage({ params }: PageProps<'/campanhas/[campaignId]/jogo'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const client = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const [sessions, party, rolls, sessionState, turn, creatures, npcs] = await Promise.all([
    listSessions(client, campaign.id),
    listCampaignCharacters(client, campaign.id),
    listDiceRolls(client, campaign.id, 30),
    getSessionState(client, campaign.id),
    getCampaignTurn(client, campaign.id).catch(() => null),
    isGm ? listCreatures(client, campaign.id) : Promise.resolve([]),
    isGm
      ? listNpcCharacterCandidates(client, user.id, campaign.id, campaign.systemId).catch(() => [])
      : Promise.resolve([]),
  ]);
  const visibleSessions = isGm ? sessions : sessions.filter((entry) => entry.isPublished);
  const current = visibleSessions.find((entry) => entry.status === 'in_progress') ?? null;
  const mapSession = current ?? [...sessions].sort((a, b) => b.number - a.number)[0] ?? null;
  const own = isGm ? null : (party.find((entry) => entry.ownerId === user.id) ?? null);
  const skills = own ? characterSkillBonuses(campaign.systemId, own.sheet) : [];
  const attributes = own ? characterAttributeBonuses(campaign.systemId, own.sheet) : [];
  const blocks = gameBlocks(campaign.systemId, isGm ? 'gm' : 'player');

  const map = isGm ? (
    mapSession ? (
      <MapManager
        campaignId={campaign.id}
        sessions={sessions.map((entry) => ({
          id: entry.id,
          number: entry.number,
          title: entry.title,
        }))}
        sessionId={mapSession.id}
        systemId={campaign.systemId}
        characters={party.map((entry) => ({ id: entry.id, name: entry.name }))}
        creatures={creatures.map((entry) => ({ id: entry.id, name: entry.name, size: entry.size }))}
        npcs={npcs
          .filter((entry) => entry.npcCampaignId === campaign.id)
          .map((entry) => ({ id: entry.id, name: entry.name, imagePath: entry.portraitPath }))}
        canManage={campaign.status === 'active'}
      />
    ) : (
      <EmptyState
        title="Nenhuma sessão criada"
        description="Crie uma sessão para preparar o mapa."
      />
    )
  ) : current ? (
    <MapView
      campaignId={campaign.id}
      systemId={campaign.systemId}
      myCharacterId={own?.id ?? null}
    />
  ) : (
    <EmptyState
      title="Nenhuma sessão em andamento"
      description="O mapa aparece quando o mestre iniciar a sessão."
    />
  );

  const character = own ? (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <strong>{own.name}</strong>
        <p className="text-fg-muted">{summarizeSheet(campaign.systemId, own.sheet).subtitle}</p>
      </div>
      {own.resources.map((resource) =>
        // Trilhas com máximo (vida, mana…) ganham − e +; moedas e afins ficam só para leitura.
        resource.max !== null && campaign.status === 'active' ? (
          <ResourceStepper key={resource.id} resource={resource} />
        ) : (
        <div key={resource.id} className="flex justify-between gap-2">
          <span>{resource.label}</span>
          <strong>
            {resource.current}
            {resource.temp ? ` + ${resource.temp}` : ''}
            {resource.max === null ? '' : ` / ${resource.max}`}
          </strong>
        </div>
        ),
      )}
      {own.conditions.length ? (
        <div className="flex flex-wrap gap-1">
          {own.conditions.map((condition) => (
            <Badge key={condition.id} tone="warning">
              {conditionLabel(campaign.systemId, condition.key, condition.level)}
            </Badge>
          ))}
        </div>
      ) : null}
      <ButtonLink
        href={campaignPath(campaign.id, '/personagem') as Route}
        size="sm"
        variant="secondary"
      >
        Abrir ficha completa
      </ButtonLink>
    </div>
  ) : (
    <p className="text-sm text-fg-muted">
      {isGm ? 'O mestre acompanha o grupo na Mesa do mestre.' : 'Vincule um personagem à campanha.'}
    </p>
  );

  const initiative = (
    <div className="flex min-w-0 flex-col gap-2">
      <TurnStatus
        campaignId={campaign.id}
        initialTurn={turn}
        ownCharacterId={own?.id ?? null}
        systemId={campaign.systemId}
      />
      {isGm ? (
        <ButtonLink
          href={campaignPath(campaign.id, '/mesa') as Route}
          size="sm"
          variant="secondary"
        >
          Controlar turnos na Mesa
        </ButtonLink>
      ) : null}
    </div>
  );

  return (
    <DiceProvider
      tray={false}
      campaignId={campaign.id}
      characterId={own?.id ?? null}
      sessionGate={!isGm}
      enabled={campaign.status === 'active'}
    >
      <GameWorkspace
        campaignId={campaign.id}
        map={map}
        character={character}
        initiative={initiative}
        dice={
          isGm || (sessionState.playing && !sessionState.physicalDice) ? (
            <DicePanel isGm={isGm} characterName={own?.name ?? null} skills={skills} attributes={attributes} />
          ) : (
            <p className="text-sm text-fg-muted">
              {sessionState.physicalDice
                ? 'Esta sessão usa dados presenciais.'
                : 'As rolagens abrem quando a sessão começar.'}
            </p>
          )
        }
        feed={
          <Card>
              <h3 className="mb-3 font-display">Mural de rolagens</h3>
              <RollFeed
                campaignId={campaign.id}
                initialRolls={rolls}
                canClear={isGm && campaign.status === 'active'}
                compact
                limit={30}
              />
          </Card>
        }
        table={<DiceTable campaignId={campaign.id} />}
        gm={
          blocks.includes('gm-tools') ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={campaignPath(campaign.id, '/mesa') as Route} size="sm">
                NPCs, PV e turnos
              </ButtonLink>
              <ButtonLink
                href={campaignPath(campaign.id, '/revelacoes') as Route}
                size="sm"
                variant="secondary"
              >
                Revelações
              </ButtonLink>
            </div>
          ) : undefined
        }
        session={
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {current
                ? `Sessão ${current.number}: ${current.title}`
                : 'Nenhuma sessão em andamento.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                href={campaignPath(campaign.id, '/sessao') as Route}
                size="sm"
                variant="secondary"
              >
                Abrir roteiro
              </ButtonLink>
              {callsEnabled() ? (
                <ButtonLink href="/call" size="sm" variant="ghost">
                  Entrar na call
                </ButtonLink>
              ) : null}
            </div>
            {blocks.includes('assimilation-cards') ? (
              <ButtonLink
                href={campaignPath(campaign.id, '/sessao') as Route}
                size="sm"
                variant="ghost"
              >
                Cartas e eventos
              </ButtonLink>
            ) : null}
          </div>
        }
      />
    </DiceProvider>
  );
}
