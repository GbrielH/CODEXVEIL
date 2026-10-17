'use client';

import {
  ABILITIES,
  abilityLabels,
  attackDamageModifier,
  attackRollBonus,
  dnd5eAttackDataSchema,
  dnd5eSpellDataSchema,
  formatModifier,
  isDedicatedResourceKey,
  previewDnd5eCharacter,
  proficiencyLevelLabels,
  skillDefinitions,
  SKILLS,
  type Dnd5eDraft,
} from '@codexveil/rpg-systems/dnd5e';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

const kindLabels = {
  class_feature: 'Habilidades de classe',
  species_trait: 'Traços da espécie',
  background_feature: 'Antecedente',
  feat: 'Talentos',
} as const;

function formatNumber(value: number) {
  return String(value).replace('.', ',');
}

/** Prévia do personagem como será gravado (mesmo cálculo do servidor). */
export function CharacterReview({ draft }: { draft: Dnd5eDraft }) {
  const preview = useMemo(() => previewDnd5eCharacter(draft), [draft]);
  const { sheet, derived, combat, resources, abilities, items } = preview;
  const hp = resources.find((resource) => resource.key === 'hp');
  const gold = resources.find((resource) => resource.key === 'currency_gp')?.current ?? 0;
  const tracks = resources.filter((resource) => !isDedicatedResourceKey(resource.key) && !resource.key.startsWith('hit_dice_'));
  const spells = abilities.filter((entry) => entry.kind === 'spell');
  const attacks = abilities.filter((entry) => entry.kind === 'attack');
  const proficientSkills = SKILLS.filter((skill) => sheet.skills[skill].proficiency === 'proficient' || sheet.skills[skill].proficiency === 'expertise');
  const klass = sheet.identity.classes[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl">{draft.name || 'Sem nome'}</h2>
        <p className="text-sm text-fg-secondary">
          {[sheet.identity.species, klass ? `${klass.name} ${klass.level}${klass.subclass ? ` · ${klass.subclass}` : ''}` : '', sheet.identity.background, sheet.identity.alignment]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Pontos de vida', String(hp?.max ?? '—')],
          ['Classe de Armadura', String(sheet.combat.armorClass)],
          ['Iniciativa', formatModifier(derived.initiative)],
          ['Deslocamento', `${formatNumber(sheet.combat.speed)} m`],
          ['Proficiência', formatModifier(derived.proficiencyBonus)],
          ['Percepção passiva', String(derived.passivePerception)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-raised/50 p-3 text-center">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="tabular mt-1 font-display text-xl text-fg-accent">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-fg-subtle">CA: {combat.armorClassSource}.</p>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="eyebrow mb-2">Atributos e salvaguardas</h3>
          <table className="w-full text-sm">
            <tbody>
              {ABILITIES.map((ability) => (
                <tr key={ability} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal text-fg-secondary">
                    {abilityLabels[ability].name}
                  </th>
                  <td className="tabular py-1.5">{sheet.abilities[ability]}</td>
                  <td className="tabular py-1.5">{formatModifier(derived.abilityModifiers[ability])}</td>
                  <td className="tabular py-1.5 text-right">
                    {sheet.savingThrows[ability].proficient ? <Badge tone="brand">TR {formatModifier(derived.savingThrows[ability])}</Badge> : <span className="text-fg-subtle">TR {formatModifier(derived.savingThrows[ability])}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="eyebrow mb-2">Perícias com proficiência</h3>
          {proficientSkills.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhuma ainda.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {proficientSkills.map((skill) => (
                <li key={skill} className="flex justify-between gap-2 border-b border-line py-1">
                  <span>
                    {skillDefinitions[skill].label}
                    {sheet.skills[skill].proficiency === 'expertise' ? <span className="ml-1 text-xs text-fg-accent">({proficiencyLevelLabels.expertise})</span> : null}
                  </span>
                  <span className="tabular text-fg-accent">{formatModifier(derived.skills[skill].bonus)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-fg-muted">Armaduras</dt>
            <dd>{sheet.proficiencies.armor || '—'}</dd>
            <dt className="text-fg-muted">Armas</dt>
            <dd>{sheet.proficiencies.weapons || '—'}</dd>
            <dt className="text-fg-muted">Ferramentas</dt>
            <dd>{sheet.proficiencies.tools || '—'}</dd>
            <dt className="text-fg-muted">Idiomas</dt>
            <dd>{sheet.proficiencies.languages || '—'}</dd>
          </dl>
        </div>
      </section>

      {attacks.length > 0 ? (
        <section>
          <h3 className="eyebrow mb-2">Ataques</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {attacks.map((attack) => {
              const data = dnd5eAttackDataSchema.parse(attack.data);
              const bonus = attackRollBonus(data, derived);
              const damageModifier = attackDamageModifier(data.ability, sheet.abilities);
              return (
                <li key={attack.name} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">{attack.name}</span>
                    <span className="text-xs text-fg-muted">{data.range}</span>
                  </span>
                  <span className="tabular text-right text-xs text-fg-secondary">
                    <span className="block text-sm text-fg-accent">{formatModifier(bonus)}</span>
                    {data.damage}
                    {damageModifier ? ` ${formatModifier(damageModifier)}` : ''} {data.damageType.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section>
          <h3 className="eyebrow mb-2">Recursos</h3>
          <ul className="flex flex-wrap gap-2">
            {tracks.map((track) => (
              <li key={track.key}>
                <Badge tone="parchment">
                  {track.label}: {track.max}
                  {track.recovery === 'short_rest' ? ' (descanso curto)' : track.recovery === 'long_rest' ? ' (descanso longo)' : ''}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(Object.keys(kindLabels) as (keyof typeof kindLabels)[]).map((kind) => {
        const entries = abilities.filter((entry) => entry.kind === kind);
        if (entries.length === 0) return null;
        return (
          <section key={kind}>
            <h3 className="eyebrow mb-2">{kindLabels[kind]}</h3>
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li key={`${entry.source}-${entry.name}`}>
                  <details className="rounded-md border border-line px-3 py-2 text-sm open:bg-raised/40">
                    <summary className="cursor-pointer">
                      <span className="text-fg">{entry.name}</span> <span className="text-xs text-fg-subtle">{entry.source}</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-fg-secondary">{entry.description}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {spells.length > 0 ? (
        <section>
          <h3 className="eyebrow mb-2">Magias ({spells.length})</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {spells.map((spell) => {
              const data = dnd5eSpellDataSchema.parse(spell.data);
              return (
                <li key={spell.name} className="flex justify-between gap-2 border-b border-line py-1">
                  <span className={data.prepared ? 'text-fg' : 'text-fg-muted'}>{spell.name}</span>
                  <span className="text-xs text-fg-subtle">{data.circle === 0 ? 'Truque' : `${data.circle}º`}</span>
                </li>
              );
            })}
          </ul>
          {derived.spellcasting ? (
            <p className="mt-2 text-xs text-fg-muted">
              CD das magias {derived.spellcasting.saveDc} · ataque mágico {formatModifier(derived.spellcasting.attackBonus)} ({abilityLabels[derived.spellcasting.ability].name}).
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="eyebrow mb-2">Inventário</h3>
        {items.length === 0 ? (
          <p className="text-sm text-fg-muted">Sem itens (escolha o equipamento ou o ouro inicial).</p>
        ) : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.name} className="flex justify-between gap-2 border-b border-line py-1">
                <span>
                  {item.quantity > 1 ? `${item.quantity} × ` : ''}
                  {item.name}
                </span>
                {item.isEquipped ? <span className="text-xs text-fg-accent">Equipado</span> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-fg-secondary">Ouro: {gold} PO</p>
      </section>
    </div>
  );
}
