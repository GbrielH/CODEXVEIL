/**
 * Deslocamento em metros, para a grade da sessão (régua vermelha ao passar do limite).
 */
import { parseDnd5eSheet } from './dnd5e/sheet';
import { parseT20Sheet } from './tormenta20/sheet';

/** Deslocamento do personagem em metros (D&D: converte pés; T20: já em metros). */
export function characterSpeedMeters(systemId: string, sheet: unknown): number | null {
  try {
    if (systemId === 'tormenta20') return parseT20Sheet(sheet).identity.speed || null;
    const combat = parseDnd5eSheet(sheet).combat;
    return combat.speedUnit === 'ft' ? Math.round(combat.speed * 0.3 * 10) / 10 : combat.speed;
  } catch {
    return null;
  }
}

/**
 * Deslocamento de criatura a partir do texto do bloco ("9 m", "12 m, voo 18 m", "30 ft.",
 * "30 pés"): o primeiro número, em metros.
 */
export function speedTextMeters(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(m\b|metros?|ft\.?|feet|pés|pes)?/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? 'm').toLowerCase();
  return /^(ft|feet|pés|pes)/.test(unit) ? Math.round(value * 0.3 * 10) / 10 : value;
}
