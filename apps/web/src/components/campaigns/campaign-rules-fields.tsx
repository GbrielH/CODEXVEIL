'use client';

import { ABILITY_SCORE_METHODS, abilityScoreMethodLabels, parseDnd5eCampaignRules, type AbilityScoreMethod } from '@codexveil/rpg-systems/dnd5e';
import type { FieldErrors } from '@codexveil/validation';
import { useId, useState } from 'react';
import { CheckboxField, SelectField } from '@/components/ui/field';
import { SourcebookPicker } from './sourcebook-picker';

interface CampaignRulesFieldsProps {
  systemId: string;
  /** Regras atuais (JSON gravado na campanha) ou `undefined` para os padrões do sistema. */
  initial?: unknown;
  errors?: FieldErrors | undefined;
}

/** Campos das regras de criação de personagens, conforme o sistema da campanha. */
export function CampaignRulesFields({ systemId, initial, errors }: CampaignRulesFieldsProps) {
  if (systemId !== 'dnd5e') return null;
  return <Dnd5eRulesFields initial={initial} errors={errors} />;
}

function Dnd5eRulesFields({ initial, errors }: { initial: unknown; errors?: FieldErrors | undefined }) {
  const id = useId();
  const [rules, setRules] = useState(() => parseDnd5eCampaignRules(initial));
  const toggleMethod = (method: AbilityScoreMethod, checked: boolean) =>
    setRules((current) => ({
      ...current,
      abilityScoreMethods: checked
        ? ABILITY_SCORE_METHODS.filter((entry) => entry === method || current.abilityScoreMethods.includes(entry))
        : current.abilityScoreMethods.filter((entry) => entry !== method),
    }));
  const methodsError = errors?.['rules.abilityScoreMethods'];

  return (
    <fieldset className="@container flex flex-col gap-5 rounded-md border border-line p-4 sm:p-5">
      <legend className="eyebrow px-1">Criação de personagens</legend>
      <p className="-mt-1 text-sm text-fg-muted">
        Os jogadores criam os personagens num passo a passo que segue as regras do SRD 5.2 e as escolhas abaixo.
      </p>
      {/* Em telas largas (criação da campanha), os três controles ficam lado a lado. */}
      <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] @3xl:gap-8">
        <SelectField
          id={`${id}-level`}
          name="rules.startingLevel"
          label="Nível inicial dos personagens"
          hint="O SRD recomenda o 1º nível, ou o 3º para grupos experientes."
          value={String(rules.startingLevel)}
          onChange={(event) => setRules((current) => ({ ...current, startingLevel: Number(event.target.value) }))}
          error={errors?.['rules.startingLevel']}
          fieldClassName="sm:max-w-xs @3xl:max-w-none"
        >
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
            <option key={level} value={level}>
              {level}º nível
            </option>
          ))}
        </SelectField>
        <div role="group" aria-labelledby={`${id}-methods`} aria-describedby={methodsError ? `${id}-methods-error` : undefined} className="flex flex-col gap-3">
          <p id={`${id}-methods`} className="text-sm font-medium text-fg">
            Métodos de atributos permitidos
          </p>
          {ABILITY_SCORE_METHODS.map((method) => (
            <CheckboxField
              key={method}
              id={`${id}-method-${method}`}
              name="rules.abilityScoreMethods"
              value={method}
              label={abilityScoreMethodLabels[method].name}
              description={abilityScoreMethodLabels[method].description}
              checked={rules.abilityScoreMethods.includes(method)}
              onChange={(event) => toggleMethod(method, event.target.checked)}
            />
          ))}
          {methodsError ? (
            <p id={`${id}-methods-error`} className="text-xs font-medium text-danger" role="alert">
              {methodsError}
            </p>
          ) : null}
        </div>
        <CheckboxField
          id={`${id}-evil`}
          name="rules.allowEvilAlignments"
          label="Permitir alinhamentos malignos"
          description="O SRD pressupõe personagens que não são malignos. Libere se a sua mesa quiser."
          checked={rules.allowEvilAlignments}
          onChange={(event) => setRules((current) => ({ ...current, allowEvilAlignments: event.target.checked }))}
        />
      </div>
      <div className="border-t border-line pt-4">
        <SourcebookPicker
          audience="campaign"
          selected={rules.sourcebooks}
          onChange={(sourcebooks) => setRules((current) => ({ ...current, sourcebooks }))}
          fieldName="rules.sourcebooks"
          modeFieldName="rules.sourcebookMode"
        />
      </div>
    </fieldset>
  );
}
