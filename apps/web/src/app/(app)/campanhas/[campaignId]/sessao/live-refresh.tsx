'use client';

import { useRouter } from 'next/navigation';
import { LiveBadge } from '@/components/ui/save-status';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/** Recarrega a aba Sessão quando o mestre libera ou oculta um trecho. */
export function LiveRefresh({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const status = useRealtimeRefresh(
    `sessao:${campaignId}`,
    [
      { table: 'session_blocks', filter: `campaign_id=eq.${campaignId}` },
      { table: 'sessions', filter: `campaign_id=eq.${campaignId}` },
    ],
    () => router.refresh(),
  );
  return <LiveBadge status={status} />;
}
