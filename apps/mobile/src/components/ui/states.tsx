import { CircleAlert, Info, Lock, TriangleAlert, CircleCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { DragonLoader } from '@/components/brand/dragon-loader';
import { colors, radii, spacing } from '@/lib/theme';
import { Button } from './button';
import { AppText } from './primitives';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={[styles.center, { backgroundColor: colors.canvas }]}>
      <DragonLoader label={label} />
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.frame}>
      {icon}
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          {description}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View
      style={[styles.frame, { borderColor: 'rgba(226, 109, 90, 0.4)' }]}
      accessibilityRole="alert"
    >
      <CircleAlert color="#E26D5A" size={28} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        Algo deu errado
      </AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {onRetry ? <Button label="Tentar de novo" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function ForbiddenState({ message }: { message: string }) {
  return (
    <View style={styles.frame}>
      <Lock color={colors.fgSecondary} size={28} />
      <AppText variant="heading">Acesso restrito</AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
    </View>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { background: string; border: string; icon: ReactNode }> = {
  info: {
    background: colors.infoBg,
    border: 'rgba(127, 167, 217, 0.4)',
    icon: <Info size={18} color="#A5C2E6" />,
  },
  success: {
    background: colors.successBg,
    border: 'rgba(111, 179, 138, 0.4)',
    icon: <CircleCheck size={18} color="#8CC7A3" />,
  },
  warning: {
    background: colors.warningBg,
    border: 'rgba(217, 165, 74, 0.4)',
    icon: <TriangleAlert size={18} color="#E6BE74" />,
  },
  danger: {
    background: colors.dangerBg,
    border: 'rgba(226, 109, 90, 0.45)',
    icon: <CircleAlert size={18} color="#EC9384" />,
  },
};

/** Aviso em linha (resultado de ações, sessão expirada, modo somente leitura). */
export function Notice({
  tone = 'info',
  title,
  message,
  action,
}: {
  tone?: Tone;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  const style = tones[tone];
  return (
    <View
      style={[styles.notice, { backgroundColor: style.background, borderColor: style.border }]}
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
    >
      <View style={{ paddingTop: 2 }}>{style.icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <AppText style={{ fontWeight: '600' }}>{title}</AppText> : null}
        <AppText variant="muted" style={{ color: colors.fgSecondary }}>
          {message}
        </AppText>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[12],
  },
  frame: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[6],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing[3],
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing[3],
  },
});
