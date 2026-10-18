import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, palette, spacing } from '@/lib/theme';
import { AppText } from './primitives';

interface ScreenProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Bordas protegidas pela área segura (o cabeçalho de navegação já cobre o topo). */
  edges?: Edge[];
  scroll?: boolean;
}

/**
 * Estrutura padrão das telas: fundo carvão, rolagem com "puxar para atualizar",
 * teclado sem cobrir campos e margens confortáveis para telas pequenas.
 */
export function Screen({ children, title, eyebrow, subtitle, headerAction, refreshing = false, onRefresh, edges = ['bottom'], scroll = true }: ScreenProps) {
  const header =
    title || eyebrow ? (
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
          {title ? (
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {subtitle ? <AppText variant="muted">{subtitle}</AppText> : null}
        </View>
        {headerAction}
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.fgAccent} colors={[palette.wine[500]]} progressBackgroundColor={colors.raised} /> : undefined}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }]}>
            {header}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], paddingBottom: spacing[1] },
});
