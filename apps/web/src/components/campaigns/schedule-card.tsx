'use client';

import {
  confirmSchedule,
  createSchedulePoll,
  deleteSchedulePoll,
  listSchedulePolls,
  listSessions,
  voteSchedule,
  type ScheduleAnswer,
  type SchedulePoll,
} from '@codexveil/database';
import { CalendarClock, Check, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const ANSWERS: { value: ScheduleAnswer; label: string }[] = [
  { value: 'yes', label: 'Posso' },
  { value: 'maybe', label: 'Talvez' },
  { value: 'no', label: 'Não posso' },
];

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Agenda da campanha: o mestre propõe datas para a próxima sessão, cada membro responde e o
 * mestre confirma uma (vira a data da sessão escolhida).
 */
export function ScheduleCard({
  campaignId,
  userId,
  canManage,
}: {
  campaignId: string;
  userId: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [polls, setPolls] = useState<SchedulePoll[]>([]);
  const [sessions, setSessions] = useState<{ id: string; label: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [dates, setDates] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    listSchedulePolls(getSupabaseBrowserClient(), campaignId)
      .then(setPolls)
      .catch(() => undefined);
  }, [campaignId]);

  useEffect(() => {
    reload();
    if (!canManage) return;
    listSessions(getSupabaseBrowserClient(), campaignId)
      .then((list) =>
        setSessions(
          list
            .filter((session) => session.status !== 'completed')
            .map((session) => ({
              id: session.id,
              label: `Sessão ${session.number}: ${session.title}`,
            })),
        ),
      )
      .catch(() => undefined);
  }, [campaignId, canManage, reload]);

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
      reload();
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, failure) });
    }
  };

  const create = async () => {
    const starts = dates.filter(Boolean).map((value) => new Date(value).toISOString());
    if (!starts.length) return;
    setBusy(true);
    await run(async () => {
      await createSchedulePoll(getSupabaseBrowserClient(), {
        campaignId,
        sessionId: sessionId || null,
        title: title.trim(),
        starts,
      });
      setCreating(false);
      setTitle('');
      setDates(['']);
    }, 'A votação não foi criada.');
    setBusy(false);
  };

  const open = polls.filter((poll) => poll.status === 'open');
  const lastClosed = polls.find((poll) => poll.status === 'closed');

  return (
    <Card>
      <CardHeader
        icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
        title="Agenda"
        description="Marque quando você pode jogar a próxima sessão."
        action={
          canManage && !creating ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setCreating(true)}
            >
              Propor datas
            </Button>
          ) : undefined
        }
      />

      {creating ? (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-line p-3">
          <TextField
            id="agenda-titulo"
            label="Título (opcional)"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Próxima sessão"
          />
          {sessions.length ? (
            <SelectField
              id="agenda-sessao"
              label="Sessão que recebe a data"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">Nenhuma (só votar)</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          {dates.map((value, index) => (
            <div key={index} className="flex items-end gap-2">
              <TextField
                id={`agenda-data-${index}`}
                label={`Opção ${index + 1}`}
                type="datetime-local"
                value={value}
                onChange={(event) =>
                  setDates((current) =>
                    current.map((entry, position) =>
                      position === index ? event.target.value : entry,
                    ),
                  )
                }
              />
              {dates.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Tirar opção ${index + 1}`}
                  className="mb-2 rounded p-1 text-fg-muted hover:text-fg"
                  onClick={() =>
                    setDates((current) => current.filter((_, position) => position !== index))
                  }
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {dates.length < 10 ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDates((current) => [...current, ''])}
              >
                Outra data
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={busy}
              disabled={!dates.some(Boolean)}
              onClick={() => void create()}
            >
              Abrir votação
            </Button>
          </div>
        </div>
      ) : null}

      {open.length === 0 && !creating ? (
        <p className="text-sm text-fg-muted">
          {lastClosed?.chosenOptionId
            ? `Data confirmada: ${formatWhen(lastClosed.options.find((option) => option.id === lastClosed.chosenOptionId)?.startsAt ?? lastClosed.createdAt)}.`
            : 'Nenhuma votação aberta.'}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {open.map((poll) => (
          <section key={poll.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-fg">{poll.title || 'Próxima sessão'}</h3>
              {canManage ? (
                <button
                  type="button"
                  aria-label="Apagar votação"
                  className="rounded p-1 text-fg-muted hover:text-fg"
                  onClick={() =>
                    void run(
                      () => deleteSchedulePoll(getSupabaseBrowserClient(), poll.id),
                      'A votação não foi apagada.',
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <ul className="flex flex-col gap-2">
              {poll.options.map((option) => {
                const mine = option.votes.find((vote) => vote.userId === userId)?.answer;
                const count = (answer: ScheduleAnswer) =>
                  option.votes.filter((vote) => vote.answer === answer).length;
                return (
                  <li key={option.id} className="rounded-md border border-line p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-fg">{formatWhen(option.startsAt)}</span>
                      <span className="text-xs text-fg-muted">
                        {count('yes')} podem · {count('maybe')} talvez · {count('no')} não
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ANSWERS.map((answer) => (
                        <button
                          key={answer.value}
                          type="button"
                          onClick={() =>
                            void run(
                              () =>
                                voteSchedule(getSupabaseBrowserClient(), option.id, answer.value),
                              'A resposta não foi salva.',
                            )
                          }
                          className={cx(
                            'rounded-md border px-2 py-1 text-xs',
                            mine === answer.value
                              ? 'border-accent bg-accent/20 text-fg'
                              : 'border-line text-fg-secondary',
                          )}
                        >
                          {answer.label}
                        </button>
                      ))}
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Check className="h-4 w-4" aria-hidden="true" />}
                          onClick={() =>
                            void run(
                              () => confirmSchedule(getSupabaseBrowserClient(), poll.id, option.id),
                              'A data não foi confirmada.',
                            )
                          }
                        >
                          Confirmar
                        </Button>
                      ) : null}
                    </div>
                    {option.votes.length ? (
                      <p className="mt-1 text-xs text-fg-muted">
                        {option.votes
                          .map(
                            (vote) =>
                              `${vote.name}: ${ANSWERS.find((answer) => answer.value === vote.answer)?.label}`,
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
