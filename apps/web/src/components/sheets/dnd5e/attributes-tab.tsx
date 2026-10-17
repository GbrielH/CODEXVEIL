'use client';

import { d20Expression } from '@codexveil/domain';
import {
  ABILITIES,
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  PROFICIENCY_LEVELS,
  SKILLS,
  SPELLCASTING_ABILITIES,
  abilityLabels,
  formatModifier,
  passiveWithConditions,
  proficiencyLevelLabels,
  skillDefinitions,
  type Ability,
  type ProficiencyLevel,
} from '@codexveil/rpg-systems/dnd5e';
import { useId } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TextareaField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { cx } from '@/lib/cx';
import { RollButton } from '@/components/dice/dice-roller';
import { PenaltyBadge, RollEffectBadge, rollModeFrom } from './condition-badges';
import { useSheet } from './context';

const proficiencyMarks: Record<ProficiencyLevel, string> = {
  none: '○',
  half: '◐',
  proficient: '●',
  expertise: '◆',
};

export function AttributesTab() {
  return (
    <div className="flex flex-col gap-5">
      <AbilityScores />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-5">
          <SavingThrows />
          <CombatBasics />
          <Spellcasting />
        </div>
        <SkillsTable />
      </div>
      <Proficiencies />
    </div>
  );
}

function AbilityScores() {
  const { sheet, derived, updateSheet, permissions } = useSheet();
  const id = useId();
  return (
    <section aria-label="Atributos" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {ABILITIES.map((ability) => (
        <div key={ability} className="ornate flex flex-col items-center gap-2 rounded-lg border border-line bg-card px-2 py-3 shadow-card">
          <label htmlFor={`${id}-${ability}`} className="text-center">
            <span className="block font-display text-xs tracking-[0.2em] text-fg-secondary">{abilityLabels[ability].abbreviation}</span>
            <span className="block text-[11px] text-fg-muted">{abilityLabels[ability].name}</span>
          </label>
          <span className="tabular font-display text-3xl leading-none text-fg-accent" aria-label={`Modificador ${formatModifier(derived.abilityModifiers[ability])}`}>
            {formatModifier(derived.abilityModifiers[ability])}
          </span>
          <NumberInput
            id={`${id}-${ability}`}
            value={sheet.abilities[ability]}
            min={ABILITY_SCORE_MIN}
            max={ABILITY_SCORE_MAX}
            disabled={!permissions.canEditSheet}
            onCommit={(value) =>
              updateSheet((current) => ({ ...current, abilities: { ...current.abilities, [ability]: value ?? 10 } }))
            }
            className="h-9 w-16 text-base"
          />
        </div>
      ))}
    </section>
  );
}

function SavingThrows() {
  const { sheet, derived, updateSheet, permissions, conditionEffects: effects } = useSheet();
  const penalty = effects.d20Penalty;
  const id = useId();
  const setSave = (ability: Ability, patch: Partial<{ proficient: boolean; bonus: number }>) =>
    updateSheet((current) => ({
      ...current,
      savingThrows: { ...current.savingThrows, [ability]: { ...current.savingThrows[ability], ...patch } },
    }));

  return (
    <Card>
      <CardHeader title="Testes de resistência" />
      <ul className="flex flex-col gap-1">
        {ABILITIES.map((ability) => (
          <li key={ability} className="flex items-center gap-3">
            <input
              id={`${id}-${ability}`}
              type="checkbox"
              checked={sheet.savingThrows[ability].proficient}
              disabled={!permissions.canEditSheet}
              onChange={(event) => setSave(ability, { proficient: event.target.checked })}
              className="h-5 w-5 accent-wine-500"
            />
            <label htmlFor={`${id}-${ability}`} className="flex-1 text-sm">
              {abilityLabels[ability].name}
            </label>
            <NumberInput
              aria-label={`Bônus adicional em ${abilityLabels[ability].name}`}
              value={sheet.savingThrows[ability].bonus}
              min={-30}
              max={30}
              disabled={!permissions.canEditSheet}
              onCommit={(value) => setSave(ability, { bonus: value ?? 0 })}
              className="h-9 w-14 text-sm"
            />
            <span className="flex w-24 shrink-0 items-center justify-end gap-1">
              <RollEffectBadge sources={effects.savingThrows[ability].rolls} autoFail={effects.savingThrows[ability].autoFail} />
              <PenaltyBadge penalty={penalty} source={`Exaustão ${effects.exhaustionLevel}`} />
              <RollButton
                expression={d20Expression(derived.savingThrows[ability] - penalty)}
                label={`Resistência de ${abilityLabels[ability].name}`}
                mode={rollModeFrom(effects.savingThrows[ability].rolls)}
              >
                <span className={cx('tabular block w-10 text-right font-display text-lg', penalty > 0 ? 'text-amber-300' : 'text-fg-accent')}>
                  {formatModifier(derived.savingThrows[ability] - penalty)}
                </span>
              </RollButton>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">
        Marque as proficiências. O campo do meio soma bônus de itens ou magias. Selos indicam efeitos de condições ativas.
      </p>
    </Card>
  );
}

function SkillsTable() {
  const { sheet, derived, updateSheet, permissions, conditionEffects: effects } = useSheet();
  const penalty = effects.d20Penalty;
  return (
    <Card>
      <CardHeader
        title="Perícias"
        description={`Percepção passiva ${passiveWithConditions(derived.passivePerception, effects)} · Intuição passiva ${passiveWithConditions(derived.passiveInsight, effects)} · Investigação passiva ${passiveWithConditions(derived.passiveInvestigation, effects)}`}
      />
      <ul className="flex flex-col divide-y divide-line">
        {SKILLS.map((skill) => {
          const entry = sheet.skills[skill];
          const definition = skillDefinitions[skill];
          return (
            <li key={skill} className="flex items-center gap-2 py-1.5">
              <span className={cx('w-5 text-center text-sm', entry.proficiency === 'none' ? 'text-fg-subtle' : 'text-fg-brand')} aria-hidden="true">
                {proficiencyMarks[entry.proficiency]}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {definition.label}
                <span className="ml-1 text-xs text-fg-muted">({abilityLabels[definition.ability].abbreviation})</span>
              </span>
              <Select
                aria-label={`Proficiência em ${definition.label}`}
                value={entry.proficiency}
                disabled={!permissions.canEditSheet}
                onChange={(event) =>
                  updateSheet((current) => ({
                    ...current,
                    skills: { ...current.skills, [skill]: { ...current.skills[skill], proficiency: event.target.value as ProficiencyLevel } },
                  }))
                }
                size="sm"
                className="w-32 sm:w-40"
              >
                {PROFICIENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {proficiencyLevelLabels[level]}
                  </option>
                ))}
              </Select>
              <NumberInput
                aria-label={`Bônus adicional em ${definition.label}`}
                value={entry.bonus}
                min={-30}
                max={30}
                disabled={!permissions.canEditSheet}
                onCommit={(value) =>
                  updateSheet((current) => ({
                    ...current,
                    skills: { ...current.skills, [skill]: { ...current.skills[skill], bonus: value ?? 0 } },
                  }))
                }
                className="h-9 w-12 text-xs"
              />
              <span className="flex w-24 shrink-0 items-center justify-end gap-1">
                <RollEffectBadge sources={effects.abilityChecks} />
                <PenaltyBadge penalty={penalty} source={`Exaustão ${effects.exhaustionLevel}`} />
                <RollButton
                  expression={d20Expression(derived.skills[skill].bonus - penalty)}
                  label={skillDefinitions[skill].label}
                  mode={rollModeFrom(effects.abilityChecks)}
                >
                  <span className={cx('tabular block w-10 text-right font-display text-lg', penalty > 0 ? 'text-amber-300' : 'text-fg-accent')}>
                    {formatModifier(derived.skills[skill].bonus - penalty)}
                  </span>
                </RollButton>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CombatBasics() {
  const { sheet, updateSheet, permissions } = useSheet();
  const id = useId();
  const setCombat = (patch: Partial<typeof sheet.combat>) =>
    updateSheet((current) => ({ ...current, combat: { ...current.combat, ...patch } }));
  return (
    <Card>
      <CardHeader title="Combate" description="Valores base informados por você; a iniciativa soma a Destreza." />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-ac`} className="text-sm font-medium">
            Classe de armadura
          </label>
          <NumberInput id={`${id}-ac`} value={sheet.combat.armorClass} min={0} max={50} disabled={!permissions.canEditSheet} onCommit={(value) => setCombat({ armorClass: value ?? 10 })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-init`} className="text-sm font-medium">
            Bônus de iniciativa
          </label>
          <NumberInput id={`${id}-init`} value={sheet.combat.initiativeBonus} min={-30} max={30} disabled={!permissions.canEditSheet} onCommit={(value) => setCombat({ initiativeBonus: value ?? 0 })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-speed`} className="text-sm font-medium">
            Deslocamento
          </label>
          <NumberInput id={`${id}-speed`} value={sheet.combat.speed} min={0} max={1000} decimal disabled={!permissions.canEditSheet} onCommit={(value) => setCombat({ speed: value ?? 0 })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-unit`} className="text-sm font-medium">
            Unidade
          </label>
          <Select
            id={`${id}-unit`}
            value={sheet.combat.speedUnit}
            disabled={!permissions.canEditSheet}
            onChange={(event) => setCombat({ speedUnit: event.target.value === 'ft' ? 'ft' : 'm' })}
          >
            <option value="m">metros</option>
            <option value="ft">pés</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function Spellcasting() {
  const { sheet, derived, updateSheet, permissions } = useSheet();
  const id = useId();
  const setCasting = (patch: Partial<typeof sheet.spellcasting>) =>
    updateSheet((current) => ({ ...current, spellcasting: { ...current.spellcasting, ...patch } }));
  return (
    <Card>
      <CardHeader
        title="Conjuração"
        description={
          derived.spellcasting
            ? `CD ${derived.spellcasting.saveDc} · ataque ${formatModifier(derived.spellcasting.attackBonus)}`
            : 'Escolha o atributo de conjuração se o personagem usa magias.'
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor={`${id}-ability`} className="text-sm font-medium">
            Atributo
          </label>
          <Select
            id={`${id}-ability`}
            value={sheet.spellcasting.ability ?? ''}
            disabled={!permissions.canEditSheet}
            onChange={(event) =>
              setCasting({ ability: event.target.value ? (event.target.value as (typeof SPELLCASTING_ABILITIES)[number]) : null })
            }
          >
            <option value="">Nenhum</option>
            {SPELLCASTING_ABILITIES.map((ability) => (
              <option key={ability} value={ability}>
                {abilityLabels[ability].name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-dc`} className="text-sm font-medium">
            Bônus na CD
          </label>
          <NumberInput id={`${id}-dc`} value={sheet.spellcasting.saveDcBonus} min={-30} max={30} disabled={!permissions.canEditSheet} onCommit={(value) => setCasting({ saveDcBonus: value ?? 0 })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-attack`} className="text-sm font-medium">
            Bônus no ataque
          </label>
          <NumberInput id={`${id}-attack`} value={sheet.spellcasting.attackBonus} min={-30} max={30} disabled={!permissions.canEditSheet} onCommit={(value) => setCasting({ attackBonus: value ?? 0 })} />
        </div>
      </div>
    </Card>
  );
}

function Proficiencies() {
  const { sheet, updateSheet, permissions } = useSheet();
  const id = useId();
  const fields = [
    { key: 'armor', label: 'Armaduras' },
    { key: 'weapons', label: 'Armas' },
    { key: 'tools', label: 'Ferramentas' },
    { key: 'languages', label: 'Idiomas' },
  ] as const;
  return (
    <Card>
      <CardHeader title="Proficiências e idiomas" />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <TextareaField
            key={field.key}
            id={`${id}-${field.key}`}
            label={field.label}
            rows={2}
            maxLength={300}
            readOnly={!permissions.canEditSheet}
            value={sheet.proficiencies[field.key]}
            onChange={(event) =>
              updateSheet((current) => ({
                ...current,
                proficiencies: { ...current.proficiencies, [field.key]: event.target.value },
              }))
            }
          />
        ))}
      </div>
    </Card>
  );
}
