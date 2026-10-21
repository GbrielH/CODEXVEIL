import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { LoadingState } from '@/components/ui/states';
import { getSupabase } from '@/lib/supabase';

/** Volta do login com Google (`codexveil://google?code=...`): troca o código pela sessão. */
export default function GoogleCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [state, setState] = useState<'working' | 'done' | 'failed'>(params.code ? 'working' : 'failed');

  useEffect(() => {
    if (!params.code) return;
    let active = true;
    getSupabase()
      .auth.exchangeCodeForSession(params.code)
      .then(({ error }) => {
        if (active) setState(error ? 'failed' : 'done');
      })
      .catch(() => {
        if (active) setState('failed');
      });
    return () => {
      active = false;
    };
  }, [params.code]);

  if (state === 'done') return <Redirect href="/" />;
  if (state === 'working') return <LoadingState />;
  return (
    <Screen title="Login com Google">
      <AppText>{params.error_description ? `O Google recusou o login: ${params.error_description}` : 'Não foi possível concluir o login com o Google.'}</AppText>
      <Button label="Voltar para entrar" onPress={() => router.replace('/entrar')} />
    </Screen>
  );
}
