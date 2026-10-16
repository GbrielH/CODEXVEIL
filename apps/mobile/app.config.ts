import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração do app Expo. O identificador Android é configurável por variável de ambiente
 * para que cada organização publique com o próprio domínio reverso.
 */
const charcoal = '#171719';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Codexveil',
  slug: 'codexveil',
  version: '0.1.0',
  scheme: 'codexveil',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: charcoal,
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'app.codexveil.mobile',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: charcoal,
      foregroundImage: './assets/images/adaptive-icon-foreground.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? 'app.codexveil.mobile',
    supportsTablet: true,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: charcoal,
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
