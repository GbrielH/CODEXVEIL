'use client';

import { createBoard, deleteBoard, updateBoard, type BoardSummary } from '@codexveil/database';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Lista de quadros da campanha: o mestre cria, renomeia, mostra ao grupo e apaga. */
export function BoardManager({
  campaignId,
  boards,
  activeId,
  canManage,
}: {
  campaignId: string;
  boards: BoardSummary[];
  activeId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const active = boards.find((board) => board.id === activeId);
  const href = (id: string) => `/campanhas/${campaignId}/quadros?quadro=${id}` as Route;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      router.refresh();
    } catch (cause) {
      toast({ tone: 'danger', title: failureMessage(cause, 'Não foi possível alterar o quadro.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-wrap items-center gap-2" aria-label="Quadros">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={href(board.id)}
            aria-current={board.id === activeId ? 'page' : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-fg-secondary hover:bg-hover aria-[current=page]:border-fg-brand aria-[current=page]:text-fg"
          >
            {board.title}
            {canManage && board.visible ? <Eye className="h-3.5 w-3.5" aria-label="Visível ao grupo" /> : null}
          </Link>
        ))}
        {canManage ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() =>
              void run(async () => {
                const id = await createBoard(getSupabaseBrowserClient(), campaignId, `Quadro ${boards.length + 1}`);
                router.push(href(id));
              })
            }
          >
            Novo quadro
          </Button>
        ) : null}
      </nav>

      {canManage && active ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={active.id}
            aria-label="Nome do quadro"
            defaultValue={active.title}
            maxLength={80}
            onBlur={(event) => {
              const title = event.target.value.trim();
              if (title && title !== active.title) void run(() => updateBoard(getSupabaseBrowserClient(), active.id, { title }));
            }}
            className="h-9 min-w-48 rounded-md border border-line bg-surface px-3 text-sm text-fg"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            icon={active.visible ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void run(() => updateBoard(getSupabaseBrowserClient(), active.id, { visible: !active.visible }))}
          >
            {active.visible ? 'Visível ao grupo' : 'Só o mestre vê'}
          </Button>
          <ConfirmDialog
            trigger={(open) => (
              <Button size="sm" variant="ghost" disabled={busy} onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                Apagar quadro
              </Button>
            )}
            title="Apagar o quadro?"
            description="Todos os blocos dele somem. Não dá para desfazer."
            confirmLabel="Apagar"
            onConfirm={() =>
              run(async () => {
                await deleteBoard(getSupabaseBrowserClient(), active.id);
                router.push(`/campanhas/${campaignId}/quadros` as Route);
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
