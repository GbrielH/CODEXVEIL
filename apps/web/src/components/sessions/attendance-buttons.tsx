'use client';

import { setMyAttendance, type AttendanceStatus } from '@codexveil/database';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** O jogador confirma ou recusa a presença numa sessão agendada. */
export function AttendanceButtons({
  sessionId,
  campaignId,
  userId,
  initial,
}: {
  sessionId: string;
  campaignId: string;
  userId: string;
  initial: AttendanceStatus | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<AttendanceStatus | null>(initial);
  const [busy, setBusy] = useState(false);
  // Respondida, mostra só a resposta e "Mudar" (os botões voltam ao mudar).
  const [editing, setEditing] = useState(initial === null);
  const answer = async (next: AttendanceStatus) => {
    setBusy(true);
    try {
      await setMyAttendance(getSupabaseBrowserClient(), sessionId, campaignId, userId, next);
      setStatus(next);
      setEditing(false);
      router.refresh();
      toast({
        tone: 'success',
        title: next === 'yes' ? 'Presença confirmada.' : 'Ausência avisada ao mestre.',
      });
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'A resposta não foi salva',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };
  if (!editing && status) {
    return (
      <p className="flex items-center gap-2 text-xs">
        <span className={status === 'yes' ? 'text-verdigris-300' : 'text-ember-300'}>
          {status === 'yes' ? 'Você confirmou presença.' : 'Você avisou que não vai.'}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          Mudar
        </button>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar presença">
      <span className="text-xs text-fg-muted">
        {status === 'yes'
          ? 'Você confirmou presença.'
          : status === 'no'
            ? 'Você avisou que não vai.'
            : 'Você vai?'}
      </span>
      <Button
        size="sm"
        variant={status === 'yes' ? 'primary' : 'secondary'}
        icon={<Check className="h-4 w-4" aria-hidden="true" />}
        disabled={busy}
        aria-pressed={status === 'yes'}
        onClick={() => void answer('yes')}
      >
        Vou
      </Button>
      <Button
        size="sm"
        variant={status === 'no' ? 'danger' : 'ghost'}
        icon={<X className="h-4 w-4" aria-hidden="true" />}
        disabled={busy}
        aria-pressed={status === 'no'}
        onClick={() => void answer('no')}
      >
        Não vou
      </Button>
    </div>
  );
}
