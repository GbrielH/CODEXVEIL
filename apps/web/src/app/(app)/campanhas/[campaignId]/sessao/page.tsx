import {
  listConflictObjectives,
  listShownCards,
  listSessionBlocks,
  listSessions,
  resolveBlockReferences,
  signedMediaUrls,
  type StoredSessionBlock,
} from '@codexveil/database';
import type { Metadata, Route } from 'next';
import { RevealPanel } from '@/components/gm/reveal-panel';
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
import { ConflictObjectivesCard } from '@/components/gm/conflict-objectives';
import { ShownCards } from '@/components/assimilacao/shown-cards';

export const metadata: Metadata = { title: 'Sessão' };

/**
 * Aba Sessão.
 *   * Só a sessão **iniciada** (em andamento) aparece; sem sessão aberta, não há conteúdo.
 *     Mestre: lista para liberar trechos. Jogadores: os trechos liberados.
 *   * "Sessões anteriores": o que foi liberado em cada sessão passada, para consulta. Se o mestre
 *     ocultar um trecho depois, ele some (os jogadores só recebem blocos liberados — RLS).
 *   * O mapa (grade de combate) fica na aba Mapa.
 */
export default async function SessionTabPage({
  params,
}: PageProps<'/campanhas/[campaignId]/sessao'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const all = await listSessions(supabase, campaign.id);
  // Jogadores só recebem sessões publicadas.
  const sessions = isGm ? all : all.filter((session) => session.isPublished);
  const current = sessions.find((session) => session.status === 'in_progress') ?? null;
  const past = sessions
    .filter((session) => session.id !== current?.id && session.status === 'completed')
    .sort((a, b) => b.number - a.number);

  const [currentBlocks, pastBlocks] = await Promise.all([
    current ? listSessionBlocks(supabase, current.id) : Promise.resolve([] as StoredSessionBlock[]),
    Promise.all(past.map((session) => listSessionBlocks(supabase, session.id))),
  ]);
  const released = (blocks: StoredSessionBlock[]) =>
    blocks.filter((block) => block.visibility === 'members');
  const shownCurrent = released(currentBlocks);
  const shownPast = past
    .map((session, index) => ({ session, blocks: released(pastBlocks[index] ?? []) }))
    .filter((entry) => entry.blocks.length > 0);
  const everyBlock = [...shownCurrent, ...shownPast.flatMap((entry) => entry.blocks)];
  const [references, imageUrls, reveal] = await Promise.all([
    resolveBlockReferences(supabase, everyBlock),
    signedMediaUrls(
      supabase,
      everyBlock.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    ),
    isGm && current ? loadRevealBlocks(supabase, currentBlocks) : Promise.resolve([]),
  ]);

  return (
    <article className={`mx-auto flex w-full flex-col gap-5 ${isGm ? 'max-w-none' : 'max-w-6xl'}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        {current ? (
          <Badge tone="brand">Sessão {current.number} · em andamento</Badge>
        ) : (
          <Badge tone="neutral">Nenhuma sessão em andamento</Badge>
        )}
        <h2 className="min-w-0 flex-1 text-2xl leading-tight">{current?.title ?? 'Sessão'}</h2>
        {isGm && current ? (
          <ButtonLink
            href={`${sessionPath(campaign.id, current.id)}/editar` as Route}
            variant="ghost"
            size="sm"
          >
            Editar roteiro
          </ButtonLink>
        ) : null}
        <LiveRefresh campaignId={campaign.id} />
      </header>

      {/* Assimilação: Objetivos do Conflito ao vivo (o mestre ajusta na Mesa). */}
      {campaign.systemId === 'assimilacao' && current ? (
        <ConflictObjectivesCard
          campaignId={campaign.id}
          canManage={false}
          initial={await listConflictObjectives(supabase, campaign.id)}
        />
      ) : null}
      {campaign.systemId === 'assimilacao' && current ? (
        <ShownCards
          campaignId={campaign.id}
          initial={await listShownCards(supabase, campaign.id)}
        />
      ) : null}

      {isGm && current ? (
        <RevealPanel
          sessionId={current.id}
          isPublished={current.isPublished}
          isActive={campaign.status === 'active'}
          blocks={reveal}
        />
      ) : null}

      {current ? (
        <>
          {isGm ? <Divider label="O que os jogadores estão vendo" /> : null}
          {shownCurrent.length === 0 ? (
            <EmptyState
              title="Nada liberado ainda"
              description={
                isGm
                  ? 'Use “Liberar” acima: o trecho aparece na hora na aba Sessão dos jogadores.'
                  : 'O mestre ainda não liberou trechos desta sessão. Eles aparecem aqui assim que forem liberados.'
              }
            />
          ) : (
            shownCurrent.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                campaignId={campaign.id}
                references={references}
                imageUrls={imageUrls}
                showVisibility={false}
              />
            ))
          )}
        </>
      ) : (
        <EmptyState
          title="Nenhuma sessão em andamento"
          description={
            isGm
              ? 'Inicie uma sessão em Sessões para liberar trechos aos jogadores. Os mapas podem ser preparados na aba Mapa.'
              : 'Quando o mestre iniciar a sessão, o que ele liberar aparece aqui.'
          }
          action={
            isGm ? (
              <ButtonLink href={campaignPath(campaign.id, '/sessoes') as Route}>
                Ir para as sessões
              </ButtonLink>
            ) : undefined
          }
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
                <span className="ml-2 text-xs text-fg-muted">
                  ({blocks.length} {blocks.length === 1 ? 'trecho' : 'trechos'})
                </span>
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                {blocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    campaignId={campaign.id}
                    references={references}
                    imageUrls={imageUrls}
                    showVisibility={false}
                  />
                ))}
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </article>
  );
}
