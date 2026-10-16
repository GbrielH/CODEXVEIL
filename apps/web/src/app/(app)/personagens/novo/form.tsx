'use client';

import {
  ABILITIES,
  HIT_DICE,
  STANDARD_ARRAY,
  abilityLabels,
  abilityModifier,
  dnd5eCreationSchema,
  formatModifier,
  suggestHitPointMax,
  buildDnd5eCharacter,
} from '@codexveil/rpg-systems/dnd5e';
import { useActionState, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleFormState } from '@/lib/actions';
import { routes } from '@/lib/routes';
import { createCharacterAction } from '../actions';

interface CampaignOption {
  id: string;
  name: string;
  systemId: string;
}

interface CreateCharacterFormProps {
  campaigns: CampaignOption[];
  systems: { id: string; name: string }[];
  defaultCampaignId: string;
}

type Abilities = Record<(typeof ABILITIES)[number], string>;

const initialAbilities: Abilities = { str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' };

export function CreateCharacterForm({ campaigns, systems, defaultCampaignId }: CreateCharacterFormProps) {
  const [state, action] = useActionState(createCharacterAction, idleFormState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  const [campaignId, setCampaignId] = useState(values.campaignId ?? defaultCampaignId);
  const [level, setLevel] = useState(values.level ?? '1');
  const [hitDie, setHitDie] = useState(values.hitDie ?? 'd8');
  const [abilities, setAbilities] = useState<Abilities>(() => {
    const restored = { ...initialAbilities };
    for (const ability of ABILITIES) {
      const value = values[`abilities.${ability}`];
      if (value) restored[ability] = value;
    }
    return restored;
  });

  const campaign = campaigns.find((option) => option.id === campaignId);
  const systemId = campaign?.systemId ?? values.systemId ?? systems[0]?.id ?? 'dnd5e';

  // Sugestão de PV calculada pelas mesmas regras do servidor, enquanto o jogador digita.
  const suggestedHp = useMemo(() => {
    const parsed = dnd5eCreationSchema.safeParse({
      level: Number(level),
      hitDie,
      abilities: Object.fromEntries(ABILITIES.map((ability) => [ability, Number(abilities[ability])])),
    });
    return parsed.success ? suggestHitPointMax(buildDnd5eCharacter(parsed.data).sheet) : null;
  }, [level, hitDie, abilities]);

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-1">Identidade</legend>
        <TextField
          id="name"
          name="name"
          label="Nome do personagem"
          maxLength={80}
          required
          autoComplete="off"
          defaultValue={values.name}
          error={errors.name}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            id="campaignId"
            name="campaignId"
            label="Campanha"
            hint="Opcional. Você pode vincular depois."
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            error={errors.campaignId}
          >
            <option value="">Sem campanha (ficha pessoal)</option>
            {campaigns.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>
          {campaign || systems.length <= 1 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">Sistema</span>
              <p className="flex h-11 items-center rounded-md border border-line bg-raised px-3 text-sm text-fg-secondary">
                {systems.find((system) => system.id === systemId)?.name ?? systemId}
              </p>
              <input type="hidden" name="systemId" value={systemId} />
            </div>
          ) : (
            <SelectField id="systemId" name="systemId" label="Sistema" defaultValue={systemId} error={errors.systemId}>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="species"
            name="species"
            label="Espécie"
            placeholder="Ex.: Elfo, Anão, Humano"
            maxLength={60}
            defaultValue={values.species}
            error={errors.species}
          />
          <TextField
            id="background"
            name="background"
            label="Antecedente"
            placeholder="Ex.: Sábio, Soldado"
            maxLength={60}
            defaultValue={values.background}
            error={errors.background}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-1">Classe</legend>
        <div className="grid gap-5 sm:grid-cols-[1fr_7rem_9rem]">
          <TextField
            id="className"
            name="className"
            label="Classe"
            placeholder="Ex.: Guerreiro, Maga"
            maxLength={40}
            defaultValue={values.className}
            error={errors.className}
          />
          <TextField
            id="level"
            name="level"
            label="Nível"
            inputMode="numeric"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            error={errors.level}
          />
          <SelectField
            id="hitDie"
            name="hitDie"
            label="Dado de vida"
            value={hitDie}
            onChange={(event) => setHitDie(event.target.value)}
            error={errors.hitDie}
          >
            {HIT_DICE.map((die) => (
              <option key={die} value={die}>
                {die}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-1">Atributos</legend>
        <p className="text-sm text-fg-muted">
          Use o método da sua mesa. Sugestão do conjunto padrão: {STANDARD_ARRAY.join(', ')}.
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((ability) => {
            const numeric = Number(abilities[ability]);
            const modifier = Number.isInteger(numeric) ? formatModifier(abilityModifier(numeric)) : '—';
            const error = errors[`abilities.${ability}`];
            return (
              <div key={ability} className="flex flex-col items-center gap-1 rounded-md border border-line bg-raised p-2">
                <label htmlFor={`ability-${ability}`} className="text-xs font-semibold tracking-wider text-fg-secondary">
                  <abbr title={abilityLabels[ability].name} className="no-underline">
                    {abilityLabels[ability].abbreviation}
                  </abbr>
                </label>
                <input
                  id={`ability-${ability}`}
                  name={`abilities.${ability}`}
                  inputMode="numeric"
                  value={abilities[ability]}
                  onChange={(event) => setAbilities((current) => ({ ...current, [ability]: event.target.value }))}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `ability-${ability}-error` : undefined}
                  className="tabular h-11 w-full rounded-md border border-line-strong bg-sunken text-center text-lg text-fg focus-visible:border-parchment-300"
                />
                <span className="tabular text-sm text-fg-accent" aria-label={`Modificador ${modifier}`}>
                  {modifier}
                </span>
                {error ? (
                  <span id={`ability-${ability}-error`} className="text-center text-xs text-danger" role="alert">
                    {error}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>

      <TextField
        id="hitPointMax"
        name="hitPointMax"
        label="Pontos de vida máximos"
        inputMode="numeric"
        placeholder={suggestedHp ? String(suggestedHp) : undefined}
        hint={
          suggestedHp
            ? `Deixe em branco para usar ${suggestedHp} (máximo do dado no 1º nível e média nos demais, com Constituição).`
            : 'Deixe em branco para usar a sugestão das regras.'
        }
        defaultValue={values.hitPointMax}
        error={errors.hitPointMax}
        fieldClassName="sm:max-w-xs"
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href={routes.characters} variant="ghost">
          Cancelar
        </ButtonLink>
        <SubmitButton pendingLabel="Criando…">Criar personagem</SubmitButton>
      </div>
    </form>
  );
}
