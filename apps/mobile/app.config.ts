import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração do app Expo. O identificador Android é configurável por variável de ambiente
 * para que cada organização publique com o próprio domínio reverso.
 */
const charcoal = '#171719';
const wine = '#853244';

/**
 * Notificações push no Android passam pelo Firebase (FCM). O `google-services.json` não fica
 * no repositório: no EAS ele é a variável de ambiente GOOGLE_SERVICES_JSON (tipo arquivo), que
 * o gancho `eas-build-pre-install` copia para cá antes do build. Sem a variável (ex.: no
 * computador), o app funciona sem push.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ? './google-services.json' : undefined;

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
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: charcoal,
      foregroundImage: './assets/images/adaptive-icon-foreground.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? 'app.codexveil.mobile',
    supportsTablet: true,
  },
  // Atualizações OTA (EAS Update): o APK instalado baixa o JavaScript novo ao abrir. O runtime
  // por fingerprint garante que uma atualização só chegue a builds com o mesmo código nativo;
  // mudanças nativas exigem um APK novo (o workflow do EAS decide sozinho).
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: `https://u.expo.dev/${easProjectId}`,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: wine,
        defaultChannel: 'sessoes',
      },
    ],
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
