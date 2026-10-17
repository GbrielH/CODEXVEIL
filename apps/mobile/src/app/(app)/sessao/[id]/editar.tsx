import {
  createSessionBlock,
  deleteSessionBlock,
  getCampaign,
  getSession,
  listSessionBlocks,
  notifySessionScheduled,
  reorderSessionBlocks,
  updateSession,
  updateSessionBlock,
  type StoredSessionBlock,
} from '@codexveil/database';
import {
  CALLOUT_TONES,
  blockTypeLabels,
  createBlockContent,
  defaultVisibilityFor,
  isAlwaysPrivate,
  moveItem,
  positionBetween,
  type SessionBlockContent,
  type SessionBlockType,
} from '@codexveil/domain';
import { fieldErrorsFrom, sessionBlockContentSchema, sessionUpdateSchema, type FieldErrors } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton } from '@/components/ui/button';
import { CheckRow, Chip, ChipRow } from '@/components/ui/controls';
import { useConfirm } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { brasiliaToIso, isoToBrasilia } from '@/lib/dates';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

/** Blocos que o app edita; os demais (imagens, referências, listas de tarefas) ficam para o site. */
const EDITABLE: SessionBlockType[] = ['paragraph', 'heading', 'subheading', 'gm_note', 'callout', 'list', 'divider'];

const calloutToneLabels: Record<(typeof CALLOUT_TONES)[number], string> = { lore: 'História', info: 'Informação', warning: 'Atenção', danger: 'Perigo' };

function preview(content: SessionBlockContent | null): string {
  if (!content) return 'Bloco em formato não reconhecido.';
  switch (content.type) {
    case 'paragraph':
    case 'heading':
    case 'subheading':
    case 'gm_note':
      return content.data.text || '(vazio)';
    case 'callout':
      return [content.data.title, content.data.text].filter(Boolean).join(' — ') || '(vazio)';
    case 'list':
      return content.data.items.filter(Boolean).join(' · ') || '(lista vazia)';
    case 'divider':
      return '———';
    default:
      return 'Edite este bloco no site.';
  }
}

function BlockEditor({ content, onChange }: { content: SessionBlockContent; onChange: (content: SessionBlockContent) => void }) {
  switch (content.type) {
    case 'paragraph':
    case 'gm_note':
      return <Field label="Texto" value={content.data.text} multiline maxLength={20000} onChangeText={(text) => onChange({ ...content, data: { text } })} />;
    case 'heading':
    case 'subheading':
      return <Field label="Título" value={content.data.text} maxLength={200} onChangeText={(text) => onChange({ ...content, data: { text } })} />;
    case 'callout':
      return (
        <View style={{ gap: spacing[2] }}>
          <ChipRow>
            {CALLOUT_TONES.map((tone) => (
              <Chip key={tone} label={calloutToneLabels[tone]} selected={content.data.tone === tone} onPress={() => onChange({ ...content, data: { ...content.data, tone } })} />
            ))}
          </ChipRow>
          <Field label="Título (opcional)" value={content.data.title ?? ''} maxLength={200} onChangeText={(title) => onChange({ ...content, data: { ...content.data, title: title || null } })} />
          <Field label="Texto" value={content.data.text} multiline maxLength={20000} onChangeText={(text) => onChange({ ...content, data: { ...content.data, text } })} />
        </View>
      );
    case 'list':
      return (
        <View style={{ gap: spacing[2] }}>
          <ChipRow>
            <Chip label="Marcadores" selected={content.data.style === 'bulleted'} onPress={() => onChange({ ...content, data: { ...content.data, style: 'bulleted' } })} />
            <Chip label="Numerada" selected={content.data.style === 'numbered'} onPress={() => onChange({ ...content, data: { ...content.data, style: 'numbered' } })} />
          </ChipRow>
          <Field
            label="Itens (um por linha)"
            value={content.data.items.join('\n')}
            multiline
            onChangeText={(text) => onChange({ ...content, data: { ...content.data, items: text.split('\n').slice(0, 200) } })}
          />
        </View>
      );
    default:
      return <AppText variant="muted">Este tipo de bloco é editado no site.</AppText>;
  }
}

/** Edição da sessão no app: dados, publicação (com aviso aos jogadores) e blocos do roteiro. */
export default function SessionEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const toast = useToast();
  const confirm = useConfirm();
  const [meta, setMeta] = useState<{ title: string; date: string; time: string; published: boolean; recap: string } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; content: SessionBlockContent } | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, error, loading, refreshing, reload, mutate } = useAsyncData(async () => {
    const supabase = getSupabase();
    const session = await getSession(supabase, id);
    if (!session) return null;
    const [campaign, blocks] = await Promise.all([getCampaign(supabase, session.campaignId, userId), listSessionBlocks(supabase, session.id)]);
    return campaign ? { session, campaign, blocks } : null;
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.campaign.role !== 'gm') {
    return (
      <Screen>
        <EmptyState title="Sem acesso" description="Só os mestres editam sessões." />
      </Screen>
    );
  }
  const { session, campaign, blocks } = data;
  const canManage = campaign.status === 'active';
  const initialDate = isoToBrasilia(session.scheduledAt);
  const form = meta ?? { title: session.title, date: initialDate.date, time: initialDate.time, published: session.isPublished, recap: session.recap };

  const saveMeta = async () => {
    const scheduledAt = brasiliaToIso(form.date, form.time);
    const parsed = sessionUpdateSchema.safeParse({ title: form.title, scheduledAt: scheduledAt === undefined ? 'data-invalida' : scheduledAt, isPublished: form.published, recap: form.recap });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const supabase = getSupabase();
      await updateSession(supabase, session.id, session.version, parsed.data);
      toast({ tone: 'success', title: 'Sessão salva.' });
      if (parsed.data.isPublished && parsed.data.scheduledAt) {
        const result = await notifySessionScheduled(supabase, session.id);
        if (result && result.sent > 0) toast({ tone: 'success', title: `Aviso enviado a ${result.sent} ${result.sent === 1 ? 'aparelho' : 'aparelhos'} da mesa.` });
      }
      setMeta(null);
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title: 'A sessão não foi salva', description: failureMessage(cause) });
      reload();
    } finally {
      setBusy(false);
    }
  };

  const run = async (title: string, action: () => Promise<unknown>) => {
    try {
      await action();
      reload();
    } catch (cause) {
      toast({ tone: 'danger', title, description: failureMessage(cause) });
      reload();
    }
  };

  const addBlock = (type: SessionBlockType) =>
    run('O bloco não foi criado', async () => {
      setAdding(false);
      const last = blocks[blocks.length - 1]?.position ?? null;
      const created = await createSessionBlock(getSupabase(), {
        sessionId: session.id,
        campaignId: campaign.id,
        position: positionBetween(last, null),
        visibility: defaultVisibilityFor(type),
        content: createBlockContent(type),
      });
      if (created.content) setEditing({ id: created.id, content: created.content });
    });

  const saveBlock = (block: StoredSessionBlock, content: SessionBlockContent) =>
    run('O bloco não foi salvo', async () => {
      const parsed = sessionBlockContentSchema.parse(content);
      await updateSessionBlock(getSupabase(), block.id, { content: parsed });
      setEditing(null);
    });

  const move = (index: number, direction: -1 | 1) =>
    run('A ordem não mudou', async () => {
      const reordered = moveItem(blocks, index, index + direction);
      mutate((current) => (current ? { ...current, blocks: reordered } : current));
      await reorderSessionBlocks(getSupabase(), session.id, reordered.map((block) => block.id));
    });

  const remove = async (block: StoredSessionBlock) => {
    const ok = await confirm({ title: 'Excluir o bloco?', message: preview(block.content).slice(0, 120), confirmLabel: 'Excluir', tone: 'danger' });
    if (ok) await run('O bloco não foi excluído', () => deleteSessionBlock(getSupabase(), block.id));
  };

  return (
    <Screen eyebrow={campaign.name} title={`Sessão ${session.number}`} subtitle="Editar" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Editar sessão' }} />
      <Card>
        <Field label="Título" value={form.title} maxLength={120} editable={canManage} onChangeText={(title) => setMeta({ ...form, title })} error={errors.title} />
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <View style={{ flex: 3 }}>
            <Field label="Data" value={form.date} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" editable={canManage} onChangeText={(date) => setMeta({ ...form, date })} error={errors.scheduledAt} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Hora" value={form.time} placeholder="19:00" keyboardType="numbers-and-punctuation" editable={canManage} onChangeText={(time) => setMeta({ ...form, time })} />
          </View>
        </View>
        <AppText variant="small">Horário de Brasília.</AppText>
        <CheckRow
          label="Publicada para os jogadores"
          description="Com data marcada, quem usa o app recebe um aviso."
          checked={form.published}
          disabled={!canManage}
          onChange={(published) => setMeta({ ...form, published })}
        />
        <Field label="Resumo para os jogadores" value={form.recap} multiline maxLength={20000} editable={canManage} onChangeText={(recap) => setMeta({ ...form, recap })} error={errors.recap} />
        {canManage ? <Button label="Salvar sessão" loading={busy} disabled={meta === null} onPress={() => void saveMeta()} /> : null}
      </Card>

      <AppText variant="heading">Roteiro</AppText>
      {blocks.length === 0 ? <AppText variant="muted">Nenhum bloco ainda.</AppText> : null}
      {blocks.map((block, index) => {
        const isEditing = editing?.id === block.id;
        const type = block.content?.type;
        const editable = type ? EDITABLE.includes(type) : false;
        return (
          <View key={block.id} style={[styles.block, block.visibility === 'gm' && styles.private]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Badge label={type ? blockTypeLabels[type] : 'Bloco'} />
                {block.visibility === 'gm' ? <Badge label="Só mestres" tone="brand" /> : null}
              </View>
              {canManage ? (
                <>
                  <IconButton icon={<ArrowUp size={16} color={colors.fgSecondary} />} accessibilityLabel="Subir bloco" disabled={index === 0} onPress={() => void move(index, -1)} />
                  <IconButton icon={<ArrowDown size={16} color={colors.fgSecondary} />} accessibilityLabel="Descer bloco" disabled={index === blocks.length - 1} onPress={() => void move(index, 1)} />
                  {type && !isAlwaysPrivate(type) ? (
                    <IconButton
                      icon={block.visibility === 'gm' ? <EyeOff size={16} color={colors.warning} /> : <Eye size={16} color={colors.fgSecondary} />}
                      accessibilityLabel={block.visibility === 'gm' ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                      onPress={() => void run('A visibilidade não mudou', () => updateSessionBlock(getSupabase(), block.id, { visibility: block.visibility === 'gm' ? 'members' : 'gm' }))}
                    />
                  ) : null}
                  <IconButton icon={<Trash2 size={16} color={colors.fgSecondary} />} accessibilityLabel="Excluir bloco" onPress={() => void remove(block)} />
                </>
              ) : null}
            </View>
            {isEditing && editing ? (
              <View style={{ gap: spacing[2] }}>
                <BlockEditor content={editing.content} onChange={(content) => setEditing({ id: block.id, content })} />
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <Button label="Cancelar" variant="ghost" compact onPress={() => setEditing(null)} style={{ flex: 1 }} />
                  <Button label="Salvar bloco" compact onPress={() => void saveBlock(block, editing.content)} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <AppText variant={type === 'heading' || type === 'subheading' ? 'heading' : 'body'} numberOfLines={6} onPress={canManage && editable && block.content ? () => setEditing({ id: block.id, content: block.content as SessionBlockContent }) : undefined}>
                {preview(block.content)}
              </AppText>
            )}
          </View>
        );
      })}
      {canManage ? (
        adding ? (
          <Card>
            <AppText variant="muted">Que tipo de bloco?</AppText>
            <ChipRow>
              {EDITABLE.map((type) => (
                <Chip key={type} role="button" label={blockTypeLabels[type]} selected={false} onPress={() => void addBlock(type)} />
              ))}
            </ChipRow>
            <Button label="Cancelar" variant="ghost" compact onPress={() => setAdding(false)} />
          </Card>
        ) : (
          <Button label="Adicionar bloco" variant="secondary" icon={<Plus size={16} color={colors.fg} />} onPress={() => setAdding(true)} />
        )
      ) : null}
      <AppText variant="small" style={{ color: colors.fgMuted }}>
        Toque no texto de um bloco para editá-lo. Imagens, listas de tarefas e referências são editadas no site.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[2], padding: spacing[3], borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  private: { borderStyle: 'dashed', borderColor: 'rgba(176, 74, 96, 0.6)' },
});
