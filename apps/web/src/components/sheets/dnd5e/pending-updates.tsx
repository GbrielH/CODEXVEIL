'use client';

import { createCharacterAbility, type Json } from '@codexveil/database';
import { listDnd5ePendingUpdates } from '@codexveil/rpg-systems/dnd5e';
import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

const DISMISS_KEY = (characterId: string) => `codexveil:pendencias-dispensadas:${characterId}`;

function readDismissed(characterId: string): string[] {
  try {
    const stored = window.localStorage.getItem(DISMISS_KEY(characterId));
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Aviso ao abrir a ficha quando uma atualização do Codexveil acrescentou algo que este
 * personagem (criado antes) ainda não tem. O dono aplica com um toque ou deixa para depois.
 */
export function PendingUpdatesDialog() {
  const { character, permissions, sheet, abilities, setAbilities, run } = useSheet();
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readDismissed(character.id),
  );
  const [busy, setBusy] = useState(false);
  const pending = useMemo(
    () =>
      listDnd5ePendingUpdates(
        sheet,
        abilities.map((entry) => entry.name),
      ).filter((update) => !dismissed.includes(update.id)),
    [sheet, abilities, dismissed],
  );
  const open = permissions.isOwner && permissions.canEditSheet && pending.length > 0;

  const dismiss = (ids: string[]) => {
    const next = [...new Set([...dismissed, ...ids])];
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY(character.id), JSON.stringify(next));
    } catch {
      // Sem armazenamento: o aviso volta na próxima vez.
    }
  };

  const apply = async () => {
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const created = await run(
      async () => {
        const list = [];
        for (const update of pending) {
          for (const entry of update.abilities) {
            list.push(
              await createCharacterAbility(client, character.id, {
                kind: entry.kind,
                name: entry.name,
                source: entry.source,
                description: entry.description,
                data: (entry.data ?? {}) as Json,
                resourceId: null,
              }),
            );
          }
        }
        return list;
      },
      { success: 'Ficha atualizada.', failure: 'Não foi possível atualizar a ficha.' },
    );
    if (created) setAbilities((current) => [...current, ...created]);
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => dismiss(pending.map((update) => update.id))}
      title="Sua ficha tem novidades"
      busy={busy}
    >
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
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => dismiss(pending.map((update) => update.id))}
          >
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
