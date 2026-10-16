import { acceptCampaignInvite, declineCampaignInvite, getInvitePreview, type InvitePreview } from '@codexveil/database';
import { formatInviteCode, inviteRejectionMessages } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { inviteCodeSchema } from '@codexveil/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/** Entrada por código: prévia validada no servidor, depois aceitar ou recusar. */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ codigo?: string }>();
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(params.codigo ?? '');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'accept' | 'decline' | null>(null);

  const validCode = () => {
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Código inválido.');
      return null;
    }
    return parsed.data;
  };

  const lookUp = async () => {
    setError(null);
    setPreview(null);
    const normalized = validCode();
    if (!normalized) return;
    setBusy('preview');
    try {
      const result = await getInvitePreview(getSupabase(), normalized);
      if (!result.ok && !('campaign' in result)) setError(inviteRejectionMessages[result.reason]);
      else setPreview(result);
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const accept = async () => {
    const normalized = validCode();
    if (!normalized) return;
    setBusy('accept');
    try {
      const result = await acceptCampaignInvite(getSupabase(), normalized);
      if (result.ok) {
        toast({ tone: 'success', title: 'Bem-vindo à mesa!', description: 'Você agora participa desta campanha.' });
        router.replace({ pathname: '/campanha/[id]', params: { id: result.campaignId } });
        return;
      }
      if (result.reason === 'already_member' && result.campaignId) {
        router.replace({ pathname: '/campanha/[id]', params: { id: result.campaignId } });
        return;
      }
      setError(inviteRejectionMessages[result.reason]);
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    const normalized = validCode();
    if (!normalized) return;
    setBusy('decline');
    try {
      await declineCampaignInvite(getSupabase(), normalized);
      toast({ tone: 'info', title: 'Convite recusado.' });
      router.back();
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const campaign = preview && 'campaign' in preview ? preview.campaign : null;

  return (
    <Screen title="Entrar com código" subtitle="Digite o código que o mestre enviou (ex.: ABCD-EFGH-JKLM).">
      {error ? <Notice tone="danger" message={error} /> : null}
      <Card>
        <Field label="Código do convite" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={20} onSubmitEditing={() => void lookUp()} />
        <Button label="Ver convite" onPress={() => void lookUp()} loading={busy === 'preview'} />
      </Card>
      {campaign ? (
        <Card ornate>
          <AppText variant="eyebrow">Convite para</AppText>
          <AppText variant="title">{campaign.name}</AppText>
          {campaign.description ? <AppText variant="serif">{campaign.description}</AppText> : null}
          <AppText variant="muted">
            {findSystem(campaign.systemId)?.shortName ?? campaign.systemId} · Mestre: {campaign.ownerName ?? '—'} · {campaign.memberCount} participante{campaign.memberCount === 1 ? '' : 's'}
          </AppText>
          {preview && !preview.ok && preview.reason === 'already_member' ? (
            <Button label="Abrir a campanha" onPress={() => router.replace({ pathname: '/campanha/[id]', params: { id: campaign.id } })} />
          ) : (
            <View style={{ gap: 8 }}>
              <Button label="Aceitar e entrar" onPress={() => void accept()} loading={busy === 'accept'} />
              {preview && 'isPersonal' in preview && preview.isPersonal ? <Button label="Recusar" variant="ghost" onPress={() => void decline()} loading={busy === 'decline'} /> : null}
            </View>
          )}
          <AppText variant="small">Código: {formatInviteCode(code)}</AppText>
        </Card>
      ) : null}
    </Screen>
  );
}
