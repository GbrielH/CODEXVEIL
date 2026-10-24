import { createCharacterAbility, type CharacterAbility } from '@codexveil/database';
import type { AbilityEntryTemplate } from '@codexveil/rpg-systems';
import { listDnd5ePendingUpdates } from '@codexveil/rpg-systems/dnd5e';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useRef } from 'react';
import { useConfirm } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { useSheet } from './context';

export interface PendingUpdateView {
  id: string;
  title: string;
  description: string;
  abilities: AbilityEntryTemplate[];
}

const dismissKey = (characterId: string) => `codexveil:pendencias-dispensadas:${characterId}`;

/**
 * Ao abrir a ficha, avisa o dono quando uma atualização do Codexveil acrescentou algo que o
 * personagem (criado antes) ainda não tem, e aplica com um toque. Vale para qualquer sistema.
 */
export function PendingUpdatesPrompt({
  characterId,
  enabled,
  updates,
  onCreated,
}: {
  characterId: string;
  enabled: boolean;
  updates: PendingUpdateView[];
  onCreated: (created: CharacterAbility[]) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !enabled || updates.length === 0) return;
    asked.current = true;
    void (async () => {
      const dismissed = JSON.parse(
        (await Storage.getItem(dismissKey(characterId))) ?? '[]',
      ) as string[];
      const fresh = updates.filter((update) => !dismissed.includes(update.id));
      if (fresh.length === 0) return;
      const accepted = await confirm({
        title: 'Sua ficha tem novidades',
        message: fresh.map((update) => `${update.title}: ${update.description}`).join('\n\n'),
        confirmLabel: 'Aplicar na ficha',
        cancelLabel: 'Agora não',
      });
      if (!accepted) {
        await Storage.setItem(
          dismissKey(characterId),
          JSON.stringify([...dismissed, ...fresh.map((update) => update.id)]),
        );
        return;
      }
      try {
        const created: CharacterAbility[] = [];
        for (const update of fresh)
          for (const entry of update.abilities)
            created.push(
              await createCharacterAbility(getSupabase(), characterId, {
                kind: entry.kind,
                name: entry.name,
                source: entry.source,
                description: entry.description,
                data: entry.data as CharacterAbility['data'],
                resourceId: null,
              }),
            );
        onCreated(created);
        toast({ tone: 'success', title: 'Ficha atualizada.' });
      } catch (cause) {
        toast({
          tone: 'danger',
          title: 'Não foi possível atualizar a ficha',
          description: failureMessage(cause),
        });
      }
    })();
  }, [enabled, updates, characterId, confirm, toast, onCreated]);

  return null;
}

/** Pendências da ficha D&D (hoje, magias sempre preparadas que faltam). */
export function Dnd5ePendingUpdates({ isOwner }: { isOwner: boolean }) {
  const { characterId, canEditSheet, sheet, abilities, setAbilities } = useSheet();
  const updates = listDnd5ePendingUpdates(
    sheet,
    abilities.map((entry) => entry.name),
  );
  return (
    <PendingUpdatesPrompt
      characterId={characterId}
      enabled={isOwner && canEditSheet}
      updates={updates}
      onCreated={(created) => setAbilities((current) => [...current, ...created])}
    />
  );
}
