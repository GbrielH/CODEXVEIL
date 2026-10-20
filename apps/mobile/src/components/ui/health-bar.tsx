import { healthStatus, healthStatusLabels, type HealthStatus } from '@codexveil/domain';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';
import { AppText } from './primitives';

const barColors: Record<HealthStatus, string> = {
  healthy: colors.hpHealthy,
  bloodied: colors.hpBloodied,
  critical: colors.hpCritical,
  down: colors.hpCritical,
  unknown: colors.fgSubtle,
};

/** Barra de vida com o estado também escrito em texto (não depende só da cor). */
export function HealthBar({
  current,
  max,
  temp = 0,
  showValues = true,
}: {
  current: number;
  max: number | null;
  temp?: number;
  showValues?: boolean;
}) {
  const status = healthStatus(current, max);
  const percent = max && max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const tempPercent = max && max > 0 ? Math.min(100 - percent, (temp / max) * 100) : 0;
  return (
    <View
      style={{ gap: 4 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Pontos de vida: ${current} de ${max ?? '?'}${temp > 0 ? `, mais ${temp} temporários` : ''}. ${healthStatusLabels[status]}.`}
    >
      <View style={styles.track}>
        <View style={{ width: `${percent}%`, backgroundColor: barColors[status] }} />
        {tempPercent > 0 ? (
          <View style={{ width: `${tempPercent}%`, backgroundColor: colors.hpTemp }} />
        ) : null}
      </View>
      {showValues ? (
        <View style={styles.row}>
          <AppText variant="small">
            {current} / {max ?? '—'}
            {temp > 0 ? ` +${temp} temp.` : ''}
          </AppText>
          <AppText variant="small" style={{ color: barColors[status] }}>
            {healthStatusLabels[status]}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
