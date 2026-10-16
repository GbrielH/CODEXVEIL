/**
 * Trilhas de recursos de personagens e criaturas: pontos de vida, dados de vida,
 * espaços de magia, usos de habilidades, testes contra a morte etc.
 *
 * Toda trilha tem valor atual, máximo opcional e (para vida) um amortecedor temporário.
 * As mesmas regras são aplicadas atomicamente no banco pela função
 * `public.adjust_character_resource` — os testes de integração comparam os dois resultados.
 */

export const RESOURCE_RECOVERIES = ['manual', 'short_rest', 'long_rest'] as const;
export type ResourceRecovery = (typeof RESOURCE_RECOVERIES)[number];

export const resourceRecoveryLabels: Record<ResourceRecovery, string> = {
  manual: 'Manual',
  short_rest: 'Descanso curto',
  long_rest: 'Descanso longo',
};

export type RestKind = 'short_rest' | 'long_rest';

export interface TrackValue {
  current: number;
  /** `null` = sem limite superior. */
  max: number | null;
  /** Valor temporário que absorve dano antes do atual (ex.: PV temporários). */
  temp: number;
}

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Quantidade inválida: ${amount}. Use um inteiro maior ou igual a zero.`);
  }
}

function clampCurrent(value: number, max: number | null): number {
  const floored = Math.max(0, value);
  return max === null ? floored : Math.min(max, floored);
}

/** Dano: consome primeiro o temporário, depois o atual (mínimo zero). */
export function applyDamage(track: TrackValue, amount: number): TrackValue {
  assertAmount(amount);
  const absorbed = Math.min(track.temp, amount);
  const remaining = amount - absorbed;
  return {
    ...track,
    temp: track.temp - absorbed,
    current: Math.max(0, track.current - remaining),
  };
}

/** Cura: aumenta o atual até o máximo; não afeta o temporário. */
export function applyHealing(track: TrackValue, amount: number): TrackValue {
  assertAmount(amount);
  return { ...track, current: clampCurrent(track.current + amount, track.max) };
}

/** Define o valor temporário (substitui o anterior). */
export function setTemporary(track: TrackValue, value: number): TrackValue {
  assertAmount(value);
  return { ...track, temp: value };
}

/** Define diretamente o valor atual, respeitando os limites. */
export function setCurrent(track: TrackValue, value: number): TrackValue {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Valor inválido: ${value}. Use um número inteiro.`);
  }
  return { ...track, current: clampCurrent(value, track.max) };
}

/** Operações aceitas pela função `public.adjust_character_resource` do banco. */
export const TRACK_OPERATIONS = ['damage', 'heal', 'spend', 'set_current', 'set_temp', 'set_max'] as const;
export type TrackOperation = (typeof TRACK_OPERATIONS)[number];

/**
 * Aplica uma operação localmente, com o mesmo resultado que o banco produzirá. Usada para
 * dar retorno imediato na interface enquanto a gravação atômica é confirmada.
 */
export function applyTrackOperation(track: TrackValue, operation: TrackOperation, amount: number): TrackValue {
  assertAmount(amount);
  switch (operation) {
    case 'damage':
      return applyDamage(track, amount);
    case 'heal':
      return applyHealing(track, amount);
    case 'spend':
      return { ...track, current: Math.max(0, track.current - amount) };
    case 'set_current':
      return setCurrent(track, amount);
    case 'set_temp':
      return setTemporary(track, amount);
    case 'set_max':
      return { ...track, max: amount, current: Math.min(track.current, amount) };
  }
}

/** Indica se uma trilha é restaurada pelo descanso informado. */
export function recoversOn(recovery: ResourceRecovery, rest: RestKind): boolean {
  if (recovery === 'manual') return false;
  if (rest === 'long_rest') return true;
  return recovery === 'short_rest';
}

export type HealthStatus = 'healthy' | 'bloodied' | 'critical' | 'down' | 'unknown';

export const healthStatusLabels: Record<HealthStatus, string> = {
  healthy: 'Saudável',
  bloodied: 'Ferido',
  critical: 'Em perigo',
  down: 'Caído',
  unknown: 'Indefinido',
};

/** Classificação visual da vida: até 50% ferido, até 25% em perigo, zero caído. */
export function healthStatus(current: number, max: number | null): HealthStatus {
  if (max === null || max <= 0) return 'unknown';
  if (current <= 0) return 'down';
  const ratio = current / max;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.5) return 'bloodied';
  return 'healthy';
}
