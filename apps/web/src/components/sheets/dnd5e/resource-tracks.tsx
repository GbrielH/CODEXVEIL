'use client';

import {
  createCharacterResource,
  deleteCharacterResource,
  removeCharacterCondition,
  setCharacterConditionLevel,
  takeCharacterRest,
  updateCharacterResource,
  type CharacterResource,
  type ResourceDisplay,
} from '@codexveil/database';
import {
  RESOURCE_RECOVERIES,
  resourceRecoveryLabels,
  type ResourceRecovery,
} from '@codexveil/domain';
import {
  dnd5eLongRestConditionChanges,
  isDedicatedResourceKey,
} from '@codexveil/rpg-systems/dnd5e';
import { fieldErrorsFrom, resourceSchema, type FieldErrors } from '@codexveil/validation';
import { BedDouble, Coffee, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';
import { CheckboxTrack } from './hp-tracker';

function groupOf(resource: CharacterResource): string {
  if (resource.key.startsWith('hit_dice_')) return 'Dados de vida';
  if (resource.key.startsWith('spell_slot_')) return 'Espaços de magia';
  return 'Recursos de classe e outros';
}

/** Trilhas gerais (dados de vida, espaços de magia, usos de habilidades) e descansos. */
export function ResourceTracks() {
  const { resources, permissions } = useSheet();
  const [editing, setEditing] = useState<CharacterResource | 'new' | null>(null);
  const general = resources.filter((resource) => !isDedicatedResourceKey(resource.key));

  const groups = new Map<string, CharacterResource[]>();
  for (const resource of general) {
    const group = groupOf(resource);
    groups.set(group, [...(groups.get(group) ?? []), resource]);
  }

  return (
    <Card>
      <CardHeader
        title="Recursos"
        description="Dados de vida, espaços de magia e usos de habilidades."
        action={
          permissions.canEditPlay ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing('new')}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Novo
            </Button>
          ) : undefined
        }
      />
      {general.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum recurso registrado.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {[...groups.entries()].map(([group, list]) => (
            <section key={group} aria-label={group}>
              <h3 className="eyebrow mb-2 text-[11px]">{group}</h3>
              <ul className="flex flex-col divide-y divide-line">
                {list.map((resource) => (
                  <li key={resource.id} className="py-2">
                    <ResourceRow resource={resource} onEdit={() => setEditing(resource)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {permissions.canEditPlay ? <RestControls /> : null}
      <ResourceFormModal resource={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function ResourceRow({ resource, onEdit }: { resource: CharacterResource; onEdit: () => void }) {
  const { adjustResource, permissions, pendingResourceIds } = useSheet();
  if (resource.display === 'checkboxes' && resource.max !== null && resource.max <= 10) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CheckboxTrack resource={resource} />
        </div>
        {permissions.canEditPlay ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            aria-label={`Editar ${resource.label}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    );
  }
  const pending = pendingResourceIds.has(resource.id);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{resource.label}</p>
        <p className="text-xs text-fg-muted">{resourceRecoveryLabels[resource.recovery]}</p>
      </div>
      <span
        className={cx(
          'tabular min-w-14 text-right font-display text-lg text-fg-accent',
          pending && 'opacity-70',
        )}
        aria-live="polite"
      >
        {resource.current}
        <span className="text-sm text-fg-muted">
          {resource.max === null ? '' : ` / ${resource.max}`}
        </span>
      </span>
      {permissions.canEditPlay ? (
        <div className="flex">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => adjustResource(resource, 'spend', 1)}
            disabled={resource.current <= 0}
            aria-label={`Gastar 1 de ${resource.label}`}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => adjustResource(resource, 'heal', 1)}
            disabled={resource.max !== null && resource.current >= resource.max}
            aria-label={`Recuperar 1 de ${resource.label}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            aria-label={`Editar ${resource.label}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RestControls() {
  const { character, run, reloadResources, reloadConditions, conditions } = useSheet();
  const rest = async (kind: 'short_rest' | 'long_rest') => {
    const restored = await run(
      async () => {
        const client = getSupabaseBrowserClient();
        const count = await takeCharacterRest(client, character.id, kind);
        // SRD 5.2.1: terminar um Descanso Longo remove 1 nível de Exaustão.
        if (kind === 'long_rest') {
          const changes = dnd5eLongRestConditionChanges(conditions);
          for (const entry of changes.update)
            await setCharacterConditionLevel(client, entry.id, entry.level);
          for (const conditionId of changes.remove)
            await removeCharacterCondition(client, conditionId);
        }
        return count;
      },
      { failure: 'O descanso não foi registrado' },
    );
    if (restored === undefined) throw new Error('O descanso não foi registrado. Tente novamente.');
    await Promise.all([reloadResources(), reloadConditions()]);
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
      <ConfirmDialog
        trigger={(open) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={open}
            icon={<Coffee className="h-4 w-4" aria-hidden="true" />}
          >
            Descanso curto
          </Button>
        )}
        title="Fazer um descanso curto?"
        description="Restaura os recursos marcados como “Descanso curto”. Dados de vida gastos para recuperar vida devem ser ajustados manualmente."
        confirmLabel="Descansar"
        tone="primary"
        onConfirm={() => rest('short_rest')}
      />
      <ConfirmDialog
        trigger={(open) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={open}
            icon={<BedDouble className="h-4 w-4" aria-hidden="true" />}
          >
            Descanso longo
          </Button>
        )}
        title="Fazer um descanso longo?"
        description="Restaura vida, espaços de magia e todos os recursos de descanso curto e longo. Pontos de vida temporários se encerram, e a Exaustão cai 1 nível."
        confirmLabel="Descansar"
        tone="primary"
        onConfirm={() => rest('long_rest')}
      />
    </div>
  );
}

interface ResourceForm {
  label: string;
  current: number | null;
  max: number | null;
  recovery: ResourceRecovery;
  display: ResourceDisplay;
}

function ResourceFormModal({
  resource,
  onClose,
}: {
  resource: CharacterResource | 'new' | null;
  onClose: () => void;
}) {
  const { character, setResources, run } = useSheet();
  const id = useId();
  const isNew = resource === 'new';
  const [form, setForm] = useState<ResourceForm>({
    label: '',
    current: 0,
    max: 1,
    recovery: 'long_rest',
    display: 'pool',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<CharacterResource | 'new' | null>(null);

  // Reinicia o formulário sempre que o modal abre para outra trilha.
  if (resource !== openedFor) {
    setOpenedFor(resource);
    setErrors({});
    setForm(
      resource && resource !== 'new'
        ? {
            label: resource.label,
            current: resource.current,
            max: resource.max,
            recovery: resource.recovery,
            display: resource.display,
          }
        : { label: '', current: 1, max: 1, recovery: 'long_rest', display: 'pool' },
    );
  }

  const submit = async () => {
    const parsed = resourceSchema.safeParse({ ...form, current: form.current ?? 0 });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setBusy(true);
    const client = getSupabaseBrowserClient();
    const fields = { ...parsed.data, display: form.display };
    const saved = await run(
      () =>
        isNew || !resource
          ? createCharacterResource(client, character.id, fields)
          : updateCharacterResource(client, resource.id, fields),
      {
        success: isNew ? 'Recurso criado.' : 'Recurso atualizado.',
        failure: 'Não foi possível salvar o recurso',
      },
    );
    setBusy(false);
    if (!saved) return;
    setResources((current) =>
      isNew ? [...current, saved] : current.map((item) => (item.id === saved.id ? saved : item)),
    );
    onClose();
  };

  const remove = async () => {
    if (!resource || resource === 'new') return;
    const ok = await run(() => deleteCharacterResource(getSupabaseBrowserClient(), resource.id), {
      success: 'Recurso removido.',
      failure: 'Não foi possível remover o recurso',
    });
    if (ok === undefined) throw new Error('O recurso não foi removido.');
    setResources((current) => current.filter((item) => item.id !== resource.id));
    onClose();
  };

  return (
    <Modal
      open={resource !== null}
      onClose={onClose}
      title={isNew ? 'Novo recurso' : 'Editar recurso'}
      busy={busy}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          id={`${id}-label`}
          label="Nome"
          placeholder="Ex.: Fúria, Ki, Canalizar Divindade"
          value={form.label}
          maxLength={60}
          onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          error={errors.label}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-current`} className="text-sm font-medium">
              Atual
            </label>
            <NumberInput
              id={`${id}-current`}
              value={form.current}
              min={0}
              max={99_999}
              onCommit={(value) => setForm((current) => ({ ...current, current: value }))}
              invalid={Boolean(errors.current)}
            />
            {errors.current ? <p className="text-xs text-danger">{errors.current}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-max`} className="text-sm font-medium">
              Máximo
            </label>
            <NumberInput
              id={`${id}-max`}
              value={form.max}
              min={0}
              max={99_999}
              allowEmpty
              onCommit={(value) => setForm((current) => ({ ...current, max: value }))}
            />
            <p className="text-xs text-fg-muted">Vazio = sem limite.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id={`${id}-recovery`}
            label="Recupera em"
            value={form.recovery}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recovery: event.target.value as ResourceRecovery,
              }))
            }
          >
            {RESOURCE_RECOVERIES.map((recovery) => (
              <option key={recovery} value={recovery}>
                {resourceRecoveryLabels[recovery]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={`${id}-display`}
            label="Exibição"
            value={form.display}
            onChange={(event) =>
              setForm((current) => ({ ...current, display: event.target.value as ResourceDisplay }))
            }
          >
            <option value="pool">Contador</option>
            <option value="checkboxes">Caixas de marcação</option>
          </SelectField>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {!isNew && resource ? (
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
              title={`Excluir “${resource.label}”?`}
              description="A trilha deixa de existir. Habilidades que usavam este recurso ficam sem contador."
              confirmLabel="Excluir recurso"
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
    </Modal>
  );
}
