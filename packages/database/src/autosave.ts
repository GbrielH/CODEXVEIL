/**
 * Salvamento automático com debounce e controle otimista de concorrência.
 *
 * Independente de framework: web e mobile envolvem esta classe num hook do próprio React.
 *
 * Regras:
 *  - Alterações são agrupadas (debounce) e enviadas uma de cada vez, nunca em paralelo.
 *  - O estado só vira "salvo" depois que o servidor confirma a gravação.
 *  - Cada gravação informa a versão lida; se outra pessoa salvou antes, o servidor recusa
 *    (`conflict`) e nada é sobrescrito sem decisão explícita do usuário.
 *  - Dados inválidos não são enviados; o motivo é exposto para a interface.
 */
import { appErrorMessages, isAppError } from '@codexveil/domain';
import { toAppError } from './errors';

export type AutosaveStatus =
  /** Nada a salvar desde a última confirmação do servidor. */
  | 'saved'
  /** Há alterações aguardando o intervalo de agrupamento. */
  | 'pending'
  | 'saving'
  /** A última tentativa falhou (rede, permissão...). As alterações continuam locais. */
  | 'error'
  /** Outra pessoa salvou antes: é preciso recarregar ou sobrescrever. */
  | 'conflict'
  /** Os dados atuais não passam na validação e não serão enviados. */
  | 'invalid';

export interface AutosaveState {
  status: AutosaveStatus;
  message: string | null;
  version: number;
  lastSavedAt: number | null;
}

export interface AutosaverOptions<T> {
  initial: T;
  version: number;
  /** Grava e devolve a nova versão. Deve lançar `AppError('conflict')` em conflito. */
  save: (value: T, expectedVersion: number) => Promise<number>;
  /** Mensagem de erro de validação, ou `null` se o valor puder ser salvo. */
  validate?: (value: T) => string | null;
  onState: (state: AutosaveState) => void;
  delayMs?: number;
}

export class Autosaver<T> {
  private draft: T;
  private savedKey: string;
  private version: number;
  private status: AutosaveStatus = 'saved';
  private message: string | null = null;
  private lastSavedAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private disposed = false;
  private readonly options: AutosaverOptions<T>;

  constructor(options: AutosaverOptions<T>) {
    this.options = options;
    this.draft = options.initial;
    this.savedKey = JSON.stringify(options.initial);
    this.version = options.version;
  }

  get value(): T {
    return this.draft;
  }

  get currentVersion(): number {
    return this.version;
  }

  /** Há algo que ainda não foi confirmado pelo servidor. */
  get hasUnsavedChanges(): boolean {
    return JSON.stringify(this.draft) !== this.savedKey;
  }

  /** Registra uma nova versão local e agenda o salvamento. */
  update(value: T): void {
    if (this.disposed) return;
    this.draft = value;
    if (this.status === 'conflict') {
      // Continua acumulando alterações, mas só grava após a decisão do usuário.
      this.emit();
      return;
    }
    if (!this.hasUnsavedChanges) {
      this.clearTimer();
      if (!this.inFlight) this.setStatus('saved', null);
      return;
    }
    this.setStatus(this.inFlight ? 'saving' : 'pending', null);
    this.schedule();
  }

  /** Salva imediatamente (ex.: antes de sair da página ou ao tentar de novo). */
  async flush(): Promise<void> {
    this.clearTimer();
    if (this.disposed || this.status === 'conflict') return;
    if (this.inFlight) {
      await this.inFlight;
      // O status pode ter mudado durante a espera (o TypeScript não enxerga isso).
      if (this.hasUnsavedChanges && this.currentStatus() !== 'conflict') return this.flush();
      return;
    }
    if (!this.hasUnsavedChanges) {
      this.setStatus('saved', null);
      return;
    }

    const invalid = this.options.validate?.(this.draft) ?? null;
    if (invalid) {
      this.setStatus('invalid', invalid);
      return;
    }

    const snapshot = this.draft;
    const snapshotKey = JSON.stringify(snapshot);
    this.setStatus('saving', null);
    this.inFlight = (async () => {
      try {
        const nextVersion = await this.options.save(snapshot, this.version);
        if (this.disposed) return;
        this.version = nextVersion;
        this.savedKey = snapshotKey;
        this.lastSavedAt = Date.now();
        this.setStatus(this.hasUnsavedChanges ? 'pending' : 'saved', null);
      } catch (error) {
        if (this.disposed) return;
        const appError = isAppError(error) ? error : toAppError(error);
        if (appError.code === 'conflict') {
          this.setStatus('conflict', appError.message || appErrorMessages.conflict);
        } else {
          this.setStatus('error', appError.message || appErrorMessages.unknown);
        }
      } finally {
        this.inFlight = null;
      }
    })();
    await this.inFlight;
    if (this.currentStatus() === 'pending') this.schedule();
  }

  private currentStatus(): AutosaveStatus {
    return this.status;
  }

  /** Nova tentativa após erro. */
  retry(): Promise<void> {
    return this.flush();
  }

  /** Descarta as alterações locais e adota o estado do servidor. */
  reset(value: T, version: number): void {
    this.clearTimer();
    this.draft = value;
    this.savedKey = JSON.stringify(value);
    this.version = version;
    this.setStatus('saved', null);
  }

  /**
   * Resolve um conflito mantendo as alterações locais: grava por cima da versão atual
   * do servidor, informada pelo chamador depois de o usuário confirmar.
   */
  overwrite(serverVersion: number): Promise<void> {
    this.version = serverVersion;
    this.status = 'pending';
    return this.flush();
  }

  /**
   * Adota uma versão nova gerada por uma alteração que não envolve os campos deste
   * rascunho (ex.: troca do retrato), evitando um falso conflito no próximo salvamento.
   */
  adoptVersion(version: number): void {
    if (version > this.version) this.version = version;
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private schedule(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.delayMs ?? 800);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private setStatus(status: AutosaveStatus, message: string | null): void {
    this.status = status;
    this.message = message;
    this.emit();
  }

  private emit(): void {
    if (this.disposed) return;
    this.options.onState({
      status: this.status,
      message: this.message,
      version: this.version,
      lastSavedAt: this.lastSavedAt,
    });
  }
}
