import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodexveilClient } from './client';
import { subscribeToChanges, type RealtimeStatus } from './realtime';

type StatusCallback = (status: string) => void;

/** Canal falso que registra as assinaturas e permite disparar eventos e estados. */
function fakeClient() {
  const bindings: { filter: Record<string, unknown>; handler: () => void }[] = [];
  let statusCallback: StatusCallback | undefined;
  const removed: unknown[] = [];

  const channel = {
    on(_type: string, filter: Record<string, unknown>, handler: () => void) {
      bindings.push({ filter, handler });
      return channel;
    },
    subscribe(callback: StatusCallback) {
      statusCallback = callback;
      return channel;
    },
  };

  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn((value: unknown) => {
      removed.push(value);
      return Promise.resolve('ok');
    }),
  } as unknown as CodexveilClient;

  return {
    client,
    bindings,
    removed,
    emit: () => bindings.forEach((binding) => binding.handler()),
    setStatus: (status: string) => statusCallback?.(status),
  };
}

describe('subscribeToChanges', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('assina cada tabela com o filtro informado', () => {
    const fake = fakeClient();
    subscribeToChanges(
      fake.client,
      'ficha:1',
      [{ table: 'characters', filter: 'id=eq.1' }, { table: 'character_resources' }],
      { onChange: vi.fn() },
    );
    expect(fake.bindings.map((binding) => binding.filter)).toEqual([
      { event: '*', schema: 'public', table: 'characters', filter: 'id=eq.1' },
      { event: '*', schema: 'public', table: 'character_resources' },
    ]);
  });

  it('agrupa rajadas de eventos numa única recarga', () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], { onChange, debounceMs: 200 });
    fake.emit();
    fake.emit();
    fake.emit();
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('informa o estado da conexão e ressincroniza após reconectar', () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const statuses: RealtimeStatus[] = [];
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange,
      onStatus: (status) => statuses.push(status),
      debounceMs: 10,
    });

    fake.setStatus('SUBSCRIBED');
    vi.advanceTimersByTime(50);
    expect(onChange).not.toHaveBeenCalled();

    fake.setStatus('CHANNEL_ERROR');
    fake.setStatus('SUBSCRIBED');
    vi.advanceTimersByTime(50);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(['connecting', 'live', 'offline', 'live']);
  });

  it('não dispara nada depois de encerrada e remove o canal', () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const unsubscribe = subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange,
    });
    fake.emit();
    unsubscribe();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    expect(fake.removed).toHaveLength(1);
  });
});
