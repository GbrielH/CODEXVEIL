import { getCampaignDicePalette, setMyDiceColor } from '@codexveil/database';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';

export const DICE_COLORS = [
  '#7a1f2b',
  '#b23a48',
  '#d98e04',
  '#2f7d4a',
  '#1f6f8b',
  '#3b4cb8',
  '#6b3fa0',
  '#c2c2c8',
  '#222226',
  '#c46a2a',
  '#d4568c',
  '#5a8f29',
];

/** Cores dos dados da mesa (em tempo real) e a cor de cada personagem, pelo dono. */
export function useDicePalette(campaignId: string) {
  const userId = useUserId();
  const { data, reload, mutate } = useAsyncData(
    () => getCampaignDicePalette(getSupabase(), campaignId),
    `paleta:${campaignId}`,
  );
  useRealtimeRefresh(
    `cores-dados:${campaignId}`,
    [{ table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` }],
    reload,
  );
  const members = data?.members ?? [];
  const me = members.find((member) => member.userId === userId);
  const colorOfUser = (id: string | null | undefined) =>
    id ? (members.find((member) => member.userId === id)?.color ?? null) : null;
  return {
    loaded: data !== null,
    userId,
    myColor: me?.color ?? null,
    isGm: me?.role === 'gm',
    gmReady: members.some((member) => member.role === 'gm' && member.color),
    taken: new Set(
      members
        .filter((member) => member.userId !== userId && member.color)
        .map((member) => member.color!.toLowerCase()),
    ),
    colorOfCharacter: (id: string | null | undefined) =>
      id && data ? colorOfUser(data.characterOwners[id]) : null,
    setLocal: (color: string) =>
      mutate((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.userId === userId ? { ...member, color } : member,
        ),
      })),
    reload,
  };
}

/** Bolinha com a cor do dono do personagem (ao lado do nome). */
export function ColorDot({ color }: { color: string | null }) {
  if (!color) return null;
  return <View accessibilityElementsHidden style={[styles.dot, { backgroundColor: color }]} />;
}

/**
 * Cor dos dados: obrigatória para rolar. O mestre escolhe primeiro; cada cor é de uma pessoa.
 * Com a cor já escolhida, mostra a atual e permite trocar.
 */
export function DiceColorCard({ campaignId }: { campaignId: string }) {
  const toast = useToast();
  const palette = useDicePalette(campaignId);
  if (!palette.loaded) return null;
  const waiting = !palette.isGm && !palette.gmReady && !palette.myColor;

  const choose = async (color: string) => {
    try {
      await setMyDiceColor(getSupabase(), campaignId, color);
      palette.setLocal(color);
    } catch (cause) {
      toast({ tone: 'danger', title: 'A cor não foi salva', description: failureMessage(cause) });
      palette.reload();
    }
  };

  return (
    <Card style={!palette.myColor ? { borderColor: colors.parchmentEdge } : undefined}>
      <AppText variant="eyebrow">
        {palette.myColor
          ? 'Cor dos seus dados'
          : waiting
            ? 'Aguardando o mestre escolher a cor'
            : 'Escolha a cor dos seus dados'}
      </AppText>
      <AppText variant="small">
        {waiting
          ? 'O mestre escolhe primeiro; depois você escolhe a sua. Sem cor não é possível rolar dados.'
          : palette.myColor
            ? 'Aparece nos seus dados e no nome do seu personagem para toda a mesa.'
            : 'Obrigatório para rolar. A cor aparece nos seus dados e no nome do seu personagem.'}
      </AppText>
      {waiting ? null : (
        <View
          style={styles.row}
          accessibilityRole="radiogroup"
          accessibilityLabel="Cor dos seus dados"
        >
          {DICE_COLORS.map((color) => {
            const taken = palette.taken.has(color.toLowerCase());
            const current = color === palette.myColor;
            return (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityState={{ checked: current, disabled: taken }}
                accessibilityLabel={taken ? `Cor ${color}, já escolhida` : `Cor ${color}`}
                disabled={taken}
                onPress={() => void choose(color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  current && styles.current,
                  taken && { opacity: 0.2 },
                ]}
              />
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  current: { borderWidth: 3, borderColor: colors.fgAccent },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)' },
});
