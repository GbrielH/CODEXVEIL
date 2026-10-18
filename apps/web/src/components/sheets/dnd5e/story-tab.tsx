'use client';

import { ADVANCEMENT_MODES, findClassByName, listClasses, type Dnd5eClass } from '@codexveil/rpg-systems/dnd5e';
import { useId } from 'react';
import { SourcebookLinks, SourcebookPicker } from '@/components/campaigns/sourcebook-picker';
import { CharacterIcon } from '@/components/characters/character-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { useSheet } from './context';
import { LevelUpButton } from './level-up-dialog';

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
  const { character, sheet, updateSheet, permissions } = useSheet();
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
      {/* Ficha pessoal: os livros são escolhidos aqui; numa campanha, valem os liberados pelo mestre. */}
      <div className="mt-4 border-t border-line pt-3">
        {character.campaign || readOnly ? (
          <SourcebookLinks
            ids={sheet.identity.sourcebooks}
            label={character.campaign ? 'Livros da ficha (na campanha, valem os liberados pelo mestre):' : 'Livros da ficha:'}
          />
        ) : (
          <SourcebookPicker audience="character" selected={sheet.identity.sourcebooks} onChange={(sourcebooks) => setIdentity({ sourcebooks })} />
        )}
      </div>
    </Card>
  );
}

/**
 * Classes da ficha, sem campos de texto: classe, nível, subclasse e dado de vida vêm das regras.
 * Subir de nível ou entrar numa classe nova (multiclasse) passa pela subida de nível, que
 * recalcula vida, habilidades, magias e recursos.
 */
function ClassesCard() {
  const { sheet, updateSheet, permissions, derived } = useSheet();
  const id = useId();
  const canEdit = permissions.canEditSheet;
  const classes = sheet.identity.classes;
  const setClass = (index: number, patch: Partial<Dnd5eClass>) =>
    updateSheet((current) => ({
      ...current,
      identity: { ...current.identity, classes: current.identity.classes.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)) },
    }));
  const taken = new Set(classes.map((entry) => findClassByName(entry.name)?.id).filter(Boolean));

  return (
    <Card>
      <CardHeader title="Classes" description={`Nível total ${derived.level}. Multiclasse: até 4 classes.`} action={<LevelUpButton />} />
      <ul className="flex flex-col gap-3">
        {classes.map((entry, index) => {
          const classDef = findClassByName(entry.name);
          const subclasses = classDef ? [classDef.subclass] : [];
          return (
            <li key={index} className="flex flex-col gap-3 rounded-md border border-line p-3">
              <div className="flex items-center gap-3">
                {classDef ? <CharacterIcon kind="class" id={classDef.id} className="h-9 w-9 text-fg-accent" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">
                    {classDef?.name ?? (entry.name || 'Classe não definida')}
                    <span className="ml-2 text-sm font-normal text-fg-muted">{entry.level}º nível</span>
                  </p>
                  <p className="text-sm text-fg-muted">
                    {entry.subclass ? `Subclasse: ${entry.subclass}` : entry.level < 3 ? 'Subclasse no 3º nível' : 'Sem subclasse'}
                  </p>
                </div>
                <Badge tone="parchment">Dado de vida {classDef?.hitDie ?? entry.hitDie}</Badge>
              </div>
              {/* Fichas antigas, com a classe escrita à mão: escolhe-se a classe do SRD na lista. */}
              {canEdit && !classDef ? (
                <SelectField
                  id={`${id}-${index}-class`}
                  label="Escolha a classe"
                  hint="Esta classe não é do SRD 5.2.1. Escolha a classe correspondente para a ficha seguir as regras."
                  value=""
                  onChange={(event) => {
                    const chosen = listClasses().find((option) => option.id === event.target.value);
                    if (chosen) setClass(index, { name: chosen.name, hitDie: chosen.hitDie });
                  }}
                >
                  <option value="">Escolha a classe</option>
                  {listClasses()
                    .filter((option) => !taken.has(option.id))
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                </SelectField>
              ) : null}
              {canEdit && classDef && entry.level >= 3 && !subclasses.some((option) => option.name === entry.subclass) ? (
                <SelectField
                  id={`${id}-${index}-subclass`}
                  label="Escolha a subclasse"
                  value=""
                  onChange={(event) => {
                    const chosen = subclasses.find((option) => option.id === event.target.value);
                    if (chosen) setClass(index, { subclass: chosen.name });
                  }}
                >
                  <option value="">Escolha a subclasse</option>
                  {subclasses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </SelectField>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">
        Classe, nível e subclasse mudam pela subida de nível: escolha a classe que sobe ou uma classe nova (multiclasse) e a vida,
        as habilidades, as magias e os recursos são recalculados pelas regras. Para trocar a classe inicial, crie o personagem de
        novo pelo assistente.
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

