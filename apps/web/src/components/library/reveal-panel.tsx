'use client';

import { setCreatureRevealedStats } from '@codexveil/database';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface RevealGroup {
  id: string;
  label: string;
  /** Chaves do bloco de estatísticas que o grupo libera. */
  keys: string[];
}

/** Partes da ficha de D&D 5e que o mestre pode liberar, na ordem do bloco de estatísticas. */
export const DND5E_REVEAL_GROUPS: RevealGroup[] = [
  { id: 'identity', label: 'Tamanho, tipo e tendência', keys: ['size', 'creatureType', 'alignment'] },
  { id: 'ac', label: 'Classe de armadura', keys: ['armorClass', 'armorNote'] },
  { id: 'hp', label: 'Pontos de vida', keys: ['hitPoints', 'hitPointFormula'] },
  { id: 'speed', label: 'Deslocamento', keys: ['speed'] },
  { id: 'abilities', label: 'Atributos', keys: ['abilities'] },
  { id: 'saves', label: 'Testes de resistência', keys: ['savingThrows'] },
  { id: 'skills', label: 'Perícias', keys: ['skills'] },
  { id: 'defenses', label: 'Resistências e imunidades', keys: ['damageResistances', 'damageImmunities', 'conditionImmunities'] },
  { id: 'senses', label: 'Sentidos', keys: ['senses'] },
  { id: 'languages', label: 'Idiomas', keys: ['languages'] },
  { id: 'challenge', label: 'Nível de desafio', keys: ['challengeRating'] },
  { id: 'traits', label: 'Características', keys: ['traits'] },
  { id: 'actions', label: 'Ações', keys: ['actions'] },
  { id: 'bonus', label: 'Ações bônus', keys: ['bonusActions'] },
  { id: 'reactions', label: 'Reações', keys: ['reactions'] },
  { id: 'legendary', label: 'Ações lendárias', keys: ['legendaryActions'] },
];

/** Partes da ficha de ameaça do Tormenta20. */
export const T20_REVEAL_GROUPS: RevealGroup[] = [
  { id: 'type', label: 'Tipo e ND', keys: ['type', 'challenge'] },
  { id: 'senses', label: 'Iniciativa e sentidos', keys: ['senses', 'initiative'] },
  { id: 'defense', label: 'Defesa', keys: ['defense', 'defenseNotes'] },
  { id: 'hp', label: 'Pontos de vida e mana', keys: ['hitPoints', 'manaPoints'] },
  { id: 'speed', label: 'Deslocamento', keys: ['speed'] },
  { id: 'attacks', label: 'Ataques', keys: ['melee', 'ranged'] },
  { id: 'attributes', label: 'Atributos', keys: ['attributes'] },
  { id: 'skills', label: 'Perícias', keys: ['skills'] },
  { id: 'abilities', label: 'Habilidades', keys: ['abilities'] },
  { id: 'equipment', label: 'Equipamento', keys: ['equipment'] },
  { id: 'treasure', label: 'Tesouro', keys: ['treasure'] },
  { id: 'description', label: 'Descrição da ficha', keys: ['description'] },
];

export function revealGroupsFor(systemId: string): RevealGroup[] {
  return systemId === 'tormenta20' ? T20_REVEAL_GROUPS : DND5E_REVEAL_GROUPS;
}

/**
 * O mestre escolhe o que os jogadores veem da ficha desta criatura e muda quando quiser (ex.:
 * libera a CA depois que o grupo a descobre no combate). Só vale com o registro revelado.
 */
export function RevealPanel({
  creatureId,
  systemId,
  revealed,
  creatureVisible,
}: {
  creatureId: string;
  systemId: string;
  revealed: string[];
  creatureVisible: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const groups = revealGroupsFor(systemId);
  const [selected, setSelected] = useState(() => new Set(revealed));
  const [busy, setBusy] = useState(false);
  const isOn = (group: RevealGroup) => group.keys.every((key) => selected.has(key));

  const save = async (next: Set<string>) => {
    setSelected(next);
    setBusy(true);
    try {
      await setCreatureRevealedStats(getSupabaseBrowserClient(), creatureId, [...next]);
      router.refresh();
    } catch (error) {
      toast({ tone: 'danger', title: 'Não foi possível salvar', description: failureMessage(error, 'Tente novamente.') });
      setSelected(new Set(revealed));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (group: RevealGroup) => {
    const next = new Set(selected);
    if (isOn(group)) for (const key of group.keys) next.delete(key);
    else for (const key of group.keys) next.add(key);
    void save(next);
  };

  return (
    <Card>
      <CardHeader
        icon={<Eye className="h-5 w-5" aria-hidden="true" />}
        title="O que os jogadores veem da ficha"
        description={
          creatureVisible
            ? 'Libere e oculte cada parte quando quiser; os jogadores veem na hora, na biblioteca da campanha.'
            : 'Este registro está oculto: revele-o ao grupo para que as partes liberadas apareçam.'
        }
      />
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const on = isOn(group);
          return (
            <button
              key={group.id}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => toggle(group)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                on ? 'border-wine-400/60 bg-wine-700/40 text-parchment-50' : 'border-line text-fg-muted hover:bg-hover hover:text-fg'
              }`}
            >
              {on ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
              {group.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void save(new Set(groups.flatMap((group) => group.keys)))}>
          Liberar tudo
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(new Set())}>
          Ocultar tudo
        </Button>
      </div>
    </Card>
  );
}
