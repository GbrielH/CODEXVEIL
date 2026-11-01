import { callsEnabled } from '@/lib/env';
import { notFound } from 'next/navigation';
import { listMyCallInvites, listMyCallRooms, listMyCampaigns } from '@codexveil/database';
import { Video } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import { callPath, routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CallStart } from './call-start';

export const metadata: Metadata = { title: 'Call' };

/** Aba Call: criar sala (com link e código), entrar por código e as salas e convites recentes. */
export default async function CallPage() {
  if (!callsEnabled()) notFound();
  const user = await requireSessionUser(routes.call);
  const supabase = await createSupabaseServerClient();
  const [campaigns, rooms, invites] = await Promise.all([
    listMyCampaigns(supabase, user.id),
    listMyCallRooms(supabase).catch(() => []),
    listMyCallInvites(supabase, user.id).catch(() => []),
  ]);
  const active = rooms.filter((room) => room.status === 'active');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Mesa"
        title="Call"
        description="Voz e vídeo dentro do Codexveil: a sala sabe quem é o mestre e o personagem de cada jogador."
      />
      <CallStart
        campaigns={campaigns
          .filter((campaign) => campaign.status === 'active')
          .map((campaign) => ({ id: campaign.id, name: campaign.name }))}
      />
      {invites.length ? (
        <Card ornate>
          <CardHeader
            title="Convites para você"
            description="Chamados para salas que ainda estão abertas."
          />
          <ul className="flex flex-col divide-y divide-line">
            {invites.map((invite) => (
              <li key={invite.roomId}>
                <Link
                  href={callPath(invite.slug) as Route}
                  className="flex items-center justify-between gap-3 py-2 text-sm hover:text-fg-accent"
                >
                  <span>{invite.title || 'Call'}</span>
                  <span className="font-mono text-xs text-fg-muted">{invite.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {active.length ? (
        <Card>
          <CardHeader
            icon={<Video className="h-5 w-5" aria-hidden="true" />}
            title="Salas abertas"
            description="Salas suas ou em que você entrou e que ainda não foram encerradas."
          />
          <ul className="flex flex-col divide-y divide-line">
            {active.map((room) => (
              <li key={room.id}>
                <Link
                  href={callPath(room.slug) as Route}
                  className="flex items-center justify-between gap-3 py-2 text-sm hover:text-fg-accent"
                >
                  <span>{room.title || 'Call'}</span>
                  <span className="font-mono text-xs text-fg-muted">{room.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
