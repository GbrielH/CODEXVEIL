'use client';

import { listDnd5ePendingUpdates } from '@codexveil/rpg-systems/dnd5e';
import { useMemo } from 'react';
import { PendingUpdatesModal } from '../pending-updates-modal';
import { useSheet } from './context';

/** Pendências da ficha D&D (hoje, magias sempre preparadas que faltam). */
export function PendingUpdatesDialog() {
  const { character, permissions, sheet, abilities, setAbilities } = useSheet();
  const updates = useMemo(
    () =>
      listDnd5ePendingUpdates(
        sheet,
        abilities.map((entry) => entry.name),
      ),
    [sheet, abilities],
  );
  return (
    <PendingUpdatesModal
      characterId={character.id}
      enabled={permissions.isOwner && permissions.canEditSheet}
      updates={updates}
      onCreated={(created) => setAbilities((current) => [...current, ...created])}
    />
  );
}
