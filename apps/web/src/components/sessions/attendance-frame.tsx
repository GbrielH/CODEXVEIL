'use client';

import { setMyAttendance, type AttendanceStatus } from '@codexveil/database';
import { Check, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const BORDER: Record<'yes' | 'no' | 'none', string> = {
  yes: '#34d399',
  no: '#f87171',
  none: '#fbbf24',
};

/**
 * Sessão agendada no Painel com a resposta de presença: borda verde (vou), vermelha (não vou) ou
 * amarela (sem resposta). Respondida, mostra só a resposta e "Mudar".
 */
export function AttendanceFrame({
  sessionId,
  campaignId,
  userId,
  initial,
  children,
}: {
  sessionId: string;
  campaignId: string;
  userId: string;
  initial: AttendanceStatus | null;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AttendanceStatus | null>(initial);
  const [editing, setEditing] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const answer = async (next: AttendanceStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      await setMyAttendance(getSupabaseBrowserClient(), sessionId, campaignId, userId, next);
      setStatus(next);
      setEditing(false);
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
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border-2 px-3 py-2"
      style={{ borderColor: BORDER[status ?? 'none'] }}
    >
      {children}
      {editing ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Confirmar presença"
        >
          <span className="text-xs text-fg-muted">Você vai?</span>
          <Button
            size="sm"
            variant={status === 'yes' ? 'primary' : 'secondary'}
            icon={<Check className="h-4 w-4" aria-hidden="true" />}
            disabled={busy}
            onClick={() => void answer('yes')}
          >
            Vou
          </Button>
          <Button
            size="sm"
            variant={status === 'no' ? 'danger' : 'ghost'}
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            disabled={busy}
            onClick={() => void answer('no')}
          >
            Não vou
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs">
          <span style={{ color: BORDER[status ?? 'none'] }}>
            {status === 'yes' ? 'Você vai.' : 'Você não vai.'}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Mudar
          </button>
        </p>
      )}
    </div>
  );
}
