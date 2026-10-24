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
  SRD_LANGUAGES,
} from '@codexveil/rpg-systems/dnd5e';
import { useId } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
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

/** `withoutProficiencies`: a ficha da campanha mostra as proficiências abaixo das características. */
export function AttributesTab({ withoutProficiencies = false }: { withoutProficiencies?: boolean } = {}) {
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
      {withoutProficiencies ? null : <Proficiencies />}
    </div>
  );
}

function AbilityScores() {
  const { sheet, derived, updateSheet, permissions, conditionEffects: effects } = useSheet();
  const penalty = effects.d20Penalty;
  const id = useId();
  return (
    <section aria-label="Atributos" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {ABILITIES.map((ability) => (
        <div
          key={ability}
          className="ornate flex flex-col items-center gap-2 rounded-lg border border-line bg-card px-2 py-3 shadow-card"
        >
          {/* Clicar no cartão (nome e modificador) rola o teste do atributo (d20 + modificador). */}
          <RollButton
            expression={d20Expression(derived.abilityModifiers[ability] - penalty)}
            label={`Teste de ${abilityLabels[ability].name}`}
            mode={rollModeFrom(effects.abilityChecks)}
            title={`Rolar teste de ${abilityLabels[ability].name}`}
            className="flex w-full flex-col items-center gap-2 py-1"
          >
            <span className="text-center">
              <span className="block font-display text-xs tracking-[0.2em] text-fg-secondary">
                {abilityLabels[ability].abbreviation}
              </span>
              <span className="block text-[11px] text-fg-muted">{abilityLabels[ability].name}</span>
            </span>
            <span
              className={cx('tabular font-display text-3xl leading-none', penalty > 0 ? 'text-amber-300' : 'text-fg-accent')}
              aria-label={`Modificador ${formatModifier(derived.abilityModifiers[ability] - penalty)}`}
            >
              {formatModifier(derived.abilityModifiers[ability] - penalty)}
            </span>
          </RollButton>
          <NumberInput
            id={`${id}-${ability}`}
            aria-label={`Valor de ${abilityLabels[ability].name}`}
            value={sheet.abilities[ability]}
            min={ABILITY_SCORE_MIN}
            max={ABILITY_SCORE_MAX}
            disabled={!permissions.canEditSheet}
            onCommit={(value) =>
              updateSheet((current) => ({
                ...current,
                abilities: { ...current.abilities, [ability]: value ?? 10 },
              }))
            }
            className="h-9 w-16 text-base"
          />
          {derived.abilities[ability] !== sheet.abilities[ability] ? (
            <span className="text-center text-[11px] text-emerald-300" title={derived.abilityNotes.join('; ')}>
              Com itens: {derived.abilities[ability]}
            </span>
          ) : null}
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
      savingThrows: {
        ...current.savingThrows,
        [ability]: { ...current.savingThrows[ability], ...patch },
      },
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
              <RollEffectBadge
                sources={effects.savingThrows[ability].rolls}
                autoFail={effects.savingThrows[ability].autoFail}
              />
              <PenaltyBadge penalty={penalty} source={`Exaustão ${effects.exhaustionLevel}`} />
              <RollButton
                expression={d20Expression(derived.savingThrows[ability] - penalty)}
                label={`Resistência de ${abilityLabels[ability].name}`}
                mode={rollModeFrom(effects.savingThrows[ability].rolls)}
              >
                <span
                  className={cx(
                    'tabular block w-10 text-right font-display text-lg',
                    penalty > 0 ? 'text-amber-300' : 'text-fg-accent',
                  )}
                >
                  {formatModifier(derived.savingThrows[ability] - penalty)}
                </span>
              </RollButton>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">
        Marque as proficiências. O campo do meio soma bônus de itens ou magias. Selos indicam
        efeitos de condições ativas.
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
              <span
                className={cx(
                  'w-5 text-center text-sm',
                  entry.proficiency === 'none' ? 'text-fg-subtle' : 'text-fg-brand',
                )}
                aria-hidden="true"
              >
                {proficiencyMarks[entry.proficiency]}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {definition.label}
                <span className="ml-1 text-xs text-fg-muted">
                  ({abilityLabels[definition.ability].abbreviation})
                </span>
              </span>
              <Select
                aria-label={`Proficiência em ${definition.label}`}
                value={entry.proficiency}
                disabled={!permissions.canEditSheet}
                onChange={(event) =>
                  updateSheet((current) => ({
                    ...current,
                    skills: {
                      ...current.skills,
                      [skill]: {
                        ...current.skills[skill],
                        proficiency: event.target.value as ProficiencyLevel,
                      },
                    },
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
                    skills: {
                      ...current.skills,
                      [skill]: { ...current.skills[skill], bonus: value ?? 0 },
                    },
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
                  <span
                    className={cx(
                      'tabular block w-10 text-right font-display text-lg',
                      penalty > 0 ? 'text-amber-300' : 'text-fg-accent',
                    )}
                  >
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
  const { sheet, derived, updateSheet, permissions } = useSheet();
  const id = useId();
  const unit = sheet.combat.speedUnit;
  const stats = [
    { label: 'Classe de armadura', value: String(derived.armorClass), notes: derived.armorClassBreakdown },
    {
      label: 'Iniciativa',
      value: formatModifier(derived.initiative),
      notes: [`Destreza ${formatModifier(derived.abilityModifiers.dex)}`, ...(derived.initiative !== derived.abilityModifiers.dex ? ['+ proficiência/bônus de talentos'] : [])],
    },
    { label: 'Deslocamento', value: `${derived.speed.toLocaleString('pt-BR')} ${unit}`, notes: derived.speedNotes },
  ];
  return (
    <Card>
      <CardHeader title="Combate" description="Calculado automaticamente pela espécie, classe, atributos e pelo que está equipado." />
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-md border border-line bg-raised p-3">
            <span className="text-xs text-fg-muted">{stat.label}</span>
            <span className="tabular font-display text-2xl text-fg-accent">{stat.value}</span>
            {stat.notes.length ? (
              <ul className="text-[11px] text-fg-muted">
                {stat.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      {derived.combatWarnings.length ? (
        <ul className="mt-3 text-xs text-amber-300">
          {derived.combatWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {derived.abilityNotes.length ? <p className="mt-2 text-xs text-fg-muted">Atributos alterados por itens: {derived.abilityNotes.join('; ')}.</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <label htmlFor={`${id}-unit`} className="text-xs text-fg-muted">
          Unidade de distância
        </label>
        <Select
          id={`${id}-unit`}
          value={unit}
          disabled={!permissions.canEditSheet}
          onChange={(event) => updateSheet((current) => ({ ...current, combat: { ...current.combat, speedUnit: event.target.value === 'ft' ? 'ft' : 'm' } }))}
          className="w-32"
        >
          <option value="m">metros</option>
          <option value="ft">pés</option>
        </Select>
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
              setCasting({
                ability: event.target.value
                  ? (event.target.value as (typeof SPELLCASTING_ABILITIES)[number])
                  : null,
              })
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
          <NumberInput
            id={`${id}-dc`}
            value={sheet.spellcasting.saveDcBonus}
            min={-30}
            max={30}
            disabled={!permissions.canEditSheet}
            onCommit={(value) => setCasting({ saveDcBonus: value ?? 0 })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-attack`} className="text-sm font-medium">
            Bônus no ataque
          </label>
          <NumberInput
            id={`${id}-attack`}
            value={sheet.spellcasting.attackBonus}
            min={-30}
            max={30}
            disabled={!permissions.canEditSheet}
            onCommit={(value) => setCasting({ attackBonus: value ?? 0 })}
          />
        </div>
      </div>
    </Card>
  );
}

export function Proficiencies() {
  const { sheet, updateSheet, permissions } = useSheet();
  // Armaduras, armas e ferramentas vêm da classe, do antecedente e das evoluções (criação e
  // subida de nível gravam sozinhas): só exibição.
  const fixed = [
    { key: 'armor', label: 'Armaduras' },
    { key: 'weapons', label: 'Armas' },
    { key: 'tools', label: 'Ferramentas' },
  ] as const;
  const known = sheet.proficiencies.languages
    .split(/,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const all = [...SRD_LANGUAGES.map((language) => language.name), ...known.filter((name) => !SRD_LANGUAGES.some((language) => language.name === name))];
  const toggle = (name: string, checked: boolean) =>
    updateSheet((current) => {
      const currentKnown = current.proficiencies.languages.split(/,\s*/).map((entry) => entry.trim()).filter(Boolean);
      const next = checked ? [...currentKnown, name] : currentKnown.filter((entry) => entry !== name);
      return { ...current, proficiencies: { ...current.proficiencies, languages: [...new Set(next)].join(', ') } };
    });
  return (
    <Card>
      <CardHeader title="Proficiências e idiomas" description="Proficiências automáticas pela classe, antecedente e evoluções." />
      <dl className="grid gap-3 sm:grid-cols-3">
        {fixed.map((field) => (
          <div key={field.key} className="rounded-md border border-line bg-raised p-3">
            <dt className="text-xs text-fg-muted">{field.label}</dt>
            <dd className="text-sm text-fg">{sheet.proficiencies[field.key] || 'Nenhuma'}</dd>
          </div>
        ))}
      </dl>
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium">Idiomas</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {all.map((name) => {
            const checked = known.includes(name);
            return (
              <label key={name} className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', checked ? 'border-parchment-300/60 bg-parchment-200/10 text-fg' : 'border-line text-fg-secondary')}>
                <input type="checkbox" className="h-4 w-4 accent-wine-500" checked={checked} disabled={!permissions.canEditSheet} onChange={(event) => toggle(name, event.target.checked)} />
                {name}
              </label>
            );
          })}
        </div>
      </fieldset>
    </Card>
  );
}
