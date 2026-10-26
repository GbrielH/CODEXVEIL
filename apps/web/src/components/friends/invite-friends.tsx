'use client';

import { inviteFriendToCampaign, type Friend } from '@codexveil/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Convite direto para amigos: o convite aparece no painel deles, sem código. */
export function InviteFriends({ campaignId, friends, memberIds }: { campaignId: string; friends: Friend[]; memberIds: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const members = new Set(memberIds);
  const list = friends.filter((friend) => friend.status === 'accepted');

  if (list.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Você ainda não tem amigos adicionados.{' '}
        <Link href={routes.friends} className="text-fg-brand underline-offset-2 hover:underline">
          Adicionar amigos
        </Link>
      </p>
    );
  }

  const invite = async (friend: Friend) => {
    setBusy(friend.userId);
    try {
      await inviteFriendToCampaign(getSupabaseBrowserClient(), campaignId, friend.userId);
      setSent((current) => new Set(current).add(friend.userId));
      toast({ tone: 'success', title: `Convite enviado para ${friend.displayName}.` });
      router.refresh();
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Não foi possível convidar.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="divide-y divide-line">
      {list.map((friend) => (
        <li key={friend.userId} className="flex items-center gap-3 py-2.5">
          <Avatar name={friend.displayName} icon={friend.avatarIcon} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm text-fg">{friend.displayName}</span>
          {members.has(friend.userId) ? (
            <span className="text-xs text-fg-muted">Já participa</span>
          ) : sent.has(friend.userId) ? (
            <span className="text-xs text-success">Convidado</span>
          ) : (
            <Button size="sm" variant="secondary" loading={busy === friend.userId} onClick={() => void invite(friend)}>
              Convidar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
