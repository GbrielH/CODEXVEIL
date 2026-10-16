import { AppError } from '@codexveil/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosaver, type AutosaveState } from './autosave';

interface Draft {
  name: string;
}

function setup(overrides: { save?: (value: Draft, version: number) => Promise<number> } = {}) {
  const states: AutosaveState[] = [];
  const save = vi.fn(overrides.save ?? ((_value: Draft, version: number) => Promise.resolve(version + 1)));
  const saver = new Autosaver<Draft>({
    initial: { name: 'Aria' },
    version: 1,
    save,
    validate: (value) => (value.name.trim() ? null : 'Informe o nome.'),
    onState: (state) => states.push(state),
    delayMs: 500,
  });
  const last = () => states[states.length - 1];
  return { saver, save, states, last };
}

describe('Autosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('agrupa alterações e salva uma vez após o intervalo', async () => {
    const { saver, save, last } = setup();
    saver.update({ name: 'Ar' });
    saver.update({ name: 'Ari' });
    saver.update({ name: 'Arin' });
    expect(last()?.status).toBe('pending');
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ name: 'Arin' }, 1);
    expect(last()).toMatchObject({ status: 'saved', version: 2 });
    expect(saver.hasUnsavedChanges).toBe(false);
  });

  it('só indica "salvo" depois da confirmação do servidor', async () => {
    let resolve: (version: number) => void = () => undefined;
    const { saver, last } = setup({
      save: () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    });
    saver.update({ name: 'Bruna' });
    await vi.advanceTimersByTimeAsync(500);
    expect(last()?.status).toBe('saving');
    expect(saver.hasUnsavedChanges).toBe(true);
    resolve(2);
    await vi.waitFor(() => expect(last()?.status).toBe('saved'));
  });

  it('nunca envia duas gravações ao mesmo tempo e salva o que mudou durante o envio', async () => {
    let resolveFirst: (version: number) => void = () => undefined;
    const save = vi
      .fn<(value: Draft, version: number) => Promise<number>>()
      .mockImplementationOnce(
        () =>
          new Promise<number>((done) => {
            resolveFirst = done;
          }),
      )
      .mockImplementation((_value, version) => Promise.resolve(version + 1));
    const { saver, last } = setup({ save });

    saver.update({ name: 'Primeiro' });
    await vi.advanceTimersByTimeAsync(500);
    saver.update({ name: 'Segundo' });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);

    resolveFirst(2);
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ name: 'Segundo' }, 2);
    expect(last()).toMatchObject({ status: 'saved', version: 3 });
  });

  it('não envia dados inválidos', async () => {
    const { saver, save, last } = setup();
    saver.update({ name: '   ' });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ status: 'invalid', message: 'Informe o nome.' });
  });

  it('em conflito, para de gravar até o usuário decidir', async () => {
    const save = vi
      .fn<(value: Draft, version: number) => Promise<number>>()
      .mockRejectedValueOnce(new AppError('conflict'))
      .mockImplementation((_value, version) => Promise.resolve(version + 1));
    const { saver, last } = setup({ save });

    saver.update({ name: 'Minha versão' });
    await vi.advanceTimersByTimeAsync(500);
    expect(last()?.status).toBe('conflict');

    saver.update({ name: 'Minha versão 2' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.hasUnsavedChanges).toBe(true);

    await saver.overwrite(7);
    expect(save).toHaveBeenLastCalledWith({ name: 'Minha versão 2' }, 7);
    expect(last()).toMatchObject({ status: 'saved', version: 8 });
  });

  it('reset descarta as alterações locais e adota a versão do servidor', async () => {
    const { saver, save, last } = setup();
    saver.update({ name: 'Rascunho' });
    saver.reset({ name: 'Do servidor' }, 5);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(saver.value).toEqual({ name: 'Do servidor' });
    expect(last()).toMatchObject({ status: 'saved', version: 5 });
  });

  it('erros de rede mantêm as alterações e permitem tentar de novo', async () => {
    const save = vi
      .fn<(value: Draft, version: number) => Promise<number>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation((_value, version) => Promise.resolve(version + 1));
    const { saver, last } = setup({ save });

    saver.update({ name: 'Offline' });
    await vi.advanceTimersByTimeAsync(500);
    expect(last()?.status).toBe('error');
    expect(last()?.message).toMatch(/conexão/);
    expect(saver.hasUnsavedChanges).toBe(true);

    await saver.retry();
    expect(last()).toMatchObject({ status: 'saved', version: 2 });
  });

  it('adota versões geradas por alterações paralelas sem conflito', async () => {
    const { saver, save } = setup();
    saver.adoptVersion(4);
    saver.update({ name: 'Depois do retrato' });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledWith({ name: 'Depois do retrato' }, 4);
  });
});
