'use client';

import { setMyAttendance, type AttendanceStatus } from '@codexveil/database';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** O jogador confirma ou recusa a presença numa sessão agendada. */
export function AttendanceButtons({ sessionId, campaignId, userId, initial }: { sessionId: string; campaignId: string; userId: string; initial: AttendanceStatus | null }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AttendanceStatus | null>(initial);
  const [busy, setBusy] = useState(false);
  const answer = async (next: AttendanceStatus) => {
    setBusy(true);
    try {
      await setMyAttendance(getSupabaseBrowserClient(), sessionId, campaignId, userId, next);
      setStatus(next);
      toast({ tone: 'success', title: next === 'yes' ? 'Presença confirmada.' : 'Ausência avisada ao mestre.' });
    } catch (error) {
      toast({ tone: 'danger', title: 'A resposta não foi salva', description: failureMessage(error, 'Tente novamente.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar presença">
      <span className="text-xs text-fg-muted">{status === 'yes' ? 'Você confirmou presença.' : status === 'no' ? 'Você avisou que não vai.' : 'Você vai?'}</span>
      <Button size="sm" variant={status === 'yes' ? 'primary' : 'secondary'} icon={<Check className="h-4 w-4" aria-hidden="true" />} disabled={busy} aria-pressed={status === 'yes'} onClick={() => void answer('yes')}>
        Vou
      </Button>
      <Button size="sm" variant={status === 'no' ? 'danger' : 'ghost'} icon={<X className="h-4 w-4" aria-hidden="true" />} disabled={busy} aria-pressed={status === 'no'} onClick={() => void answer('no')}>
        Não vou
      </Button>
    </div>
  );
}
