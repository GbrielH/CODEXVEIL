import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração do app Expo. O identificador Android é configurável por variável de ambiente
 * para que cada organização publique com o próprio domínio reverso.
 */
const charcoal = '#171719';

/** Projeto no EAS (expo.dev). Identificadores públicos: não são segredos. */
const easOwner = 'gabriel.xxtth';
const easProjectId = '577acbce-c1fa-4729-b1f9-1f94f5b95569';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Codexveil',
  slug: 'codexveil',
  owner: easOwner,
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
    eas: { projectId: easProjectId },
  },
});
