'use client';

import { deleteCharacterDraft, saveCharacterDraft } from '@codexveil/database';
import { Save } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Salva a criação do personagem como rascunho na conta (mesmo incompleta) para continuar depois,
 * em qualquer aparelho. O rascunho aparece em "Personagens" e some ao criar o personagem.
 */
export function SaveDraftButton({
  systemId,
  campaignId,
  name,
  draftId,
  onSaved,
  getPayload,
}: {
  systemId: string;
  campaignId: string | null;
  name: string;
  draftId: string | null;
  onSaved: (id: string) => void;
  getPayload: () => unknown;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const id = await saveCharacterDraft(getSupabaseBrowserClient(), {
        draftId,
        systemId,
        campaignId,
        name: name || 'Personagem sem nome',
        payload: getPayload(),
      });
      onSaved(id);
      if (params.get('rascunho') !== id) {
        const next = new URLSearchParams(params.toString());
        next.set('rascunho', id);
        router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false });
      }
      toast({
        tone: 'success',
        title: 'Rascunho salvo.',
        description: 'Continue depois em Personagens.',
      });
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'O rascunho não foi salvo',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      variant="secondary"
      icon={<Save className="h-4 w-4" aria-hidden="true" />}
      onClick={() => void save()}
      loading={busy}
    >
      Salvar rascunho
    </Button>
  );
}

/** Depois de criar o personagem, o rascunho de onde ele veio não serve mais. */
export async function discardDraftAfterCreate(draftId: string | null) {
  if (!draftId) return;
  try {
    await deleteCharacterDraft(getSupabaseBrowserClient(), draftId);
  } catch {
    // Fica na lista; o jogador pode apagar à mão.
  }
}
