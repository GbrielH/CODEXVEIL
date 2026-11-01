import {
  callAccessModeLabels,
  createCallRoom,
  findCallRoom,
  listMyCallInvites,
  listMyCallRooms,
  listMyCampaigns,
  type CallAccessMode,
} from '@codexveil/database';
import { useRouter, type Href } from 'expo-router';
import { DoorOpen, Plus, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { SectionHeader } from '@/components/ui/layout';
import { ListRow } from '@/components/ui/list-row';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** Aba Call: criar sala (link e código), entrar por código e convites e salas abertas. */
export default function CallTab() {
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<CallAccessMode>('open');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const { data, refreshing, reload } = useAsyncData(async () => {
    const client = getSupabase();
    const [campaigns, rooms, invites] = await Promise.all([
      listMyCampaigns(client, userId),
      listMyCallRooms(client).catch(() => []),
      listMyCallInvites(client, userId).catch(() => []),
    ]);
    return {
      campaigns: campaigns.filter((campaign) => campaign.status === 'active'),
      rooms: rooms.filter((room) => room.status === 'active'),
      invites,
    };
  }, `call:${userId}`);

  // Rota nova: os tipos do expo-router só se atualizam ao rodar o app; o caminho é este.
  const open = (slug: string) => router.push(`/call/${slug}` as Href);

  const create = async () => {
    setBusy('create');
    try {
      const room = await createCallRoom(getSupabase(), {
        title: title.trim(),
        accessMode: mode,
        campaignId,
        sessionId: null,
      });
      open(room.slug);
    } catch (error) {
      toast({ tone: 'danger', title: 'A sala não foi criada', description: failureMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    const ref = code.trim().split('/').filter(Boolean).at(-1) ?? '';
    if (!ref) return;
    setBusy('join');
    try {
      const room = await findCallRoom(getSupabase(), ref);
      if (room) open(room.slug);
      else toast({ tone: 'warning', title: 'Nenhuma sala com esse código.' });
    } catch (error) {
      toast({ tone: 'danger', title: 'Não deu certo', description: failureMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="Call"
      subtitle="Voz e vídeo com a mesa."
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Card ornate>
        <AppText variant="heading">Criar sala</AppText>
        <Field label="Nome (opcional)" value={title} onChangeText={setTitle} maxLength={80} />
        {data?.campaigns.length ? (
          <>
            <AppText variant="small">Campanha (para saber o personagem de cada um)</AppText>
            <ChipRow>
              <Chip
                label="Sem campanha"
                selected={campaignId === null}
                onPress={() => setCampaignId(null)}
              />
              {data.campaigns.map((campaign) => (
                <Chip
                  key={campaign.id}
                  label={campaign.name}
                  selected={campaignId === campaign.id}
                  onPress={() => setCampaignId(campaign.id)}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
        <AppText variant="small">Quem entra</AppText>
        <ChipRow>
          {(Object.keys(callAccessModeLabels) as CallAccessMode[]).map((key) => (
            <Chip
              key={key}
              label={callAccessModeLabels[key].name}
              selected={mode === key}
              onPress={() => setMode(key)}
            />
          ))}
        </ChipRow>
        <AppText variant="small" style={{ color: colors.fgMuted }}>
          {callAccessModeLabels[mode].hint}
        </AppText>
        <Button
          label="Criar e entrar"
          icon={<Plus size={16} color={colors.primaryFg} />}
          loading={busy === 'create'}
          onPress={() => void create()}
        />
      </Card>
      <Card>
        <AppText variant="heading">Entrar numa sala</AppText>
        <Field
          label="Código ou link"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="RUNA-4821"
          maxLength={200}
        />
        <Button
          label="Entrar"
          variant="secondary"
          icon={<DoorOpen size={16} color={colors.fg} />}
          disabled={!code.trim()}
          loading={busy === 'join'}
          onPress={() => void join()}
        />
      </Card>
      {data?.invites.length ? (
        <>
          <SectionHeader
            icon={<Video size={14} color={colors.fgAccent} />}
            title="Convites para você"
          />
          {data.invites.map((invite) => (
            <ListRow
              key={invite.roomId}
              title={invite.title || 'Call'}
              meta={invite.code}
              onPress={() => open(invite.slug)}
            />
          ))}
        </>
      ) : null}
      {data?.rooms.length ? (
        <>
          <SectionHeader icon={<Video size={14} color={colors.fgAccent} />} title="Salas abertas" />
          {data.rooms.map((room) => (
            <ListRow
              key={room.id}
              title={room.title || 'Call'}
              meta={room.code}
              onPress={() => open(room.slug)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
