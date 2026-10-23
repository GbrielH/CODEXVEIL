/**
 * Notificações push do app (Android). O aparelho entra na conta pelo token do serviço de push
 * da Expo, guardado no banco (`register_push_token`); os avisos de sessão agendada são enviados
 * pelo servidor (Edge Function `notify-session`). Tocar no aviso abre a sessão.
 *
 * A pessoa pode desligar os avisos no Perfil: a escolha fica no aparelho e o token sai da conta.
 */
import { registerPushToken, unregisterPushToken } from '@codexveil/database';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

const TOKEN_KEY = 'codexveil.push.token';
const ENABLED_KEY = 'codexveil.push.enabled';
export const SESSION_CHANNEL = 'sessoes';

// Com o app aberto, o aviso aparece como notificação também.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

export type PushSetupResult = 'registered' | 'disabled' | 'denied' | 'unsupported' | 'unavailable';

export async function isPushEnabled(): Promise<boolean> {
  return (await Storage.getItem(ENABLED_KEY)) !== 'false';
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SESSION_CHANNEL, {
    name: 'Sessões agendadas',
    description: 'Avisos quando o mestre agenda ou remarca uma sessão.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#8D63E3',
  });
}

/**
 * Registra o aparelho para receber avisos (pede a permissão na primeira vez). Falhas não
 * atrapalham o uso do app: o resultado diz o que aconteceu.
 */
export async function registerForPush(
  options: { askPermission: boolean } = { askPermission: true },
): Promise<PushSetupResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (!(await isPushEnabled())) return 'disabled';
  try {
    await ensureChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && options.askPermission)
      permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'denied';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await registerPushToken(getSupabase(), token, Platform.OS === 'ios' ? 'ios' : 'android');
    await Storage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    // Sem Firebase configurado neste build, sem rede etc.: o app segue sem push.
    return 'unavailable';
  }
}

/** Tira o aparelho da conta (ao sair ou ao desligar os avisos). */
export async function unregisterFromPush(): Promise<void> {
  const token = await Storage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterPushToken(getSupabase(), token);
  } catch {
    // Sem rede: o servidor apaga tokens inválidos quando o envio falha.
  }
  await Storage.removeItem(TOKEN_KEY);
}

export async function setPushEnabled(enabled: boolean): Promise<PushSetupResult> {
  await Storage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await unregisterFromPush();
    return 'disabled';
  }
  return registerForPush({ askPermission: true });
}

/** Sessão aberta por um toque no aviso (ou `null` se o aviso não for de sessão). */
export function sessionIdFromNotification(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification.request.content.data as
    { type?: unknown; sessionId?: unknown } | undefined;
  return data?.type === 'session' && typeof data.sessionId === 'string' ? data.sessionId : null;
}
