import { authErrorMessage } from '@codexveil/database';
import { fieldErrorsFrom, signInSchema, type FieldErrors } from '@codexveil/validation';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { GoogleSignInButton } from '@/components/auth/google-button';
import { Wordmark } from '@/components/brand/emblem';
import { ConfigNotice } from '@/components/config-notice';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { useSession } from '@/lib/session';
import { getSupabase, supabaseConfig } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function SignInScreen() {
  const { expired } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword(parsed.data);
    setBusy(false);
    // Em caso de sucesso, a navegação muda sozinha (rotas protegidas pela sessão).
    if (error) setMessage(authErrorMessage(error));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
        <Wordmark size={48} />
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          Campanhas, fichas e segredos do mestre num só grimório.
        </AppText>
      </View>
      <ConfigNotice />
      {expired ? (
        <Notice
          tone="warning"
          title="Sessão expirada"
          message="Sua sessão terminou. Entre novamente para continuar."
        />
      ) : null}
      <GoogleSignInButton />
      <Card ornate>
        <AppText variant="heading" accessibilityRole="header">
          Entrar
        </AppText>
        {message ? <Notice tone="danger" message={message} /> : null}
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={errors.password}
          onSubmitEditing={() => void submit()}
        />
        <Button
          label="Entrar"
          onPress={() => void submit()}
          loading={busy}
          disabled={!supabaseConfig.ok}
        />
        <Link
          href="/recuperar-senha"
          style={{ color: colors.fgSecondary, textAlign: 'center', paddingVertical: 8 }}
        >
          Esqueci minha senha
        </Link>
      </Card>
      <Divider />
      <Button
        label="Criar uma conta"
        variant="secondary"
        onPress={() => router.push('/cadastro')}
      />
    </Screen>
  );
}
