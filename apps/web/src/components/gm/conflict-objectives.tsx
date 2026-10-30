'use client';

import {
  CONFLICT_OBJECTIVE_KINDS,
  conflictObjectiveKindLabels,
  createConflictObjective,
  deleteConflictObjective,
  listConflictObjectives,
  updateConflictObjective,
  type ConflictObjective,
  type ConflictObjectiveKind,
} from '@codexveil/database';
import { Eye, EyeOff, Minus, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AssimSymbol } from '@/components/assimilacao/symbols';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRealtimeRefresh } from '@/lib/use-realtime';

/**
 * Objetivos do Conflito (Assimilação RPG): cada um acumula Sucessos até o total necessário.
 * O mestre cria e ajusta; os jogadores veem os visíveis, atualizados em tempo real.
 */
export function ConflictObjectivesCard({
  campaignId,
  initial,
  canManage,
}: {
  campaignId: string;
  initial: ConflictObjective[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [objectives, setObjectives] = useState(initial);
  const [draft, setDraft] = useState<{ name: string; kind: ConflictObjectiveKind; needed: number }>(
    { name: '', kind: 'principal', needed: 6 },
  );

  const refresh = useCallback(() => {
    void listConflictObjectives(getSupabaseBrowserClient(), campaignId)
      .then(setObjectives)
      .catch(() => undefined);
  }, [campaignId]);
  useRealtimeRefresh(
    `conflito:${campaignId}`,
    [{ table: 'conflict_objectives', filter: `campaign_id=eq.${campaignId}` }],
    refresh,
  );

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível atualizar',
        description: failureMessage(error, 'Tente de novo.'),
      });
    }
  };
  const change = (objective: ConflictObjective, fields: Partial<ConflictObjective>) => {
    setObjectives((current) =>
      current.map((entry) => (entry.id === objective.id ? { ...entry, ...fields } : entry)),
    );
    void run(() => updateConflictObjective(getSupabaseBrowserClient(), objective.id, fields));
  };

  if (!canManage && objectives.length === 0) return null;
  return (
    <Card ornate>
      <CardHeader
        title="Conflito"
        description={
          canManage
            ? 'Some os Sucessos investidos em cada Objetivo. O grupo vê os marcados como visíveis.'
            : 'Objetivos do Conflito em andamento.'
        }
      />
      {objectives.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum Objetivo ainda.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {objectives.map((objective) => {
          const done = objective.progress >= objective.needed;
          return (
            <li
              key={objective.id}
              className={cx(
                'rounded-lg border p-3',
                done ? 'border-verdigris-400/60 bg-verdigris-900/20' : 'border-line',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0">
                  <span className="block font-display text-fg">{objective.name}</span>
                  <span className="text-xs text-fg-muted">
                    {conflictObjectiveKindLabels[objective.kind]}
                    {done ? ' · concluído' : ''}
                    {canManage && !objective.visible ? ' · oculto do grupo' : ''}
                  </span>
                </p>
                <span className="flex items-center gap-1 font-display text-lg text-fg">
                  {objective.progress}/{objective.needed} <AssimSymbol code="A" />
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <div
                  className={cx(
                    'h-full',
                    done
                      ? 'bg-verdigris-400'
                      : objective.kind === 'ameaca'
                        ? 'bg-ember-400'
                        : 'bg-wine-400',
                  )}
                  style={{
                    width: `${Math.min(100, (objective.progress / objective.needed) * 100)}%`,
                  }}
                />
              </div>
              {canManage ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={objective.progress <= 0}
                    onClick={() => change(objective, { progress: objective.progress - 1 })}
                    aria-label="Tirar um Sucesso"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      change(objective, { progress: Math.min(99, objective.progress + 1) })
                    }
                    aria-label="Somar um Sucesso"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Sucesso
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => change(objective, { visible: !objective.visible })}
                    aria-label={objective.visible ? 'Ocultar do grupo' : 'Mostrar ao grupo'}
                  >
                    {objective.visible ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remover ${objective.name}`}
                    onClick={() => {
                      setObjectives((current) =>
                        current.filter((entry) => entry.id !== objective.id),
                      );
                      void run(() =>
                        deleteConflictObjective(getSupabaseBrowserClient(), objective.id),
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canManage ? (
        <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_12rem_7rem_auto] sm:items-end">
          <TextField
            id="conflict-name"
            label="Novo Objetivo"
            value={draft.name}
            maxLength={120}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <SelectField
            id="conflict-kind"
            label="Tipo"
            value={draft.kind}
            onChange={(event) =>
              setDraft({ ...draft, kind: event.target.value as ConflictObjectiveKind })
            }
          >
            {CONFLICT_OBJECTIVE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {conflictObjectiveKindLabels[kind]}
              </option>
            ))}
          </SelectField>
          <TextField
            id="conflict-needed"
            label="Sucessos"
            type="number"
            min={1}
            max={99}
            value={String(draft.needed)}
            onChange={(event) =>
              setDraft({
                ...draft,
                needed: Math.max(1, Math.min(99, Math.floor(Number(event.target.value) || 1))),
              })
            }
          />
          <Button
            disabled={!draft.name.trim()}
            onClick={() => {
              void run(() =>
                createConflictObjective(getSupabaseBrowserClient(), campaignId, {
                  name: draft.name.trim(),
                  kind: draft.kind,
                  needed: draft.needed,
                }),
              );
              setDraft({ ...draft, name: '' });
            }}
          >
            Criar
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
