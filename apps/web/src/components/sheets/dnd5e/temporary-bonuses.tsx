'use client';

import {
  ABILITIES,
  abilityLabels,
  hasTemporaryBonuses,
  type Dnd5eTemporaryBonuses,
} from '@codexveil/rpg-systems/dnd5e';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { cx } from '@/lib/cx';
import { useSheet } from './context';

type FlatKey = Exclude<keyof Dnd5eTemporaryBonuses, 'abilities'>;

function Field({
  label,
  value,
  onChange,
  disabled,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  step?: number;
}) {
  return (
    <label className="flex flex-col items-center gap-1 text-[11px] tracking-wider text-fg-muted uppercase">
      {label}
      <input
        type="number"
        inputMode="numeric"
        step={step}
        min={-30}
        max={30}
        disabled={disabled}
        value={value || ''}
        placeholder="0"
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? Math.max(-30, Math.min(30, parsed)) : 0);
        }}
        className={cx(
          'tabular h-9 w-full rounded-md border bg-canvas text-center text-sm text-fg',
          value ? 'border-amber-400/60 text-amber-300' : 'border-line',
        )}
      />
    </label>
  );
}

/**
 * Bônus temporários (magias, poções, efeitos do mestre): somam por cima da ficha e mudam tudo o
 * que depende deles. Ficam neste navegador, como a Fúria, e não alteram a ficha salva.
 */
export function TemporaryBonuses() {
  const { sheet, activeEffects, setActiveEffects, permissions } = useSheet();
  const temporary = activeEffects.temporary ?? {};
  const active = hasTemporaryBonuses(temporary);
  const [open, setOpen] = useState(active);
  const disabled = !permissions.canEditPlay;

  const save = (next: Dnd5eTemporaryBonuses) =>
    setActiveEffects({ ...activeEffects, temporary: next });
  const setFlat = (key: FlatKey, value: number) => save({ ...temporary, [key]: value });

  return (
    <Card>
      <CardHeader
        icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
        title="Bônus temporários"
        description={
          active
            ? 'Ativos: os valores em âmbar na ficha já incluem estes bônus.'
            : 'Magias, poções ou efeitos do mestre que valem por um tempo.'
        }
        action={
          <div className="flex items-center gap-1">
            {active ? (
              <Button size="sm" variant="ghost" disabled={disabled} onClick={() => save({})}>
                Limpar
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? 'Fechar' : 'Ajustar'}
            </Button>
          </div>
        }
      />
      {open ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITIES.map((ability) => (
              <Field
                key={ability}
                label={abilityLabels[ability].abbreviation}
                value={temporary.abilities?.[ability] ?? 0}
                disabled={disabled}
                onChange={(value) =>
                  save({ ...temporary, abilities: { ...temporary.abilities, [ability]: value } })
                }
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field
              label="CA"
              value={temporary.armorClass ?? 0}
              disabled={disabled}
              onChange={(value) => setFlat('armorClass', value)}
            />
            <Field
              label="Iniciativa"
              value={temporary.initiative ?? 0}
              disabled={disabled}
              onChange={(value) => setFlat('initiative', value)}
            />
            <Field
              label={`Desloc. (${sheet.combat.speedUnit})`}
              value={temporary.speed ?? 0}
              step={sheet.combat.speedUnit === 'm' ? 1.5 : 5}
              disabled={disabled}
              onChange={(value) => setFlat('speed', value)}
            />
            <Field
              label="Perc. passiva"
              value={temporary.passivePerception ?? 0}
              disabled={disabled}
              onChange={(value) => setFlat('passivePerception', value)}
            />
          </div>
          <p className="text-xs text-fg-muted">
            Atributos mudam também modificadores, perícias, salvaguardas e ataques. Valores
            negativos servem para penalidades. Ficam só neste navegador e não alteram a ficha salva.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
