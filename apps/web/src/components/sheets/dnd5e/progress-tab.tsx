'use client';

import {
  CHARACTER_EVENT_KINDS,
  addCharacterEvent,
  characterEventKindLabels,
  listCharacterEvents,
  listCharacterSnapshots,
  type CharacterEventKind,
  type CharacterSnapshot,
} from '@codexveil/database';
import { parseDnd5eSheet, totalLevel } from '@codexveil/rpg-systems/dnd5e';
import { History, RotateCcw, ScrollText } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useAsyncData } from '@/lib/use-async-data';
import { useSheet } from './context';
import { LevelUpButton } from './level-up-dialog';

export function ProgressTab() {
  const { permissions } = useSheet();
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <ExperienceCard />
        <EventsCard />
      </div>
      {permissions.canEditSheet ? <SnapshotsCard /> : null}
    </div>
  );
}

function ExperienceCard() {
  const { sheet, derived, updateSheet, permissions } = useSheet();
  const id = useId();
  const usesXp = sheet.identity.advancement === 'experience';
  return (
    <Card>
      <CardHeader
        title="Progressão"
        description={usesXp ? 'Evolução por pontos de experiência.' : 'Evolução por marcos: o mestre indica quando subir de nível.'}
        action={<LevelUpButton />}
      />
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-line bg-raised p-3">
          <dt className="text-[11px] uppercase tracking-wider text-fg-muted">Nível</dt>
          <dd className="tabular font-display text-2xl text-fg-accent">{derived.level}</dd>
        </div>
        <div className="rounded-md border border-line bg-raised p-3">
          <dt className="text-[11px] uppercase tracking-wider text-fg-muted">Experiência</dt>
          <dd className="tabular font-display text-2xl text-fg-accent">{derived.experience.current.toLocaleString('pt-BR')}</dd>
        </div>
        <div className="rounded-md border border-line bg-raised p-3">
          <dt className="text-[11px] uppercase tracking-wider text-fg-muted">Próximo nível</dt>
          <dd className="tabular font-display text-2xl text-fg-accent">{derived.experience.nextLevelAt?.toLocaleString('pt-BR') ?? '—'}</dd>
        </div>
      </dl>
      {usesXp ? (
        <div className="mt-4 flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor={`${id}-xp`} className="text-sm font-medium">
            Pontos de experiência
          </label>
          <NumberInput
            id={`${id}-xp`}
            value={sheet.identity.experience}
            min={0}
            max={1_000_000}
            disabled={!permissions.canEditSheet}
            onCommit={(experience) => updateSheet((current) => ({ ...current, identity: { ...current.identity, experience: experience ?? 0 } }))}
          />
          {derived.experience.levelFromExperience > derived.level ? (
            <p className="text-xs text-amber-300">
              A experiência já permite o nível {derived.experience.levelFromExperience}. Use “Subir de nível”.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function EventsCard() {
  const { character, permissions, run } = useSheet();
  const id = useId();
  const [kind, setKind] = useState<CharacterEventKind>('milestone');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: events, error, reload: load } = useAsyncData(
    () => listCharacterEvents(getSupabaseBrowserClient(), character.id),
    'Não foi possível carregar o histórico.',
    character.id,
  );

  const add = async () => {
    const text = summary.trim();
    if (!text) return;
    setBusy(true);
    const ok = await run(() => addCharacterEvent(getSupabaseBrowserClient(), character.id, { kind, summary: text }), {
      success: 'Registro adicionado ao histórico.',
      failure: 'O registro não foi salvo',
    });
    setBusy(false);
    if (ok === undefined) return;
    setSummary('');
    load();
  };

  return (
    <Card>
      <CardHeader icon={<ScrollText className="h-5 w-5" aria-hidden="true" />} title="Histórico de evolução" description="Registros permanentes: níveis, marcos e acontecimentos importantes." />
      {permissions.canEditPlay ? (
        <form
          className="mb-4 grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <SelectField id={`${id}-kind`} label="Tipo" value={kind} onChange={(event) => setKind(event.target.value as CharacterEventKind)}>
            {CHARACTER_EVENT_KINDS.map((option) => (
              <option key={option} value={option}>
                {characterEventKindLabels[option]}
              </option>
            ))}
          </SelectField>
          <TextField id={`${id}-summary`} label="O que aconteceu" maxLength={300} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Ex.: Derrotou o carniçal da torre" />
          <Button type="submit" loading={busy} disabled={!summary.trim()}>
            Registrar
          </Button>
        </form>
      ) : null}
      {error ? (
        <ErrorState description={error} action={<Button size="sm" variant="secondary" onClick={load}>Tentar de novo</Button>} />
      ) : events === null ? (
        <LoadingState label="Carregando histórico…" />
      ) : events.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum registro ainda.</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rotate-45 bg-parchment-400" aria-hidden="true" />
              <p className="text-xs text-fg-muted">
                {formatDateTime(event.occurredAt)} · {characterEventKindLabels[event.kind]}
                {event.actorName ? ` · por ${event.actorName}` : ''}
              </p>
              <p className="text-sm text-fg">{event.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function SnapshotsCard() {
  const { character, name, sheet, updateSheet, setName } = useSheet();
  const { toast } = useToast();
  const { data: snapshots, error, reload: load } = useAsyncData(
    () => listCharacterSnapshots(getSupabaseBrowserClient(), character.id),
    'Não foi possível carregar as cópias.',
    character.id,
  );

  const restore = (snapshot: CharacterSnapshot) => {
    let restored;
    try {
      restored = parseDnd5eSheet(snapshot.sheet);
    } catch {
      return Promise.reject(new Error('Esta cópia não pôde ser lida.'));
    }
    // A restauração passa pelo salvamento normal (com controle de versão), e a versão
    // atual vira uma nova cópia de segurança automaticamente.
    setName(snapshot.name);
    updateSheet(() => restored);
    toast({ tone: 'success', title: 'Cópia restaurada', description: 'A ficha será salva automaticamente.' });
    return Promise.resolve();
  };

  return (
    <Card>
      <CardHeader
        icon={<History className="h-5 w-5" aria-hidden="true" />}
        title="Cópias de segurança"
        description="Guardadas automaticamente antes de cada rajada de edições (até 30)."
      />
      {error ? (
        <ErrorState description={error} action={<Button size="sm" variant="secondary" onClick={load}>Tentar de novo</Button>} />
      ) : snapshots === null ? (
        <LoadingState label="Carregando cópias…" />
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-fg-muted">Ainda não há cópias. Elas surgem conforme a ficha é editada.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {snapshots.map((snapshot) => {
            let level: number | null = null;
            try {
              level = totalLevel(parseDnd5eSheet(snapshot.sheet));
            } catch {
              level = null;
            }
            return (
              <li key={snapshot.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{snapshot.name}</p>
                  <p className="text-xs text-fg-muted">
                    {formatDateTime(snapshot.createdAt)} · versão {snapshot.version}
                    {level ? ` · nível ${level}` : ''}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={(open) => (
                    <Button size="sm" variant="ghost" onClick={open} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
                      Restaurar
                    </Button>
                  )}
                  title="Restaurar esta cópia?"
                  description={`A ficha de “${name}” volta ao estado de ${formatDateTime(snapshot.createdAt)}. O estado atual é guardado como nova cópia, então nada se perde. Vida, recursos e inventário não mudam.`}
                  confirmLabel="Restaurar"
                  tone="primary"
                  onConfirm={() => restore(snapshot)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-fg-muted">Ficha atual: {sheet.identity.classes.map((entry) => entry.name).filter(Boolean).join(' / ') || 'sem classe definida'}.</p>
    </Card>
  );
}
