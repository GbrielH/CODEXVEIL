'use client';

import { generateQuickNpc } from '@codexveil/domain';
import { Dices, Megaphone, Save } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { queueCallNpc } from '@/components/call/speaker-bar';
import { saveQuickNpcAction } from './actions';

const randomSeed = () => Math.random().toString(36).slice(2, 10);

/** NPC rápido: sorteia, salva na biblioteca (só o mestre vê) ou manda o nome para a call. */
export function QuickNpc({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [seed, setSeed] = useState(randomSeed);
  const [pending, startTransition] = useTransition();
  const npc = generateQuickNpc(seed);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-end gap-2">
        <TextField id="npc-seed" label="Semente" maxLength={40} value={seed} onChange={(event) => setSeed(event.target.value)} />
        <Button variant="secondary" icon={<Dices className="h-4 w-4" aria-hidden="true" />} onClick={() => setSeed(randomSeed())}>
          Outro
        </Button>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-line p-3">
        <p className="font-display text-base text-fg">{npc.name}</p>
        <p className="text-fg-secondary">{npc.appearance}</p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Fala: </span>
          {npc.voice}
        </p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Quer: </span>
          {npc.motivation}
        </p>
        <p className="text-fg-secondary">
          <span className="text-fg-muted">Segredo: </span>
          {npc.secret}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Save className="h-4 w-4" aria-hidden="true" />}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveQuickNpcAction(campaignId, seed);
              if (result.ok) toast({ tone: 'success', title: `${npc.name} salvo na biblioteca.` });
              else toast({ tone: 'danger', title: result.message });
            })
          }
        >
          Salvar na biblioteca
        </Button>
        <Button
          variant="secondary"
          icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}
          onClick={() => {
            queueCallNpc(npc.name);
            toast({ tone: 'success', title: 'Vai aparecer nos botões de "Quem está falando" da próxima call.' });
          }}
        >
          Usar na call
        </Button>
      </div>
    </div>
  );
}
