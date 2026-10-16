import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodexveilClient } from './client';
import { subscribeToChanges, type RealtimeStatus } from './realtime';

type StatusCallback = (status: string) => void;

/** Canal falso que registra as assinaturas e permite disparar eventos e estados. */
function fakeClient() {
  const bindings: { filter: Record<string, unknown>; handler: () => void }[] = [];
  const systemHandlers: ((payload: unknown) => void)[] = [];
  let statusCallback: StatusCallback | undefined;
  const removed: unknown[] = [];

  const channel = {
    on(type: string, filter: Record<string, unknown>, handler: (payload?: unknown) => void) {
      if (type === 'system') systemHandlers.push(handler);
      else bindings.push({ filter, handler });
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
    /** Mensagem de sistema do Realtime (ex.: "Subscribed to PostgreSQL"). */
    system: (payload: unknown) => systemHandlers.forEach((handler) => handler(payload)),
  };
}

const postgresOk = {
  extension: 'postgres_changes',
  status: 'ok',
  message: 'Subscribed to PostgreSQL',
};

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

  it('só fica ao vivo quando o Postgres confirma e então ressincroniza', () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const statuses: RealtimeStatus[] = [];
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange,
      onStatus: (status) => statuses.push(status),
      debounceMs: 10,
    });

    // O canal entra antes de o servidor assinar o Postgres: ainda não está ao vivo.
    fake.setStatus('SUBSCRIBED');
    vi.advanceTimersByTime(50);
    expect(statuses).toEqual(['connecting']);
    expect(onChange).not.toHaveBeenCalled();

    fake.system(postgresOk);
    vi.advanceTimersByTime(50);
    expect(statuses).toEqual(['connecting', 'live']);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Após uma queda, volta a ressincronizar quando a assinatura fica pronta de novo.
    fake.setStatus('CHANNEL_ERROR');
    fake.setStatus('SUBSCRIBED');
    fake.system(postgresOk);
    vi.advanceTimersByTime(50);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(statuses).toEqual(['connecting', 'live', 'offline', 'live']);
  });

  it('aceita a confirmação do Postgres antes do SUBSCRIBED', () => {
    const fake = fakeClient();
    const statuses: RealtimeStatus[] = [];
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });
    fake.system(postgresOk);
    fake.setStatus('SUBSCRIBED');
    expect(statuses).toEqual(['connecting', 'live']);
  });

  it('sem confirmação, considera a assinatura pronta após o tempo limite', () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const statuses: RealtimeStatus[] = [];
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange,
      onStatus: (status) => statuses.push(status),
      debounceMs: 10,
      readyTimeoutMs: 1000,
    });
    fake.setStatus('SUBSCRIBED');
    vi.advanceTimersByTime(999);
    expect(statuses).toEqual(['connecting']);
    vi.advanceTimersByTime(20);
    expect(statuses).toEqual(['connecting', 'live']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('assinatura recusada pelo servidor fica offline', () => {
    const fake = fakeClient();
    const statuses: RealtimeStatus[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    subscribeToChanges(fake.client, 'x', [{ table: 'characters' }], {
      onChange: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });
    fake.setStatus('SUBSCRIBED');
    fake.system({ extension: 'postgres_changes', status: 'error', message: 'invalid filter' });
    vi.advanceTimersByTime(10_000);
    expect(statuses).toEqual(['connecting', 'offline']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
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
