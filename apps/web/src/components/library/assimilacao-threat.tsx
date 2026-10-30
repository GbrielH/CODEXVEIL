'use client';

import { updateCreatureGmData } from '@codexveil/database';
import {
  assimilacaoStatBlockSchema,
  poolExpression,
  rollPool,
  sumFaces,
  type AssimilacaoStatBlock,
  type RolledDie,
} from '@codexveil/rpg-systems/assimilacao';
import { Dices, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AssimSymbol, withAssimSymbols } from '@/components/assimilacao/symbols';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextareaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function Faces({ dice }: { dice: RolledDie[] }) {
  const total = sumFaces(dice.map((die) => die.result));
  return (
    <span className="flex flex-wrap items-center gap-1">
      {Array.from({ length: total.sucesso }, (_, i) => (
        <AssimSymbol key={`a${i}`} code="A" />
      ))}
      {Array.from({ length: total.adaptacao }, (_, i) => (
        <AssimSymbol key={`b${i}`} code="B" />
      ))}
      {Array.from({ length: total.pressao }, (_, i) => (
        <AssimSymbol key={`c${i}`} code="C" />
      ))}
      {total.sucesso + total.adaptacao + total.pressao === 0 ? '—' : null}
    </span>
  );
}

/**
 * Ameaça de Conflito do Assimilação: a pilha de dados que o Assimilador rola no turno dele, os
 * Sucessos para neutralizá-la e as ativações (pagas com os símbolos da rolagem).
 */
export function AssimilacaoThreatView({
  name,
  stats,
}: {
  name: string;
  stats: AssimilacaoStatBlock;
}) {
  const [rolled, setRolled] = useState<RolledDie[] | null>(null);
  const expression = poolExpression(stats.pool);
  return (
    <Card ornate>
      <CardHeader title={stats.name || name} description={stats.kind || 'Ameaça de Conflito'} />
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <dt className="text-fg-muted">Pilha de dados</dt>
        <dd className="text-fg sm:col-span-2">{expression || '—'}</dd>
        <dt className="text-fg-muted">Para neutralizar</dt>
        <dd className="flex items-center gap-1 text-fg sm:col-span-2">
          {stats.neutralize} <AssimSymbol code="A" />
        </dd>
        {stats.health !== null ? (
          <>
            <dt className="text-fg-muted">Saúde</dt>
            <dd className="text-fg sm:col-span-2">{stats.health}</dd>
          </>
        ) : null}
      </dl>
      {stats.activations.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {stats.activations.map((activation) => (
            <li key={activation.name} className="rounded-md border border-line p-2 text-sm">
              <p className="font-medium text-fg">
                {activation.cost ? (
                  <span className="mr-1">{withAssimSymbols(activation.cost)}</span>
                ) : null}
                {activation.name}
              </p>
              {activation.text ? (
                <p className="text-fg-secondary">{withAssimSymbols(activation.text)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {stats.notes ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-fg-secondary">
          {withAssimSymbols(stats.notes)}
        </p>
      ) : null}
      {expression ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setRolled(rollPool(stats.pool))}>
            <Dices className="h-4 w-4" aria-hidden="true" /> Rolar {expression}
          </Button>
          {rolled ? (
            <span className="flex items-center gap-2 text-sm text-fg" aria-live="polite">
              Resultado (todos os símbolos, para pagar as ativações): <Faces dice={rolled} />
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function AssimilacaoThreatEditor({
  creatureId,
  stats: initial,
  gm,
}: {
  creatureId: string;
  stats: AssimilacaoStatBlock;
  gm: { notes: string; secrets: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const parsed = assimilacaoStatBlockSchema.safeParse(stats);
    if (!parsed.success) {
      toast({
        tone: 'danger',
        title: 'Dados inválidos',
        description: parsed.error.issues[0]?.message ?? '',
      });
      return;
    }
    setBusy(true);
    try {
      await updateCreatureGmData(getSupabaseBrowserClient(), creatureId, {
        stats: parsed.data,
        notes: gm.notes,
        secrets: gm.secrets,
      });
      toast({ tone: 'success', title: 'Ameaça salva.' });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível salvar',
        description: failureMessage(error, 'Tente de novo.'),
      });
    } finally {
      setBusy(false);
    }
  };
  const number = (value: string) => Math.max(0, Math.floor(Number(value) || 0));
  return (
    <Card>
      <CardHeader
        title="Editar Ameaça"
        description="Use {A}, {B}, {C}… nos textos para mostrar os ícones."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="threat-name"
          label="Nome"
          value={stats.name}
          maxLength={120}
          onChange={(event) => setStats({ ...stats, name: event.target.value })}
        />
        <TextField
          id="threat-kind"
          label="Tipo"
          value={stats.kind}
          maxLength={120}
          onChange={(event) => setStats({ ...stats, kind: event.target.value })}
        />
        {(['d6', 'd10', 'd12'] as const).map((die) => (
          <TextField
            key={die}
            id={`threat-${die}`}
            label={`Quantidade de ${die}`}
            type="number"
            min={0}
            max={20}
            value={String(stats.pool[die])}
            onChange={(event) =>
              setStats({
                ...stats,
                pool: { ...stats.pool, [die]: Math.min(20, number(event.target.value)) },
              })
            }
          />
        ))}
        <TextField
          id="threat-neutralize"
          label="Sucessos para neutralizar"
          type="number"
          min={0}
          value={String(stats.neutralize)}
          onChange={(event) => setStats({ ...stats, neutralize: number(event.target.value) })}
        />
        <TextField
          id="threat-health"
          label="Saúde (opcional)"
          type="number"
          min={0}
          value={stats.health === null ? '' : String(stats.health)}
          onChange={(event) =>
            setStats({
              ...stats,
              health: event.target.value === '' ? null : number(event.target.value),
            })
          }
        />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <p className="eyebrow">Ativações</p>
        {stats.activations.map((activation, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-line p-2 sm:grid-cols-[8rem_1fr_auto]"
          >
            <TextField
              id={`act-cost-${index}`}
              label="Custo"
              value={activation.cost}
              maxLength={40}
              onChange={(event) =>
                setStats({
                  ...stats,
                  activations: stats.activations.map((item, position) =>
                    position === index ? { ...item, cost: event.target.value } : item,
                  ),
                })
              }
            />
            <TextField
              id={`act-name-${index}`}
              label="Nome"
              value={activation.name}
              maxLength={120}
              onChange={(event) =>
                setStats({
                  ...stats,
                  activations: stats.activations.map((item, position) =>
                    position === index ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label="Tirar ativação"
              className="self-end p-2"
              onClick={() =>
                setStats({
                  ...stats,
                  activations: stats.activations.filter((_, position) => position !== index),
                })
              }
            >
              <Trash2 className="h-4 w-4 text-fg-muted hover:text-fg" aria-hidden="true" />
            </button>
            <TextareaField
              id={`act-text-${index}`}
              className="sm:col-span-3"
              label="Efeito"
              rows={2}
              value={activation.text}
              onChange={(event) =>
                setStats({
                  ...stats,
                  activations: stats.activations.map((item, position) =>
                    position === index ? { ...item, text: event.target.value } : item,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() =>
            setStats({
              ...stats,
              activations: [
                ...stats.activations,
                { name: 'Nova ativação', cost: '{C}{C}', text: '' },
              ],
            })
          }
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Ativação
        </Button>
        <TextareaField
          id="threat-notes"
          label="Anotações"
          rows={3}
          value={stats.notes}
          onChange={(event) => setStats({ ...stats, notes: event.target.value })}
        />
        <Button className="self-start" loading={busy} onClick={() => void save()}>
          Salvar Ameaça
        </Button>
      </div>
    </Card>
  );
}
