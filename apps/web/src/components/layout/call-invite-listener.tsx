'use client';

import { Video, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { callPath } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Invite {
  roomId: string;
  slug: string;
  title: string;
}

/**
 * Convite para call em tempo real: quando alguém chama a pessoa para uma sala, aparece um aviso
 * no canto com o botão para entrar (em qualquer página da área logada).
 */
export function CallInviteListener() {
  const [invite, setInvite] = useState<Invite | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || !active) return;
      channel = client
        .channel(`convites-call:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_invites',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const roomId = (payload.new as { room_id?: string }).room_id;
            if (!roomId) return;
            void client
              .from('call_rooms')
              .select('slug, title, status')
              .eq('id', roomId)
              .maybeSingle()
              .then(({ data: room }) => {
                if (room && room.status === 'active')
                  setInvite({ roomId, slug: room.slug, title: room.title });
              });
          },
        )
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) void client.removeChannel(channel);
    };
  }, []);

  if (!invite) return null;
  return (
    <div
      role="alert"
      className="fixed right-4 bottom-24 z-[105] flex max-w-sm items-center gap-3 rounded-xl border border-line bg-raised p-3 shadow-2xl lg:bottom-6"
    >
      <Video className="h-5 w-5 shrink-0 text-fg-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">Chamaram você para uma call</p>
        <p className="truncate text-xs text-fg-muted">{invite.title || 'Call'}</p>
      </div>
      <Link
        href={callPath(invite.slug) as Route}
        onClick={() => setInvite(null)}
        className="rounded-md bg-wine-600 px-3 py-1.5 text-sm font-medium text-parchment-50 hover:bg-wine-500"
      >
        Entrar
      </Link>
      <button
        type="button"
        aria-label="Dispensar"
        onClick={() => setInvite(null)}
        className="rounded p-1 text-fg-muted hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
