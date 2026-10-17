import type { DiceRollMode } from '@codexveil/domain';
import {
  describeRollSources,
  netRollMode,
  rollModeLabels,
  rollModeShortLabels,
  type ConditionRollSource,
} from '@codexveil/rpg-systems/dnd5e';
import { cx } from '@/lib/cx';

const badgeBase = 'inline-flex shrink-0 items-center rounded border px-1 text-[10px] leading-4 font-semibold tracking-wide uppercase';

/**
 * Selo do efeito das condições numa jogada: "Falha" (falha automática), "Vant." ou "Desv.".
 * Efeitos que só valem numa situação (ex.: com a fonte do medo à vista) aparecem como "Desv.?".
 */
export function RollEffectBadge({
  sources,
  autoFail = [],
  className,
}: {
  sources: readonly ConditionRollSource[];
  autoFail?: readonly string[];
  className?: string;
}) {
  if (autoFail.length > 0) {
    const description = `Falha automática (${autoFail.join(', ')})`;
    return (
      <span title={description} className={cx(badgeBase, 'border-ember-400/50 bg-danger-bg text-ember-300', className)}>
        <span aria-hidden="true">Falha</span>
        <span className="sr-only">{description}</span>
      </span>
    );
  }
  const mode = netRollMode(sources);
  const situational = sources.filter((source) => source.qualifier);
  if (mode === null && situational.length === 0) return null;
  const description = describeRollSources(sources).join('; ');
  if (mode === 'cancelled') {
    return (
      <span title={`${description}. Vantagem e desvantagem se anulam.`} className={cx(badgeBase, 'border-line-strong text-fg-muted', className)}>
        <span aria-hidden="true">Anulam</span>
        <span className="sr-only">{description}. Vantagem e desvantagem se anulam.</span>
      </span>
    );
  }
  const shown = mode ?? situational[0]?.mode ?? 'disadvantage';
  return (
    <span
      title={description}
      className={cx(
        badgeBase,
        shown === 'advantage' ? 'border-verdigris-400/50 bg-success-bg text-verdigris-300' : 'border-amber-400/50 bg-warning-bg text-amber-300',
        className,
      )}
    >
      <span aria-hidden="true">
        {rollModeShortLabels[shown]}
        {mode === null ? '?' : ''}
      </span>
      <span className="sr-only">
        {mode === null ? `${rollModeLabels[shown]} em certas situações: ` : ''}
        {description}
      </span>
    </span>
  );
}

/** Penalidade de Exaustão já descontada do valor mostrado. */
export function PenaltyBadge({ penalty, source, className }: { penalty: number; source: string; className?: string }) {
  if (penalty <= 0) return null;
  const description = `Já inclui −${penalty} (${source})`;
  return (
    <span title={description} className={cx(badgeBase, 'border-amber-400/50 bg-warning-bg text-amber-300', className)}>
      <span aria-hidden="true">−{penalty}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

/** Vantagem ou desvantagem que as condições ativas impõem à rolagem (anuladas = normal). */
export function rollModeFrom(sources: Parameters<typeof netRollMode>[0]): DiceRollMode {
  const net = netRollMode(sources);
  return net === 'advantage' || net === 'disadvantage' ? net : 'normal';
}
