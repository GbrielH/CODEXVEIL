'use client';

import { generateQuickMonster } from '@codexveil/domain';
import { Dices, Save } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { saveQuickMonsterAction } from './actions';

const randomSeed = () => Math.random().toString(36).slice(2, 10);

const sizeNames = { small: 'Pequeno', medium: 'Médio', large: 'Grande', huge: 'Enorme' } as const;

/** Monstro rápido: sorteia aparência, comportamento, habilidade e fraqueza e salva na biblioteca. */
export function QuickMonster({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [seed, setSeed] = useState(randomSeed);
  const [pending, startTransition] = useTransition();
  const monster = generateQuickMonster(seed);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-end gap-2">
        <TextField
          id="monster-seed"
          label="Semente"
          maxLength={40}
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
        />
        <Button
          variant="secondary"
          icon={<Dices className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setSeed(randomSeed())}
        >
          Outro
        </Button>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-line p-3">
        <p className="font-display text-base text-fg">{monster.name}</p>
        <p className="text-xs text-fg-muted">{sizeNames[monster.size]}</p>
        <p className="text-fg-secondary">{monster.appearance}</p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Age assim: </span>
          {monster.behavior}
        </p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Habilidade: </span>
          {monster.ability}
        </p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Fraqueza: </span>
          {monster.weakness}
        </p>
      </div>
      <Button
        icon={<Save className="h-4 w-4" aria-hidden="true" />}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveQuickMonsterAction(campaignId, seed);
            if (result.ok) toast({ tone: 'success', title: `${monster.name} salvo na biblioteca.` });
            else toast({ tone: 'danger', title: result.message });
          })
        }
      >
        Salvar na biblioteca
      </Button>
      <p className="text-xs text-fg-muted">
        As estatísticas de combate você preenche na página do monstro depois de salvar.
      </p>
    </div>
  );
}
