import { authErrorMessage } from '@codexveil/database';
import { fieldErrorsFrom, forgotPasswordSchema, type FieldErrors } from '@codexveil/validation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { getSupabase, siteUrl, supabaseConfig } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setResult(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(parsed.data.email, {
      // A nova senha é definida no site, numa página segura aberta pelo link do e-mail.
      redirectTo: `${siteUrl}/auth/confirmar?next=/redefinir-senha`,
    });
    setBusy(false);
    if (error && (error.status === 429 || error.code?.startsWith('over_'))) {
      setResult({ tone: 'danger', message: authErrorMessage(error) });
      return;
    }
    setResult({ tone: 'success', message: 'Se houver uma conta com esse e-mail, você receberá um link para escolher uma nova senha.' });
  };

  return (
    <Screen title="Recuperar senha" subtitle="Enviaremos um link para você escolher uma nova senha.">
      {result ? <Notice tone={result.tone} message={result.message} /> : null}
      <Card>
        <Field label="E-mail da conta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
        <Button label="Enviar link" onPress={() => void submit()} loading={busy} disabled={!supabaseConfig.ok} />
      </Card>
    </Screen>
  );
}
