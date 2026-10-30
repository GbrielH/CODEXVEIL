'use client';

import { listMoneyLog, recordMoney, type CharacterResource, type MoneyLogEntry } from '@codexveil/database';
import { Coins } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { formatRelative } from '@/lib/format';

export interface MoneyCurrency {
  /** Chave da trilha (`tibar`, `currency_gp`…). */
  key: string;
  /** Rótulo curto (T$, PO, PP…). */
  label: string;
  amount: number;
}

/**
 * Moedas do personagem (D&D e Tormenta20): saldo, gastar e receber sempre com valor e descrição,
 * e o histórico das movimentações. `ensure` cria a trilha da moeda se a ficha antiga não a tiver.
 */
export function MoneyPanel({
  characterId,
  currencies,
  canEdit,
  onChanged,
  ensure,
  title = 'Moedas',
}: {
  characterId: string;
  currencies: MoneyCurrency[];
  canEdit: boolean;
  onChanged: (resource: CharacterResource) => void;
  ensure?: (key: string) => Promise<void>;
  title?: string;
}) {
  const id = useId();
  const { toast } = useToast();
  const [key, setKey] = useState(currencies[0]?.key ?? '');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<MoneyLogEntry[] | null>(null);
  const labelOf = (resourceKey: string) => currencies.find((currency) => currency.key === resourceKey)?.label ?? resourceKey;

  useEffect(() => {
    listMoneyLog(getSupabaseBrowserClient(), characterId)
      .then(setLog)
      .catch(() => setLog([]));
  }, [characterId]);

  const amount = Math.floor(Number(value) || 0);
  const ready = amount > 0 && description.trim().length > 0;

  const submit = async (sign: 1 | -1) => {
    if (!ready) return;
    setBusy(true);
    try {
      if (ensure && !currencies.find((currency) => currency.key === key && currency.amount >= 0)) await ensure(key);
      const client = getSupabaseBrowserClient();
      const saved = await recordMoney(client, characterId, key, sign * amount, description.trim());
      onChanged(saved);
      setLog(await listMoneyLog(client, characterId));
      setValue('');
      setDescription('');
      toast({ tone: 'success', title: sign > 0 ? `Recebeu ${amount} ${labelOf(key)}.` : `Gastou ${amount} ${labelOf(key)}.` });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error, 'Não foi possível registrar.') });
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-10 rounded-md border border-line bg-sunken px-3 text-sm text-fg';
  return (
    <Card>
      <CardHeader icon={<Coins className="h-5 w-5" aria-hidden="true" />} title={title} />
      <div className="flex flex-wrap gap-2">
        {currencies.map((currency) => (
          <span key={currency.key} className="rounded-md border border-line px-3 py-1.5 text-sm">
            <span className="text-fg-muted">{currency.label}</span> <strong className="text-fg tabular-nums">{currency.amount.toLocaleString('pt-BR')}</strong>
          </span>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {currencies.length > 1 ? (
              <select aria-label="Moeda" value={key} onChange={(event) => setKey(event.target.value)} className={input}>
                {currencies.map((currency) => (
                  <option key={currency.key} value={currency.key}>
                    {currency.label}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              id={`${id}-valor`}
              aria-label="Valor"
              inputMode="numeric"
              placeholder="Valor"
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
              className={`${input} w-28`}
            />
            <input
              aria-label="Descrição"
              placeholder="Descrição (ex.: poção de cura, recompensa)"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${input} min-w-48 flex-1`}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!ready} loading={busy} onClick={() => void submit(-1)}>
              Gastar
            </Button>
            <Button size="sm" variant="secondary" disabled={!ready} loading={busy} onClick={() => void submit(1)}>
              Receber
            </Button>
          </div>
        </div>
      ) : null}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-fg-secondary">Histórico {log?.length ? `(${log.length})` : ''}</summary>
        {log === null ? (
          <p className="mt-2 text-sm text-fg-muted">Carregando…</p>
        ) : log.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {log.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <span className={`tabular-nums ${entry.amount > 0 ? 'text-success' : 'text-ember-300'}`}>
                  {entry.amount > 0 ? '+' : '−'}
                  {Math.abs(entry.amount).toLocaleString('pt-BR')} {labelOf(entry.resourceKey)}
                </span>
                <span className="min-w-0 flex-1 text-fg">{entry.description}</span>
                <span className="text-xs text-fg-muted">
                  saldo {entry.balance.toLocaleString('pt-BR')} · {formatRelative(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </Card>
  );
}
