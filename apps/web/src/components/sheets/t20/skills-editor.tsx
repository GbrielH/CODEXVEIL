'use client';

import {
  T20_ATTRIBUTES,
  T20_SKILLS,
  T20_SKILL_IDS,
  t20AttributeLabels,
  type T20Sheet,
  type T20Skill,
} from '@codexveil/rpg-systems/tormenta20';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { NumberInput } from '@/components/ui/number-input';

/**
 * Edição na própria aba Atributos e perícias: valores dos atributos, perícias treinadas e bônus
 * fixos por perícia (poderes, itens, decisões do mestre). Os totais continuam calculados.
 */
export function T20SkillsEditor({
  sheet,
  onSave,
  onCancel,
}: {
  sheet: T20Sheet;
  onSave: (next: T20Sheet) => Promise<void>;
  onCancel: () => void;
}) {
  const [attributes, setAttributes] = useState({ ...sheet.attributes });
  const [trained, setTrained] = useState(new Set<T20Skill>(sheet.skills.trained));
  const [bonuses, setBonuses] = useState<Record<string, number>>({ ...sheet.skills.bonuses });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        ...sheet,
        attributes,
        skills: {
          ...sheet.skills,
          trained: T20_SKILL_IDS.filter((skill) => trained.has(skill)),
          // Bônus zerado sai da ficha.
          bonuses: Object.fromEntries(Object.entries(bonuses).filter(([, value]) => value !== 0)),
        },
      });
    } catch {
      // O aviso de erro já apareceu; a edição continua aberta.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card>
          <CardHeader title="Atributos" description="Valor final de cada atributo." />
          <ul className="grid grid-cols-2 gap-2">
            {T20_ATTRIBUTES.map((key) => (
              <li key={key} className="flex flex-col gap-1">
                <span className="text-xs tracking-wider text-fg-subtle uppercase">
                  {t20AttributeLabels[key].abbreviation}
                </span>
                <NumberInput
                  value={attributes[key] ?? 0}
                  min={-10}
                  max={20}
                  aria-label={t20AttributeLabels[key].name}
                  onCommit={(value) => setAttributes({ ...attributes, [key]: value ?? 0 })}
                />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Perícias"
            description="Marque as treinadas e ajuste o bônus fixo de cada uma (poderes, itens, mestre)."
          />
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {T20_SKILL_IDS.map((skill) => (
              <li key={skill} className="flex items-center gap-2 py-0.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-wine-500"
                    checked={trained.has(skill)}
                    onChange={(event) => {
                      const next = new Set(trained);
                      if (event.target.checked) next.add(skill);
                      else next.delete(skill);
                      setTrained(next);
                    }}
                  />
                  <span className="truncate text-fg">{T20_SKILLS[skill].label}</span>
                </label>
                <NumberInput
                  value={bonuses[skill] ?? 0}
                  min={-20}
                  max={40}
                  aria-label={`Bônus em ${T20_SKILLS[skill].label}`}
                  className="w-20"
                  onCommit={(value) => setBonuses({ ...bonuses, [skill]: value ?? 0 })}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={() => void save()} loading={busy}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
