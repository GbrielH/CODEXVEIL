'use client';

import {
  T20_ATTRIBUTES,
  T20_SIZES,
  t20AttributeLabels,
  t20SizeLabels,
  type T20Sheet,
  type T20Size,
} from '@codexveil/rpg-systems/tormenta20';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';

export interface T20StatsChange {
  sheet: T20Sheet;
  hitPointsMax: number;
  manaPointsMax: number;
}

/**
 * Ajuste manual dos números do cabeçalho da ficha do Tormenta20: atributos, bônus de Defesa e de
 * Iniciativa, deslocamento, tamanho e PV/PM máximos (o que o livro não cobre, itens, decisões do
 * mestre). Defesa e Iniciativa continuam calculadas; aqui entra só o bônus extra.
 */
export function T20StatsEditor({
  open,
  sheet,
  hitPointsMax,
  manaPointsMax,
  onClose,
  onSave,
}: {
  open: boolean;
  sheet: T20Sheet;
  hitPointsMax: number;
  manaPointsMax: number;
  onClose: () => void;
  onSave: (change: T20StatsChange) => Promise<void>;
}) {
  const [form, setForm] = useState(() => initial(sheet, hitPointsMax, manaPointsMax));
  const [openedFor, setOpenedFor] = useState(false);
  const [busy, setBusy] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) setForm(initial(sheet, hitPointsMax, manaPointsMax));
  }
  const number = (
    label: string,
    value: number,
    min: number,
    max: number,
    onCommit: (value: number) => void,
    hint?: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <NumberInput
        value={value}
        min={min}
        max={max}
        onCommit={(next) => onCommit(next ?? 0)}
        aria-label={label}
      />
      {hint ? <span className="text-xs text-fg-muted">{hint}</span> : null}
    </div>
  );

  const save = async () => {
    setBusy(true);
    const next: T20Sheet = {
      ...sheet,
      attributes: { ...sheet.attributes, ...form.attributes },
      identity: { ...sheet.identity, speed: form.speed, size: form.size },
      defense: { ...sheet.defense, other: form.defenseOther },
      skills: {
        ...sheet.skills,
        bonuses: { ...sheet.skills.bonuses, iniciativa: form.initiativeBonus },
      },
      hitPoints: { ...sheet.hitPoints, max: form.hitPointsMax },
      manaPoints: { ...sheet.manaPoints, max: form.manaPointsMax },
    };
    try {
      await onSave({
        sheet: next,
        hitPointsMax: form.hitPointsMax,
        manaPointsMax: form.manaPointsMax,
      });
      onClose();
    } catch {
      // O aviso de erro já apareceu; o formulário fica aberto para tentar de novo.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajustar números da ficha" busy={busy} size="lg">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-fg">Atributos</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {T20_ATTRIBUTES.map((attribute) => (
              <div key={attribute} className="flex flex-col gap-1">
                <span className="text-xs tracking-wider text-fg-muted uppercase">
                  {t20AttributeLabels[attribute].abbreviation}
                </span>
                <NumberInput
                  value={form.attributes[attribute] ?? 0}
                  min={-5}
                  max={20}
                  aria-label={t20AttributeLabels[attribute].name}
                  onCommit={(value) =>
                    setForm({
                      ...form,
                      attributes: { ...form.attributes, [attribute]: value ?? 0 },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {number(
            'Defesa: outros bônus',
            form.defenseOther,
            -20,
            40,
            (value) => setForm({ ...form, defenseOther: value }),
            'Somado à Defesa calculada (armadura, escudo, Destreza).',
          )}
          {number(
            'Iniciativa: bônus',
            form.initiativeBonus,
            -20,
            40,
            (value) => setForm({ ...form, initiativeBonus: value }),
            'Somado ao teste de Iniciativa.',
          )}
          {number('Deslocamento (m)', form.speed, 0, 120, (value) =>
            setForm({ ...form, speed: value }),
          )}
          <SelectField
            id="t20-ajuste-tamanho"
            label="Tamanho"
            value={form.size}
            onChange={(event) => setForm({ ...form, size: event.target.value as T20Size })}
          >
            {T20_SIZES.map((size) => (
              <option key={size} value={size}>
                {t20SizeLabels[size]}
              </option>
            ))}
          </SelectField>
          {number('Pontos de Vida máximos', form.hitPointsMax, 1, 9999, (value) =>
            setForm({ ...form, hitPointsMax: Math.max(1, value) }),
          )}
          {number('Pontos de Mana máximos', form.manaPointsMax, 0, 9999, (value) =>
            setForm({ ...form, manaPointsMax: Math.max(0, value) }),
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function initial(sheet: T20Sheet, hitPointsMax: number, manaPointsMax: number) {
  return {
    attributes: { ...sheet.attributes },
    defenseOther: sheet.defense.other,
    initiativeBonus: sheet.skills.bonuses.iniciativa ?? 0,
    speed: sheet.identity.speed,
    size: sheet.identity.size,
    hitPointsMax,
    manaPointsMax,
  };
}
