'use client';

import { cx } from '@/lib/cx';

export type SessionModeValue = 'presencial' | 'online';

function Choice({
  name,
  selected,
  label,
  description,
  onSelect,
}: {
  name: string;
  selected: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm transition-colors',
        selected
          ? 'border-parchment-300/70 bg-parchment-200/10'
          : 'border-line hover:border-line-strong hover:bg-hover',
      )}
    >
      <span className="flex items-center gap-2 font-medium text-fg">
        <input
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
          className="accent-wine-500"
        />
        {label}
      </span>
      <span className="text-xs text-fg-muted">{description}</span>
    </label>
  );
}

/**
 * Tipo da sessão: presencial (o mestre escolhe dados físicos ou virtuais) ou online (dados
 * virtuais sempre ligados). Com `inputs`, grava campos ocultos para formulários de servidor.
 */
export function SessionModeFields({
  mode,
  physicalDice,
  onChange,
  inputs = false,
}: {
  mode: SessionModeValue;
  physicalDice: boolean;
  onChange: (next: { mode: SessionModeValue; physicalDice: boolean }) => void;
  inputs?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Tipo de sessão</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <Choice
          name="session-mode"
          selected={mode === 'presencial'}
          label="Presencial"
          description="Todos na mesma mesa. Você escolhe se os dados são físicos ou virtuais."
          onSelect={() => onChange({ mode: 'presencial', physicalDice })}
        />
        <Choice
          name="session-mode"
          selected={mode === 'online'}
          label="Online"
          description="Cada um no seu lugar. Os dados virtuais ficam ligados automaticamente."
          onSelect={() => onChange({ mode: 'online', physicalDice: false })}
        />
      </div>
      {mode === 'presencial' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            name="session-dice"
            selected={!physicalDice}
            label="Dados virtuais"
            description="O app rola os dados (aparecem na tela e no mural)."
            onSelect={() => onChange({ mode, physicalDice: false })}
          />
          <Choice
            name="session-dice"
            selected={physicalDice}
            label="Dados físicos"
            description="Os dados virtuais somem; a ficha mostra que dado rolar em cada coisa (acerto, dano, testes)."
            onSelect={() => onChange({ mode, physicalDice: true })}
          />
        </div>
      ) : (
        <p className="text-xs text-fg-muted">Sessão online: dados virtuais ligados.</p>
      )}
      {inputs ? (
        <>
          <input type="hidden" name="mode" value={mode} />
          <input
            type="hidden"
            name="physicalDice"
            value={mode === 'presencial' && physicalDice ? 'on' : ''}
          />
        </>
      ) : null}
    </fieldset>
  );
}
