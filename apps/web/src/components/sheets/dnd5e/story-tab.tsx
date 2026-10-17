'use client';

import { ADVANCEMENT_MODES, HIT_DICE, MAX_LEVEL, type Dnd5eClass, type HitDie } from '@codexveil/rpg-systems/dnd5e';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { useSheet } from './context';

const advancementLabels: Record<(typeof ADVANCEMENT_MODES)[number], string> = {
  milestone: 'Marcos (o mestre decide)',
  experience: 'Pontos de experiência',
};

export function StoryTab() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <IdentityCard />
        <ClassesCard />
      </div>
      <DetailsCard />
    </div>
  );
}

function IdentityCard() {
  const { sheet, updateSheet, permissions } = useSheet();
  const id = useId();
  const readOnly = !permissions.canEditSheet;
  const setIdentity = (patch: Partial<typeof sheet.identity>) =>
    updateSheet((current) => ({ ...current, identity: { ...current.identity, ...patch } }));
  return (
    <Card>
      <CardHeader title="Identidade" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id={`${id}-species`} label="Espécie" maxLength={60} readOnly={readOnly} value={sheet.identity.species} onChange={(event) => setIdentity({ species: event.target.value })} />
        <TextField id={`${id}-background`} label="Antecedente" maxLength={60} readOnly={readOnly} value={sheet.identity.background} onChange={(event) => setIdentity({ background: event.target.value })} />
        <TextField id={`${id}-alignment`} label="Alinhamento" maxLength={40} readOnly={readOnly} value={sheet.identity.alignment} onChange={(event) => setIdentity({ alignment: event.target.value })} />
        <SelectField
          id={`${id}-advancement`}
          label="Evolução"
          disabled={readOnly}
          value={sheet.identity.advancement}
          onChange={(event) => setIdentity({ advancement: event.target.value as (typeof ADVANCEMENT_MODES)[number] })}
        >
          {ADVANCEMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {advancementLabels[mode]}
            </option>
          ))}
        </SelectField>
      </div>
    </Card>
  );
}

function ClassesCard() {
  const { sheet, updateSheet, permissions, derived } = useSheet();
  const id = useId();
  const readOnly = !permissions.canEditSheet;
  const classes = sheet.identity.classes;
  const setClasses = (next: Dnd5eClass[]) =>
    updateSheet((current) => ({ ...current, identity: { ...current.identity, classes: next } }));
  const setClass = (index: number, patch: Partial<Dnd5eClass>) =>
    setClasses(classes.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));

  return (
    <Card>
      <CardHeader
        title="Classes"
        description={`Nível total ${derived.level}. Multiclasse: até 4 classes.`}
        action={
          !readOnly && classes.length < 4 ? (
            <Button size="sm" variant="secondary" onClick={() => setClasses([...classes, { name: '', subclass: '', level: 1, hitDie: 'd8' }])} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Classe
            </Button>
          ) : undefined
        }
      />
      <ul className="flex flex-col gap-4">
        {classes.map((entry, index) => (
          <li key={index} className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr_5rem_6rem_auto]">
            <TextField id={`${id}-${index}-name`} label="Classe" maxLength={40} readOnly={readOnly} value={entry.name} onChange={(event) => setClass(index, { name: event.target.value })} />
            <TextField id={`${id}-${index}-subclass`} label="Subclasse" maxLength={60} readOnly={readOnly} value={entry.subclass} onChange={(event) => setClass(index, { subclass: event.target.value })} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-${index}-level`} className="text-sm font-medium">
                Nível
              </label>
              <NumberInput id={`${id}-${index}-level`} value={entry.level} min={1} max={MAX_LEVEL} disabled={readOnly} onCommit={(level) => setClass(index, { level: level ?? 1 })} />
            </div>
            <SelectField id={`${id}-${index}-die`} label="Dado de vida" disabled={readOnly} value={entry.hitDie} onChange={(event) => setClass(index, { hitDie: event.target.value as HitDie })}>
              {HIT_DICE.map((die) => (
                <option key={die} value={die}>
                  {die}
                </option>
              ))}
            </SelectField>
            {!readOnly && classes.length > 1 ? (
              <div className="flex items-end">
                <Button size="icon" variant="ghost" onClick={() => setClasses(classes.filter((_, position) => position !== index))} aria-label={`Remover a classe ${entry.name || index + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">
        Ao subir de nível, ajuste os pontos de vida máximos e os dados de vida na aba “Jogo”, e registre o marco em “Evolução”.
      </p>
    </Card>
  );
}

function DetailsCard() {
  const { sheet, updateSheet, permissions } = useSheet();
  const id = useId();
  const fields = [
    { key: 'appearance', label: 'Descrição física', rows: 3, max: 4000 },
    { key: 'personality', label: 'Personalidade', rows: 3, max: 4000 },
    { key: 'ideals', label: 'Ideais', rows: 2, max: 2000 },
    { key: 'bonds', label: 'Vínculos', rows: 2, max: 2000 },
    { key: 'flaws', label: 'Defeitos', rows: 2, max: 2000 },
    { key: 'goals', label: 'Objetivos', rows: 3, max: 4000 },
    { key: 'backstory', label: 'História', rows: 8, max: 20000 },
    { key: 'notes', label: 'Anotações', rows: 6, max: 20000 },
  ] as const;
  return (
    // Superfície de pergaminho (registro escrito): fundo claro e tinta escura. Não usa <Card>,
    // cujo fundo escuro anularia o do pergaminho e deixaria os rótulos ilegíveis.
    <section aria-labelledby={`${id}-cronica`} className="parchment rounded-lg p-5 sm:p-6">
      <h2 id={`${id}-cronica`} className="font-display text-xl text-ink">
        Crônica do personagem
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Registro de quem o personagem é. Tudo é salvo automaticamente.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.rows >= 6 ? 'md:col-span-2' : undefined}>
            <label htmlFor={`${id}-${field.key}`} className="mb-1 block font-display text-sm font-semibold tracking-wide text-ink">
              {field.label}
            </label>
            <textarea
              id={`${id}-${field.key}`}
              rows={field.rows}
              maxLength={field.max}
              readOnly={!permissions.canEditSheet}
              value={sheet.details[field.key]}
              onChange={(event) =>
                updateSheet((current) => ({ ...current, details: { ...current.details, [field.key]: event.target.value } }))
              }
              className="w-full rounded-md border border-parchment-500/60 bg-parchment-50/80 px-3 py-2 font-serif text-base leading-relaxed text-ink shadow-[inset_0_1px_2px_rgb(43_36_32/0.12)] placeholder:text-ink-muted focus-visible:border-wine-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-400/40 read-only:bg-parchment-100/60"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

