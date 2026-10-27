'use client';

import {
  createCharacterAbility,
  deleteCharacterAbility,
  updateCharacterAbility,
  type CharacterAbility,
  type Json,
} from '@codexveil/database';
import {
  abilityEntrySchema,
  fieldErrorsFrom,
  type AbilityEntryKind,
  type FieldErrors,
} from '@codexveil/validation';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField, TextareaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Tipos que a ficha do Tormenta20 mostra (grupos da aba Poderes e magias). */
export const T20_ABILITY_KINDS: { kind: AbilityEntryKind; label: string }[] = [
  { kind: 'class_feature', label: 'Habilidade de classe' },
  { kind: 'species_trait', label: 'Habilidade de raça' },
  { kind: 'background_feature', label: 'Origem' },
  { kind: 'feat', label: 'Poder' },
  { kind: 'spell', label: 'Magia' },
];

export type T20AbilityEditing = { entry: CharacterAbility | null; kind: AbilityEntryKind } | null;

interface Form {
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  circle: number;
  cost: number;
}

function formFor(state: NonNullable<T20AbilityEditing>): Form {
  const data = (state.entry?.data ?? {}) as { circle?: number; cost?: number };
  return {
    kind: state.entry?.kind ?? state.kind,
    name: state.entry?.name ?? '',
    source: state.entry?.source ?? '',
    description: state.entry?.description ?? '',
    circle: data.circle ?? 1,
    cost: data.cost ?? 1,
  };
}

/**
 * Cadastro manual de habilidades, poderes e magias na ficha do Tormenta20 (o que o livro não
 * trouxe ou o mestre concedeu): criar, editar e excluir.
 */
export function T20AbilityEditor({
  characterId,
  state,
  onClose,
  onSaved,
  onDeleted,
}: {
  characterId: string;
  state: T20AbilityEditing;
  onClose: () => void;
  onSaved: (ability: CharacterAbility, isNew: boolean) => void;
  onDeleted: (abilityId: string) => void;
}) {
  const id = useId();
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [openedFor, setOpenedFor] = useState<T20AbilityEditing>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  if (state !== openedFor) {
    setOpenedFor(state);
    setErrors({});
    setForm(state ? formFor(state) : null);
  }
  const entry = state?.entry ?? null;
  const set = (patch: Partial<Form>) =>
    setForm((current) => (current ? { ...current, ...patch } : current));

  const submit = async () => {
    if (!form) return;
    const parsed = abilityEntrySchema.safeParse({
      kind: form.kind,
      name: form.name,
      source: form.source,
      description: form.description,
      resourceId: entry?.resourceId ?? null,
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    // Magias guardam círculo e custo; os demais mantêm o que já tinham (ex.: nível de origem).
    const data = (
      form.kind === 'spell'
        ? { ...((entry?.data as object | null) ?? {}), circle: form.circle, cost: form.cost }
        : (entry?.data ?? {})
    ) as Json;
    setBusy(true);
    const client = getSupabaseBrowserClient();
    try {
      const saved = entry
        ? await updateCharacterAbility(client, entry.id, { ...parsed.data, data })
        : await createCharacterAbility(client, characterId, { ...parsed.data, data });
      toast({ tone: 'success', title: entry ? 'Alterações salvas.' : 'Adicionado à ficha.' });
      onSaved(saved, !entry);
      onClose();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível salvar',
        description: failureMessage(error, 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    try {
      await deleteCharacterAbility(getSupabaseBrowserClient(), entry.id);
    } catch (error) {
      throw new Error(failureMessage(error, 'Não foi possível excluir.'));
    }
    toast({ tone: 'success', title: 'Removido da ficha.' });
    onDeleted(entry.id);
    onClose();
  };

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={entry ? `Editar ${entry.name}` : 'Adicionar à ficha'}
      busy={busy}
      size="lg"
    >
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
          <SelectField
            id={`${id}-kind`}
            label="Tipo"
            value={form.kind}
            onChange={(event) => set({ kind: event.target.value as AbilityEntryKind })}
          >
            {T20_ABILITY_KINDS.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id={`${id}-name`}
              label="Nome"
              required
              maxLength={120}
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              error={errors.name}
            />
            <TextField
              id={`${id}-source`}
              label="Origem"
              placeholder="Ex.: Inventor 3º nível, concedido pelo mestre"
              maxLength={120}
              value={form.source}
              onChange={(event) => set({ source: event.target.value })}
              error={errors.source}
            />
          </div>
          {form.kind === 'spell' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-circle`} className="text-sm font-medium">
                  Círculo
                </label>
                <NumberInput
                  id={`${id}-circle`}
                  value={form.circle}
                  min={1}
                  max={5}
                  onCommit={(circle) => set({ circle: circle ?? 1 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-cost`} className="text-sm font-medium">
                  Custo (PM)
                </label>
                <NumberInput
                  id={`${id}-cost`}
                  value={form.cost}
                  min={0}
                  max={99}
                  onCommit={(cost) => set({ cost: cost ?? 0 })}
                />
              </div>
            </div>
          ) : null}
          <TextareaField
            id={`${id}-description`}
            label="Descrição"
            rows={6}
            maxLength={8000}
            value={form.description}
            onChange={(event) => set({ description: event.target.value })}
            error={errors.description}
            hint="O custo em PM no texto (ex.: “gaste 2 PM”) aparece no botão Usar."
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {entry ? (
              <ConfirmDialog
                trigger={(open) => (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={open}
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  >
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
