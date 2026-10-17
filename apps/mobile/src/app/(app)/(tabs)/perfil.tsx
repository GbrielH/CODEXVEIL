import { getProfile, updateProfile } from '@codexveil/database';
import { fieldErrorsFrom, profileUpdateSchema, type FieldErrors } from '@codexveil/validation';
import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Alert as NativeAlert } from 'react-native';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useSession, useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { Profile } from '@codexveil/database';

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const userId = useUserId();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = profileUpdateSchema.safeParse({ displayName, bio, preferences: profile.preferences });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updateProfile(getSupabase(), userId, parsed.data);
      toast({ tone: 'success', title: 'Perfil atualizado.' });
      onSaved();
    } catch (error) {
      toast({ tone: 'danger', title: 'O perfil não foi salvo', description: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ornate>
      <AppText variant="heading">Dados públicos</AppText>
      <Field label="Nome de exibição" value={displayName} onChangeText={setDisplayName} maxLength={40} error={errors.displayName} />
      <Field label="Sobre você" value={bio} onChangeText={setBio} maxLength={500} multiline error={errors.bio} />
      <Button label="Salvar perfil" onPress={() => void save()} loading={busy} />
    </Card>
  );
}

export default function ProfileScreen() {
  const userId = useUserId();
  const { email, signOut } = useSession();
  const { data, error, loading, reload } = useAsyncData(() => getProfile(getSupabase(), userId), userId);

  if (loading) return <LoadingState />;

  return (
    <Screen title="Perfil" subtitle={email ?? undefined}>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? <ProfileForm key={data.displayName + data.bio} profile={data} onSaved={reload} /> : null}
      <Card>
        <AppText variant="heading">Conta</AppText>
        <AppText variant="muted">Para trocar a senha, use o site do Codexveil.</AppText>
        <Button
          label="Sair da conta"
          variant="danger"
          icon={<LogOut size={16} color="#EC9384" />}
          onPress={() =>
            NativeAlert.alert('Sair da conta?', 'Você precisará entrar novamente neste aparelho.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </Card>
      <AppText variant="small" style={{ color: colors.fgSubtle, textAlign: 'center' }}>
        Codexveil 0.1.0
      </AppText>
    </Screen>
  );
}
