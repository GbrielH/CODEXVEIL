'use client';

import { Copy } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import {
  copyBookItemAction,
  copyBookMonsterAction,
} from '@/app/(app)/campanhas/[campaignId]/livros/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';

/** Copia um monstro ou item mágico do livro para a biblioteca da campanha (só mestres). */
export function BookCopy({
  campaignId,
  packId,
  entryKey,
  kind,
}: {
  campaignId: string;
  packId: string;
  entryKey: string;
  kind: 'monster' | 'magic_item';
}) {
  const id = useId();
  const [creatureKind, setCreatureKind] = useState<'npc' | 'monster'>('monster');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = () =>
    startTransition(async () => {
      setError(null);
      const result =
        kind === 'monster'
          ? await copyBookMonsterAction(campaignId, packId, entryKey, creatureKind)
          : await copyBookItemAction(campaignId, packId, entryKey);
      if (!result.ok) setError(result.message);
    });

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {kind === 'monster' ? (
        <SelectField
          id={`${id}-kind`}
          label="Copiar como"
          value={creatureKind}
          onChange={(event) => setCreatureKind(event.target.value === 'npc' ? 'npc' : 'monster')}
        >
          <option value="monster">Monstro</option>
          <option value="npc">NPC</option>
        </SelectField>
      ) : null}
      <div>
        <Button
          loading={pending}
          icon={<Copy className="h-4 w-4" aria-hidden="true" />}
          onClick={copy}
        >
          {kind === 'monster' ? 'Copiar para a biblioteca' : 'Copiar para os itens da campanha'}
        </Button>
      </div>
    </div>
  );
}
