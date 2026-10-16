import { listSessions, sessionStatusLabels } from '@codexveil/database';
import { CalendarClock, EyeOff, NotebookPen, ScrollText } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { formatDateTime } from '@/lib/format';
import { sessionPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewSessionForm } from './new-session-form';

export const metadata: Metadata = { title: 'Sessões' };

export default async function SessionsPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/sessoes'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const sessions = await listSessions(supabase, campaign.id);
  const isGm = campaign.role === 'gm';
  const canManage = isGm && campaign.status === 'active';
  const nextNumber = (sessions[0]?.number ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <Notice value={query.aviso} />
      <div className={canManage ? 'grid gap-6 lg:grid-cols-[1fr_22rem]' : 'flex flex-col gap-6'}>
        <section aria-labelledby="lista-sessoes" className="flex flex-col gap-4">
          <h2 id="lista-sessoes" className="text-xl">
            Sessões
          </h2>
          {sessions.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-8 w-8" aria-hidden="true" />}
              title={isGm ? 'Nenhuma sessão ainda' : 'Nenhuma sessão publicada'}
              description={
                isGm
                  ? 'Crie a primeira sessão para preparar o roteiro por blocos.'
                  : 'Quando o mestre publicar uma sessão, ela aparecerá aqui com o resumo e as informações liberadas.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={sessionPath(campaign.id, session.id) as Route}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card transition-colors hover:border-parchment-400/40 hover:bg-raised sm:flex-row sm:items-center"
                  >
                    <span className="tabular flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-parchment-400/30 bg-wine-950 font-display text-lg text-parchment-200">
                      {session.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg text-fg-accent">{session.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                        {session.scheduledAt ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDateTime(session.scheduledAt)}
                          </span>
                        ) : (
                          <span>Sem data</span>
                        )}
                        {session.recap ? <span className="line-clamp-1">{session.recap}</span> : null}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={session.status === 'in_progress' ? 'brand' : session.status === 'completed' ? 'neutral' : 'parchment'}>
                        {sessionStatusLabels[session.status]}
                      </Badge>
                      {isGm && !session.isPublished ? (
                        <Badge tone="warning" icon={<EyeOff className="h-3 w-3" aria-hidden="true" />}>
                          Não publicada
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {canManage ? (
          <aside>
            <Card ornate>
              <CardHeader icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />} title="Nova sessão" description={`Será a sessão nº ${nextNumber}.`} />
              <NewSessionForm campaignId={campaign.id} suggestedTitle={`Sessão ${nextNumber}`} />
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
