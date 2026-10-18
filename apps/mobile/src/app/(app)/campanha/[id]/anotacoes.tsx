import { createCampaignNote, deleteCampaignNote, getCampaign, listCampaignNotes, setCampaignNotePinned, updateCampaignNote, type CampaignNote } from '@codexveil/database';
import { CONTENT_VISIBILITIES, visibilityLabels, type ContentVisibility } from '@codexveil/domain';
import { fieldErrorsFrom, noteSchema, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

interface NoteForm {
  id: string | null;
  version: number;
  title: string;
  body: string;
  visibility: ContentVisibility;
  isPinned: boolean;
}

const emptyForm: NoteForm = { id: null, version: 1, title: '', body: '', visibility: 'members', isPinned: false };

/** Anotações da campanha: públicas, só para mestres ou pessoais. */
export default function NotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<NoteForm | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    return { campaign, notes: await listCampaignNotes(supabase, campaign.id) };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }
  const { campaign, notes } = data;
  const canWrite = campaign.status === 'active';

  const save = async () => {
    if (!form) return;
    const parsed = noteSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (form.id) await updateCampaignNote(getSupabase(), form.id, form.version, parsed.data);
      else await createCampaignNote(getSupabase(), campaign.id, parsed.data);
      toast({ tone: 'success', title: 'Anotação salva.' });
      setForm(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'A anotação não foi salva', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: CampaignNote) => {
    const ok = await confirm({ title: `Excluir “${note.title}”?`, message: 'A anotação será apagada para todos.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCampaignNote(getSupabase(), note.id);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'A anotação não foi excluída', description: failureMessage(cause) });
    }
  };

  return (
    <Screen eyebrow={campaign.name} title="Anotações" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Anotações' }} />
      {canWrite ? (
        form ? (
          <Card>
            <AppText variant="heading">{form.id ? 'Editar anotação' : 'Nova anotação'}</AppText>
            <Field label="Título" value={form.title} maxLength={120} onChangeText={(title) => setForm({ ...form, title })} error={errors.title} />
            <Field label="Texto" value={form.body} multiline maxLength={20000} onChangeText={(body) => setForm({ ...form, body })} error={errors.body} />
            <AppText variant="small" style={{ color: colors.fg }}>
              Quem vê
            </AppText>
            <ChipRow>
              {CONTENT_VISIBILITIES.map((visibility) => (
                <Chip key={visibility} label={visibilityLabels[visibility]} selected={form.visibility === visibility} onPress={() => setForm({ ...form, visibility })} />
              ))}
            </ChipRow>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button label="Cancelar" variant="ghost" onPress={() => setForm(null)} style={{ flex: 1 }} />
              <Button label="Salvar" loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Button label="Nova anotação" variant="secondary" icon={<Plus size={16} color={colors.fg} />} onPress={() => setForm(emptyForm)} />
        )
      ) : null}
      {notes.length === 0 ? <EmptyState title="Nenhuma anotação" description="Registre pistas, nomes e decisões da mesa." /> : null}
      {notes.map((note) => {
        const mine = note.authorId === userId;
        const canEdit = canWrite && (mine || campaign.role === 'gm');
        return (
          <Card key={note.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              {note.isPinned ? <Pin size={14} color={colors.fgAccent} /> : null}
              <AppText variant="heading" style={{ flex: 1 }}>
                {note.title}
              </AppText>
              {mine && canWrite ? (
                <IconButton
                  icon={note.isPinned ? <PinOff size={16} color={colors.fgAccent} /> : <Pin size={16} color={colors.fgSecondary} />}
                  accessibilityLabel={note.isPinned ? `Desafixar ${note.title}` : `Fixar ${note.title} no topo`}
                  onPress={() =>
                    void setCampaignNotePinned(getSupabase(), note, userId, !note.isPinned)
                      .then(reload)
                      .catch((cause: unknown) => toast({ tone: 'danger', title: 'Não foi possível fixar', description: failureMessage(cause) }))
                  }
                />
              ) : null}
              {canEdit ? (
                <>
                  <IconButton
                    icon={<Pencil size={16} color={colors.fgSecondary} />}
                    accessibilityLabel={`Editar ${note.title}`}
                    onPress={() => setForm({ id: note.id, version: note.version, title: note.title, body: note.body, visibility: note.visibility, isPinned: note.isPinned })}
                  />
                  <IconButton icon={<Trash2 size={16} color={colors.fgSecondary} />} accessibilityLabel={`Excluir ${note.title}`} onPress={() => void remove(note)} />
                </>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Badge label={note.visibility === 'members' ? 'Geral' : note.visibility === 'author' ? 'Pessoal' : visibilityLabels[note.visibility]} tone={note.visibility === 'members' ? 'neutral' : 'brand'} />
              <AppText variant="small">por {mine ? 'você' : note.authorName}</AppText>
            </View>
            {note.body ? <AppText variant="serif">{note.body}</AppText> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
