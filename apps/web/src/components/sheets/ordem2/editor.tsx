'use client';

import {
  ORDEM2_APTITUDE_FIELDS,
  ORDEM2_ATTRIBUTES,
  ORDEM2_EQUIPMENT_KINDS,
  ORDEM2_PROFILES,
  ORDEM2_SETTINGS,
  ORDEM2_TIERS,
  ordem2AttributeDescriptions,
  ordem2AttributeLabels,
  ordem2EquipmentKindLabels,
  ordem2ProfileDescriptions,
  ordem2ProfileLabels,
  ordem2RelationGradeLabels,
  ordem2SettingLabels,
  ordem2SkillsFor,
  ordem2TierLabels,
  type Ordem2Sheet,
} from '@codexveil/rpg-systems/ordem2';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { DieSelect } from './die-select';

type Change = (next: Ordem2Sheet) => void;

/** Identidade e números da ficha: cenário, perfil, vocação, nível, patamar, PV e PD máximos. */
export function Ordem2IdentityEditor({
  sheet,
  onChange,
  disabled,
  lockSetting,
}: {
  sheet: Ordem2Sheet;
  onChange: Change;
  disabled?: boolean;
  /** Na campanha, o cenário vem das regras do mestre. */
  lockSetting?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField
        id={`${id}-setting`}
        label="Cenário"
        value={sheet.setting}
        disabled={disabled || lockSetting}
        onChange={(event) =>
          onChange({ ...sheet, setting: event.target.value as Ordem2Sheet['setting'] })
        }
      >
        {ORDEM2_SETTINGS.map((setting) => (
          <option key={setting} value={setting}>
            {ordem2SettingLabels[setting]}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${id}-profile`}
        label="Perfil"
        value={sheet.profile ?? ''}
        disabled={disabled}
        hint={sheet.profile ? ordem2ProfileDescriptions[sheet.profile] : undefined}
        onChange={(event) =>
          onChange({
            ...sheet,
            profile: (event.target.value || null) as Ordem2Sheet['profile'],
          })
        }
      >
        <option value="">Escolha…</option>
        {ORDEM2_PROFILES.map((profile) => (
          <option key={profile} value={profile}>
            {ordem2ProfileLabels[profile]}
          </option>
        ))}
      </SelectField>
      <TextField
        id={`${id}-vocation`}
        label="Vocação"
        value={sheet.vocation}
        disabled={disabled}
        maxLength={120}
        placeholder="Ex.: Ferreira, Médico, Detetive"
        onChange={(event) => onChange({ ...sheet, vocation: event.target.value })}
      />
      <SelectField
        id={`${id}-level`}
        label="Nível"
        value={String(sheet.level)}
        disabled={disabled}
        onChange={(event) => onChange({ ...sheet, level: Number(event.target.value) })}
      >
        {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${id}-tier`}
        label="Patamar"
        hint="+1 por patamar acima de iniciante nas tabelas de lesão e trauma."
        value={sheet.tier}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...sheet, tier: event.target.value as Ordem2Sheet['tier'] })
        }
      >
        {ORDEM2_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {ordem2TierLabels[tier]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={`${id}-hp`}
          label="PV máximos"
          type="number"
          min={1}
          max={999}
          value={sheet.maxHitPoints}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...sheet, maxHitPoints: Math.max(1, Number(event.target.value) || 1) })
          }
        />
        <TextField
          id={`${id}-pd`}
          label="PD máximos"
          type="number"
          min={1}
          max={999}
          value={sheet.maxDetermination}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...sheet, maxDetermination: Math.max(1, Number(event.target.value) || 1) })
          }
        />
      </div>
    </div>
  );
}

/** Atributos, perícias (com modificadores fixos) e campos de Aptidão. */
export function Ordem2StatsEditor({
  sheet,
  onChange,
  disabled,
}: {
  sheet: Ordem2Sheet;
  onChange: Change;
  disabled?: boolean;
}) {
  const id = useId();
  const fields = ORDEM2_APTITUDE_FIELDS[sheet.setting];
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {ORDEM2_ATTRIBUTES.map((attribute) => (
          <label
            key={attribute}
            htmlFor={`${id}-${attribute}`}
            className="flex flex-col gap-1 rounded-md border border-line bg-sunken p-3"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-lg">{ordem2AttributeLabels[attribute]}</span>
              <DieSelect
                id={`${id}-${attribute}`}
                label={ordem2AttributeLabels[attribute]}
                value={sheet.attributes[attribute]}
                disabled={disabled}
                allowD20
                onChange={(die) =>
                  onChange({ ...sheet, attributes: { ...sheet.attributes, [attribute]: die } })
                }
              />
            </span>
            <span className="text-xs text-fg-muted">{ordem2AttributeDescriptions[attribute]}</span>
          </label>
        ))}
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg">Perícias</h3>
        <p className="mb-3 text-xs text-fg-muted">
          d4 destreinado · d6 treinado · d8 especialista · d10 mestre · d12 grão-mestre. O
          modificador fixo é para sequelas e efeitos permanentes.
        </p>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {ordem2SkillsFor(sheet.setting).map((skill) => {
            const value = sheet.skills[skill.key] ?? { die: 4 as const, modifier: 0 };
            return (
              <div key={skill.key} className="flex items-center gap-2 border-b border-line py-1.5">
                <span className="min-w-0 flex-1 text-sm">
                  {skill.labels[sheet.setting]}
                  <span className="ml-1 text-xs text-fg-muted">
                    ({ordem2AttributeLabels[skill.attribute]})
                  </span>
                </span>
                <DieSelect
                  id={`${id}-skill-${skill.key}`}
                  label={`${skill.labels[sheet.setting]}: dado`}
                  value={value.die}
                  disabled={disabled}
                  onChange={(die) =>
                    onChange({
                      ...sheet,
                      skills: { ...sheet.skills, [skill.key]: { ...value, die } },
                    })
                  }
                />
                <input
                  type="number"
                  aria-label={`${skill.labels[sheet.setting]}: modificador`}
                  min={-10}
                  max={10}
                  value={value.modifier}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...sheet,
                      skills: {
                        ...sheet.skills,
                        [skill.key]: {
                          ...value,
                          modifier: Math.trunc(Number(event.target.value) || 0),
                        },
                      },
                    })
                  }
                  className="tabular h-9 w-14 rounded-md border border-line-strong bg-sunken px-2 text-sm"
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg">Campos de Aptidão</h3>
        <p className="mb-3 text-xs text-fg-muted">
          Campos com dado próprio; os outros usam o dado de Aptidão.
          {sheet.setting === 'medieval' ? ' Erudição d6 ou mais = alfabetizado.' : ''}
        </p>
        <div className="flex flex-wrap gap-3">
          {fields.map((field) => {
            const own = sheet.aptitudes.find((entry) => entry.field === field.key);
            return (
              <div
                key={field.key}
                className="flex items-center gap-2 rounded-md border border-line px-2 py-1"
              >
                <span className="text-sm">{field.label}</span>
                <DieSelect
                  id={`${id}-apt-${field.key}`}
                  label={`Aptidão (${field.label})`}
                  value={own?.die ?? sheet.skills.aptidao?.die ?? 4}
                  disabled={disabled}
                  onChange={(die) =>
                    onChange({
                      ...sheet,
                      aptitudes: [
                        ...sheet.aptitudes.filter((entry) => entry.field !== field.key),
                        { field: field.key, die },
                      ],
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Habilidades e equipamento (armas com dano "RA+3", proteções com pontos de armadura). */
export function Ordem2GearEditor({
  sheet,
  onChange,
  disabled,
}: {
  sheet: Ordem2Sheet;
  onChange: Change;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg">Habilidades</h3>
        <p className="-mt-2 text-xs text-fg-muted">
          Você começa com uma habilidade do perfil e uma da vocação; anote o texto da ficha pronta.
        </p>
        {sheet.abilities.map((ability, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <TextField
                id={`${id}-ab-${index}`}
                label="Nome"
                value={ability.name}
                disabled={disabled}
                maxLength={160}
                onChange={(event) =>
                  onChange({
                    ...sheet,
                    abilities: sheet.abilities.map((entry, position) =>
                      position === index ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
              <TextField
                id={`${id}-ab-src-${index}`}
                label="Origem"
                value={ability.source}
                disabled={disabled}
                maxLength={80}
                placeholder="Perfil, vocação, treino…"
                onChange={(event) =>
                  onChange({
                    ...sheet,
                    abilities: sheet.abilities.map((entry, position) =>
                      position === index ? { ...entry, source: event.target.value } : entry,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="self-end"
                aria-label={`Remover ${ability.name}`}
                disabled={disabled}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                onClick={() =>
                  onChange({
                    ...sheet,
                    abilities: sheet.abilities.filter((_, position) => position !== index),
                  })
                }
              />
            </div>
            <TextareaField
              id={`${id}-ab-text-${index}`}
              label="Como funciona"
              rows={3}
              value={ability.text}
              disabled={disabled}
              maxLength={6000}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  abilities: sheet.abilities.map((entry, position) =>
                    position === index ? { ...entry, text: event.target.value } : entry,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={disabled || sheet.abilities.length >= 60}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            onChange({
              ...sheet,
              abilities: [...sheet.abilities, { name: 'Nova habilidade', source: '', text: '' }],
            })
          }
        >
          Adicionar habilidade
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg">Equipamento</h3>
        {sheet.equipment.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_12rem_8rem_6rem_auto]"
          >
            <TextField
              id={`${id}-eq-${index}`}
              label="Item"
              value={item.name}
              disabled={disabled}
              maxLength={160}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  equipment: sheet.equipment.map((entry, position) =>
                    position === index ? { ...entry, name: event.target.value } : entry,
                  ),
                })
              }
            />
            <SelectField
              id={`${id}-eq-kind-${index}`}
              label="Tipo"
              value={item.kind}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  equipment: sheet.equipment.map((entry, position) =>
                    position === index
                      ? {
                          ...entry,
                          kind: event.target.value as (typeof ORDEM2_EQUIPMENT_KINDS)[number],
                        }
                      : entry,
                  ),
                })
              }
            >
              {ORDEM2_EQUIPMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {ordem2EquipmentKindLabels[kind]}
                </option>
              ))}
            </SelectField>
            <TextField
              id={`${id}-eq-dmg-${index}`}
              label="Dano"
              value={item.damage}
              disabled={disabled}
              maxLength={80}
              placeholder="RA+3"
              onChange={(event) =>
                onChange({
                  ...sheet,
                  equipment: sheet.equipment.map((entry, position) =>
                    position === index ? { ...entry, damage: event.target.value } : entry,
                  ),
                })
              }
            />
            <TextField
              id={`${id}-eq-armor-${index}`}
              label="Armadura"
              type="number"
              min={0}
              max={20}
              value={item.armor}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...sheet,
                  equipment: sheet.equipment.map((entry, position) =>
                    position === index
                      ? {
                          ...entry,
                          armor: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                        }
                      : entry,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="self-end"
              aria-label={`Remover ${item.name}`}
              disabled={disabled}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                onChange({
                  ...sheet,
                  equipment: sheet.equipment.filter((_, position) => position !== index),
                })
              }
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={disabled || sheet.equipment.length >= 80}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={() =>
            onChange({
              ...sheet,
              equipment: [
                ...sheet.equipment,
                { name: 'Novo item', kind: 'outro', damage: '', armor: 0, notes: '' },
              ],
            })
          }
        >
          Adicionar item
        </Button>
      </section>
    </div>
  );
}

/** Relações (afinidade, vínculo, devoção). */
export function Ordem2RelationsEditor({
  sheet,
  onChange,
  disabled,
}: {
  sheet: Ordem2Sheet;
  onChange: Change;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <section className="flex flex-col gap-3">
      {sheet.relations.map((relation, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_10rem_auto]"
        >
          <TextField
            id={`${id}-rel-${index}`}
            label="Pessoa"
            value={relation.name}
            disabled={disabled}
            maxLength={160}
            onChange={(event) =>
              onChange({
                ...sheet,
                relations: sheet.relations.map((entry, position) =>
                  position === index ? { ...entry, name: event.target.value } : entry,
                ),
              })
            }
          />
          <SelectField
            id={`${id}-rel-grade-${index}`}
            label="Grau"
            value={String(relation.grade)}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...sheet,
                relations: sheet.relations.map((entry, position) =>
                  position === index
                    ? { ...entry, grade: Number(event.target.value) as 1 | 2 | 3 }
                    : entry,
                ),
              })
            }
          >
            {([1, 2, 3] as const).map((grade) => (
              <option key={grade} value={grade}>
                {grade} · {ordem2RelationGradeLabels[grade]}
              </option>
            ))}
          </SelectField>
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            aria-label={`Remover ${relation.name}`}
            disabled={disabled}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() =>
              onChange({
                ...sheet,
                relations: sheet.relations.filter((_, position) => position !== index),
              })
            }
          />
          <TextareaField
            id={`${id}-rel-text-${index}`}
            label="O que sente por ela"
            rows={2}
            value={relation.description}
            disabled={disabled}
            maxLength={2000}
            fieldClassName="sm:col-span-3"
            onChange={(event) =>
              onChange({
                ...sheet,
                relations: sheet.relations.map((entry, position) =>
                  position === index ? { ...entry, description: event.target.value } : entry,
                ),
              })
            }
          />
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={disabled || sheet.relations.length >= 20}
        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        onClick={() =>
          onChange({
            ...sheet,
            relations: [
              ...sheet.relations,
              { name: 'Nova relação', grade: 1, description: '', invoked: false },
            ],
          })
        }
      >
        Adicionar relação
      </Button>
    </section>
  );
}
