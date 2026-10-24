import type { CharacterItem } from '@codexveil/database';
import { RageGlow } from '@/components/sheet/rage-glow';
import { d20Expression, type DiceRollMode } from '@codexveil/domain';
import {
  formatT20Bonus,
  resolveT20Attack,
  t20GripLabels,
  t20RageMaxBonus,
  t20WeaponStats,
  type T20Content,
  type T20Derived,
  type T20Sheet,
} from '@codexveil/rpg-systems/tormenta20';
import { Pressable, View } from 'react-native';
import { RollButton } from '@/components/dice/dice';
import { AppText, Card } from '@/components/ui/primitives';
import { useRage } from '@/lib/active-effects';
import { colors, fonts } from '@/lib/theme';

/** Ataques das armas equipadas e Fúria (Tormenta20), com os mesmos cálculos do site. */
export function T20Attacks({
  characterId,
  sheet,
  derived,
  items,
  content,
  mode,
  canAct,
}: {
  characterId: string;
  sheet: T20Sheet;
  derived: T20Derived;
  items: readonly CharacterItem[];
  content: T20Content | null;
  mode: DiceRollMode;
  canAct: boolean;
}) {
  const [rage, setRage] = useRage(characterId);
  const rageMax = t20RageMaxBonus(sheet);
  const activeRage = Math.min(rage, rageMax);
  const weapons = items
    .filter((item) => item.isEquipped && item.category === 'weapon')
    .map((item) => ({ item, stats: t20WeaponStats(item.name, item.description, content) }));
  const shieldEquipped = items.some((item) => item.isEquipped && /escudo/i.test(item.name));

  return (
    <Card>
      <AppText style={{ fontFamily: fonts.display, fontSize: 18, color: colors.fg }}>
        Ataques
      </AppText>
      {rageMax > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            borderColor: activeRage ? '#F87171' : colors.line,
            backgroundColor: activeRage ? 'rgba(239,68,68,0.15)' : 'transparent',
          }}
        >
          {activeRage ? <RageGlow /> : null}
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: fonts.display, color: colors.fg }}>
              {activeRage ? `Em Fúria (+${activeRage})` : 'Fúria'}
            </AppText>
            <AppText variant="small">
              2 PM: +2 no ataque e no dano corpo a corpo; +1 PM a cada cinco níveis aumenta (máx. +
              {rageMax}).
            </AppText>
          </View>
          <Pressable
            disabled={!canAct || activeRage === 0}
            onPress={() => setRage(activeRage <= 2 ? 0 : activeRage - 1)}
            accessibilityLabel="Diminuir a Fúria"
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 8,
              opacity: !canAct || activeRage === 0 ? 0.4 : 1,
            }}
          >
            <AppText>−</AppText>
          </Pressable>
          <Pressable
            disabled={!canAct || activeRage >= rageMax}
            onPress={() => setRage(activeRage === 0 ? 2 : activeRage + 1)}
            accessibilityLabel={activeRage ? 'Aumentar a Fúria' : 'Entrar em Fúria'}
            style={{
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 8,
              opacity: !canAct || activeRage >= rageMax ? 0.4 : 1,
            }}
          >
            <AppText>{activeRage ? '+' : 'Entrar'}</AppText>
          </Pressable>
        </View>
      ) : null}
      {weapons.length === 0 ? (
        <AppText variant="muted">
          Nenhuma arma equipada. Equipe uma arma no inventário para atacar com ela.
        </AppText>
      ) : (
        weapons.map(({ item, stats }) => {
          if (!stats) {
            return (
              <View key={item.id} style={{ gap: 2 }}>
                <AppText style={{ color: colors.fg }}>{item.name}</AppText>
                <AppText variant="small">
                  Sem o dano desta arma: escolha-a do livro no site ou escreva na descrição
                  &quot;Dano 1d8 · Crítico 19/x3&quot;.
                </AppText>
              </View>
            );
          }
          const attack = resolveT20Attack(stats, sheet, derived, {
            rage: activeRage,
            offHandBusy: shieldEquipped || weapons.length > 1,
          });
          const critLabel = `${attack.critMargin}/x${attack.critMultiplier}`;
          return (
            <View key={item.id} style={{ gap: 6 }}>
              <View>
                <AppText style={{ color: colors.fg }}>{item.name}</AppText>
                <AppText variant="small">
                  {[
                    stats.damage,
                    stats.damageType,
                    stats.grip ? t20GripLabels[stats.grip] : '',
                    stats.kind === 'ranged'
                      ? 'disparo'
                      : stats.kind === 'thrown'
                        ? 'arremesso'
                        : 'corpo a corpo',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  {
                    key: 'acerto',
                    title: 'Acerto',
                    expression: d20Expression(attack.toHit),
                    value: formatT20Bonus(attack.toHit),
                    color: colors.fgAccent,
                    label: `Ataque: ${item.name}`,
                    mode,
                  },
                  {
                    key: 'dano',
                    title: 'Dano',
                    expression: attack.damage,
                    value: attack.damage,
                    color: '#EC9384',
                    label: `Dano: ${item.name}`,
                    mode: 'normal' as const,
                  },
                  {
                    key: 'critico',
                    title: `Crítico (${critLabel})`,
                    expression: attack.critical,
                    value: attack.critical,
                    color: '#E6BE74',
                    label: `Dano crítico: ${item.name}`,
                    mode: 'normal' as const,
                  },
                ].map((roll) => (
                  <RollButton
                    key={roll.key}
                    expression={roll.expression}
                    label={roll.label}
                    mode={roll.mode}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={{
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.line,
                        borderRadius: 8,
                        paddingVertical: 6,
                      }}
                    >
                      <AppText variant="small" style={{ fontSize: 11 }}>
                        {roll.title}
                      </AppText>
                      <AppText variant="number" style={{ color: roll.color }}>
                        {roll.value}
                      </AppText>
                    </View>
                  </RollButton>
                ))}
              </View>
              <AppText variant="small" style={{ fontSize: 11 }}>
                Automático: {attack.notes.join(' · ')}
              </AppText>
            </View>
          );
        })
      )}
    </Card>
  );
}
