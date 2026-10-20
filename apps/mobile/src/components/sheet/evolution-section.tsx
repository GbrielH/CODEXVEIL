import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Card } from '@/components/ui/primitives';
import { spacing } from '@/lib/theme';
import { useSheet } from './context';
import { LevelGate, type LevelGateInfo } from './level-gate';
import { LevelUpModal } from './level-up';

/** Aba Evolução da ficha de D&D: nível atual e a subida de nível (liberada pelo mestre na campanha). */
export function EvolutionSection({ characterName, gate }: { characterName: string; gate: LevelGateInfo }) {
  const { characterId, sheet, derived, canEditSheet } = useSheet();
  const [levelUp, setLevelUp] = useState(false);
  return (
    <View style={{ gap: spacing[4] }}>
      <Card>
        <AppText variant="heading">Evolução</AppText>
        <AppText>
          Nível {derived.level} · {sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ')}
        </AppText>
        <AppText variant="small">
          {gate.inCampaign ? 'Na campanha, o mestre libera o próximo nível e você escolhe as melhorias aqui.' : 'Suba de nível escolhendo as melhorias do nível novo.'}
        </AppText>
        <LevelGate characterId={characterId} characterName={characterName} level={derived.level} canEditSheet={canEditSheet} gate={gate} onLevelUp={() => setLevelUp(true)} />
        <LevelUpModal visible={levelUp} onClose={() => setLevelUp(false)} />
      </Card>
    </View>
  );
}
