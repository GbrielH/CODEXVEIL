'use client';

import { createCharacterResource, type CharacterResource } from '@codexveil/database';
import { healthStatus } from '@codexveil/domain';
import { DND5E_RESOURCE_KEYS } from '@codexveil/rpg-systems/dnd5e';
import { Heart, HeartCrack, LoaderCircle, Shield, Skull, Sparkle } from 'lucide-react';
import { useId, useState } from 'react';
import { HealthBar } from '@/components/characters/health-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useSheet } from './context';

function parseAmount(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 && text.trim() !== '' ? value : null;
}

/** Controle de vida pensado para uso durante a sessão: poucos toques, números grandes. */
export function HpTracker() {
  const { resources, adjustResource, pendingResourceIds, permissions, character, setResources, run } = useSheet();
  const hp = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.hitPoints);
  const inputId = useId();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [maxOpen, setMaxOpen] = useState(false);
  const [newMax, setNewMax] = useState<number | null>(hp?.max ?? null);
  const disabled = !permissions.canEditPlay;

  if (!hp) {
    return (
      <Card>
        <h2 className="text-lg">Pontos de vida</h2>
        <p className="mt-2 text-sm text-fg-muted">Este personagem ainda não tem uma trilha de vida.</p>
        {!disabled ? (
          <Button
            className="mt-3"
            size="sm"
            onClick={async () => {
              const created = await run(
                () =>
                  createCharacterResource(getSupabaseBrowserClient(), character.id, {
                    key: DND5E_RESOURCE_KEYS.hitPoints,
                    label: 'Pontos de vida',
                    current: 10,
                    max: 10,
                    recovery: 'long_rest',
                    display: 'health',
                    sortOrder: 0,
                  }),
                { failure: 'Não foi possível criar a trilha de vida' },
              );
              if (created) setResources((current) => [created, ...current]);
            }}
          >
            Criar trilha de vida
          </Button>
        ) : null}
      </Card>
    );
  }

  const status = healthStatus(hp.current, hp.max);
  const pending = pendingResourceIds.has(hp.id);

  const apply = (operation: 'damage' | 'heal' | 'set_temp') => {
    const value = parseAmount(amount);
    if (value === null) {
      setError('Informe um número inteiro.');
      return;
    }
    setError(null);
    adjustResource(hp, operation, value);
    setAmount('');
  };

  return (
    <Card ornate className={cx(status === 'down' && 'border-ember-400/50')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-fg-brand" aria-hidden="true" />
          Pontos de vida
        </h2>
        {pending ? (
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted" role="status">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Salvando…
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end gap-3" aria-live="polite">
        <span className="tabular font-display text-5xl leading-none text-fg-accent">{hp.current}</span>
        <span className="tabular pb-1 text-xl text-fg-muted">/ {hp.max ?? '—'}</span>
        {hp.temp > 0 ? (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-arcane-400/40 bg-info-bg px-2 py-0.5 text-xs text-arcane-300">
            <Shield className="h-3 w-3" aria-hidden="true" />
            {hp.temp} temporários
          </span>
        ) : null}
        {status === 'down' ? (
          <span className="mb-1 inline-flex items-center gap-1 text-sm text-ember-300">
            <Skull className="h-4 w-4" aria-hidden="true" /> Caído
          </span>
        ) : null}
      </div>
      <HealthBar current={hp.current} max={hp.max} temp={hp.temp} size="md" showValues={false} className="mt-3" />

      {!disabled ? (
        <>
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-fg">
              Quantidade
            </label>
            <div className="grid grid-cols-[minmax(4.5rem,6rem)_1fr_1fr_1fr] gap-2">
              <input
                id={inputId}
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply('damage');
                  }
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
                className="tabular h-11 w-full rounded-md border border-line-strong bg-sunken px-2 text-center text-lg text-fg focus-visible:border-parchment-300"
                placeholder="0"
              />
              <Button variant="danger" onClick={() => apply('damage')} icon={<HeartCrack className="h-4 w-4" aria-hidden="true" />}>
                Dano
              </Button>
              <Button variant="secondary" onClick={() => apply('heal')} icon={<Heart className="h-4 w-4" aria-hidden="true" />}>
                Cura
              </Button>
              <Button variant="secondary" onClick={() => apply('set_temp')} icon={<Shield className="h-4 w-4" aria-hidden="true" />}>
                Temp.
              </Button>
            </div>
            {error ? (
              <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
                {error}
              </p>
            ) : (
              <p id={`${inputId}-hint`} className="text-xs text-fg-muted">
                Enter aplica dano. O dano consome primeiro os pontos temporários.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { label: '−5', operation: 'damage' as const, value: 5 },
              { label: '−1', operation: 'damage' as const, value: 1 },
              { label: '+1', operation: 'heal' as const, value: 1 },
              { label: '+5', operation: 'heal' as const, value: 5 },
            ].map((quick) => (
              <Button
                key={quick.label}
                size="sm"
                variant="ghost"
                className="tabular border border-line"
                onClick={() => adjustResource(hp, quick.operation, quick.value)}
                aria-label={`${quick.operation === 'damage' ? 'Dano' : 'Cura'} de ${quick.value}`}
              >
                {quick.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setNewMax(hp.max);
                setMaxOpen(true);
              }}
            >
              Ajustar máximo
            </Button>
          </div>
        </>
      ) : null}

      <DeathSaves />

      <Modal open={maxOpen} onClose={() => setMaxOpen(false)} title="Pontos de vida máximos">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (newMax !== null) adjustResource(hp, 'set_max', newMax);
            setMaxOpen(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${inputId}-max`} className="text-sm font-medium">
              Novo máximo
            </label>
            <NumberInput id={`${inputId}-max`} value={newMax} onCommit={setNewMax} min={0} max={1_000_000} />
            <p className="text-xs text-fg-muted">Se a vida atual passar do novo máximo, ela é reduzida.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMaxOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar máximo</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/** Caixas de marcação para trilhas pequenas (testes contra a morte, inspiração). */
export function CheckboxTrack({ resource, label, tone = 'neutral' }: { resource: CharacterResource; label?: string; tone?: 'neutral' | 'success' | 'danger' }) {
  const { adjustResource, permissions } = useSheet();
  const max = resource.max ?? 0;
  const color = tone === 'success' ? 'bg-success border-success' : tone === 'danger' ? 'bg-danger border-danger' : 'bg-parchment-300 border-parchment-300';
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm text-fg-secondary">{label ?? resource.label}</span>
      <div className="flex gap-1.5" role="group" aria-label={`${label ?? resource.label}: ${resource.current} de ${max}`}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < resource.current;
          return (
            <button
              key={index}
              type="button"
              disabled={!permissions.canEditPlay}
              aria-pressed={filled}
              aria-label={`${label ?? resource.label} ${index + 1}`}
              onClick={() => adjustResource(resource, 'set_current', filled && resource.current === index + 1 ? index : index + 1)}
              className={cx(
                'h-7 w-7 rounded-full border-2 transition-colors disabled:cursor-not-allowed',
                filled ? color : 'border-line-strong bg-sunken hover:border-silver-400',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function DeathSaves() {
  const { resources } = useSheet();
  const successes = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveSuccesses);
  const failures = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.deathSaveFailures);
  const inspiration = resources.find((resource) => resource.key === DND5E_RESOURCE_KEYS.heroicInspiration);
  if (!successes && !failures && !inspiration) return null;
  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
      {successes ? <CheckboxTrack resource={successes} label="Sucessos contra a morte" tone="success" /> : null}
      {failures ? <CheckboxTrack resource={failures} label="Falhas contra a morte" tone="danger" /> : null}
      {inspiration ? (
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-parchment-300" aria-hidden="true" />
          <div className="flex-1">
            <CheckboxTrack resource={inspiration} label="Inspiração heroica" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
