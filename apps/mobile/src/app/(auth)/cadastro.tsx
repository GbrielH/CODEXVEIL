import { authErrorMessage } from '@codexveil/database';
import { fieldErrorsFrom, signUpSchema, type FieldErrors } from '@codexveil/validation';
import { useState } from 'react';
import { ConfigNotice } from '@/components/config-notice';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { getSupabase, siteUrl, supabaseConfig } from '@/lib/supabase';

export default function SignUpScreen() {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setResult(null);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await getSupabase().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        // A confirmação abre no site, que ativa a conta; depois basta entrar no app.
        emailRedirectTo: `${siteUrl}/auth/confirmar?next=/painel`,
      },
    });
    setBusy(false);
    if (error) {
      setResult({ tone: 'danger', message: authErrorMessage(error) });
      return;
    }
    if (!data.session) {
      // Mesma resposta para e-mails novos e já cadastrados (não revela quem tem conta).
      setResult({ tone: 'success', message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra-o e depois entre no app.` });
    }
  };

  return (
    <Screen title="Criar conta" subtitle="Você poderá mestrar e jogar em quantas campanhas quiser.">
      <ConfigNotice />
      {result ? <Notice tone={result.tone} message={result.message} /> : null}
      <Card>
        <Field label="Nome de exibição" value={form.displayName} onChangeText={set('displayName')} maxLength={40} autoComplete="name" error={errors.displayName} />
        <Field label="E-mail" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
        <Field label="Senha" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" hint="Pelo menos 8 caracteres, com letras e números." error={errors.password} />
        <Field label="Confirme a senha" value={form.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry autoComplete="new-password" error={errors.confirmPassword} />
        <Button label="Criar conta" onPress={() => void submit()} loading={busy} disabled={!supabaseConfig.ok} />
      </Card>
    </Screen>
  );
}
