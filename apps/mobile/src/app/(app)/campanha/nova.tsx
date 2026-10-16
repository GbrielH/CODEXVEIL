import { createCampaign } from '@codexveil/database';
import { DEFAULT_SYSTEM_ID, getSystem } from '@codexveil/rpg-systems';
import { campaignCreateSchema, fieldErrorsFrom, type FieldErrors } from '@codexveil/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Notice } from '@/components/ui/states';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export default function NewCampaignScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const system = getSystem(DEFAULT_SYSTEM_ID);

  const submit = async () => {
    setMessage(null);
    const parsed = campaignCreateSchema.safeParse({ name, description, systemId: system.id });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const id = await createCampaign(getSupabase(), parsed.data);
      router.replace({ pathname: '/campanha/[id]', params: { id } });
    } catch (error) {
      setMessage(failureMessage(error));
      setBusy(false);
    }
  };

  return (
    <Screen subtitle="Você será o mestre responsável. Depois, convide os jogadores.">
      {message ? <Notice tone="danger" message={message} /> : null}
      <Card ornate>
        <Field label="Nome da campanha" value={name} onChangeText={setName} maxLength={80} error={errors.name} />
        <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} maxLength={2000} multiline error={errors.description} />
        <AppText variant="muted">
          Sistema: {system.name} ({system.rulesReference}). O sistema não pode ser trocado depois.
        </AppText>
        <Button label="Criar campanha" onPress={() => void submit()} loading={busy} />
      </Card>
    </Screen>
  );
}
