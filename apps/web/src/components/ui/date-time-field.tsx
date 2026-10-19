'use client';

import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { controlClasses } from './control-classes';
import { FieldShell, describedBy } from './field';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];

const pad = (value: number) => String(value).padStart(2, '0');

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** "2026-10-18T20:30" (o formato do antigo `datetime-local`) ↔ partes. */
function parse(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) };
}

function format(parts: Parts): string {
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function describe(parts: Parts | null): string {
  if (!parts) return '';
  const weekday = new Date(parts.year, parts.month, parts.day).toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${weekday}, ${parts.day} de ${MONTHS[parts.month]} de ${parts.year}, às ${pad(parts.hour)}:${pad(parts.minute)}`;
}

interface DateTimeFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** Nome do campo no formulário (o valor vai num campo oculto, no formato `AAAA-MM-DDTHH:mm`). */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

/**
 * Data e hora com um calendário no visual do Codexveil (o `datetime-local` nativo muda de cara em
 * cada navegador). Pode ser controlado (`value`/`onChange`) ou usado num formulário (`name`).
 */
export function DateTimeField({ id, label, hint, error, name, value, defaultValue = '', onChange }: DateTimeFieldProps) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const parts = parse(current);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [view, setView] = useState(() => ({ year: parts?.year ?? today.getFullYear(), month: parts?.month ?? today.getMonth() }));
  const rootRef = useRef<HTMLDivElement>(null);
  const gridId = useId();

  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };
  const choose = (patch: Partial<Parts>) => {
    const base: Parts = parts ?? { year: view.year, month: view.month, day: today.getDate(), hour: 20, minute: 0 };
    set(format({ ...base, ...patch }));
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const first = new Date(view.year, view.month, 1).getDay();
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const move = (delta: number) => setView((current) => {
    const date = new Date(current.year, current.month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const isToday = (day: number) => day === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();
  const isChosen = (day: number) => parts !== null && day === parts.day && view.month === parts.month && view.year === parts.year;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div ref={rootRef} className="relative">
        {name ? <input type="hidden" name={name} value={current} /> : null}
        <div className="flex gap-2">
          <button
            id={id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-describedby={describedBy(id, hint, error)}
            onClick={() => setOpen((state) => !state)}
            className={controlClasses(Boolean(error), 'flex h-11 items-center gap-2 text-left text-sm')}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-parchment-400" aria-hidden="true" />
            {parts ? <span className="truncate first-letter:uppercase">{describe(parts)}</span> : <span className="text-fg-subtle">Escolher data e hora</span>}
          </button>
          {parts ? (
            <button
              type="button"
              onClick={() => set('')}
              aria-label="Limpar data"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong text-fg-muted hover:bg-hover hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {open ? (
          <div role="dialog" aria-label="Escolher data e hora" className="absolute z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-raised p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => move(-1)} aria-label="Mês anterior" className="rounded-md p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <p id={gridId} className="font-display text-base text-fg first-letter:uppercase">
                {MONTHS[view.month]} de {view.year}
              </p>
              <button type="button" onClick={() => move(1)} aria-label="Próximo mês" className="rounded-md p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div role="grid" aria-labelledby={gridId} className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((weekday, index) => (
                <span key={index} className="py-1 text-[11px] tracking-wider text-fg-subtle uppercase" aria-hidden="true">
                  {weekday}
                </span>
              ))}
              {cells.map((day, index) =>
                day === null ? (
                  <span key={`vazio-${index}`} />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => choose({ year: view.year, month: view.month, day })}
                    aria-pressed={isChosen(day)}
                    aria-label={`${day} de ${MONTHS[view.month]}`}
                    className={cx(
                      'tabular h-9 rounded-md text-sm transition-colors',
                      isChosen(day)
                        ? 'bg-wine-500 text-parchment-100 shadow-[inset_0_0_0_1px_rgb(228_216_189/0.35)]'
                        : isToday(day)
                          ? 'border border-parchment-300/50 text-fg-accent hover:bg-hover'
                          : 'text-fg-secondary hover:bg-hover hover:text-fg',
                    )}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <span className="text-sm text-fg-muted">Horário</span>
              <select
                aria-label="Hora"
                value={parts?.hour ?? 20}
                onChange={(event) => choose({ hour: Number(event.target.value) })}
                className={controlClasses(false, 'h-9 w-20 text-sm')}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {pad(hour)}h
                  </option>
                ))}
              </select>
              <select
                aria-label="Minutos"
                value={parts?.minute ?? 0}
                onChange={(event) => choose({ minute: Number(event.target.value) })}
                className={controlClasses(false, 'h-9 w-20 text-sm')}
              >
                {[...new Set([...MINUTES, parts?.minute ?? 0])].sort((a, b) => a - b).map((minute) => (
                  <option key={minute} value={minute}>
                    {pad(minute)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-md px-3 py-1.5 text-sm text-fg-brand hover:bg-hover">
                Pronto
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}
