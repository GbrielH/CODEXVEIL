/**
 * Custo das habilidades no turno (SRD 5.2.1): o que gasta a ação, a ação bônus ou a reação, e o
 * que concede uma ação extra (Surto de Ação). Usado pelo painel de turnos para registrar e
 * controlar automaticamente o que cada personagem já fez.
 */
import type { TurnActionKind } from '@codexveil/domain';

export interface Dnd5eTurnCost {
  kind: TurnActionKind;
  /** Concede uma ação extra neste turno. */
  grantsAction: boolean;
}

/** Habilidades de classe conhecidas, pelo nome na ficha (em português). */
const FEATURE_COSTS: Readonly<Record<string, Dnd5eTurnCost>> = {
  'fúria': { kind: 'bonus_action', grantsAction: false },
  'surto de ação': { kind: 'free', grantsAction: true },
  'retomar o fôlego': { kind: 'bonus_action', grantsAction: false },
  'ação ardilosa': { kind: 'bonus_action', grantsAction: false },
  'inspiração de bardo': { kind: 'bonus_action', grantsAction: false },
  'forma selvagem': { kind: 'bonus_action', grantsAction: false },
  'cura pelas mãos': { kind: 'bonus_action', grantsAction: false },
  'véu da natureza': { kind: 'bonus_action', grantsAction: false },
  'canalizar divindade': { kind: 'action', grantsAction: false },
  'destruir mortos-vivos': { kind: 'action', grantsAction: false },
  'presença intimidadora': { kind: 'bonus_action', grantsAction: false },
  'contraencanto': { kind: 'reaction', grantsAction: false },
  'desviar ataques': { kind: 'reaction', grantsAction: false },
  'esquiva sobrenatural': { kind: 'reaction', grantsAction: false },
  'golpe atordoante': { kind: 'free', grantsAction: false },
  'retaliação': { kind: 'reaction', grantsAction: false },
};

/** Custo pelo tempo de conjuração da magia ("Ação", "Ação bônus", "Reação", "1 minuto"…). */
export function spellTurnCost(castingTime: string): Dnd5eTurnCost {
  const text = castingTime.toLowerCase();
  if (text.includes('bônus') || text.includes('bonus')) return { kind: 'bonus_action', grantsAction: false };
  if (text.includes('reação') || text.includes('reaction')) return { kind: 'reaction', grantsAction: false };
  return { kind: 'action', grantsAction: false };
}

/** Custo de uma habilidade da ficha; `null` quando ela não é usada como ação (ex.: passivas). */
export function featureTurnCost(name: string): Dnd5eTurnCost | null {
  return FEATURE_COSTS[name.trim().toLowerCase()] ?? null;
}
