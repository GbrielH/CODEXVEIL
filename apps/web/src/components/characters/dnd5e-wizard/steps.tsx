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
  findSpecies,
  listBackgrounds,
  listClasses,
  listSpecies,
  listSubclasses,
  skillDefinitions,
  skillGrants,
  startingEquipment,
  toolGrants,
  dnd5eOfficialPageUrl,
  englishName,
  matchesNameSearch,
  type ClassDefinition,
  type Dnd5eDraft,
  type Skill,
  type SubclassDefinition,
} from '@codexveil/rpg-systems/dnd5e';
import { ExternalLink } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { CharacterIcon } from '@/components/characters/character-icon';
import { Badge } from '@/components/ui/badge';
import { TextField, TextareaField } from '@/components/ui/field';
import { cx } from '@/lib/cx';

function PickerCard({
  selected,
  onSelect,
  title,
  subtitle,
  children,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  /** Nome em português; o original em inglês aparece pequeno ao lado, quando existe. */
  title: string;
  subtitle?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'flex h-full flex-col gap-1.5 rounded-md border p-3 text-left transition-colors',
        selected
          ? 'border-parchment-300/70 bg-parchment-200/10 shadow-[inset_0_0_0_1px_rgb(228_216_189/0.25)]'
          : 'border-line hover:border-line-strong hover:bg-hover',
      )}
    >
      <span className="flex items-center gap-2">
        {icon ? (
          <span className={cx('text-parchment-400', selected && 'text-fg-accent')}>{icon}</span>
        ) : null}
        <span className="font-display text-base text-fg">
          {title}
          {englishName(title) ? (
            <span className="ml-1.5 font-sans text-xs text-fg-muted">{englishName(title)}</span>
          ) : null}
        </span>
      </span>
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

/** Busca por nome em português ou inglês ("Golias" ou "Goliath"). */
function NameSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <TextField
      id={id}
      label={label}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Nome em português ou em inglês"
      fieldClassName="max-w-sm"
    />
  );
}

export function ClassPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const classes = listClasses().filter((entry) => matchesNameSearch(entry.name, query));
  return (
    <div className="flex flex-col gap-3">
      <NameSearch label="Buscar classe" value={query} onChange={setQuery} />
      {classes.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma classe com esse nome.</p>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Classe"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {classes.map((entry) => (
          <PickerCard
            key={entry.id}
            selected={entry.id === value}
            onSelect={() => onSelect(entry.id)}
            title={entry.name}
            icon={<CharacterIcon kind="class" id={entry.id} className="h-8 w-8" />}
            subtitle={
              entry.book
                ? `${entry.primaryAbilityLabel} · Dado de vida ${entry.hitDie} · ${entry.book}`
                : `${entry.primaryAbilityLabel} · Dado de vida ${entry.hitDie} · Complexidade ${entry.complexity.toLowerCase()}`
            }
          >
            <span className="line-clamp-4">{entry.summary}</span>
          </PickerCard>
        ))}
      </div>
    </div>
  );
}

function OfficialArtLink({
  kind,
  id,
  name,
}: {
  kind: 'class' | 'species';
  id: string;
  name: string;
}) {
  return (
    <a
      href={dnd5eOfficialPageUrl(kind, id)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 text-xs text-fg-brand underline-offset-2 hover:underline"
    >
      Ver {name} com as ilustrações oficiais (D&amp;D Beyond)
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

export function ClassDetails({
  classDef,
  level,
  subclass,
}: {
  classDef: ClassDefinition;
  level: number;
  subclass: SubclassDefinition | undefined;
}) {
  const features = classDef.features.filter((feature) => feature.level <= level);
  const subclasses = listSubclasses(classDef);
  const subclassFeatures =
    level >= 3 && subclass ? subclass.features.filter((feature) => feature.level <= level) : [];
  const skillText =
    classDef.skillChoices.options === 'any'
      ? `Escolha ${classDef.skillChoices.count} perícias quaisquer`
      : `Escolha ${classDef.skillChoices.count}: ${classDef.skillChoices.options.map((skill) => skillDefinitions[skill].label).join(', ')}`;
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-card/60 p-4">
      {classDef.book ? (
        <p className="text-xs text-fg-accent">{classDef.book}</p>
      ) : (
        <OfficialArtLink kind="class" id={classDef.id} name={classDef.name} />
      )}
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
            <dd>
              {[...classDef.tools.map(catalogItemName), classDef.toolChoice?.label]
                .filter(Boolean)
                .join(', ')}
            </dd>
          </>
        ) : null}
      </dl>
      <div>
        <h3 className="eyebrow mb-2">Habilidades até o {level}º nível</h3>
        <FeatureList items={features} />
      </div>
      {level >= 3 && subclass ? (
        <div>
          <h3 className="eyebrow mb-1">
            Subclasse: {subclass.name}
            {subclass.book ? ` (${subclass.book})` : ' (SRD)'}
          </h3>
          <p className="mb-2 text-sm whitespace-pre-line text-fg-muted">{subclass.description}</p>
          <FeatureList items={subclassFeatures} />
        </div>
      ) : level >= 3 ? (
        <p className="text-sm text-fg-muted">
          Escolha a subclasse abaixo ({subclasses.length} opções).
        </p>
      ) : (
        <p className="text-sm text-fg-muted">
          A subclasse é escolhida no 3º nível
          {subclasses.length > 0
            ? ` (${subclasses.length === 1 ? subclasses[0]!.name : `${subclasses.length} opções`})`
            : ''}
          .
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Antecedente e espécie
// ---------------------------------------------------------------------------

export function BackgroundPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Antecedente" className="grid gap-2 sm:grid-cols-2">
      {listBackgrounds().map((background) => (
        <PickerCard
          key={background.id}
          selected={background.id === value}
          onSelect={() => onSelect(background.id)}
          title={background.name}
          subtitle={
            background.book
              ? `${background.book} · Atributos à escolha · Talento de origem à escolha`
              : `Atributos: ${background.abilities.map((ability) => abilityLabels[ability].abbreviation).join(', ')} · Talento: ${findFeat(background.feat)?.name ?? background.feat}`
          }
        >
          <span className="line-clamp-4 whitespace-pre-line">{background.summary}</span>
          {background.skills.length
            ? ` Perícias: ${background.skills.map((skill) => skillDefinitions[skill].label).join(' e ')}.`
            : ''}
          {background.tool
            ? ` Ferramenta: ${typeof background.tool === 'string' ? catalogItemName(background.tool) : 'um jogo à escolha'}.`
            : ''}
        </PickerCard>
      ))}
    </div>
  );
}

export function SpeciesPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const list = listSpecies().filter((species) => matchesNameSearch(species.name, query));
  return (
    <div className="flex flex-col gap-3">
      <NameSearch label="Buscar espécie" value={query} onChange={setQuery} />
      {list.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma espécie com esse nome.</p>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Espécie"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {list.map((species) => (
          <PickerCard
            key={species.id}
            selected={species.id === value}
            onSelect={() => onSelect(species.id)}
            title={species.name}
            icon={<CharacterIcon kind="species" id={species.id} className="h-8 w-8" />}
            subtitle={`${species.sizeLabel} · ${formatDistance(species.speed, 'm')}${species.book ? ` · ${species.book}` : ''}`}
          >
            <span className="line-clamp-4">{species.summary}</span>
          </PickerCard>
        ))}
      </div>
    </div>
  );
}

export function SpeciesDetails({ speciesId, level }: { speciesId: string; level: number }) {
  const species = findSpecies(speciesId);
  if (!species) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card/60 p-4">
      <h3 className="eyebrow">Traços de {species.name}</h3>
      {species.book ? (
        <p className="text-sm whitespace-pre-line text-fg-muted">{species.summary}</p>
      ) : (
        <OfficialArtLink kind="species" id={species.id} name={species.name} />
      )}
      <FeatureList items={species.traits.filter((trait) => trait.level <= level)} />
      {species.traits.some((trait) => trait.level > level) ? (
        <p className="text-xs text-fg-subtle">
          Mais tarde:{' '}
          {species.traits
            .filter((trait) => trait.level > level)
            .map((trait) => `${trait.name} (${trait.level}º nível)`)
            .join(', ')}
          .
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
              {skillDefinitions[grant.id as Skill]?.label ?? grant.id}{' '}
              <span className="text-xs text-fg-subtle">· {grant.source}</span>
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
              {catalogItemName(grant.id)}{' '}
              <span className="text-xs text-fg-subtle">· {grant.source}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="eyebrow mb-2">Idiomas</h3>
        <ul className="flex flex-col gap-1">
          {languages.map((grant) => (
            <li key={`${grant.id}-${grant.source}`}>
              {languageName(grant.id)}{' '}
              <span className="text-xs text-fg-subtle">· {grant.source}</span>
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
        Moedas podem ser gastas em equipamento depois, na ficha. Em níveis mais altos, o mestre pode
        dar itens ou ouro extras.
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
                value === alignment.id
                  ? 'border-parchment-300/70 bg-parchment-200/10'
                  : 'border-line hover:bg-hover',
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
              {alignment.name}{' '}
              <span className="text-xs text-fg-subtle">({alignment.abbreviation})</span>
            </label>
          );
        })}
      </div>
      {!allowEvil ? (
        <p className="text-xs text-fg-subtle">
          O mestre desta campanha não liberou alinhamentos malignos.
        </p>
      ) : null}
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

export function DetailsFields({
  draft,
  onChange,
}: {
  draft: Dnd5eDraft;
  onChange: (details: Dnd5eDraft['details']) => void;
}) {
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
