'use client';

import { deleteCharacterDraft, type CharacterDraftSummary } from '@codexveil/database';
import { FilePen, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { formatDateTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const SYSTEM_NAMES: Record<string, string> = { dnd5e: 'D&D 5e', tormenta20: 'Tormenta20' };

/** Endereço do assistente com o rascunho (mesma campanha ou ficha pessoal do mesmo sistema). */
function continueHref(draft: CharacterDraftSummary): Route {
  const params = new URLSearchParams(
    draft.campaignId ? { campanha: draft.campaignId } : { sistema: draft.systemId },
  );
  params.set('rascunho', draft.id);
  return `${routes.newCharacter}?${params.toString()}` as Route;
}

/** Criações salvas incompletas ("Salvar rascunho"): continuar ou apagar. */
export function DraftList({ drafts }: { drafts: CharacterDraftSummary[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [removing, setRemoving] = useState<string | null>(null);
  if (drafts.length === 0) return null;
  const remove = async (draft: CharacterDraftSummary) => {
    setRemoving(draft.id);
    try {
      await deleteCharacterDraft(getSupabaseBrowserClient(), draft.id);
      toast({ tone: 'success', title: 'Rascunho apagado.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'O rascunho não foi apagado',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setRemoving(null);
    }
  };
  return (
    <Card>
      <CardHeader
        icon={<FilePen className="h-5 w-5" aria-hidden="true" />}
        title="Rascunhos"
        description="Personagens que você começou a criar e salvou para terminar depois."
      />
      <ul className="divide-y divide-line">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">{draft.name || 'Personagem sem nome'}</p>
              <p className="text-xs text-fg-muted">
                {SYSTEM_NAMES[draft.systemId] ?? draft.systemId} ·{' '}
                {draft.campaignName ?? 'Ficha pessoal'} · salvo em {formatDateTime(draft.updatedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={continueHref(draft)}
                className="inline-flex items-center rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:border-wine-400/50 hover:bg-hover"
              >
                Continuar
              </Link>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                loading={removing === draft.id}
                onClick={() => void remove(draft)}
              >
                Apagar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
