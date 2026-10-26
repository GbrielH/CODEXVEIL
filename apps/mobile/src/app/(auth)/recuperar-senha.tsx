import { authErrorMessage } from '@codexveil/database';
import { fieldErrorsFrom, forgotPasswordSchema, type FieldErrors } from '@codexveil/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { NewPasswordForm } from '@/components/change-password';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { getSupabase, siteUrl, supabaseConfig } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const router = useRouter();

  const verify = async () => {
    setResult(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setResult({ tone: 'danger', message: 'Digite os 6 números do código do e-mail.' });
      return;
    }
    setBusy(true);
    const { error } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    setBusy(false);
    if (error) {
      setResult({ tone: 'danger', message: 'Código inválido ou vencido. Peça um novo e-mail.' });
      return;
    }
    setVerified(true);
  };

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
    setSent(true);
    setResult({
      tone: 'success',
      message:
        'Se houver uma conta com esse e-mail, você receberá um código de 6 números (e um link, se preferir trocar pelo site).',
    });
  };

  return (
    <Screen
      title="Recuperar senha"
      subtitle="Enviaremos um código para você escolher uma nova senha aqui no app."
    >
      {result ? <Notice tone={result.tone} message={result.message} /> : null}
      {verified ? (
        <Card>
          <NewPasswordForm submitLabel="Salvar e entrar" onDone={() => router.replace('/')} />
        </Card>
      ) : sent ? (
        <Card>
          <Field label="Código do e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          <Button label="Confirmar código" onPress={() => void verify()} loading={busy} />
          <Button label="Enviar outro e-mail" variant="secondary" onPress={() => setSent(false)} />
        </Card>
      ) : null}
      {!sent && !verified ? (
      <Card>
        <Field
          label="E-mail da conta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />
        <Button
          label="Enviar código"
          onPress={() => void submit()}
          loading={busy}
          disabled={!supabaseConfig.ok}
        />
      </Card>
      ) : null}
    </Screen>
  );
}
