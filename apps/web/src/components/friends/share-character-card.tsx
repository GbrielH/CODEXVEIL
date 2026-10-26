'use client';

import { listCharacterShares, listFriends, shareCharacter, unshareCharacter, type Friend } from '@codexveil/database';
import { Share2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** O dono escolhe quais amigos podem ver a ficha (só leitura). */
export function ShareCharacterCard({ characterId, ownerId }: { characterId: string; ownerId: string }) {
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    Promise.all([listFriends(client, ownerId), listCharacterShares(client, characterId)])
      .then(([list, shares]) => {
        setFriends(list.filter((friend) => friend.status === 'accepted'));
        setShared(new Set(shares));
      })
      .catch(() => setFriends([]));
  }, [characterId, ownerId]);

  const toggle = async (friend: Friend) => {
    const on = shared.has(friend.userId);
    setBusy(friend.userId);
    try {
      const client = getSupabaseBrowserClient();
      if (on) await unshareCharacter(client, characterId, friend.userId);
      else await shareCharacter(client, characterId, friend.userId);
      setShared((current) => {
        const next = new Set(current);
        if (on) next.delete(friend.userId);
        else next.add(friend.userId);
        return next;
      });
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Não foi possível alterar o compartilhamento.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Share2 className="h-5 w-5" aria-hidden="true" />}
        title="Compartilhar com amigos"
        description="Amigos marcados veem a ficha, sem poder editar. Desmarque quando quiser."
      />
      {friends === null ? (
        <p className="text-sm text-fg-muted">Carregando…</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nenhum amigo ainda.{' '}
          <Link href={routes.friends} className="text-fg-brand underline-offset-2 hover:underline">
            Adicionar amigos
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {friends.map((friend) => (
            <li key={friend.userId}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <Avatar name={friend.displayName} icon={friend.avatarIcon} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{friend.displayName}</span>
                <input
                  type="checkbox"
                  checked={shared.has(friend.userId)}
                  disabled={busy === friend.userId}
                  onChange={() => void toggle(friend)}
                  className="h-5 w-5 accent-[var(--color-fg-brand)]"
                  aria-label={`Compartilhar com ${friend.displayName}`}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
