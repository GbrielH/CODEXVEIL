'use client';

import { acceptFriend, removeFriend, type Friend } from '@codexveil/database';
import { Check, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Pedidos de amizade recebidos, no Painel: aceitar ou recusar sem sair da página. */
export function FriendRequestsCard({ requests }: { requests: Friend[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0) return null;

  const run = async (key: string, task: () => Promise<void>, message?: string) => {
    setBusy(key);
    try {
      await task();
      if (message) toast({ tone: 'success', title: message });
      router.refresh();
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Não foi possível responder ao pedido.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="pedidos-amizade">
      <Card ornate>
        <CardHeader
          icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
          title={<span id="pedidos-amizade">Pedidos de amizade</span>}
          description={
            <>
              Amigos podem convidar você direto para campanhas e compartilhar fichas.{' '}
              <Link href={routes.friends} className="text-fg-brand underline-offset-2 hover:underline">
                Ver amigos
              </Link>
            </>
          }
        />
        <ul className="divide-y divide-line">
          {requests.map((request) => (
            <li key={request.friendshipId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={request.displayName} icon={request.avatarIcon} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{request.displayName}</span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  loading={busy === request.friendshipId}
                  disabled={busy !== null}
                  icon={<Check className="h-4 w-4" aria-hidden="true" />}
                  onClick={() =>
                    void run(request.friendshipId, () => acceptFriend(getSupabaseBrowserClient(), request.friendshipId), 'Agora vocês são amigos!')
                  }
                >
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  icon={<X className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void run(`x-${request.friendshipId}`, () => removeFriend(getSupabaseBrowserClient(), request.friendshipId))}
                >
                  Recusar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
