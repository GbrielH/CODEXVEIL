'use client';

import { setCallSpeaker } from '@codexveil/database';
import { Megaphone, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const NARRATION = 'Narração';
const MAX_NPCS = 8;

const storageKey = (roomId: string) => `codexveil:call-npcs:${roomId}`;

const QUEUE_KEY = 'codexveil:call-npcs:fila';

const readList = (key: string): string[] | null => {
  const saved = JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown;
  return Array.isArray(saved) && saved.every((name) => typeof name === 'string') ? saved : null;
};

/** NPC rápido da biblioteca: o nome entra nos botões da próxima call aberta. */
export function queueCallNpc(name: string) {
  try {
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([...(readList(QUEUE_KEY) ?? []), name].slice(-MAX_NPCS)),
    );
  } catch {
    // Sem armazenamento: o mestre digita o nome na call.
  }
}

function readNames(roomId: string): string[] {
  try {
    const names = readList(storageKey(roomId)) ?? ['NPC 1', 'NPC 2', 'NPC 3'];
    const queued = readList(QUEUE_KEY) ?? [];
    return [...names.filter((name) => !queued.includes(name)), ...queued].slice(-MAX_NPCS);
  } catch {
    return ['NPC 1', 'NPC 2', 'NPC 3'];
  }
}

/**
 * Opcional, só para o mestre: botões de "quem está falando". Com um NPC (ou a Narração) ativo, as
 * falas transcritas do mestre saem com esse nome em vez de "Mestre". Teclas 1–9 trocam o botão.
 */
export function SpeakerBar({ roomId }: { roomId: string }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [names, setNames] = useState<string[]>(() => readNames(roomId));
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(roomId), JSON.stringify(names));
      // A fila do NPC rápido já entrou nos nomes desta sala.
      window.localStorage.removeItem(QUEUE_KEY);
    } catch {
      // Lembrar os nomes é só conveniência.
    }
  }, [roomId, names]);

  const choose = useCallback(
    (label: string | null) => {
      setActive(label);
      setCallSpeaker(getSupabaseBrowserClient(), roomId, label).catch((error: unknown) =>
        toast({ tone: 'danger', title: failureMessage(error, 'Não deu para trocar quem fala.') }),
      );
    },
    [roomId, toast],
  );

  const buttons = useMemo(
    () => [...names.map((name) => name.trim()).filter(Boolean), NARRATION],
    [names],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '0') choose(null);
      const index = Number(event.key) - 1;
      const label = Number.isInteger(index) && index >= 0 ? buttons[index] : undefined;
      if (label) choose(label === active ? null : label);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, buttons, active, choose]);

  return (
    <Card>
      <CardHeader
        icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
        title="Quem está falando"
        description="Opcional: suas falas na transcrição saem com o nome do NPC ou como Narração."
      />
      <CheckboxField
        id={`speaker-${roomId}`}
        label="Usar botões de NPC e narração"
        checked={enabled}
        onChange={(event) => {
          setEnabled(event.target.checked);
          if (!event.target.checked && active) choose(null);
        }}
      />
      {enabled ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose(null)}
              className={cx(
                'rounded-md border px-3 py-1.5 text-sm',
                active === null
                  ? 'border-accent bg-accent/20 text-fg'
                  : 'border-line text-fg-secondary',
              )}
            >
              <span className="mr-1 text-xs text-fg-muted">0</span>Mestre
            </button>
            {buttons.map((label, index) => (
              <button
                key={`${label}-${index}`}
                type="button"
                onClick={() => choose(label === active ? null : label)}
                className={cx(
                  'rounded-md border px-3 py-1.5 text-sm',
                  active === label
                    ? 'border-accent bg-accent/20 text-fg'
                    : 'border-line text-fg-secondary',
                )}
              >
                {index < 9 ? <span className="mr-1 text-xs text-fg-muted">{index + 1}</span> : null}
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {names.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Nome do NPC ${index + 1}`}
                  value={name}
                  maxLength={80}
                  onChange={(event) =>
                    setNames((current) =>
                      current.map((entry, position) =>
                        position === index ? event.target.value : entry,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 rounded-md border border-line bg-sunken px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  aria-label={`Tirar ${name || 'NPC'}`}
                  onClick={() =>
                    setNames((current) => current.filter((_, position) => position !== index))
                  }
                  className="rounded p-1 text-fg-muted hover:text-fg"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {names.length < MAX_NPCS ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setNames((current) => [...current, `NPC ${current.length + 1}`])}
              >
                Adicionar NPC
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-fg-muted">
            Atalhos: 1 a {Math.min(buttons.length, 9)} trocam quem fala; 0 volta para Mestre.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
