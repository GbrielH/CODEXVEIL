// Cada peso é importado do próprio arquivo: importar o índice do pacote embutiria todos
// os pesos da família no app (vários MB a mais no APK).
import { Alegreya_400Regular } from '@expo-google-fonts/alegreya/400Regular';
import { Alegreya_400Regular_Italic } from '@expo-google-fonts/alegreya/400Regular_Italic';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { configureValidationLocale } from '@codexveil/validation';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui/toast';
import { SessionProvider, useSession } from '@/lib/session';
import { colors, fonts, navigationTheme } from '@/lib/theme';

configureValidationLocale();
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useSession();
  const signedIn = status === 'signed-in';

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.raised },
        headerTintColor: colors.fgAccent,
        headerTitleStyle: { fontFamily: fonts.display },
        contentStyle: { backgroundColor: colors.canvas },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)/(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)/campanha/[id]" options={{ title: 'Campanha' }} />
        <Stack.Screen name="(app)/campanha/nova" options={{ title: 'Nova campanha', presentation: 'modal' }} />
        <Stack.Screen name="(app)/convite" options={{ title: 'Convite' }} />
        <Stack.Screen name="(app)/personagem/[id]" options={{ title: 'Ficha' }} />
        <Stack.Screen name="(app)/personagem/novo" options={{ title: 'Novo personagem', presentation: 'modal' }} />
        <Stack.Screen name="(app)/sessao/[id]" options={{ title: 'Sessão' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/entrar" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="(auth)/recuperar-senha" options={{ title: 'Recuperar senha' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Alegreya_400Regular,
    Alegreya_400Regular_Italic,
  });

  // Sem as fontes (falha de leitura), o app segue com as fontes do sistema.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
