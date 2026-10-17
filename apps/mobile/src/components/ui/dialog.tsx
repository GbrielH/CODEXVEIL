import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/lib/theme';
import { Button } from './button';
import { AppText, Divider } from './primitives';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` para ações destrutivas (sair, excluir); `primary` para as demais. */
  tone?: 'primary' | 'danger';
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const DialogContext = createContext<Confirm | null>(null);

/**
 * Confirmações com a identidade visual do Codexveil, no lugar do alerta nativo do Android:
 * fundo escuro, título em Cinzel e botões do app. Voltar (Android) ou tocar fora cancela.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // Um diálogo novo encerra o anterior como cancelado.
        resolver.current?.(false);
        resolver.current = resolve;
        setCurrent(options);
      }),
    [],
  );

  const finish = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setCurrent(null);
  };

  return (
    <DialogContext.Provider value={confirm}>
      {children}
      <Modal visible={current !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => finish(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(false)} accessibilityRole="button" accessibilityLabel="Cancelar" />
          {current ? (
            <View style={styles.card} accessibilityViewIsModal>
              <View style={styles.cornerTop} />
              <View style={styles.cornerBottom} />
              <AppText variant="title" accessibilityRole="header" style={styles.title}>
                {current.title}
              </AppText>
              <Divider style={{ marginVertical: 0 }} />
              <AppText style={styles.message}>{current.message}</AppText>
              <View style={styles.actions}>
                <Button label={current.cancelLabel ?? 'Cancelar'} variant="secondary" onPress={() => finish(false)} style={{ flex: 1 }} />
                <Button
                  label={current.confirmLabel}
                  variant={current.tone === 'danger' ? 'danger' : 'primary'}
                  onPress={() => finish(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

/** Abre uma confirmação e resolve com `true` se a pessoa confirmar. */
export function useConfirm(): Confirm {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useConfirm precisa estar dentro de <DialogProvider>.');
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[5],
    backgroundColor: 'rgba(8, 8, 10, 0.78)',
  },
  card: {
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderTopColor: 'rgba(133, 50, 68, 0.9)',
    borderTopWidth: 2,
    backgroundColor: colors.raised,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  cornerTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 14,
    height: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.5)',
  },
  cornerBottom: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 14,
    height: 14,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(187, 167, 125, 0.5)',
  },
  title: { fontSize: 22, lineHeight: 28, paddingHorizontal: spacing[1] },
  message: { color: colors.fgSecondary, lineHeight: 23 },
  actions: { flexDirection: 'row', gap: spacing[3] },
});
