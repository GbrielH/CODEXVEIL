'use client';

import {
  ALIGNMENTS,
  abilityLabels,
  catalogItemName,
  combatSummary,
  findFeat,
  formatDistance,
  languageGrants,
  languageName,
  listClasses,
  SRD_BACKGROUNDS,
  SRD_SPECIES,
  skillDefinitions,
  skillGrants,
  startingEquipment,
  toolGrants,
  type ClassDefinition,
  type Dnd5eDraft,
  type Skill,
} from '@codexveil/rpg-systems/dnd5e';
import { useId, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { TextareaField } from '@/components/ui/field';
import { cx } from '@/lib/cx';

function PickerCard({
  selected,
  onSelect,
  title,
  subtitle,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'flex h-full flex-col gap-1.5 rounded-md border p-3 text-left transition-colors',
        selected ? 'border-parchment-300/70 bg-parchment-200/10 shadow-[inset_0_0_0_1px_rgb(228_216_189/0.25)]' : 'border-line hover:border-line-strong hover:bg-hover',
      )}
    >
      <span className="font-display text-base text-fg">{title}</span>
      {subtitle ? <span className="text-xs text-fg-accent">{subtitle}</span> : null}
      {children ? <span className="text-xs leading-relaxed text-fg-muted">{children}</span> : null}
    </button>
  );
}

function FeatureList({ items }: { items: { level: number; name: string; description: string }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((feature) => (
        <li key={`${feature.level}-${feature.name}`}>
          <details className="rounded-md border border-line px-3 py-2 text-sm open:bg-raised/40">
            <summary className="cursor-pointer">
              <Badge className="mr-2">{feature.level}º</Badge>
              <span className="text-fg">{feature.name}</span>
            </summary>
            <p className="mt-2 leading-relaxed text-fg-secondary">{feature.description}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Classe
// ---------------------------------------------------------------------------

export function ClassPicker({ value, onSelect }: { value: string; onSelect: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Classe" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {listClasses().map((entry) => (
        <PickerCard
          key={entry.id}
          selected={entry.id === value}
          onSelect={() => onSelect(entry.id)}
          title={entry.name}
          subtitle={`${entry.primaryAbilityLabel} · Dado de vida ${entry.hitDie} · Complexidade ${entry.complexity.toLowerCase()}`}
        >
          {entry.summary}
        </PickerCard>
      ))}
    </div>
  );
}

export function ClassDetails({ classDef, level }: { classDef: ClassDefinition; level: number }) {
  const features = classDef.features.filter((feature) => feature.level <= level);
  const subclassFeatures = level >= 3 ? classDef.subclass.features.filter((feature) => feature.level <= level) : [];
  const skillText =
    classDef.skillChoices.options === 'any'
      ? `Escolha ${classDef.skillChoices.count} perícias quaisquer`
      : `Escolha ${classDef.skillChoices.count}: ${classDef.skillChoices.options.map((skill) => skillDefinitions[skill].label).join(', ')}`;
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-card/60 p-4">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-fg-muted">Atributo principal</dt>
        <dd>{classDef.primaryAbilityLabel}</dd>
        <dt className="text-fg-muted">Pontos de vida</dt>
        <dd>
          {classDef.hitDie} por nível ({classDef.hitDie.slice(1)} + Constituição no 1º nível)
        </dd>
        <dt className="text-fg-muted">Salvaguardas</dt>
        <dd>{classDef.savingThrows.map((ability) => abilityLabels[ability].name).join(' e ')}</dd>
        <dt className="text-fg-muted">Perícias</dt>
        <dd>{skillText}</dd>
        <dt className="text-fg-muted">Armas</dt>
        <dd>{classDef.weaponLabel}</dd>
        <dt className="text-fg-muted">Armaduras</dt>
        <dd>{classDef.armorLabel}</dd>
        {classDef.tools.length > 0 || classDef.toolChoice ? (
          <>
            <dt className="text-fg-muted">Ferramentas</dt>
            <dd>{[...classDef.tools.map(catalogItemName), classDef.toolChoice?.label].filter(Boolean).join(', ')}</dd>
          </>
        ) : null}
      </dl>
      <div>
        <h3 className="eyebrow mb-2">Habilidades até o {level}º nível</h3>
        <FeatureList items={features} />
      </div>
      {level >= 3 ? (
        <div>
          <h3 className="eyebrow mb-1">Subclasse do SRD: {classDef.subclass.name}</h3>
          <p className="mb-2 text-sm text-fg-muted">{classDef.subclass.description}</p>
          <FeatureList items={subclassFeatures} />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          A subclasse ({classDef.subclass.name}, no SRD) é escolhida no 3º nível.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Antecedente e espécie
// ---------------------------------------------------------------------------

export function BackgroundPicker({ value, onSelect }: { value: string; onSelect: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Antecedente" className="grid gap-2 sm:grid-cols-2">
      {SRD_BACKGROUNDS.map((background) => (
        <PickerCard
          key={background.id}
          selected={background.id === value}
          onSelect={() => onSelect(background.id)}
          title={background.name}
          subtitle={`Atributos: ${background.abilities.map((ability) => abilityLabels[ability].abbreviation).join(', ')} · Talento: ${findFeat(background.feat)?.name ?? background.feat}`}
        >
          {background.summary} Perícias: {background.skills.map((skill) => skillDefinitions[skill].label).join(' e ')}. Ferramenta:{' '}
          {typeof background.tool === 'string' ? catalogItemName(background.tool) : 'um jogo à escolha'}.
        </PickerCard>
      ))}
    </div>
  );
}

export function SpeciesPicker({ value, onSelect }: { value: string; onSelect: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Espécie" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {SRD_SPECIES.map((species) => (
        <PickerCard
          key={species.id}
          selected={species.id === value}
          onSelect={() => onSelect(species.id)}
          title={species.name}
          subtitle={`${species.sizeLabel} · ${formatDistance(species.speed, 'm')}`}
        >
          {species.summary}
        </PickerCard>
      ))}
    </div>
  );
}

export function SpeciesDetails({ speciesId, level }: { speciesId: string; level: number }) {
  const species = SRD_SPECIES.find((entry) => entry.id === speciesId);
  if (!species) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card/60 p-4">
      <h3 className="eyebrow">Traços de {species.name}</h3>
      <FeatureList items={species.traits.filter((trait) => trait.level <= level)} />
      {species.traits.some((trait) => trait.level > level) ? (
        <p className="text-xs text-fg-subtle">
          Mais tarde: {species.traits.filter((trait) => trait.level > level).map((trait) => `${trait.name} (${trait.level}º nível)`).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proficiências
// ---------------------------------------------------------------------------

export function ProficiencySummary({ draft }: { draft: Dnd5eDraft }) {
  const skills = skillGrants(draft);
  const tools = toolGrants(draft);
  const languages = languageGrants(draft);
  return (
    <div className="grid gap-4 rounded-md border border-line bg-card/60 p-4 text-sm md:grid-cols-3">
      <div>
        <h3 className="eyebrow mb-2">Perícias</h3>
        <ul className="flex flex-col gap-1">
          {skills.length === 0 ? <li className="text-fg-muted">Nenhuma ainda.</li> : null}
          {skills.map((grant) => (
            <li key={`${grant.id}-${grant.source}`}>
              {skillDefinitions[grant.id as Skill]?.label ?? grant.id} <span className="text-xs text-fg-subtle">· {grant.source}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="eyebrow mb-2">Ferramentas</h3>
        <ul className="flex flex-col gap-1">
          {tools.length === 0 ? <li className="text-fg-muted">Nenhuma.</li> : null}
          {tools.map((grant) => (
            <li key={`${grant.id}-${grant.source}`}>
              {catalogItemName(grant.id)} <span className="text-xs text-fg-subtle">· {grant.source}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="eyebrow mb-2">Idiomas</h3>
        <ul className="flex flex-col gap-1">
          {languages.map((grant) => (
            <li key={`${grant.id}-${grant.source}`}>
              {languageName(grant.id)} <span className="text-xs text-fg-subtle">· {grant.source}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipamento
// ---------------------------------------------------------------------------

export function EquipmentPreview({ draft }: { draft: Dnd5eDraft }) {
  const equipment = startingEquipment(draft);
  const combat = combatSummary(draft);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card/60 p-4 text-sm">
      <h3 className="eyebrow">Você começa com</h3>
      {equipment.items.length === 0 ? (
        <p className="text-fg-muted">Nenhum item escolhido ainda.</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {equipment.items.map((item) => (
            <li key={`${item.catalogId}-${item.name}`}>
              {item.quantity > 1 ? `${item.quantity} × ` : ''}
              {item.name}
            </li>
          ))}
        </ul>
      )}
      <p className="text-fg-secondary">
        {equipment.gold} PO · CA {combat.armorClass} ({combat.armorClassSource})
      </p>
      <p className="text-xs text-fg-subtle">
        Moedas podem ser gastas em equipamento depois, na ficha. Em níveis mais altos, o mestre pode dar itens ou ouro extras.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhes
// ---------------------------------------------------------------------------

export function AlignmentPicker({
  value,
  allowEvil,
  error,
  onChange,
}: {
  value: string;
  allowEvil: boolean;
  error?: string | undefined;
  onChange: (id: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-fg">Alinhamento</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ALIGNMENTS.map((alignment) => {
          const disabled = alignment.evil && !allowEvil;
          return (
            <label
              key={alignment.id}
              className={cx(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                value === alignment.id ? 'border-parchment-300/70 bg-parchment-200/10' : 'border-line hover:bg-hover',
                disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
              )}
            >
              <input
                type="radio"
                name={name}
                value={alignment.id}
                checked={value === alignment.id}
                disabled={disabled}
                onChange={() => onChange(alignment.id)}
                className="h-4 w-4 accent-wine-500"
              />
              {alignment.name} <span className="text-xs text-fg-subtle">({alignment.abbreviation})</span>
            </label>
          );
        })}
      </div>
      {!allowEvil ? <p className="text-xs text-fg-subtle">O mestre desta campanha não liberou alinhamentos malignos.</p> : null}
      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const DETAIL_FIELDS = [
  { key: 'appearance', label: 'Aparência', max: 4000, rows: 3 },
  { key: 'personality', label: 'Personalidade', max: 4000, rows: 3 },
  { key: 'ideals', label: 'Ideais', max: 2000, rows: 2 },
  { key: 'bonds', label: 'Vínculos', max: 2000, rows: 2 },
  { key: 'flaws', label: 'Defeitos', max: 2000, rows: 2 },
  { key: 'backstory', label: 'História', max: 20000, rows: 6 },
] as const;

export function DetailsFields({ draft, onChange }: { draft: Dnd5eDraft; onChange: (details: Dnd5eDraft['details']) => void }) {
  const id = useId();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {DETAIL_FIELDS.map((field) => (
        <TextareaField
          key={field.key}
          id={`${id}-${field.key}`}
          label={field.label}
          hint="Opcional. Pode ser preenchido depois, na ficha."
          maxLength={field.max}
          rows={field.rows}
          value={draft.details[field.key]}
          onChange={(event) => onChange({ ...draft.details, [field.key]: event.target.value })}
          fieldClassName={field.key === 'backstory' ? 'md:col-span-2' : undefined}
        />
      ))}
    </div>
  );
}
