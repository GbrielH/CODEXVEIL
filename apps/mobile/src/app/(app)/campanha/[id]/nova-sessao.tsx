import { createSession, getCampaign, notifySessionScheduled } from '@codexveil/database';
import { fieldErrorsFrom, sessionCreateSchema, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { CheckRow } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { brasiliaToIso } from '@/lib/dates';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { spacing } from '@/lib/theme';

/** Nova sessão (mestre). Publicada e com data, os jogadores recebem um aviso no app. */
export default function NewSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [published, setPublished] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsyncData(() => getCampaign(getSupabase(), id, userId), `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.role !== 'gm' || data.status !== 'active') {
    return (
      <Screen>
        <EmptyState title="Sem acesso" description="Só os mestres de uma campanha ativa criam sessões." />
      </Screen>
    );
  }
  const campaign = data;

  const create = async () => {
    const scheduledAt = brasiliaToIso(date, time);
    const parsed = sessionCreateSchema.safeParse({ title, scheduledAt: scheduledAt === undefined ? 'data-invalida' : scheduledAt, isPublished: published });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const supabase = getSupabase();
      const sessionId = await createSession(supabase, campaign.id, parsed.data);
      if (parsed.data.isPublished && parsed.data.scheduledAt) {
        const result = await notifySessionScheduled(supabase, sessionId);
        if (result && result.sent > 0) toast({ tone: 'success', title: `Aviso enviado a ${result.sent} ${result.sent === 1 ? 'aparelho' : 'aparelhos'} da mesa.` });
      }
      router.replace({ pathname: '/sessao/[id]/editar', params: { id: sessionId } });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A sessão não foi criada', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen eyebrow={campaign.name} title="Nova sessão">
      <Stack.Screen options={{ title: 'Nova sessão' }} />
      <Card>
        <Field label="Título" value={title} onChangeText={setTitle} maxLength={120} error={errors.title} placeholder="Ex.: A cripta sob o farol" />
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <View style={{ flex: 3 }}>
            <Field label="Data" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="dd/mm/aaaa" error={errors.scheduledAt} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Hora" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="19:00" />
          </View>
        </View>
        <CheckRow
          label="Publicar para os jogadores"
          description="Eles veem o resumo e os blocos públicos. Com data marcada, quem usa o app recebe um aviso."
          checked={published}
          onChange={setPublished}
        />
        <Button label="Criar sessão" loading={busy} onPress={() => void create()} />
      </Card>
    </Screen>
  );
}
