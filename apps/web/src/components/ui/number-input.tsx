'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import { defaultWidth } from './control-classes';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number | null;
  /** Chamado com o número já validado (ao sair do campo ou pressionar Enter). */
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Permite apagar o campo para representar "sem valor". */
  allowEmpty?: boolean;
  /** Aceita casas decimais (ex.: peso). */
  decimal?: boolean;
  invalid?: boolean;
}

function parse(text: string, decimal: boolean): number | null | undefined {
  const normalized = text.trim().replace(',', '.').replace('−', '-');
  if (normalized === '') return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;
  if (!decimal && !Number.isInteger(value)) return undefined;
  return value;
}

/**
 * Campo numérico que só confirma o valor quando ele é válido. Enquanto o usuário digita,
 * o texto fica livre (permite "-" ou vazio); valores fora do intervalo são ajustados
 * aos limites e textos inválidos voltam ao último valor confirmado.
 */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  allowEmpty = false,
  decimal = false,
  invalid = false,
  className,
  ...props
}: NumberInputProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [lastValue, setLastValue] = useState(value);

  // Sincroniza com mudanças vindas de fora (ex.: atualização em tempo real) durante a
  // renderização, padrão recomendado pelo React para "ajustar estado quando a prop muda".
  if (lastValue !== value) {
    setLastValue(value);
    setText(value === null ? '' : String(value));
  }

  const commit = () => {
    const parsed = parse(text, decimal);
    if (parsed === undefined || (parsed === null && !allowEmpty)) {
      setText(value === null ? '' : String(value));
      return;
    }
    let next = parsed;
    if (next !== null) {
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
    }
    setText(next === null ? '' : String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
      aria-invalid={invalid || undefined}
      className={cx(
        'tabular h-11 rounded-md border bg-sunken px-3 text-center text-fg',
        defaultWidth(className),
        'transition-[border-color,box-shadow] duration-150 ease-codex hover:border-silver-400/50',
        'focus-visible:border-parchment-300 focus-visible:shadow-[0_0_0_3px_rgb(228_216_189/0.18)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-ember-400/80' : 'border-line-strong',
        className,
      )}
      {...props}
    />
  );
}
