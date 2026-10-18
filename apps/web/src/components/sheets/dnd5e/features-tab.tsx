'use client';

import { d20Expression } from '@codexveil/domain';
import {
  createCharacterAbility,
  createCharacterResource,
  deleteCharacterAbility,
  updateCharacterAbility,
  updateCharacterResource,
  type CharacterAbility,
  type Json,
} from '@codexveil/database';
import {
  ABILITIES,
  SPELL_SCHOOLS,
  abilityLabels,
  attackRollBonus,
  dnd5eAttackDataSchema,
  dnd5eSpellDataSchema,
  featureTurnCost,
  formatModifier,
  spellNamePt,
  spellSchoolLabels,
  spellSlotResources,
  type Dnd5eAttackData,
  type Dnd5eSpellData,
} from '@codexveil/rpg-systems/dnd5e';
import { ABILITY_ENTRY_KINDS, abilityEntryKindLabels, abilityEntrySchema, fieldErrorsFrom, type AbilityEntryKind, type FieldErrors } from '@codexveil/validation';
import { ChevronDown, Pencil, Plus, Sparkles, Swords, Trash2, WandSparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/ui/field';
import { HoverCard } from '@/components/ui/hover-card';
import { RollButton } from '@/components/dice/dice-roller';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { AttackDetails, FeatureDetails, SpellDetails } from './ability-details';
import { useSheet } from './context';
import { parseAttack } from './play-tab';

function parseSpell(data: unknown): Dnd5eSpellData {
  const parsed = dnd5eSpellDataSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : dnd5eSpellDataSchema.parse({});
}

const FEATURE_KINDS: AbilityEntryKind[] = ['class_feature', 'species_trait', 'feat', 'background_feature', 'other'];

/**
 * Habilidades e magias. Na ficha da campanha a lista se divide: a aba Jogo mostra só o que se usa
 * na mesa (`show="usable"`: custo de ação ou usos), e a aba Atributos, o restante (`show="passive"`).
 */
export function FeaturesTab({ withoutAttacks = false, show = 'all' }: { withoutAttacks?: boolean; show?: 'all' | 'usable' | 'passive' }) {
  const { abilities, permissions } = useSheet();
  const [editing, setEditing] = useState<{ entry: CharacterAbility | null; kind: AbilityEntryKind } | null>(null);
  const canEdit = permissions.canEditSheet;

  const attacks = abilities.filter((entry) => entry.kind === 'attack');
  const spells = abilities.filter((entry) => entry.kind === 'spell');
  const usable = (entry: CharacterAbility) => entry.resourceId !== null || featureTurnCost(entry.name) !== null;
  const features = abilities
    .filter((entry) => FEATURE_KINDS.includes(entry.kind))
    .filter((entry) => (show === 'usable' ? usable(entry) : show === 'passive' ? !usable(entry) : true));
  const showSpells = show === 'all' || (show === 'usable' && spells.length > 0);
  const showFeatures = show === 'all' || features.length > 0;
  const featureTitle = show === 'usable' ? 'Habilidades usáveis' : show === 'passive' ? 'Características' : 'Habilidades e características';

  const spellsByCircle = new Map<number, CharacterAbility[]>();
  for (const spell of spells) {
    const circle = parseSpell(spell.data).circle;
    spellsByCircle.set(circle, [...(spellsByCircle.get(circle) ?? []), spell]);
  }

  const addButton = (kind: AbilityEntryKind, label: string) =>
    canEdit ? (
      <Button size="sm" variant="secondary" onClick={() => setEditing({ entry: null, kind })} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
        {label}
      </Button>
    ) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {withoutAttacks || show === 'passive' ? null : <Card>
        <CardHeader icon={<Swords className="h-5 w-5" aria-hidden="true" />} title="Ataques" action={addButton('attack', 'Novo ataque')} />
        {attacks.length === 0 ? <p className="text-sm text-fg-muted">Nenhum ataque cadastrado.</p> : (
          <ul className="divide-y divide-line">
            {attacks.map((attack) => (
              <AttackRow key={attack.id} attack={attack} onEdit={() => setEditing({ entry: attack, kind: 'attack' })} />
            ))}
          </ul>
        )}
      </Card>}

      {showSpells ? (
      <Card>
        <CardHeader icon={<WandSparkles className="h-5 w-5" aria-hidden="true" />} title="Magias" action={addButton('spell', 'Nova magia')} />
        {canEdit ? <SpellSlotHelper /> : null}
        {spells.length === 0 ? <p className="text-sm text-fg-muted">Nenhuma magia cadastrada.</p> : (
          <div className="flex flex-col gap-4">
            {[...spellsByCircle.entries()]
              .sort(([a], [b]) => a - b)
              .map(([circle, list]) => (
                <section key={circle} aria-label={circle === 0 ? 'Truques' : `${circle}º círculo`}>
                  <h3 className="eyebrow mb-2 text-[11px]">{circle === 0 ? 'Truques' : `${circle}º círculo`}</h3>
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {list.map((spell) => (
                      <SpellRow key={spell.id} spell={spell} onEdit={() => setEditing({ entry: spell, kind: 'spell' })} />
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </Card>
      ) : null}

      {showFeatures ? (
      <Card>
        <CardHeader icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} title={featureTitle} action={addButton('class_feature', 'Nova habilidade')} />
        {features.length === 0 ? <p className="text-sm text-fg-muted">{show === 'usable' ? 'Nenhuma habilidade com uso ou custo de ação. As passivas ficam na aba Atributos.' : 'Registre habilidades de classe, talentos e características de espécie.'}</p> : (
          <ul className="flex flex-col gap-2">
            {features.map((feature) => (
              <FeatureRow key={feature.id} feature={feature} onEdit={() => setEditing({ entry: feature, kind: feature.kind })} />
            ))}
          </ul>
        )}
      </Card>
      ) : null}

      <AbilityFormModal state={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AttackRow({ attack, onEdit }: { attack: CharacterAbility; onEdit: () => void }) {
  const { derived, permissions } = useSheet();
  const data = parseAttack(attack.data);
  const bonus = formatModifier(attackRollBonus(data, derived));
  return (
    <li className="flex items-center gap-3 py-2">
      <RollButton expression={d20Expression(attackRollBonus(data, derived))} label={`Ataque: ${attack.name}`}>
        <span className="tabular block w-12 rounded-md border border-line-strong bg-raised py-1 text-center font-display text-lg text-fg-accent">
          {bonus}
        </span>
      </RollButton>
      <HoverCard className="block flex-1" content={() => <AttackDetails attack={attack} data={data} bonus={bonus} />}>
        <span className="block min-w-0">
          <span className="block truncate text-sm font-medium">{attack.name}</span>
          <span className="block truncate text-xs text-fg-muted">
            {[data.damage ? `${data.damage} ${data.damageType}`.trim() : null, data.range, data.ability ? abilityLabels[data.ability].abbreviation : 'bônus fixo'].filter(Boolean).join(' · ')}
          </span>
        </span>
      </HoverCard>
      {permissions.canEditSheet ? (
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${attack.name}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

function SpellRow({ spell, onEdit }: { spell: CharacterAbility; onEdit: () => void }) {
  const { permissions, setAbilities, run } = useSheet();
  const [open, setOpen] = useState(false);
  const data = parseSpell(spell.data);

  const togglePrepared = async () => {
    const next: Dnd5eSpellData = { ...data, prepared: !data.prepared };
    const saved = await run(
      () =>
        updateCharacterAbility(getSupabaseBrowserClient(), spell.id, {
          name: spell.name,
          source: spell.source,
          description: spell.description,
          data: next,
          resourceId: spell.resourceId,
        }),
      { failure: 'Não foi possível alterar a magia' },
    );
    if (saved) setAbilities((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
  };

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-2">
        {data.circle > 0 ? (
          <input
            type="checkbox"
            checked={data.prepared}
            disabled={!permissions.canEditSheet}
            onChange={() => void togglePrepared()}
            aria-label={`${spellNamePt(spell.name)} preparada`}
            title="Preparada"
            className="h-5 w-5 accent-wine-500"
          />
        ) : null}
        <HoverCard className="flex flex-1" content={() => <SpellDetails name={spellNamePt(spell.name)} data={data} description={spell.description} />}>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="truncate text-sm font-medium">{spellNamePt(spell.name)}</span>
            {data.concentration ? <Badge tone="info">Concentração</Badge> : null}
            {data.ritual ? <Badge tone="neutral">Ritual</Badge> : null}
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </HoverCard>
        {permissions.canEditSheet ? (
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${spell.name}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 pl-7 text-sm">
          <SpellDetails name={spellNamePt(spell.name)} data={data} description={spell.description} full />
        </div>
      ) : null}
    </li>
  );
}

function FeatureRow({ feature, onEdit }: { feature: CharacterAbility; onEdit: () => void }) {
  const { resources, adjustResource, permissions } = useSheet();
  const [open, setOpen] = useState(false);
  const resource = feature.resourceId ? resources.find((entry) => entry.id === feature.resourceId) : undefined;
  return (
    <li className="rounded-md border border-line px-3 py-2">
      <div className="flex items-center gap-2">
        <HoverCard className="flex flex-1" content={() => <FeatureDetails feature={feature} resource={resource} />}>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="truncate text-sm font-medium">{feature.name}</span>
            <Badge tone="neutral">{abilityEntryKindLabels[feature.kind]}</Badge>
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </HoverCard>
        {resource ? (
          <span className="flex items-center gap-1">
            <span className="tabular text-sm text-fg-accent">
              {resource.current}
              {resource.max === null ? '' : `/${resource.max}`}
            </span>
            {permissions.canEditPlay ? (
              <Button size="sm" variant="secondary" disabled={resource.current <= 0} onClick={() => adjustResource(resource, 'spend', 1)}>
                Usar
              </Button>
            ) : null}
          </span>
        ) : null}
        {permissions.canEditSheet ? (
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${feature.name}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 text-sm">
          {feature.source ? <p className="text-xs text-fg-muted">Origem: {feature.source}</p> : null}
          {feature.description ? <p className="mt-1 whitespace-pre-line font-serif leading-relaxed text-fg-secondary">{feature.description}</p> : <p className="text-xs text-fg-muted">Sem descrição.</p>}
        </div>
      ) : null}
    </li>
  );
}

/** Cria (ou ajusta) as trilhas de espaços de magia a partir do nível de conjurador. */
function SpellSlotHelper() {
  const { resources, character, setResources, run, derived } = useSheet();
  const [open, setOpen] = useState(false);
  const [casterLevel, setCasterLevel] = useState<number | null>(derived.level);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const apply = async () => {
    if (!casterLevel) return;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const ok = await run(
      async () => {
        const next = [...resources];
        for (const template of spellSlotResources(casterLevel)) {
          const existing = next.find((resource) => resource.key === template.key);
          const saved = existing
            ? await updateCharacterResource(client, existing.id, { label: template.label, current: Math.min(existing.current, template.max ?? 0), max: template.max, recovery: template.recovery })
            : await createCharacterResource(client, character.id, template);
          const index = next.findIndex((resource) => resource.id === saved.id);
          if (index >= 0) next[index] = saved;
          else next.push(saved);
        }
        return next;
      },
      { success: 'Espaços de magia atualizados.', failure: 'Não foi possível atualizar os espaços de magia' },
    );
    setBusy(false);
    if (ok) {
      setResources(ok);
      setOpen(false);
    }
  };

  return (
    <div className="mb-4">
      <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Configurar espaços de magia
      </Button>
      {open ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-line bg-raised p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-level`} className="text-sm font-medium">
              Nível de conjurador
            </label>
            <NumberInput id={`${id}-level`} value={casterLevel} min={1} max={20} onCommit={setCasterLevel} className="w-24" />
          </div>
          <Button size="sm" onClick={() => void apply()} loading={busy}>
            Aplicar tabela de conjurador
          </Button>
          <p className="w-full text-xs text-fg-muted">
            Usa a tabela de conjurador multiclasse do SRD 5.2. Meio-conjuradores somam metade do nível. Os espaços aparecem na aba “Jogo”.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface AbilityForm {
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  resourceId: string;
  spell: Dnd5eSpellData;
  attack: Dnd5eAttackData;
}

function AbilityFormModal({ state, onClose }: { state: { entry: CharacterAbility | null; kind: AbilityEntryKind } | null; onClose: () => void }) {
  const { character, resources, setAbilities, run } = useSheet();
  const id = useId();
  const [form, setForm] = useState<AbilityForm | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<typeof state>(null);

  if (state !== openedFor) {
    setOpenedFor(state);
    setErrors({});
    setForm(
      state
        ? {
            kind: state.entry?.kind ?? state.kind,
            name: state.entry?.name ?? '',
            source: state.entry?.source ?? '',
            description: state.entry?.description ?? '',
            resourceId: state.entry?.resourceId ?? '',
            spell: parseSpell(state.entry?.kind === 'spell' ? state.entry.data : {}),
            attack: parseAttack(state.entry?.kind === 'attack' ? state.entry.data : {}),
          }
        : null,
    );
  }

  const entry = state?.entry ?? null;
  const set = (patch: Partial<AbilityForm>) => setForm((current) => (current ? { ...current, ...patch } : current));

  const submit = async () => {
    if (!form) return;
    const parsed = abilityEntrySchema.safeParse({
      kind: form.kind,
      name: form.name,
      source: form.source,
      description: form.description,
      resourceId: form.resourceId || null,
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    const details =
      form.kind === 'spell'
        ? dnd5eSpellDataSchema.safeParse(form.spell)
        : form.kind === 'attack'
          ? dnd5eAttackDataSchema.safeParse(form.attack)
          : ({ success: true, data: {} } as const);
    if (!details.success) {
      setErrors({ _form: details.error.issues[0]?.message ?? 'Revise os detalhes.' });
      return;
    }
    const data = details.data as unknown as Json;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const saved = await run(
      () =>
        entry
          ? updateCharacterAbility(client, entry.id, { ...parsed.data, data })
          : createCharacterAbility(client, character.id, { ...parsed.data, data }),
      { success: entry ? 'Alterações salvas.' : 'Adicionado à ficha.', failure: 'Não foi possível salvar' },
    );
    setBusy(false);
    if (!saved) return;
    setAbilities((current) => (entry ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]));
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    const ok = await run(() => deleteCharacterAbility(getSupabaseBrowserClient(), entry.id), {
      success: 'Removido da ficha.',
      failure: 'Não foi possível remover',
    });
    if (ok === undefined) throw new Error('Nada foi removido.');
    setAbilities((current) => current.filter((item) => item.id !== entry.id));
    onClose();
  };

  const title = entry ? `Editar ${abilityEntryKindLabels[entry.kind].toLowerCase()}` : `Novo registro: ${form ? abilityEntryKindLabels[form.kind].toLowerCase() : ''}`;

  return (
    <Modal open={state !== null} onClose={onClose} title={title} busy={busy} size="lg">
      {form ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {errors._form ? (
            <p className="text-sm text-danger" role="alert">
              {errors._form}
            </p>
          ) : null}
          {!entry && form.kind !== 'spell' && form.kind !== 'attack' ? (
            <SelectField id={`${id}-kind`} label="Tipo" value={form.kind} onChange={(event) => set({ kind: event.target.value as AbilityEntryKind })}>
              {ABILITY_ENTRY_KINDS.filter((kind) => kind !== 'spell' && kind !== 'attack').map((kind) => (
                <option key={kind} value={kind}>
                  {abilityEntryKindLabels[kind]}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id={`${id}-name`} label="Nome" required maxLength={120} value={form.name} onChange={(event) => set({ name: event.target.value })} error={errors.name} />
            <TextField id={`${id}-source`} label="Origem" placeholder="Ex.: Mago 3, Talento" maxLength={120} value={form.source} onChange={(event) => set({ source: event.target.value })} error={errors.source} />
          </div>

          {form.kind === 'spell' ? <SpellFields id={id} value={form.spell} onChange={(spell) => set({ spell })} /> : null}
          {form.kind === 'attack' ? <AttackFields id={id} value={form.attack} onChange={(attack) => set({ attack })} /> : null}

          <TextareaField id={`${id}-description`} label="Descrição" rows={5} maxLength={8000} value={form.description} onChange={(event) => set({ description: event.target.value })} error={errors.description} hint="Escreva com suas palavras ou cole textos de regras abertas (SRD)." />

          {form.kind !== 'spell' && form.kind !== 'attack' ? (
            <SelectField id={`${id}-resource`} label="Usos (recurso vinculado)" hint="Crie o contador em “Recursos”, na aba Jogo." value={form.resourceId} onChange={(event) => set({ resourceId: event.target.value })}>
              <option value="">Sem contador de usos</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.label}
                </option>
              ))}
            </SelectField>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {entry ? (
              <ConfirmDialog
                trigger={(open) => (
                  <Button variant="danger" size="sm" onClick={open} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                    Excluir
                  </Button>
                )}
                title={`Excluir “${entry.name}”?`}
                description="O registro sai da ficha. Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                onConfirm={remove}
              />
            ) : null}
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" loading={busy}>
                Salvar
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

function SpellFields({ id, value, onChange }: { id: string; value: Dnd5eSpellData; onChange: (value: Dnd5eSpellData) => void }) {
  const set = (patch: Partial<Dnd5eSpellData>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-line p-3">
      <legend className="px-1 text-xs text-fg-muted">Detalhes da magia</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-circle`} className="text-sm font-medium">
            Círculo (0 = truque)
          </label>
          <NumberInput id={`${id}-circle`} value={value.circle} min={0} max={9} onCommit={(circle) => set({ circle: circle ?? 0 })} />
        </div>
        <SelectField id={`${id}-school`} label="Escola" value={value.school ?? ''} onChange={(event) => set({ school: event.target.value ? (event.target.value as Dnd5eSpellData['school']) : null })}>
          <option value="">—</option>
          {SPELL_SCHOOLS.map((school) => (
            <option key={school} value={school}>
              {spellSchoolLabels[school]}
            </option>
          ))}
        </SelectField>
        <TextField id={`${id}-casting`} label="Tempo de conjuração" maxLength={60} value={value.castingTime} onChange={(event) => set({ castingTime: event.target.value })} />
        <TextField id={`${id}-range`} label="Alcance" maxLength={60} value={value.range} onChange={(event) => set({ range: event.target.value })} />
        <TextField id={`${id}-components`} label="Componentes" maxLength={120} value={value.components} onChange={(event) => set({ components: event.target.value })} />
        <TextField id={`${id}-duration`} label="Duração" maxLength={60} value={value.duration} onChange={(event) => set({ duration: event.target.value })} />
      </div>
      <div className="flex flex-wrap gap-5">
        <CheckboxField id={`${id}-concentration`} label="Concentração" checked={value.concentration} onChange={(event) => set({ concentration: event.target.checked })} />
        <CheckboxField id={`${id}-ritual`} label="Ritual" checked={value.ritual} onChange={(event) => set({ ritual: event.target.checked })} />
        <CheckboxField id={`${id}-prepared`} label="Preparada" checked={value.prepared} onChange={(event) => set({ prepared: event.target.checked })} />
      </div>
    </fieldset>
  );
}

function AttackFields({ id, value, onChange }: { id: string; value: Dnd5eAttackData; onChange: (value: Dnd5eAttackData) => void }) {
  const { derived } = useSheet();
  const set = (patch: Partial<Dnd5eAttackData>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-line p-3">
      <legend className="px-1 text-xs text-fg-muted">Jogada de ataque: {formatModifier(attackRollBonus(value, derived))}</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField id={`${id}-ability`} label="Atributo" value={value.ability ?? ''} onChange={(event) => set({ ability: event.target.value ? (event.target.value as Dnd5eAttackData['ability']) : null })}>
          <option value="">Bônus fixo</option>
          {ABILITIES.map((ability) => (
            <option key={ability} value={ability}>
              {abilityLabels[ability].name}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-bonus`} className="text-sm font-medium">
            Bônus adicional
          </label>
          <NumberInput id={`${id}-bonus`} value={value.bonus} min={-30} max={30} onCommit={(bonus) => set({ bonus: bonus ?? 0 })} />
        </div>
        <div className="flex items-end pb-2">
          <CheckboxField id={`${id}-proficient`} label="Proficiente" checked={value.proficient} onChange={(event) => set({ proficient: event.target.checked })} />
        </div>
        <TextField id={`${id}-damage`} label="Dano" placeholder="1d8 + 3" maxLength={60} value={value.damage} onChange={(event) => set({ damage: event.target.value })} />
        <TextField id={`${id}-damage-type`} label="Tipo de dano" placeholder="cortante" maxLength={40} value={value.damageType} onChange={(event) => set({ damageType: event.target.value })} />
        <TextField id={`${id}-attack-range`} label="Alcance" placeholder="1,5 m" maxLength={60} value={value.range} onChange={(event) => set({ range: event.target.value })} />
      </div>
    </fieldset>
  );
}
