'use client';

import {
  ABILITIES,
  SRD_SPELLS,
  abilityLabels,
  dnd5eSpellDataSchema,
  spellSchoolLabels,
  type Ability,
  type ChoiceSpec,
  type Dnd5eSpellData,
  type Selection,
  type SpellOption,
} from '@codexveil/rpg-systems/dnd5e';
import { Check, Search } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { HoverCard } from '@/components/ui/hover-card';
import { Select } from '@/components/ui/select';
import { SpellDetails } from '@/components/sheets/dnd5e/ability-details';
import { cx } from '@/lib/cx';

/** A partir de quantas opções a lista ganha um campo de busca. */
const SEARCH_AT = 10;

/** Comparação sem acentos e sem diferenciar maiúsculas. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Filtra opções pelo nome e pela descrição; as escolhidas continuam sempre visíveis. */
function useOptionFilter<T extends { name: string; description?: string | undefined }>(options: readonly T[], keep: (option: T) => boolean) {
  const [query, setQuery] = useState('');
  const term = normalize(query.trim());
  const visible = term ? options.filter((option) => keep(option) || normalize(`${option.name} ${option.description ?? ''}`).includes(term)) : options;
  return { query, setQuery, visible, searchable: options.length > SEARCH_AT };
}

function OptionSearch({ label, query, onChange, shown, total }: { label: string; query: string; onChange: (query: string) => void; shown: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 sm:max-w-sm">
        <span className="sr-only">Buscar em {label}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Digite para filtrar…"
          className="h-10 w-full rounded-md border border-line-strong bg-sunken pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none"
        />
      </label>
      {query ? (
        <span className="text-xs text-fg-muted" role="status">
          {shown} de {total}
        </span>
      ) : null}
    </div>
  );
}

interface ChoiceFieldProps {
  spec: ChoiceSpec;
  value: Selection | undefined;
  error?: string | undefined;
  onChange: (value: Selection) => void;
}

/** Desenha uma escolha exigida pelas regras, conforme o tipo. */
export function ChoiceField({ spec, value, error, onChange }: ChoiceFieldProps) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-label`} className="flex flex-col gap-3 rounded-md border border-line bg-raised/40 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${id}-label`} className="text-base leading-snug">
            {spec.label}
          </h3>
          <p className="text-xs text-fg-subtle">{spec.source}</p>
        </div>
        {spec.kind === 'multi' || spec.kind === 'spells' ? (
          <Badge tone={Array.isArray(value) && value.length === spec.count ? 'success' : 'neutral'}>
            {Array.isArray(value) ? value.length : 0} de {spec.count}
          </Badge>
        ) : null}
      </header>
      {spec.description ? <p className="-mt-1 text-sm text-fg-muted">{spec.description}</p> : null}
      {spec.kind === 'option' ? <OptionList spec={spec} value={typeof value === 'string' ? value : ''} onChange={onChange} /> : null}
      {spec.kind === 'multi' ? <MultiList spec={spec} value={Array.isArray(value) ? value : []} onChange={onChange} /> : null}
      {spec.kind === 'spells' ? <SpellPicker spec={spec} value={Array.isArray(value) ? value : []} onChange={onChange} /> : null}
      {spec.kind === 'ability_increase' ? (
        <AbilityIncrease spec={spec} value={value && typeof value === 'object' && !Array.isArray(value) ? value : {}} onChange={onChange} />
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function OptionList({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'option' }>; value: string; onChange: (value: string) => void }) {
  const name = useId();
  const filter = useOptionFilter(spec.options, (option) => option.id === value);
  return (
    <>
      {filter.searchable ? <OptionSearch label={spec.label} query={filter.query} onChange={filter.setQuery} shown={filter.visible.length} total={spec.options.length} /> : null}
      <div role="radiogroup" aria-label={spec.label} className="grid gap-2 sm:grid-cols-2">
        {filter.visible.map((option) => {
          const selected = option.id === value;
          const disabled = Boolean(option.disabledReason) && !selected;
          return (
            <label
              key={option.id}
              className={cx(
                'flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors',
                selected ? 'border-parchment-300/70 bg-parchment-200/10' : 'border-line hover:border-line-strong hover:bg-hover',
                disabled && 'cursor-not-allowed opacity-55 hover:bg-transparent',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-wine-500"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-fg">{option.name}</span>
                {option.description ? <span className="text-xs leading-relaxed text-fg-muted">{option.description}</span> : null}
                {option.disabledReason ? <span className="text-xs text-warning">{option.disabledReason}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}

function MultiList({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'multi' }>; value: string[]; onChange: (value: string[]) => void }) {
  const full = value.length >= spec.count;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  const detailed = spec.options.some((option) => option.description && option.description.length > 20);
  const filter = useOptionFilter(spec.options, (option) => value.includes(option.id));
  return (
    <>
      {filter.searchable ? <OptionSearch label={spec.label} query={filter.query} onChange={filter.setQuery} shown={filter.visible.length} total={spec.options.length} /> : null}
      <div className={cx('grid gap-2', detailed ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {filter.visible.map((option) => {
          const selected = value.includes(option.id);
          const disabled = !selected && (Boolean(option.disabledReason) || full);
          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              title={option.disabledReason}
              onClick={() => toggle(option.id)}
              className={cx(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                selected ? 'border-parchment-300/70 bg-parchment-200/10 text-fg' : 'border-line text-fg-secondary hover:border-line-strong hover:bg-hover',
                disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                  selected ? 'border-parchment-300 bg-parchment-300 text-canvas' : 'border-line-strong',
                )}
              >
                {selected ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span>{option.name}</span>
                {option.description && detailed ? <span className="text-xs leading-relaxed text-fg-muted">{option.description}</span> : null}
                {option.disabledReason && !selected ? <span className="text-xs text-fg-subtle">{option.disabledReason}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const LEVEL_LABEL = (level: number) => (level === 0 ? 'Truque' : `${level}º círculo`);

/** Dados técnicos da magia do SRD no formato da ficha (para o cartão de detalhes). */
function srdSpellData(option: SpellOption): Dnd5eSpellData {
  const srd = SRD_SPELLS.find((spell) => spell.name === option.name);
  return dnd5eSpellDataSchema.parse({
    circle: option.level,
    school: option.school,
    castingTime: srd?.castingTime ?? '',
    range: srd?.range ?? '',
    components: srd?.components ?? '',
    duration: srd?.duration ?? '',
    concentration: option.concentration,
    ritual: option.ritual,
  });
}

function SpellPicker({ spec, value, onChange }: { spec: Extract<ChoiceSpec, { kind: 'spells' }>; value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | 'all'>('all');
  const levels = useMemo(() => [...new Set(spec.options.map((option) => option.level))].sort((a, b) => a - b), [spec.options]);
  const full = value.length >= spec.count;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return spec.options.filter((option) => (level === 'all' || option.level === level) && (!term || option.name.toLowerCase().includes(term)));
  }, [spec.options, query, level]);
  const toggle = (option: SpellOption) =>
    onChange(value.includes(option.id) ? value.filter((entry) => entry !== option.id) : [...value, option.id]);

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Magias escolhidas">
          {value.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry !== name))}
                className="rounded-full border border-parchment-300/60 bg-parchment-200/10 px-3 py-1 text-xs text-fg-accent hover:border-ember-400/60"
                aria-label={`Remover ${name}`}
              >
                {name} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar magia</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pelo nome (em inglês, como no SRD)"
            className="h-10 w-full rounded-md border border-line-strong bg-sunken pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-parchment-300 focus-visible:outline-none"
          />
        </label>
        {levels.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <span>Círculo</span>
            <Select
              value={String(level)}
              onChange={(event) => setLevel(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="w-40"
            >
              <option value="all">Todos</option>
              {levels.map((entry) => (
                <option key={entry} value={entry}>
                  {LEVEL_LABEL(entry)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-md border border-line p-1 sm:grid-cols-2" aria-label={spec.label}>
        {filtered.map((option) => {
          const selected = value.includes(option.id);
          const disabled = !selected && (Boolean(option.disabledReason) || full);
          return (
            <li key={option.id}>
              <HoverCard className="block" content={() => <SpellDetails name={option.name} data={srdSpellData(option)} description="" />}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={disabled}
                  title={option.disabledReason}
                  onClick={() => toggle(option)}
                  className={cx(
                    'flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left text-sm',
                    selected ? 'bg-parchment-200/10 text-fg' : 'text-fg-secondary hover:bg-hover',
                    disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.name}</span>
                    <span className="text-xs text-fg-subtle">
                      {LEVEL_LABEL(option.level)} · {spellSchoolLabels[option.school]}
                      {option.concentration ? ' · C' : ''}
                      {option.ritual ? ' · R' : ''}
                      {option.disabledReason && !selected ? ` · ${option.disabledReason}` : ''}
                    </span>
                  </span>
                  {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-fg-accent" aria-hidden="true" /> : null}
                </button>
              </HoverCard>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="p-3 text-sm text-fg-muted">Nenhuma magia encontrada.</li> : null}
      </ul>
      <p className="text-xs text-fg-subtle">C = concentração · R = ritual. Nomes e dados técnicos do SRD 5.2 (CC-BY-4.0).</p>
    </div>
  );
}

function AbilityIncrease({
  spec,
  value,
  onChange,
}: {
  spec: Extract<ChoiceSpec, { kind: 'ability_increase' }>;
  value: Partial<Record<Ability, number>>;
  onChange: (value: Partial<Record<Ability, number>>) => void;
}) {
  const entries = ABILITIES.filter((ability) => (value[ability] ?? 0) > 0);
  // O modo do Aumento no Valor de Atributo fica guardado: com nada escolhido, não dá para deduzi-lo.
  const [asiMode, setAsiMode] = useState<'two' | 'split'>(() => (entries.length === 1 && value[entries[0]!] === 2 ? 'two' : 'split'));
  const allOnes = spec.mode === 'background' && entries.length === 3;
  const twoAndOne = !allOnes;
  const plusTwo = entries.find((ability) => value[ability] === 2) ?? '';
  const ones = entries.filter((ability) => value[ability] === 1);

  if (spec.mode === 'background') {
    const setMode = (mode: 'split' | 'even') =>
      onChange(mode === 'even' ? Object.fromEntries(spec.abilities.map((ability) => [ability, 1])) : {});
    const setSplit = (two: Ability | '', one: Ability | '') => {
      const next: Partial<Record<Ability, number>> = {};
      if (two) next[two] = 2;
      if (one && one !== two) next[one] = 1;
      onChange(next);
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de distribuir">
          <ModeButton selected={twoAndOne} onClick={() => setMode('split')}>
            +2 e +1
          </ModeButton>
          <ModeButton selected={allOnes} onClick={() => setMode('even')}>
            +1 nos três
          </ModeButton>
        </div>
        {twoAndOne ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <AbilitySelect label="+2 em" abilities={spec.abilities} value={plusTwo} onChange={(ability) => setSplit(ability, ones[0] ?? '')} />
            <AbilitySelect
              label="+1 em"
              abilities={spec.abilities.filter((ability) => ability !== plusTwo)}
              value={ones[0] ?? ''}
              onChange={(ability) => setSplit(plusTwo, ability)}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-secondary">{spec.abilities.map((ability) => `${abilityLabels[ability].name} +1`).join(' · ')}</p>
        )}
      </div>
    );
  }

  const asiTwo = asiMode === 'two';
  const setAsi = (mode: 'two' | 'split', first: Ability | '', second: Ability | '') => {
    setAsiMode(mode);
    if (mode === 'two') onChange(first ? { [first]: 2 } : {});
    else {
      const next: Partial<Record<Ability, number>> = {};
      if (first) next[first] = 1;
      if (second && second !== first) next[second] = 1;
      onChange(next);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de distribuir">
        <ModeButton selected={asiTwo} onClick={() => setAsi('two', '', '')}>
          +2 em um atributo
        </ModeButton>
        <ModeButton selected={!asiTwo} onClick={() => setAsi('split', '', '')}>
          +1 em dois atributos
        </ModeButton>
      </div>
      {asiTwo ? (
        <AbilitySelect label="+2 em" abilities={spec.abilities} value={entries[0] ?? ''} onChange={(ability) => setAsi('two', ability, '')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AbilitySelect label="+1 em" abilities={spec.abilities} value={ones[0] ?? ''} onChange={(ability) => setAsi('split', ability, ones[1] ?? '')} />
          <AbilitySelect
            label="+1 em"
            abilities={spec.abilities.filter((ability) => ability !== ones[0])}
            value={ones[1] ?? ''}
            onChange={(ability) => setAsi('split', ones[0] ?? '', ability)}
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'rounded-md border px-3 py-1.5 text-sm',
        selected ? 'border-parchment-300/70 bg-parchment-200/10 text-fg' : 'border-line text-fg-secondary hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}

function AbilitySelect({
  label,
  abilities,
  value,
  onChange,
}: {
  label: string;
  abilities: readonly Ability[];
  value: Ability | '';
  onChange: (ability: Ability | '') => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Ability | '')}
      >
        <option value="">Escolha…</option>
        {abilities.map((ability) => (
          <option key={ability} value={ability}>
            {abilityLabels[ability].name}
          </option>
        ))}
      </Select>
    </div>
  );
}
