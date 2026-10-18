'use client';

import {
  ABILITY_SCORE_METHODS,
  DND5E_SOURCEBOOKS,
  SOURCEBOOK_CATEGORIES,
  abilityScoreMethodLabels,
  dnd5eOfficialLinks,
  sourcebookCategoryLabels,
  sourcebookUrl,
  parseDnd5eCampaignRules,
  type AbilityScoreMethod,
} from '@codexveil/rpg-systems/dnd5e';
import type { FieldErrors } from '@codexveil/validation';
import { ExternalLink } from 'lucide-react';
import { useId, useState } from 'react';
import { CheckboxField, SelectField } from '@/components/ui/field';

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
    <fieldset className="flex flex-col gap-5 rounded-md border border-line p-4">
      <legend className="eyebrow px-1">Criação de personagens</legend>
      <p className="-mt-1 text-sm text-fg-muted">
        Os jogadores criam os personagens num passo a passo que segue as regras do SRD 5.2 e as escolhas abaixo.
      </p>
      <SelectField
        id={`${id}-level`}
        name="rules.startingLevel"
        label="Nível inicial dos personagens"
        hint="O SRD recomenda o 1º nível, ou o 3º para grupos experientes."
        value={String(rules.startingLevel)}
        onChange={(event) => setRules((current) => ({ ...current, startingLevel: Number(event.target.value) }))}
        error={errors?.['rules.startingLevel']}
        fieldClassName="sm:max-w-xs"
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
      <SourcebookFields selected={rules.sourcebooks} onChange={(sourcebooks) => setRules((current) => ({ ...current, sourcebooks }))} />
    </fieldset>
  );
}

/** Sistema base (só o SRD) ou com livros oficiais escolhidos por categoria. */
function SourcebookFields({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const id = useId();
  const [mode, setMode] = useState<'base' | 'expanded'>(selected.length > 0 ? 'expanded' : 'base');
  const toggle = (bookId: string, checked: boolean) => onChange(checked ? [...selected, bookId] : selected.filter((entry) => entry !== bookId));
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm font-medium text-fg">Conteúdo do sistema</p>
      <input type="hidden" name="rules.sourcebookMode" value={mode} />
      <div className="grid gap-2 sm:grid-cols-2">
        {(['base', 'expanded'] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer flex-col gap-1 rounded-md border border-line p-3 text-sm has-[:checked]:border-parchment-300/70 has-[:checked]:bg-parchment-200/10"
          >
            <span className="flex items-center gap-2 font-medium text-fg">
              <input type="radio" name={`${id}-mode`} checked={mode === option} onChange={() => setMode(option)} className="accent-wine-500" />
              {option === 'base' ? 'Sistema base' : 'Base + livros oficiais'}
            </span>
            <span className="text-xs text-fg-muted">
              {option === 'base'
                ? 'Só o SRD 5.2.1, gratuito e já pronto no Codexveil. Sem nada para escolher.'
                : 'Escolha os livros que a mesa usa. São livros pagos, vendidos pela Wizards na página oficial: o conteúdo deles não vem no Codexveil e entra à mão.'}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        Gratuitos:{' '}
        {dnd5eOfficialLinks
          .filter((link) => link.access === 'free')
          .map((link, index) => (
            <span key={link.url}>
              {index > 0 ? ' · ' : ''}
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-fg-brand underline-offset-2 hover:underline">
                {link.label}
              </a>
            </span>
          ))}
      </p>
      {mode === 'expanded' ? (
        <div className="flex flex-col gap-4">
          {SOURCEBOOK_CATEGORIES.map((category) => (
            <details key={category} className="rounded-md border border-line px-3 py-2" open={category === 'core' || category === 'player'}>
              <summary className="cursor-pointer text-sm font-medium text-fg">
                {sourcebookCategoryLabels[category].name}
                <span className="ml-2 text-xs text-fg-muted">
                  {DND5E_SOURCEBOOKS.filter((book) => book.category === category && selected.includes(book.id)).length || ''}
                </span>
              </summary>
              <p className="mt-1 text-xs text-fg-muted">{sourcebookCategoryLabels[category].description}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {DND5E_SOURCEBOOKS.filter((book) => book.category === category).map((book) => (
                  <CheckboxField
                    key={book.id}
                    id={`${id}-book-${book.id}`}
                    name="rules.sourcebooks"
                    value={book.id}
                    label={book.name}
                    description={
                      <>
                        {book.year}
                        {book.edition === '2024' ? ' · regras de 2024' : ''} · Pago ·{' '}
                        <a
                          href={sourcebookUrl(book.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-fg-brand underline-offset-2 hover:underline"
                        >
                          página oficial
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">(abre em outra aba)</span>
                        </a>
                      </>
                    }
                    checked={selected.includes(book.id)}
                    onChange={(event) => toggle(book.id, event.target.checked)}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
