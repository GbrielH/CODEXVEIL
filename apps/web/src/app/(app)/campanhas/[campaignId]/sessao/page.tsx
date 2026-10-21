import { listCampaignCharacters, listCreatures, listSessionBlocks, listSessions, pickCurrentSession, resolveBlockReferences, sessionStatusLabels, signedMediaUrls } from '@codexveil/database';
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
 *   * Mestre: a sessão em andamento (ou a próxima) com toda a lore montada e um botão para
 *     liberar cada trecho aos jogadores; abaixo, o que os jogadores estão vendo.
 *   * Jogadores: os trechos liberados da sessão atual, em tempo real.
 */
export default async function SessionTabPage({ params }: PageProps<'/campanhas/[campaignId]/sessao'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const all = await listSessions(supabase, campaign.id);
  // O mestre vê também sessões ainda não publicadas; os jogadores só recebem as publicadas.
  const sessions = isGm ? all : all.filter((session) => session.isPublished);
  const session = pickCurrentSession(sessions) ?? [...sessions].sort((a, b) => b.number - a.number)[0] ?? null;

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <LiveRefresh campaignId={campaign.id} />
        </div>
        <EmptyState
          title={isGm ? 'Nenhuma sessão montada' : 'Nada liberado ainda'}
          description={isGm ? 'Crie uma sessão e escreva o roteiro; aqui você libera cada trecho aos jogadores durante o jogo.' : 'Quando o mestre liberar trechos da sessão (textos, imagens de NPCs, falas), eles aparecem aqui.'}
          action={isGm ? <ButtonLink href={campaignPath(campaign.id, '/sessoes') as Route}>Ir para as sessões</ButtonLink> : undefined}
        />
      </div>
    );
  }

  const allBlocks = await listSessionBlocks(supabase, session.id);
  const blocks = allBlocks.filter((block) => block.visibility === 'members');
  const [references, imageUrls, reveal, party, creatures] = await Promise.all([
    resolveBlockReferences(supabase, blocks),
    signedMediaUrls(
      supabase,
      blocks.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    ),
    isGm ? loadRevealBlocks(supabase, allBlocks) : Promise.resolve([]),
    listCampaignCharacters(supabase, campaign.id),
    isGm ? listCreatures(supabase, campaign.id) : Promise.resolve([]),
  ]);
  const ownCharacter = isGm ? null : (party.find((character) => character.ownerId === user.id) ?? null);

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Badge tone="parchment">Sessão {session.number}</Badge>
        {isGm ? <Badge tone={session.status === 'in_progress' ? 'brand' : 'neutral'}>{sessionStatusLabels[session.status]}</Badge> : null}
        <h2 className="min-w-0 flex-1 text-2xl leading-tight">{session.title}</h2>
        {isGm ? (
          <ButtonLink href={`${sessionPath(campaign.id, session.id)}/editar` as Route} variant="ghost" size="sm">
            Editar roteiro
          </ButtonLink>
        ) : null}
        <LiveRefresh campaignId={campaign.id} />
      </header>

      {isGm ? (
        <>
          <MapManager
            campaignId={campaign.id}
            sessionId={session.id}
            systemId={campaign.systemId}
            characters={party.map((character) => ({ id: character.id, name: character.name }))}
            creatures={creatures.map((creature) => ({ id: creature.id, name: creature.name, size: creature.size }))}
            canManage={campaign.status === 'active'}
          />
          <RevealPanel sessionId={session.id} isPublished={session.isPublished} isActive={campaign.status === 'active'} blocks={reveal} />
          <Divider label="O que os jogadores estão vendo" />
        </>
      ) : null}

      {!isGm ? <MapView campaignId={campaign.id} myCharacterId={ownCharacter?.id ?? null} /> : null}

      {blocks.length === 0 ? (
        <EmptyState
          title="Nada liberado ainda"
          description={isGm ? 'Use “Liberar” acima: o trecho aparece na hora na aba Sessão dos jogadores.' : 'O mestre ainda não liberou trechos desta sessão. Eles aparecem aqui assim que forem liberados.'}
        />
      ) : (
        blocks.map((block) => <BlockRenderer key={block.id} block={block} campaignId={campaign.id} references={references} imageUrls={imageUrls} showVisibility={false} />)
      )}
    </article>
  );
}
