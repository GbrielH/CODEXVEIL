import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/lib/theme';
import { AppText } from './primitives';

type Tone = 'success' | 'info' | 'warning' | 'danger';

interface ToastMessage {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ToastContext = createContext<((message: Omit<ToastMessage, 'id'>) => void) | null>(null);

const dotColors: Record<Tone, string> = {
  success: colors.success,
  info: colors.info,
  warning: colors.warning,
  danger: colors.danger,
};

/** Notificações temporárias, anunciadas por leitores de tela. Toque para dispensar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback(
    (id: number) => setMessages((current) => current.filter((message) => message.id !== id)),
    [],
  );
  const show = useCallback(
    (message: Omit<ToastMessage, 'id'>) => {
      const id = nextId.current++;
      setMessages((current) => [...current.slice(-2), { ...message, id }]);
      setTimeout(() => dismiss(id), message.tone === 'danger' ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.region, { bottom: insets.bottom + 72 }]}>
        {messages.map((message) => (
          <Pressable
            key={message.id}
            onPress={() => dismiss(message.id)}
            accessibilityRole={message.tone === 'danger' ? 'alert' : 'text'}
            accessibilityLiveRegion={message.tone === 'danger' ? 'assertive' : 'polite'}
            accessibilityHint="Toque para fechar"
            style={[styles.toast, { borderColor: dotColors[message.tone] }]}
          >
            <View style={[styles.dot, { backgroundColor: dotColors[message.tone] }]} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '600' }}>{message.title}</AppText>
              {message.description ? (
                <AppText variant="muted">{message.description}</AppText>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  region: { position: 'absolute', left: spacing[4], right: spacing[4], gap: spacing[2] },
  toast: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing[3],
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
