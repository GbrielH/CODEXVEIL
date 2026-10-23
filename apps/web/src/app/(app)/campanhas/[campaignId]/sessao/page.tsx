import { listCampaignCharacters, listCreatures, listSessionBlocks, listSessions, resolveBlockReferences, signedMediaUrls, type StoredSessionBlock } from '@codexveil/database';
import type { Metadata, Route } from 'next';
import { RevealPanel } from '@/components/gm/reveal-panel';
import { MapManager } from '@/components/map/map-manager';
import { MapView } from '@/components/map/map-view';
import { BlockRenderer } from '@/components/sessions/block-renderer';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Divider } from '@/components/ui/divider';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { loadRevealBlocks } from '@/lib/reveal-blocks';
import { campaignPath, sessionPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LiveRefresh } from './live-refresh';

export const metadata: Metadata = { title: 'Sessão' };

/**
 * Aba Sessão.
 *   * Só a sessão **iniciada** (em andamento) aparece; sem sessão aberta, não há conteúdo.
 *     Mestre: lista para liberar trechos e o mapa. Jogadores: os trechos liberados e o mapa ativo.
 *   * "Sessões anteriores": o que foi liberado em cada sessão passada, para consulta. Se o mestre
 *     ocultar um trecho depois, ele some (os jogadores só recebem blocos liberados — RLS).
 *   * O mestre mantém o editor de mapas sempre à mão, para preparar cenários antes da sessão.
 */
export default async function SessionTabPage({ params }: PageProps<'/campanhas/[campaignId]/sessao'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const all = await listSessions(supabase, campaign.id);
  // Jogadores só recebem sessões publicadas.
  const sessions = isGm ? all : all.filter((session) => session.isPublished);
  const current = sessions.find((session) => session.status === 'in_progress') ?? null;
  const past = sessions.filter((session) => session.id !== current?.id && session.status === 'completed').sort((a, b) => b.number - a.number);

  const [currentBlocks, pastBlocks, party, creatures] = await Promise.all([
    current ? listSessionBlocks(supabase, current.id) : Promise.resolve([] as StoredSessionBlock[]),
    Promise.all(past.map((session) => listSessionBlocks(supabase, session.id))),
    listCampaignCharacters(supabase, campaign.id),
    isGm ? listCreatures(supabase, campaign.id) : Promise.resolve([]),
  ]);
  const released = (blocks: StoredSessionBlock[]) => blocks.filter((block) => block.visibility === 'members');
  const shownCurrent = released(currentBlocks);
  const shownPast = past.map((session, index) => ({ session, blocks: released(pastBlocks[index] ?? []) })).filter((entry) => entry.blocks.length > 0);
  const everyBlock = [...shownCurrent, ...shownPast.flatMap((entry) => entry.blocks)];
  const [references, imageUrls, reveal] = await Promise.all([
    resolveBlockReferences(supabase, everyBlock),
    signedMediaUrls(
      supabase,
      everyBlock.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    ),
    isGm && current ? loadRevealBlocks(supabase, currentBlocks) : Promise.resolve([]),
  ]);
  const ownCharacter = isGm ? null : (party.find((character) => character.ownerId === user.id) ?? null);
  // Sessão de referência do editor de mapas do mestre (a iniciada, senão a mais recente).
  const mapSession = current ?? [...all].sort((a, b) => b.number - a.number)[0] ?? null;

  return (
    <article className={`mx-auto flex w-full flex-col gap-5 ${isGm ? 'max-w-none' : 'max-w-6xl'}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        {current ? <Badge tone="brand">Sessão {current.number} · em andamento</Badge> : <Badge tone="neutral">Nenhuma sessão em andamento</Badge>}
        <h2 className="min-w-0 flex-1 text-2xl leading-tight">{current?.title ?? 'Sessão'}</h2>
        {isGm && current ? (
          <ButtonLink href={`${sessionPath(campaign.id, current.id)}/editar` as Route} variant="ghost" size="sm">
            Editar roteiro
          </ButtonLink>
        ) : null}
        <LiveRefresh campaignId={campaign.id} />
      </header>

      {isGm && current ? (
        <RevealPanel sessionId={current.id} isPublished={current.isPublished} isActive={campaign.status === 'active'} blocks={reveal} />
      ) : null}

      {isGm && mapSession ? (
        <MapManager
          campaignId={campaign.id}
          sessions={all.map((entry) => ({ id: entry.id, number: entry.number, title: entry.title }))}
          sessionId={mapSession.id}
          systemId={campaign.systemId}
          characters={party.map((character) => ({ id: character.id, name: character.name }))}
          creatures={creatures.map((creature) => ({ id: creature.id, name: creature.name, size: creature.size }))}
          canManage={campaign.status === 'active'}
        />
      ) : null}
      {!isGm && current ? <MapView campaignId={campaign.id} systemId={campaign.systemId} myCharacterId={ownCharacter?.id ?? null} /> : null}

      {current ? (
        <>
          {isGm ? <Divider label="O que os jogadores estão vendo" /> : null}
          {shownCurrent.length === 0 ? (
            <EmptyState
              title="Nada liberado ainda"
              description={isGm ? 'Use “Liberar” acima: o trecho aparece na hora na aba Sessão dos jogadores.' : 'O mestre ainda não liberou trechos desta sessão. Eles aparecem aqui assim que forem liberados.'}
            />
          ) : (
            shownCurrent.map((block) => <BlockRenderer key={block.id} block={block} campaignId={campaign.id} references={references} imageUrls={imageUrls} showVisibility={false} />)
          )}
        </>
      ) : (
        <EmptyState
          title="Nenhuma sessão em andamento"
          description={
            isGm
              ? 'Inicie uma sessão em Sessões para liberar trechos aos jogadores. Os mapas podem ser preparados acima.'
              : 'Quando o mestre iniciar a sessão, o que ele liberar aparece aqui.'
          }
          action={isGm ? <ButtonLink href={campaignPath(campaign.id, '/sessoes') as Route}>Ir para as sessões</ButtonLink> : undefined}
        />
      )}

      {shownPast.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="sessoes-anteriores">
          <Divider label="Sessões anteriores" />
          <p id="sessoes-anteriores" className="text-sm text-fg-muted">
            O que foi liberado em cada sessão, para consulta.
          </p>
          {shownPast.map(({ session, blocks }) => (
            <details key={session.id} className="group rounded-lg border border-line bg-card p-4">
              <summary className="cursor-pointer list-none font-display text-lg text-fg">
                Sessão {session.number} · {session.title}
                <span className="ml-2 text-xs text-fg-muted">({blocks.length} {blocks.length === 1 ? 'trecho' : 'trechos'})</span>
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                {blocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} campaignId={campaign.id} references={references} imageUrls={imageUrls} showVisibility={false} />
                ))}
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </article>
  );
}
