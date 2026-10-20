'use client';

import {
  getOpenEncounter,
  listCampaignCharacters,
  listSceneEntities,
  sessionStatusLabels,
  type CampaignNote,
  type CampaignTurnSettings,
  type DiceRoll,
  type Encounter,
  type PartyCharacter,
  type SceneEntity,
  type SessionStatus,
} from '@codexveil/database';
import { BookOpen, Dices, Lock, NotebookPen, ScrollText } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LiveBadge } from '@/components/ui/save-status';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { formatDateTime } from '@/lib/format';
import { campaignPath, sessionPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { DicePanel, DiceProvider } from '@/components/dice/dice-roller';
import { RollFeed } from '@/components/dice/roll-feed';
import { CombatTracker } from './combat-tracker';
import { PartyStatus } from './party-status';
import { RevealPanel, type RevealBlock } from './reveal-panel';
import { ScenePanel } from './scene-panel';

export interface LibraryOption {
  id: string;
  name: string;
  subtitle: string;
  kind: 'npc' | 'monster';
  hitPoints: number | null;
  armorClass: number | null;
  initiativeBonus: number;
}

export interface GmSession {
  id: string;
  number: number;
  title: string;
  status: SessionStatus;
  scheduledAt: string | null;
}

interface GmTableProps {
  campaignId: string;
  systemId: string;
  currentUserId: string;
  isActive: boolean;
  session: GmSession;
  initialParty: PartyCharacter[];
  initialEntities: SceneEntity[];
  initialEncounter: Encounter | null;
  portraits: Record<string, string>;
  library: LibraryOption[];
  outline: { id: string; type: string; text: string }[];
  reveal: RevealBlock[];
  sessionPublished: boolean;
  notes: CampaignNote[];
  turnSettings: CampaignTurnSettings;
  rolls: DiceRoll[];
}

export interface GmTableContext {
  campaignId: string;
  systemId: string;
  session: GmSession;
  /** Modo e ordem padrão dos encontros novos (configurações da campanha). */
  turnSettings: CampaignTurnSettings;
  canManage: boolean;
  party: PartyCharacter[];
  entities: SceneEntity[];
  encounter: Encounter | null;
  setParty: (update: (current: PartyCharacter[]) => PartyCharacter[]) => void;
  setEntities: (update: (current: SceneEntity[]) => SceneEntity[]) => void;
  reload: () => Promise<void>;
  /** Mostra a falha e recarrega o estado real do banco (nada fica como "salvo" sem confirmação). */
  fail: (title: string, error: unknown) => void;
}

/**
 * Central da sessão para o mestre. Mudanças feitas por jogadores (vida, condições) ou por
 * outros mestres chegam em tempo real; cada evento recarrega os dados pelas consultas
 * normais, que passam pelo RLS.
 */
export function GmTable(props: GmTableProps) {
  const { campaignId, systemId, session } = props;
  const { toast } = useToast();
  const [party, setPartyState] = useState(props.initialParty);
  const [entities, setEntitiesState] = useState(props.initialEntities);
  const [encounter, setEncounter] = useState(props.initialEncounter);

  const reload = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    try {
      const [nextParty, nextEntities, nextEncounter] = await Promise.all([
        listCampaignCharacters(client, campaignId),
        listSceneEntities(client, session.id),
        getOpenEncounter(client, session.id),
      ]);
      setPartyState(nextParty);
      setEntitiesState(nextEntities);
      setEncounter(nextEncounter);
    } catch (error) {
      console.error('[codexveil] falha ao recarregar a mesa', error);
    }
  }, [campaignId, session.id]);

  const live = useRealtimeRefresh(
    `mesa:${session.id}`,
    [
      { table: 'characters', filter: `campaign_id=eq.${campaignId}` },
      { table: 'character_resources' },
      { table: 'character_conditions' },
      { table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` },
      { table: 'session_entities', filter: `session_id=eq.${session.id}` },
      { table: 'encounters', filter: `session_id=eq.${session.id}` },
      { table: 'encounter_combatants', filter: `campaign_id=eq.${campaignId}` },
    ],
    () => void reload(),
  );

  const context: GmTableContext = {
    campaignId,
    systemId,
    session,
    turnSettings: props.turnSettings,
    canManage: props.isActive,
    party,
    entities,
    encounter,
    setParty: setPartyState,
    setEntities: setEntitiesState,
    reload,
    fail: (title, error) => {
      toast({ tone: 'danger', title, description: failureMessage(error, 'A alteração não foi salva. Os dados foram recarregados.') });
      void reload();
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={session.status === 'in_progress' ? 'brand' : 'parchment'}>{sessionStatusLabels[session.status]}</Badge>
            <LiveBadge status={live} />
            {session.scheduledAt ? <span className="text-xs text-fg-muted">{formatDateTime(session.scheduledAt)}</span> : null}
          </div>
          <h2 className="mt-1 truncate text-xl">
            Sessão {session.number}: {session.title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={sessionPath(campaignId, session.id) as Route} size="sm" variant="secondary" icon={<ScrollText className="h-4 w-4" aria-hidden="true" />}>
            Roteiro
          </ButtonLink>
          {props.isActive ? (
            <ButtonLink href={sessionPath(campaignId, session.id, '/editar') as Route} size="sm" variant="ghost">
              Editar roteiro
            </ButtonLink>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <CombatTracker context={context} />
          <PartyStatus context={context} portraits={props.portraits} currentUserId={props.currentUserId} />
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              icon={<Dices className="h-5 w-5" aria-hidden="true" />}
              title="Mural de rolagens"
              description="Rolagens dos jogadores e as suas, ao vivo (as secretas só aparecem para os mestres)."
            />
            {props.isActive ? (
              <details className="mb-3 rounded-md border border-line bg-sunken/50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-fg-secondary">Rolar dados</summary>
                <div className="mt-3">
                  <DiceProvider campaignId={campaignId}>
                    <DicePanel isGm />
                  </DiceProvider>
                </div>
              </details>
            ) : null}
            <RollFeed campaignId={campaignId} initialRolls={props.rolls} canClear={props.isActive} limit={30} compact />
          </Card>
          <RevealPanel sessionId={session.id} isPublished={props.sessionPublished} isActive={props.isActive} blocks={props.reveal} />
          <ScenePanel context={context} library={props.library} />
          <Card>
            <CardHeader icon={<BookOpen className="h-5 w-5" aria-hidden="true" />} title="Atalhos do roteiro" />
            {props.outline.length === 0 ? (
              <p className="text-sm text-fg-muted">Títulos e notas privadas do roteiro aparecem aqui para consulta rápida.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {props.outline.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`${sessionPath(campaignId, session.id)}#bloco-${entry.id}` as Route}
                      className={
                        entry.type === 'heading'
                          ? 'block truncate rounded px-2 py-1 font-display text-fg-accent hover:bg-hover'
                          : entry.type === 'subheading'
                            ? 'block truncate rounded px-2 py-1 pl-5 text-sm text-fg-secondary hover:bg-hover'
                            : 'flex items-center gap-1.5 truncate rounded px-2 py-1 pl-5 text-sm text-wine-200 hover:bg-hover'
                      }
                    >
                      {entry.type === 'gm_note' ? <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                      <span className="truncate">{entry.text || (entry.type === 'gm_note' ? 'Nota privada' : 'Sem título')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader
              icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
              title="Anotações importantes"
              action={
                <ButtonLink href={campaignPath(campaignId, '/anotacoes') as Route} size="sm" variant="ghost">
                  Todas
                </ButtonLink>
              }
            />
            {props.notes.length === 0 ? (
              <p className="text-sm text-fg-muted">Fixe anotações ou marque-as como “somente mestres” para vê-las aqui.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {props.notes.map((note) => (
                  <li key={note.id} className="rounded-md border border-line bg-raised px-3 py-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-fg-accent">
                      {note.visibility !== 'members' ? <Lock className="h-3.5 w-3.5" aria-label="Privada" /> : null}
                      {note.title}
                    </p>
                    {note.body ? <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-fg-secondary">{note.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
