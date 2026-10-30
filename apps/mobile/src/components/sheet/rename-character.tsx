import { saveCharacterSheet } from '@codexveil/database';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

/** Nome do personagem no topo da ficha: toque no lápis para renomear (quem edita a ficha). */
export function CharacterName({
  characterId,
  name,
  version,
  canEdit,
  onRenamed,
}: {
  characterId: string;
  name: string;
  version: number;
  canEdit: boolean;
  onRenamed: (name: string, version: number) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveCharacterSheet(getSupabase(), characterId, version, { name: next });
      onRenamed(next, saved.version);
      setEditing(false);
      toast({ tone: 'success', title: 'Nome alterado.' });
    } catch (error) {
      toast({ tone: 'danger', title: failureMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (editing)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={80}
          autoFocus
          accessibilityLabel="Nome do personagem"
          onSubmitEditing={() => void save()}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radii.md,
            paddingHorizontal: spacing[2],
            paddingVertical: 6,
            color: colors.fg,
            fontFamily: fonts.display,
            fontSize: 20,
          }}
        />
        <Button compact label="Salvar" loading={busy} onPress={() => void save()} />
      </View>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
      <AppText variant="title" style={{ flexShrink: 1 }}>
        {name}
      </AppText>
      {canEdit ? (
        <Pressable
          onPress={() => {
            setDraft(name);
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Renomear personagem"
          hitSlop={12}
        >
          <Pencil size={18} color={colors.fgMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
