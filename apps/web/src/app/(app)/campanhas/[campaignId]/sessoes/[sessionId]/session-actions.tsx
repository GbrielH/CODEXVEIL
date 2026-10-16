'use client';

import type { SessionStatus } from '@codexveil/database';
import { CheckCheck, Copy, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { sessionPath } from '@/lib/routes';
import { deleteSessionAction, duplicateSessionAction, setSessionStatusAction } from '../actions';

interface SessionActionsProps {
  campaignId: string;
  sessionId: string;
  title: string;
  status: SessionStatus;
}

/** Controles do mestre para a sessão (status, edição, duplicação e exclusão). */
export function SessionActions({ campaignId, sessionId, title, status }: SessionActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const changeStatus = (next: SessionStatus) =>
    startTransition(async () => {
      const result = await setSessionStatusAction(campaignId, sessionId, next);
      if (!result.ok) {
        toast({ tone: 'danger', title: 'Não foi possível alterar a sessão', description: result.message });
        return;
      }
      toast({ tone: 'success', title: result.message ?? 'Sessão atualizada.' });
      router.refresh();
    });

  const throwOnFailure = async (action: () => Promise<{ ok: boolean; message?: string }>) => {
    const result = await action();
    if (!result.ok) throw new Error(result.message ?? 'Não foi possível concluir.');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={sessionPath(campaignId, sessionId, '/editar') as Route} icon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
        Editar roteiro
      </ButtonLink>
      {status === 'planned' ? (
        <Button variant="secondary" loading={pending} onClick={() => changeStatus('in_progress')} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
          Iniciar sessão
        </Button>
      ) : null}
      {status === 'in_progress' ? (
        <Button variant="secondary" loading={pending} onClick={() => changeStatus('completed')} icon={<CheckCheck className="h-4 w-4" aria-hidden="true" />}>
          Concluir sessão
        </Button>
      ) : null}
      {status === 'completed' ? (
        <Button variant="ghost" loading={pending} onClick={() => changeStatus('planned')} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
          Reabrir
        </Button>
      ) : null}
      <ConfirmDialog
        trigger={(open) => (
          <Button variant="ghost" onClick={open} icon={<Copy className="h-4 w-4" aria-hidden="true" />}>
            Duplicar
          </Button>
        )}
        title="Duplicar esta sessão?"
        description="A cópia leva todos os blocos do roteiro (inclusive os privados) e nasce planejada e não publicada."
        confirmLabel="Duplicar"
        tone="primary"
        onConfirm={() => throwOnFailure(() => duplicateSessionAction(campaignId, sessionId))}
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button variant="danger" onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
            Excluir
          </Button>
        )}
        title={`Excluir “${title}”?`}
        description="A sessão, o roteiro, a cena e os combates registrados nela serão apagados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir sessão"
        requireText={title}
        onConfirm={() => throwOnFailure(() => deleteSessionAction(campaignId, sessionId))}
      />
    </div>
  );
}
