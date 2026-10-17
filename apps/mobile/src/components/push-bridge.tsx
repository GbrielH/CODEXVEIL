import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { registerForPush, sessionIdFromNotification } from '@/lib/notifications';

/**
 * Liga as notificações com a conta aberta: registra o aparelho (pedindo a permissão na
 * primeira vez) e abre a sessão quando a pessoa toca num aviso, inclusive com o app fechado.
 */
export function PushBridge({ userId }: { userId: string }) {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    void registerForPush({ askPermission: true });
  }, [userId]);

  useEffect(() => {
    const sessionId = sessionIdFromNotification(response ?? null);
    const key = response?.notification.request.identifier ?? null;
    if (!sessionId || !key || handled.current === key) return;
    handled.current = key;
    router.push({ pathname: '/sessao/[id]', params: { id: sessionId } });
  }, [response, router]);

  return null;
}
