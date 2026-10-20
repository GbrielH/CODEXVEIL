'use client';

import {
  addSceneEntity,
  adjustSceneEntityHp,
  removeSceneEntity,
  updateSceneEntity,
  type SceneEntity,
} from '@codexveil/database';
import { applyDamage, applyHealing } from '@codexveil/domain';
import { conditionLabel, conditionsLeftAfter, findSystem } from '@codexveil/rpg-systems';
import { creatureKindLabels } from '@codexveil/validation';
import { Plus, Shield, Skull, Trash2, UserRound, Zap } from 'lucide-react';
import { useId, useState } from 'react';
import { HealthBar } from '@/components/characters/health-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ConditionApplier, ConditionChip } from './condition-applier';
import type { GmTableContext, LibraryOption } from './gm-table';
import { HpQuickAdjust } from './hp-quick-adjust';

function formatBonus(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

/**
 * NPCs e monstros presentes na cena. Cada linha é uma instância independente: dano numa
 * instância não altera o registro da biblioteca nem as outras instâncias.
 */
export function ScenePanel({
  context,
  library,
}: {
  context: GmTableContext;
  library: LibraryOption[];
}) {
  const { entities, setEntities, fail, canManage, session, campaignId, systemId } = context;
  const [adding, setAdding] = useState(false);
  const conditions = findSystem(systemId)?.conditions ?? [];

  const adjustHp = async (entity: SceneEntity, operation: 'damage' | 'heal', amount: number) => {
    const track = { current: entity.hpCurrent ?? 0, max: entity.hpMax, temp: entity.hpTemp };
    const next = operation === 'damage' ? applyDamage(track, amount) : applyHealing(track, amount);
    setEntities((current) =>
      current.map((item) =>
        item.id === entity.id ? { ...item, hpCurrent: next.current, hpTemp: next.temp } : item,
      ),
    );
    try {
      const saved = await adjustSceneEntityHp(
        getSupabaseBrowserClient(),
        entity.id,
        operation,
        amount,
      );
      setEntities((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      fail(`${entity.name}: vida não alterada`, error);
    }
  };

  const setConditions = async (
    entity: SceneEntity,
    nextConditions: string[],
    nextRounds: Record<string, number>,
  ) => {
    const conditionRounds = Object.fromEntries(
      Object.entries(nextRounds).filter(([key]) => nextConditions.includes(key)),
    );
    setEntities((current) =>
      current.map((item) =>
        item.id === entity.id ? { ...item, conditions: nextConditions, conditionRounds } : item,
      ),
    );
    try {
      const saved = await updateSceneEntity(getSupabaseBrowserClient(), entity.id, {
        conditions: nextConditions,
        conditionRounds,
      });
      setEntities((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      fail(`${entity.name}: condições não salvas`, error);
    }
  };

  const addCondition = (entity: SceneEntity, key: string, rounds: number | null) => {
    const nextRounds = { ...entity.conditionRounds };
    if (rounds === null) delete nextRounds[key];
    else nextRounds[key] = rounds;
    const nextConditions = entity.conditions.includes(key)
      ? entity.conditions
      : [...entity.conditions, key];
    return setConditions(entity, nextConditions, nextRounds);
  };

  const removeCondition = (entity: SceneEntity, key: string) => {
    const remaining = entity.conditions.filter((item) => item !== key);
    // Ex.: quem deixa de estar Inconsciente continua Caído.
    const left = conditionsLeftAfter(systemId, [key], remaining);
    return setConditions(entity, [...remaining, ...left], entity.conditionRounds);
  };

  const remove = async (entity: SceneEntity) => {
    try {
      await removeSceneEntity(getSupabaseBrowserClient(), entity.id);
    } catch (error) {
      fail(`${entity.name} não foi removido`, error);
      throw new Error('A remoção não foi concluída.');
    }
    setEntities((current) => current.filter((item) => item.id !== entity.id));
    await context.reload();
  };

  return (
    <Card>
      <CardHeader
        icon={<Skull className="h-5 w-5" aria-hidden="true" />}
        title="Cena"
        description="NPCs e monstros presentes nesta sessão."
        action={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdding(true)}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Adicionar
            </Button>
          ) : undefined
        }
      />
      {entities.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Ninguém na cena. Adicione registros da biblioteca ou crie entidades rápidas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {entities.map((entity) => (
            <li key={entity.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-fg-brand">
                  {entity.kind === 'npc' ? (
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Skull className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-fg">{entity.name}</span>
                    <Badge tone="neutral">{creatureKindLabels[entity.kind]}</Badge>
                  </p>
                  <p className="flex flex-wrap gap-3 text-xs text-fg-muted">
                    {entity.armorClass !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" aria-hidden="true" /> CA {entity.armorClass}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3" aria-hidden="true" /> Iniciativa{' '}
                      {formatBonus(entity.initiativeBonus)}
                    </span>
                  </p>
                  {entity.hpMax !== null || entity.hpCurrent !== null ? (
                    <HealthBar
                      current={entity.hpCurrent}
                      max={entity.hpMax}
                      temp={entity.hpTemp}
                      className="mt-1.5"
                    />
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex flex-col items-end gap-1">
                    <HpQuickAdjust
                      label={entity.name}
                      onApply={(operation, amount) => void adjustHp(entity, operation, amount)}
                    />
                    <ConfirmDialog
                      trigger={(open) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={open}
                          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                        >
                          Remover
                        </Button>
                      )}
                      title={`Remover ${entity.name} da cena?`}
                      description="A instância sai da cena e do combate. O registro da biblioteca não é afetado."
                      confirmLabel="Remover"
                      onConfirm={() => remove(entity)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-8">
                {entity.conditions.map((key) => (
                  <ConditionChip
                    key={key}
                    systemId={systemId}
                    conditionKey={key}
                    label={conditionLabel(systemId, key)}
                    rounds={entity.conditionRounds[key] ?? null}
                    onRemove={canManage ? () => void removeCondition(entity, key) : undefined}
                    removeLabel={`Remover ${conditionLabel(systemId, key)} de ${entity.name}`}
                  />
                ))}
                {canManage && entity.conditions.length < 20 && conditions.length > 0 ? (
                  <ConditionApplier
                    systemId={systemId}
                    targetName={entity.name}
                    appliedKeys={entity.conditions}
                    allowLevels={false}
                    onApply={(key, rounds) => addCondition(entity, key, rounds)}
                  />
                ) : null}
              </div>
              {entity.notes ? (
                <p className="pl-8 text-xs text-fg-secondary">{entity.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AddEntityModal
        open={adding}
        onClose={() => setAdding(false)}
        context={context}
        library={library}
        sessionId={session.id}
        campaignId={campaignId}
      />
    </Card>
  );
}

function AddEntityModal({
  open,
  onClose,
  context,
  library,
  sessionId,
  campaignId,
}: {
  open: boolean;
  onClose: () => void;
  context: GmTableContext;
  library: LibraryOption[];
  sessionId: string;
  campaignId: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<'library' | 'custom'>(library.length > 0 ? 'library' : 'custom');
  const [creatureId, setCreatureId] = useState('');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [custom, setCustom] = useState<{
    name: string;
    kind: 'npc' | 'monster';
    hp: number | null;
    ac: number | null;
    init: number | null;
  }>({ name: '', kind: 'monster', hp: null, ac: null, init: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const client = getSupabaseBrowserClient();
    const baseOrder = context.entities.length;
    let inputs;
    if (mode === 'library') {
      const creature = library.find((option) => option.id === creatureId);
      if (!creature) {
        setError('Escolha um registro da biblioteca.');
        return;
      }
      const count = Math.min(Math.max(quantity ?? 1, 1), 10);
      inputs = Array.from({ length: count }, (_, index) => ({
        sessionId,
        campaignId,
        creatureId: creature.id,
        kind: creature.kind,
        name: count > 1 ? `${creature.name} ${index + 1}`.slice(0, 80) : creature.name,
        hpMax: creature.hitPoints,
        armorClass: creature.armorClass,
        initiativeBonus: creature.initiativeBonus,
        sortOrder: baseOrder + index,
      }));
    } else {
      const name = custom.name.trim();
      if (!name) {
        setError('Informe o nome.');
        return;
      }
      inputs = [
        {
          sessionId,
          campaignId,
          creatureId: null,
          kind: custom.kind,
          name: name.slice(0, 80),
          hpMax: custom.hp,
          armorClass: custom.ac,
          initiativeBonus: custom.init ?? 0,
          sortOrder: baseOrder,
        },
      ];
    }
    setBusy(true);
    try {
      const created: SceneEntity[] = [];
      for (const input of inputs) created.push(await addSceneEntity(client, input));
      context.setEntities((current) => [...current, ...created]);
      setCreatureId('');
      setQuantity(1);
      setCustom({ name: '', kind: 'monster', hp: null, ac: null, init: 0 });
      onClose();
    } catch (cause) {
      context.fail('Não foi possível adicionar à cena', cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar à cena" busy={busy}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div
          className="flex rounded-md border border-line-strong p-0.5"
          role="group"
          aria-label="Origem"
        >
          <Button
            size="sm"
            className="flex-1"
            variant={mode === 'library' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'library'}
            onClick={() => setMode('library')}
          >
            Da biblioteca
          </Button>
          <Button
            size="sm"
            className="flex-1"
            variant={mode === 'custom' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'custom'}
            onClick={() => setMode('custom')}
          >
            Entidade rápida
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {mode === 'library' ? (
          <>
            {library.length === 0 ? (
              <p className="text-sm text-fg-muted">
                A biblioteca está vazia. Cadastre registros na aba Biblioteca.
              </p>
            ) : null}
            <SelectField
              id={`${id}-creature`}
              label="Registro"
              value={creatureId}
              onChange={(event) => setCreatureId(event.target.value)}
            >
              <option value="">Escolha…</option>
              {library.map((creature) => (
                <option key={creature.id} value={creature.id}>
                  {creature.name} ({creature.kind === 'npc' ? 'NPC' : 'monstro'}
                  {creature.hitPoints !== null ? ` · ${creature.hitPoints} PV` : ''})
                </option>
              ))}
            </SelectField>
            <div className="flex flex-col gap-1.5 sm:max-w-40">
              <label htmlFor={`${id}-quantity`} className="text-sm font-medium">
                Quantidade
              </label>
              <NumberInput
                id={`${id}-quantity`}
                value={quantity}
                min={1}
                max={10}
                onCommit={setQuantity}
              />
              <p className="text-xs text-fg-muted">Cada cópia tem vida própria.</p>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <TextField
                id={`${id}-name`}
                label="Nome"
                maxLength={80}
                value={custom.name}
                onChange={(event) =>
                  setCustom((current) => ({ ...current, name: event.target.value }))
                }
              />
              <SelectField
                id={`${id}-kind`}
                label="Tipo"
                value={custom.kind}
                onChange={(event) =>
                  setCustom((current) => ({
                    ...current,
                    kind: event.target.value === 'npc' ? 'npc' : 'monster',
                  }))
                }
              >
                <option value="monster">Monstro</option>
                <option value="npc">NPC</option>
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-hp`} className="text-sm font-medium">
                  PV
                </label>
                <NumberInput
                  id={`${id}-hp`}
                  value={custom.hp}
                  min={0}
                  max={1_000_000}
                  allowEmpty
                  onCommit={(hp) => setCustom((current) => ({ ...current, hp }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-ac`} className="text-sm font-medium">
                  CA
                </label>
                <NumberInput
                  id={`${id}-ac`}
                  value={custom.ac}
                  min={0}
                  max={100}
                  allowEmpty
                  onCommit={(ac) => setCustom((current) => ({ ...current, ac }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-init`} className="text-sm font-medium">
                  Iniciativa
                </label>
                <NumberInput
                  id={`${id}-init`}
                  value={custom.init}
                  min={-50}
                  max={50}
                  onCommit={(init) => setCustom((current) => ({ ...current, init }))}
                />
              </div>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            Adicionar à cena
          </Button>
        </div>
      </form>
    </Modal>
  );
}
