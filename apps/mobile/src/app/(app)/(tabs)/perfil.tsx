import { getProfile, updateProfile } from '@codexveil/database';
import {
  AVATAR_ICONS,
  fieldErrorsFrom,
  profileUpdateSchema,
  type AvatarIcon,
  type FieldErrors,
} from '@codexveil/validation';
import { LogOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { NewPasswordForm } from '@/components/change-password';
import { Avatar } from '@/components/ui/avatar';
import { AVATAR_SVGS } from '@/components/ui/avatar-svgs.gen';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { isPushEnabled, setPushEnabled, type PushSetupResult } from '@/lib/notifications';
import { useSession, useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { Profile } from '@codexveil/database';

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const userId = useUserId();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState<AvatarIcon | null>(profile.preferences.avatar);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = profileUpdateSchema.safeParse({
      displayName,
      bio,
      preferences: { ...profile.preferences, avatar },
    });
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
      toast({
        tone: 'danger',
        title: 'O perfil não foi salvo',
        description: failureMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ornate>
      <AppText variant="heading">Dados públicos</AppText>
      <Field
        label="Nome de exibição"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={40}
        error={errors.displayName}
      />
      <Field
        label="Sobre você"
        value={bio}
        onChangeText={setBio}
        maxLength={500}
        multiline
        error={errors.bio}
      />
      <AppText variant="small">Retrato (aparece na mesa; sem retrato, ficam as iniciais)</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[null, ...AVATAR_ICONS].map((icon) => (
          <Pressable
            key={icon ?? 'iniciais'}
            onPress={() => setAvatar(icon)}
            accessibilityRole="radio"
            accessibilityState={{ checked: avatar === icon }}
            accessibilityLabel={icon ? AVATAR_SVGS[icon].label : 'Iniciais'}
            style={{
              padding: 4,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: avatar === icon ? colors.fgAccent : 'transparent',
            }}
          >
            <Avatar name={displayName || '?'} icon={icon} size={52} />
          </Pressable>
        ))}
      </View>
      <Button label="Salvar perfil" onPress={() => void save()} loading={busy} />
    </Card>
  );
}

const pushMessages: Record<PushSetupResult, string> = {
  registered: 'Este aparelho recebe os avisos de sessões agendadas.',
  disabled: 'Avisos desligados neste aparelho.',
  denied:
    'O Android bloqueou as notificações do Codexveil. Libere-as nas configurações do aparelho.',
  unsupported: 'Avisos só funcionam no app instalado no celular.',
  unavailable: 'Não foi possível ativar os avisos agora (verifique a conexão ou atualize o app).',
};

/** Liga ou desliga os avisos de sessão agendada neste aparelho. */
function PushCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    isPushEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (enabled === null) return null;
  return (
    <Card>
      <AppText variant="heading">Notificações</AppText>
      <CheckRow
        label="Avisos de sessões agendadas"
        description="Quando o mestre agenda ou remarca uma sessão das suas campanhas, mesmo com o app fechado."
        checked={enabled}
        disabled={busy || Platform.OS === 'web'}
        onChange={async (next) => {
          setBusy(true);
          setEnabled(next);
          const result = await setPushEnabled(next);
          setStatus(pushMessages[result]);
          setBusy(false);
        }}
      />
      {status ? (
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          {status}
        </AppText>
      ) : null}
    </Card>
  );
}

export default function ProfileScreen() {
  const userId = useUserId();
  const { email, signOut } = useSession();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useAsyncData(
    () => getProfile(getSupabase(), userId),
    userId,
  );

  if (loading) return <LoadingState />;

  return (
    <Screen title="Perfil" subtitle={email ?? undefined}>
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <ProfileForm key={data.displayName + data.bio} profile={data} onSaved={reload} />
      ) : null}
      <PushCard />
      <Card>
        <AppText variant="heading">Alterar senha</AppText>
        <NewPasswordForm />
      </Card>
      <Card>
        <AppText variant="heading">Conta</AppText>
        <Button
          label="Sair da conta"
          variant="danger"
          icon={<LogOut size={16} color="#EC9384" />}
          onPress={() =>
            void confirm({
              title: 'Sair da conta?',
              message: 'Você precisará entrar novamente neste aparelho.',
              confirmLabel: 'Sair',
              tone: 'danger',
            }).then((confirmed) => {
              if (confirmed) void signOut();
            })
          }
        />
      </Card>
      <AppText variant="small" style={{ color: colors.fgSubtle, textAlign: 'center' }}>
        Codexveil 0.1.0
      </AppText>
    </Screen>
  );
}
