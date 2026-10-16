'use client';

import {
  attackRollBonus,
  dnd5eAttackDataSchema,
  formatModifier,
  type Dnd5eAttackData,
} from '@codexveil/rpg-systems/dnd5e';
import { Crosshair, Footprints, Shield, Swords, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { useSheet } from './context';
import { ConditionsPanel } from './conditions-panel';
import { HpTracker } from './hp-tracker';
import { ResourceTracks } from './resource-tracks';

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-line bg-raised px-2 py-3 text-center">
      <span className="text-fg-brand">{icon}</span>
      <span className="tabular font-display text-2xl leading-none text-fg-accent">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</span>
      {hint ? <span className="text-[11px] text-fg-subtle">{hint}</span> : null}
    </div>
  );
}

export function parseAttack(data: unknown): Dnd5eAttackData {
  const parsed = dnd5eAttackDataSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : dnd5eAttackDataSchema.parse({});
}

/** Tudo o que se consulta e altera com frequência durante uma partida, numa só tela. */
export function PlayTab() {
  const { sheet, derived, abilities } = useSheet();
  const attacks = abilities.filter((entry) => entry.kind === 'attack');
  const speed = `${sheet.combat.speed.toLocaleString('pt-BR')} ${sheet.combat.speedUnit}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <HpTracker />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Shield className="h-5 w-5" aria-hidden="true" />} label="Classe de armadura" value={String(sheet.combat.armorClass)} />
          <Stat icon={<Zap className="h-5 w-5" aria-hidden="true" />} label="Iniciativa" value={formatModifier(derived.initiative)} />
          <Stat icon={<Footprints className="h-5 w-5" aria-hidden="true" />} label="Deslocamento" value={speed} />
          <Stat icon={<Crosshair className="h-5 w-5" aria-hidden="true" />} label="Percepção passiva" value={String(derived.passivePerception)} />
        </div>
        {derived.spellcasting ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Zap className="h-5 w-5" aria-hidden="true" />} label="CD de magia" value={String(derived.spellcasting.saveDc)} />
            <Stat icon={<Crosshair className="h-5 w-5" aria-hidden="true" />} label="Ataque mágico" value={formatModifier(derived.spellcasting.attackBonus)} />
          </div>
        ) : null}
        <Card>
          <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Ataques" />
          {attacks.length === 0 ? (
            <p className="text-sm text-fg-muted">Cadastre ataques na aba “Habilidades e magias”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {attacks.map((attack) => {
                const data = parseAttack(attack.data);
                return (
                  <li key={attack.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{attack.name}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {[data.damage && `${data.damage} ${data.damageType}`.trim(), data.range].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="tabular rounded-md border border-line-strong bg-raised px-2 py-1 font-display text-lg text-fg-accent" aria-label={`Bônus de ataque ${formatModifier(attackRollBonus(data, derived))}`}>
                      {formatModifier(attackRollBonus(data, derived))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-5">
        <ConditionsPanel />
        <ResourceTracks />
      </div>
    </div>
  );
}
