'use client';

import { ORDEM2_DICE, type Ordem2Die } from '@codexveil/rpg-systems/ordem2';
import { cx } from '@/lib/cx';

/** Escolha de um dado (d4 a d12; d20 só quando o efeito paranormal permite). */
export function DieSelect({
  id,
  value,
  onChange,
  disabled,
  allowD20 = false,
  label,
  className,
}: {
  id: string;
  value: Ordem2Die;
  onChange: (value: Ordem2Die) => void;
  disabled?: boolean;
  allowD20?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value) as Ordem2Die)}
      className={cx(
        'tabular h-9 rounded-md border border-line-strong bg-sunken px-2 text-sm text-fg disabled:opacity-70',
        className,
      )}
    >
      {ORDEM2_DICE.filter((die) => allowD20 || die !== 20 || value === 20).map((die) => (
        <option key={die} value={die}>
          d{die}
        </option>
      ))}
    </select>
  );
}
