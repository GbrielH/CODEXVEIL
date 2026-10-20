import { grantCharacterLevel } from '@codexveil/database';
import { TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export interface LevelGateInfo {
  inCampaign: boolean;
  isGm: boolean;
  isOwner: boolean;
  /** Nível liberado pelo mestre (campanha). */
  grantedLevel: number;
}

/**
 * Botão de nível da aba Evolução. Na campanha, o mestre libera o próximo nível e o jogador só
 * escolhe as melhorias quando houver nível liberado; fora dela, quem edita a ficha sobe direto.
 */
export function LevelGate({
  characterId,
  characterName,
  level,
  canEditSheet,
  gate,
  onLevelUp,
}: {
  characterId: string;
  characterName: string;
  level: number;
  canEditSheet: boolean;
  gate: LevelGateInfo;
  onLevelUp: () => void;
}) {
  const toast = useToast();
  const [granted, setGranted] = useState(gate.grantedLevel);
  const [busy, setBusy] = useState(false);
  if (level >= 20) return <AppText variant="small">Nível máximo.</AppText>;

  const levelUpButton = (
    <Button
      label="Subir de nível"
      icon={<TrendingUp size={16} color={colors.primaryFg} />}
      onPress={onLevelUp}
    />
  );

  if (!gate.inCampaign) return canEditSheet ? levelUpButton : null;
  const pending = granted > level;
  if (gate.isGm) {
    if (pending)
      return (
        <AppText variant="small">
          Nível {granted} liberado: aguardando o jogador escolher as melhorias.
        </AppText>
      );
    return (
      <Button
        label={`Liberar nível ${level + 1}`}
        loading={busy}
        icon={<TrendingUp size={16} color={colors.primaryFg} />}
        onPress={async () => {
          setBusy(true);
          try {
            setGranted(await grantCharacterLevel(getSupabase(), characterId));
            toast({ tone: 'success', title: `Nível ${level + 1} liberado para ${characterName}.` });
          } catch (error) {
            toast({
              tone: 'danger',
              title: 'O nível não foi liberado',
              description: failureMessage(error),
            });
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  if (!gate.isOwner) return null;
  if (!pending) return <AppText variant="small">O mestre libera o próximo nível.</AppText>;
  return (
    <>
      <AppText variant="small">O mestre liberou o nível {granted}: escolha as melhorias.</AppText>
      {levelUpButton}
    </>
  );
}
