'use client';

import type { T20OriginItemSlot } from '@codexveil/rpg-systems/tormenta20';
import { SelectField, TextField } from '@/components/ui/field';

const FREE = '__livre';

/**
 * Itens da origem no passo da origem: os fixos aparecem prontos; os com escolha ganham um
 * seletor (do catálogo do livro) ou um campo de texto. Tudo vira item separado no inventário.
 */
export function OriginItemsPicker({
  slots,
  value,
  onChange,
  error,
}: {
  slots: T20OriginItemSlot[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  error?: string | undefined;
}) {
  if (slots.length === 0) return null;
  const set = (key: string, pick: string) => onChange({ ...value, [key]: pick });
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-medium text-fg">Itens da origem</legend>
      <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
        {slots
          .filter((slot) => slot.kind === 'fixed')
          .map((slot) =>
            slot.kind === 'fixed' ? (
              <li key={slot.key}>
                • {slot.quantity > 1 ? `${slot.quantity}× ` : ''}
                {slot.name}
                {slot.note ? <span className="text-fg-muted"> ({slot.note})</span> : null}
              </li>
            ) : null,
          )}
      </ul>
      {slots.map((slot) => {
        if (slot.kind === 'fixed') return null;
        const pick = value[slot.key] ?? '';
        if (slot.kind === 'free') {
          return (
            <TextField
              key={slot.key}
              id={`t20-origem-item-${slot.key}`}
              label={slot.label}
              hint={slot.optional ? 'Opcional: combine com o mestre.' : undefined}
              maxLength={120}
              value={pick}
              onChange={(event) => set(slot.key, event.target.value)}
            />
          );
        }
        const known = slot.options.some((option) => option.id === pick);
        const freeMode = slot.allowFree && pick !== '' && !known;
        return (
          <div key={slot.key} className="flex flex-col gap-2">
            <SelectField
              id={`t20-origem-item-${slot.key}`}
              label={slot.label}
              value={freeMode ? FREE : pick}
              onChange={(event) =>
                set(slot.key, event.target.value === FREE ? ' ' : event.target.value)
              }
            >
              <option value="">Escolha…</option>
              {slot.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
              {slot.allowFree ? <option value={FREE}>Outro (descrever)</option> : null}
            </SelectField>
            {freeMode ? (
              <TextField
                id={`t20-origem-item-${slot.key}-livre`}
                label="Qual item?"
                maxLength={120}
                value={pick.trim()}
                onChange={(event) => set(slot.key, event.target.value || ' ')}
              />
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}
