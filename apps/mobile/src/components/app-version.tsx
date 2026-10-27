import * as Updates from 'expo-updates';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { colors } from '@/lib/theme';

const when = (date: Date | null) =>
  date ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/**
 * Versão do app e da atualização em uso (OTA). "Procurar atualização" baixa a mais nova e reinicia
 * na hora, sem precisar fechar e abrir o app duas vezes.
 */
export function AppVersion() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = Updates.isEmbeddedLaunch ? 'versão do APK (sem atualização)' : `atualização de ${when(Updates.createdAt) ?? '?'}`;

  const check = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('Você já está com a versão mais nova.');
        return;
      }
      setStatus('Baixando…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setStatus(__DEV__ ? 'Atualizações não funcionam no modo de desenvolvimento.' : 'Não foi possível procurar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <AppText variant="small" style={{ color: colors.fgSubtle, textAlign: 'center' }}>
        Codexveil 0.1.0 · {current}
      </AppText>
      <Button compact variant="ghost" label="Procurar atualização" loading={busy} onPress={() => void check()} />
      {status ? (
        <AppText variant="small" style={{ textAlign: 'center' }}>
          {status}
        </AppText>
      ) : null}
    </View>
  );
}
