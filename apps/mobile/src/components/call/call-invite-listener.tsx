import { listMyCallInvites, subscribeToChanges } from '@codexveil/database';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import { getSupabase } from '@/lib/supabase';

/**
 * Convite para call em tempo real no app: aviso na tela com o nome e o código da sala; o convite
 * fica na aba Call.
 */
export function CallInviteListener({ userId }: { userId: string }) {
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const client = getSupabase();
    const check = () =>
      void listMyCallInvites(client, userId)
        .then((invites) => {
          const known = seen.current;
          seen.current = new Set(invites.map((invite) => invite.roomId));
          if (!known) return;
          const fresh = invites.find((invite) => !known.has(invite.roomId));
          if (fresh) {
            toast({
              tone: 'info',
              title: 'Chamaram você para uma call',
              description: `${fresh.title || 'Call'} · código ${fresh.code}. Entre pela aba Call.`,
            });
          }
        })
        .catch(() => undefined);
    check();
    return subscribeToChanges(
      client,
      `convites-call:${userId}`,
      [{ table: 'call_invites', filter: `user_id=eq.${userId}` }],
      { onChange: check },
    );
  }, [userId, toast]);
  return null;
}
