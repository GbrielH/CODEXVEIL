'use client';

import { createCharacterAbility, type CharacterAbility, type Json } from '@codexveil/database';
import type { AbilityEntryTemplate } from '@codexveil/rpg-systems';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface PendingUpdateView {
  id: string;
  title: string;
  description: string;
  abilities: AbilityEntryTemplate[];
}

const dismissKey = (characterId: string) => `codexveil:pendencias-dispensadas:${characterId}`;

function readDismissed(characterId: string): string[] {
  try {
    const stored = window.localStorage.getItem(dismissKey(characterId));
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Aviso ao abrir a ficha quando uma atualização do Codexveil acrescentou algo que o personagem
 * (criado antes) ainda não tem. Vale para qualquer sistema: cada um lista as próprias pendências.
 */
export function PendingUpdatesModal({
  characterId,
  enabled,
  updates,
  onCreated,
}: {
  characterId: string;
  /** Só o dono, com permissão de editar a ficha. */
  enabled: boolean;
  updates: PendingUpdateView[];
  onCreated: (created: CharacterAbility[]) => void;
}) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readDismissed(characterId),
  );
  const [busy, setBusy] = useState(false);
  const pending = updates.filter((update) => !dismissed.includes(update.id));
  const open = enabled && pending.length > 0;

  const dismiss = () => {
    const next = [...new Set([...dismissed, ...pending.map((update) => update.id)])];
    setDismissed(next);
    try {
      window.localStorage.setItem(dismissKey(characterId), JSON.stringify(next));
    } catch {
      // Sem armazenamento: o aviso volta na próxima vez.
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const created: CharacterAbility[] = [];
      for (const update of pending)
        for (const entry of update.abilities)
          created.push(
            await createCharacterAbility(client, characterId, {
              kind: entry.kind,
              name: entry.name,
              source: entry.source,
              description: entry.description,
              data: (entry.data ?? {}) as Json,
              resourceId: null,
            }),
          );
      onCreated(created);
      toast({ tone: 'success', title: 'Ficha atualizada.' });
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar a ficha',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={dismiss} title="Sua ficha tem novidades" busy={busy}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-secondary">
          O Codexveil recebeu atualizações que acrescentam informações a personagens criados antes
          delas. Confira e aplique:
        </p>
        <ul className="flex flex-col gap-3">
          {pending.map((update) => (
            <li key={update.id} className="flex gap-3 rounded-lg border border-line bg-raised p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fg-brand" aria-hidden="true" />
              <div>
                <p className="font-medium text-fg">{update.title}</p>
                <p className="text-sm text-fg-muted">{update.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={dismiss}>
            Agora não
          </Button>
          <Button disabled={busy} onClick={() => void apply()}>
            Aplicar na ficha
          </Button>
        </div>
      </div>
    </Modal>
  );
}
